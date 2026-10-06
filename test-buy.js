// Buy-flow integration test — boots the REAL server.js in-process (pg-mem) and
// seeds a user + session straight into db.q, because register/login need Supabase OTP.
// Usage: node test-buy.js
process.env.PORT = process.env.PORT || '3951';
process.env.SILENT_MEM = '1';

const { q } = require('./db');
require('./server.js');

const BASE = 'http://localhost:' + process.env.PORT;
let passed = 0, failed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ok  ' + name); } else { failed++; console.log('  FAIL ' + name); } };

const jar = { sid: null };
async function call(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (jar.sid) headers.Cookie = 'rv_sid=' + jar.sid;
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let data = null; const t = await res.text();
  try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
  return { status: res.status, data };
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch (e) {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
}

async function stock(id) { return Number((await q('SELECT stock FROM products WHERE id=$1', [id])).rows[0].stock); }

(async () => {
  try {
    await waitReady();
    ok(true, 'server booted (in-process, pg-mem)');

    // seed buyer + session directly
    const uid = 'test-buy-user';
    await q('DELETE FROM sessions WHERE user_id=$1', [uid]);
    await q('DELETE FROM users WHERE id=$1', [uid]);
    await q('INSERT INTO users (id,email,name,role,created_at) VALUES ($1,$2,$3,$4,$5)',
      [uid, 'buyer@example.com', 'Buy Tester', 'user', Date.now()]);
    jar.sid = 'testbuy-' + Date.now();
    await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
      [jar.sid, uid, Date.now() + 3600e3]);
    ok(true, 'user + session seeded');

    // put product 1 on sale
    await q('UPDATE products SET for_sale=TRUE, sale_price=5999, stock=2 WHERE id=1', []);
    let r = await call('GET', '/api/products');
    const p1 = r.data.products.find(p => p.id === 1);
    ok(r.status === 200 && p1 && p1.for_sale === true && p1.sale_price === 5999, 'product API exposes for_sale + sale_price');

    // unauthenticated rejected
    const saved = jar.sid; jar.sid = null;
    r = await call('POST', '/api/orders', { items: [{ productId: 1, qty: 1, type: 'buy' }], name: 'X', email: 'x@y.co' });
    jar.sid = saved;
    ok(r.status === 401, 'buy order without session -> 401');

    // happy path: buy 2
    r = await call('POST', '/api/orders', {
      items: [{ productId: 1, name: p1.name, qty: 2, type: 'buy' }],
      name: 'Buy Tester', email: 'buyer@example.com', phone: '0987654321', addr: 'Main Rd', city: 'Mainpuri', zip: '205001'
    });
    ok(r.status === 200 && r.data.ids.length === 1, 'buy order placed');
    const buyId = r.data.ids[0];

    const row = (await q('SELECT * FROM orders WHERE id=$1', [buyId])).rows[0];
    ok(row && row.type === 'buy', 'order row type = buy');
    ok(row.dates === 'Purchase' && row.start_date === '' && row.end_date === '', "dates = 'Purchase', no rent dates");
    ok(Number(row.total) === 5999 * 2, 'total = sale_price * qty (11998)');
    ok(await stock(1) === 0, 'stock 2 -> 0 after buying 2');

    // stock guard
    r = await call('POST', '/api/orders', { items: [{ productId: 1, qty: 1, type: 'buy' }], name: 'B', email: 'buyer@example.com' });
    ok(r.status === 409, 'buy over stock -> 409');

    // not-for-sale rejected
    r = await call('POST', '/api/orders', { items: [{ productId: 2, qty: 1, type: 'buy' }], name: 'B', email: 'buyer@example.com' });
    ok(r.status === 400, 'buy of non-sale product -> 400');

    // appears in my orders
    r = await call('GET', '/api/orders');
    ok(r.status === 200 && r.data.orders.some(o => o.id === buyId && o.type === 'buy'), 'my orders list shows buy order');

    // cancel restores stock, idempotent
    r = await call('POST', '/api/orders/' + buyId + '/cancel');
    ok(r.status === 200 && r.data.ok === true, 'cancel buy order ok');
    ok(await stock(1) === 2, 'cancel restores stock 0 -> 2');
    r = await call('POST', '/api/orders/' + buyId + '/cancel');
    ok(r.status === 200 && await stock(1) === 2, 'second cancel does not double-restore');

    // rent order still works and does not touch stock
    const s3 = await stock(3);
    r = await call('POST', '/api/orders', {
      items: [{ productId: 3, name: 'Rent Piece', qty: 1, type: 'rent', startDate: '2027-03-10', endDate: '2027-03-12' }],
      name: 'Buy Tester', email: 'buyer@example.com', phone: '0987654321', addr: 'Main Rd', city: 'Mainpuri', zip: '205001'
    });
    ok(r.status === 200 && r.data.ids.length === 1, 'rent order still works');
    const rentRow = (await q('SELECT * FROM orders WHERE id=$1', [r.data.ids[0]])).rows[0];
    ok(rentRow.type === 'rent' && Number(rentRow.total) > 0, 'rent order type + total correct');
    ok(await stock(3) === s3, 'rent does not change stock');

    // cart round-trip with a buy line
    r = await call('PUT', '/api/me/cart', [{ id: 1, type: 'buy', qty: 1, name: p1.name, price: 5999 }]);
    ok(r.status === 200, 'save cart with buy line');
    r = await call('GET', '/api/me/cart');
    ok(r.data.cart.length === 1 && r.data.cart[0].type === 'buy', 'cart keeps type=buy');

    // ===== user blocking (admin omniscience task) =====
    const admin = 'test-admin-user';
    await q('DELETE FROM sessions WHERE user_id=$1', [admin]);
    await q('DELETE FROM users WHERE id=$1', [admin]);
    await q('INSERT INTO users (id,email,name,role,created_at) VALUES ($1,$2,$3,$4,$5)',
      [admin, 'admin@example.com', 'Owner', 'admin', Date.now()]);
    jar.sid = 'testadmin-' + Date.now();
    await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
      [jar.sid, admin, Date.now() + 3600e3]);
    const adminTok = jar.sid;

    r = await call('GET', '/api/admin/users');
    ok(r.status === 200 && r.data.users.some(u => u.id === uid && u.blocked === false), 'admin user list exposes blocked:false');

    // non-admin cannot block
    jar.sid = 'testbuy-' + Date.now();
    await q('DELETE FROM sessions WHERE user_id=$1', [uid]);
    await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
      [jar.sid, uid, Date.now() + 3600e3]);
    r = await call('POST', '/api/admin/users/' + uid + '/block');
    ok(r.status === 403, 'non-admin block attempt -> 403');

    jar.sid = adminTok;
    r = await call('POST', '/api/admin/users/' + uid + '/block');
    ok(r.status === 200 && r.data.blocked === true, 'admin blocks user -> {blocked:true}');

    // a session created AFTER blocking still can't authenticate -> middleware reads the flag live
    const blockedTok = 'freshblocked-' + Date.now();
    await q('INSERT INTO sessions (token,user_id,expires_at) VALUES ($1,$2,$3)',
      [blockedTok, uid, Date.now() + 3600e3]);
    jar.sid = blockedTok;
    r = await call('GET', '/api/auth/me');
    ok(r.status === 200 && r.data.user === null, 'blocked user auth session -> user null (flag, not just wipe)');
    r = await call('POST', '/api/orders', { items: [{ productId: 3, qty: 1, type: 'rent', startDate: '2027-04-01', endDate: '2027-04-02' }], name: 'Buy Tester', email: 'buyer@example.com' });
    ok(r.status === 401, 'blocked user order -> 401');

    jar.sid = adminTok;
    r = await call('POST', '/api/admin/users/' + uid + '/block');
    ok(r.status === 200 && r.data.blocked === false, 'admin unblocks -> {blocked:false}');
    jar.sid = blockedTok;
    r = await call('GET', '/api/auth/me');
    ok(r.status === 200 && r.data.user && r.data.user.email === 'buyer@example.com', 'unblocked user works again');
  } catch (e) {
    failed++;
    console.log('FAIL test-buy crashed: ' + e.message);
  }
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();
