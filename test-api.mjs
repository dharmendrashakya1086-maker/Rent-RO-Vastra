// API integration test — runs the REAL server.js on an in-memory Postgres (pg-mem).
// Usage: npm test
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';
const sha256 = s => createHash('sha256').update(s).digest('hex');

const PORT = 3947;
const BASE = 'http://localhost:' + PORT;
let passed = 0, failed = 0;

function ok(cond, name) {
  if (cond) { passed++; console.log('  ok  ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}

const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
server.stdout.on('data', d => { out += d; });

async function waitReady() {
  for (let i = 0; i < 50; i++) {
    if (out.includes('live at')) return;
    if (server.exitCode != null) throw new Error('server exited early: ' + server.stderr._aabb);
    await sleep(100);
  }
  throw new Error('server did not start: ' + out);
}

let jar = {};
function cookies(res) { return (res.headers.get('set-cookie') || '').split(',').map(c => c.split(';')[0]).filter(Boolean); }
async function call(method, url, body, authed) {
  const headers = { 'Content-Type': 'application/json' };
  if (authed && jar.jws) headers['Cookie'] = jar.jws;
  const res = await fetch(BASE + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const cs = cookies(res);
  if (cs.length) jar.jws = cs[0];
  let data = null;
  const t = await res.text();
  try { data = t ? JSON.parse(t) : null; } catch (e) { data = t; }
  return { status: res.status, data };
}

try {
  await waitReady();
  console.log('boot ok');

  let r = await call('GET', '/api/products');
  ok(r.status === 200 && r.data.products.length === 12, 'seeded 12 products');

  r = await call('POST', '/api/auth/register', { name: 'Priya Sharma', email: 'priya@example.com', password: 'secret123' });
  ok(r.status === 200 && r.data.user && r.data.user.email === 'priya@example.com', 'register sets user + cookie');

  r = await call('GET', '/api/auth/me', undefined, true);
  ok(r.status === 200 && r.data.user && r.data.user.email === 'priya@example.com', 'me returns signed-in user');

  r = await call('PUT', '/api/me/cart', [{ id: 1, name: 'x', qty: 1, days: 2, startDate: '2026-10-10', endDate: '2026-10-12' }], true);
  ok(r.status === 200, 'save cart');
  r = await call('GET', '/api/me/cart', undefined, true);
  ok(r.data.cart.length === 1, 'read cart');

  r = await call('POST', '/api/orders', { items: [{ productId: 1, name: 'Sabyasachi Silk Lehenga', qty: 1, days: 2, startDate: '2026-10-10', endDate: '2026-10-12', price: 7499 }], name: 'Priya Sharma', email: 'priya@example.com', phone: '0987654321', addr: 'Main Rd', city: 'Mainpuri', zip: '205001' }, true);
  ok(r.status === 200 && r.data.ids.length === 1, 'place order');

  r = await call('GET', '/api/stock/check?productId=1&startDate=2026-10-10&endDate=2026-10-12');
  ok(r.status === 200 && r.data.available === 2 && r.data.total === 3, 'availability drops to 2 after booking');

  r = await call('GET', '/api/stock/check?productId=1&startDate=2026-11-10&endDate=2026-11-12');
  ok(r.status === 200 && r.data.available === 3, 'buffer window: outside 10-day window is free');

  r = await call('POST', '/api/orders', { items: [{ productId: 1, name: 'Sabyasachi Silk Lehenga', qty: 3, days: 1, startDate: '2026-10-11', endDate: '2026-10-12', price: 7499 }], name: 'Priya', email: 'priya@example.com' }, true);
  ok(r.status === 409, 'over-booking rejected with 409');

  r = await call('POST', '/api/auth/login', { email: 'priya@example.com', password: 'wrong' });
  ok(r.status === 401, 'wrong password rejected');

  r = await call('GET', '/api/orders', undefined, true);
  ok(r.data.orders.length === 1 && r.data.orders[0].status === 'Pending', 'orders listed for owner');
  const orderId = r.data.orders[0].id;

  r = await call('POST', '/api/auth/logout', undefined, true);
  r = await call('GET', '/api/auth/me', undefined, true);
  ok(r.data.user === null, 'logout clears session');

  r = await call('POST', '/api/auth/login', { email: 'admin@rentro-vastra.in', password: 'luxe123' });
  ok(r.status === 200 && r.data.user.role === 'admin', 'seeded admin logs in');

  r = await call('PUT', '/api/admin/orders/' + orderId, { status: 'Confirmed' }, true);
  ok(r.status === 200, 'admin confirms order');
  r = await call('GET', '/api/admin/users', undefined, true);
  ok(r.data.users.length >= 1, 'admin lists users');

  r = await call('POST', '/api/reviews', { type: 'site', rating: 5, text: 'Great lehenga!' }, true);
  ok(r.status === 200, 'user posts review');
  r = await call('GET', '/api/reviews?type=site');
  ok(r.data.reviews.some(x => x.text === 'Great lehenga!'), 'review visible publicly');

  r = await call('POST', '/api/messages', { to: 'admin', body: 'When is my order shipped?' }, true);
  ok(r.status === 200, 'user messages admin');
  r = await call('POST', '/api/admin/messages/0', { body: 'Confirmed! Arrives tomorrow.' }, true);
  r = await call('GET', '/api/messages', undefined, true);
  ok(r.data.messages.length >= 2, 'admin reply (broadcast) reaches user');

  // migrate: a legacy sha256-hashed user + order
  r = await call('POST', '/api/migrate', {
    users: [{ email: 'legacy@old.com', first: 'Legacy', last: 'Guy', pass: sha256('legacypass'), created: 12345 }],
    products: [{ id: 13, name: 'Legacy Piece', category: 'evening', price: 4000, stock: 1, active: true, img: 'x.jpg', images: [] }]
  }, true);
  ok(r.status === 200 && r.data.imported.users === 1 && r.data.imported.products === 1, 'migrate imports legacy user + product');

  r = await call('POST', '/api/auth/login', { email: 'legacy@old.com', password: 'legacypass' });
  ok(r.status === 200, 'legacy sha256 user can log in (hash upgraded)');

  r = await call('POST', '/api/ai', { cfg: { provider: 'gemini', key: '' }, system: 'x', text: 'hi' });
  ok(r.status === 200 && r.data.text === null, 'ai proxy answers gracefully with no key');

  r = await call('GET', '/catalog.html');
  ok(r.status === 200 && String(r.data).includes('Collection'), 'static site served');
} catch (e) {
  failed++;
  console.error('TEST CRASH:', e.message);
} finally {
  server.kill();
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);