// Rent-RO-Vastra backend: Express + Postgres + server-side AI proxy.
// Routes /api/* answer JSON. All other requests get the static site.
// Local: `node server.js` (page-mem Postgres, no install). Production: DATABASE_URL -> Postgres (Render).
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const { q, migrate } = require('./db');
const SEED_PRODUCTS = require('./seed');

// Supabase = identity authority (passwords) + Postgres provider.
// Passwords live in Supabase Auth; the users table stores the profile + role,
// and our own sessions table keeps the login cookie (works for OTP users too).
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

const PORT = process.env.PORT || 3010;
const SESSION_COOKIE = 'rv_sid';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@rentro-vastra.in';
const ADMIN_PASS = process.env.ADMIN_PASS || 'luxe123';

// ---------------- helpers ----------------
const now = () => Date.now();
function safeUser(u) { return u ? { id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, created: u.created_at } : null; }

function authReq(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}
function adminReq(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}

function setSession(req, res, user, remember) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expires = now() + 30 * 24 * 3600 * 1000;
  q('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)', [token, user.id, expires]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax',
    maxAge: remember ? 30 * 24 * 3600 * 1000 : undefined,
    secure: req.secure || process.env.NODE_ENV === 'production'
  });
}
function loginUser(req, res, user, remember) { setSession(req, res, user, remember); return safeUser(user); }

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// legacy localStorage product -> db row (same key names as store.js)
function productRow(p) {
  return {
    id: Number(p.id), name: String(p.name || ''), category: String(p.category || ''), gender: String(p.gender || ''),
    occasion: Array.isArray(p.occasion) ? p.occasion.join(',') : String(p.occasion || ''),
    style: Array.isArray(p.style) ? p.style.join(',') : String(p.style || ''),
    budget: String(p.budget || ''), img: String(p.img || ''), images: JSON.stringify(p.images || [p.img].filter(Boolean)),
    price: Math.round(Number(p.price) || 0), stock: Number(p.stock != null ? p.stock : 3),
    active: p.active !== false
  };
}
function productOut(r) {
  const polish = (s) => {
    if (s.includes(',')) return s.split(',').map(x => x.trim()).filter(Boolean).sort();
    return s;
  };
  return {
    id: r.id, name: r.name, category: r.category, gender: r.gender,
    occasion: polish(r.occasion), style: polish(r.style), budget: r.budget,
    img: r.img, images: r.images || [r.img].filter(Boolean),
    price: r.price, stock: r.stock, active: r.active !== false, link: 'detail.html'
  };
}

const dayDiscount = d => d >= 7 ? 0.25 : d >= 3 ? 0.15 : 0;
const rentalTotal = (price, days, qty) => {
  const d = Math.max(days || 1, 1), q = Math.max(qty || 1, 1);
  return price * d * (1 - dayDiscount(d)) * q;
};

// ---------------- data access ----------------
async function allProducts() {
  const r = await q('SELECT * FROM products ORDER BY id');
  return r.rows.map(productOut);
}
async function updateProduct(id, p) {
  const row = productRow(p);
  await q(`INSERT INTO products (id,name,category,gender,occasion,style,budget,img,images,price,stock,active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)
           ON CONFLICT (id) DO UPDATE SET name=$2,category=$3,gender=$4,occasion=$5,style=$6,budget=$7,img=$8,images=$9::jsonb,price=$10,stock=$11,active=$12`,
    [row.id, row.name, row.category, row.gender, row.occasion, row.style, row.budget, row.img, row.images, row.price, row.stock, row.active]);
}
async function bookedQty(productId, startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const shift = (ds, days) => {
    const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };
  const r = await q(`SELECT COALESCE(SUM(qty),0) AS booked FROM orders
                     WHERE product_id=$1 AND status<>'Cancelled' AND start_date<>'' AND end_date<>''
                       AND start_date<=$2 AND end_date>=$3`,
    [Number(productId), shift(endDate, 10), shift(startDate, -10)]);
  const total = (await q('SELECT stock FROM products WHERE id=$1', [Number(productId)])).rows[0];
  const t = total ? total.stock : 0;
  const booked = Number(r.rows[0].booked);
  return { total: t, booked, available: Math.max(0, t - booked), enough: (t - booked) > 0, exists: !!total };
}
const shiftDate = (ds, days) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]; };
function cancelRefund(startDate) {
  if (startDate) {
    const start = new Date(startDate + 'T00:00:00');
    if (start - Date.now() < 48 * 3600 * 1000) return 50;
  }
  return 100;
}

// ---------------- seed on boot ----------------
async function seed() {
  await migrate();
  console.log('Supabase Auth: ' + (sb ? 'connected' : 'NOT configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)'));
  const pcount = (await q('SELECT COUNT(*) AS c FROM products')).rows[0].c;
  if (Number(pcount) === 0) {
    for (const p of SEED_PRODUCTS) await updateProduct(p.id, p);
    console.log('Seeded ' + SEED_PRODUCTS.length + ' products.');
  }
}

// ---------------- middleware: current user ----------------
app.use(async (req, res, next) => {
  try {
    const token = req.cookies && req.cookies[SESSION_COOKIE];
    if (token) {
      const s = (await q('SELECT s.*, u.id AS uid, u.email, u.name, u.phone, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token=$1', [token])).rows[0];
      if (s && s.expires_at > now()) req.user = { id: s.uid, email: s.email, name: s.name, phone: s.phone, role: s.role };
    }
  } catch (e) { /* anonymous */ }
  next();
});

// ---------------- auth ----------------
function authUnavailable(res) { return res.status(503).json({ error: 'Auth not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)' }); }

app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone = '', password } = req.body || {};
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email and password (6+ chars) required' });
  if (!sb) return authUnavailable(res);
  const em = String(email).trim().toLowerCase();
  const dup = await q('SELECT id FROM users WHERE email=$1', [em]);
  if (dup.rows.length) return res.status(409).json({ error: 'Email already registered' });
  const { data, error } = await sb.auth.admin.createUser({ email: em, password, email_confirm: true });
  if (error) {
    const msg = /already|exists/i.test(error.message || '') ? 'Email already registered' : error.message;
    return res.status(409).json({ error: msg });
  }
  const uid = data.user.id;
  const role = em === ADMIN_EMAIL ? 'admin' : 'user';
  await q('INSERT INTO users (id,email,name,phone,role,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
    [uid, em, String(name || ''), phone, role, now()]);
  res.json({ user: loginUser(req, res, { id: uid, email: em, name: String(name || ''), phone, role }, false) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password, remember } = req.body || {};
  if (!sb) return authUnavailable(res);
  const em = String(email || '').trim().toLowerCase();
  const { data, error } = await sb.auth.signInWithPassword({ email: em, password: String(password || '') });
  if (error) return res.status(401).json({ error: 'Invalid email or password' });
  const uid = data.user.id;
  let u = (await q('SELECT * FROM users WHERE id=$1', [uid])).rows[0];
  if (!u) {
    const full = (data.user.user_metadata && data.user.user_metadata.full_name) || '';
    u = (await q('INSERT INTO users (id,email,name,phone,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [uid, em, String(full), '', em === ADMIN_EMAIL ? 'admin' : 'user', now()])).rows[0];
  } else if (u.role !== 'admin' && em === ADMIN_EMAIL) {
    await q('UPDATE users SET role=$1 WHERE id=$2', ['admin', uid]);
    u.role = 'admin';
  }
  res.json({ user: loginUser(req, res, u, !!remember) });
});

// ---- Email OTP auth (Resend) ----
// ponytail: in-memory OTP map; expires in 5 min. Fine for this scale, per-user DB table if rate abuse matters.
const otps = new Map();
app.post('/api/auth/otp/send', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email' });
  const code = String(crypto.randomInt(100000, 1000000));
  otps.set(email, { code, exp: Date.now() + 5 * 60000 });
  const key = process.env.RESEND_KEY;
  if (!key) { otps.delete(email); return res.status(500).json({ error: 'Email service not configured (RESEND_KEY missing)' }); }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'Rent-RO-Vastra <onboarding@resend.dev>',
        to: [email],
        subject: 'Your Rent-RO-Vastra login code',
        html: '<p>Your login code is <b>' + code + '</b>.</p><p>It expires in 5 minutes. If you did not request this, ignore this email.</p>'
      })
    });
    if (!r.ok) throw new Error((await r.text()).slice(0, 200));
    res.json({ sent: true });
  } catch (e) {
    otps.delete(email);
    console.error('OTP send failed:', e.message);
    res.status(500).json({ error: 'Could not send email - check RESEND_KEY and sender address' });
  }
});

app.post('/api/auth/otp/verify', async (req, res) => {
  const email = String((req.body || {}).email || '').trim().toLowerCase();
  const code = String((req.body || {}).code || '').trim();
  const rec = otps.get(email);
  if (!rec || rec.exp < Date.now() || rec.code !== code) return res.status(401).json({ error: 'Invalid or expired code' });
  otps.delete(email);
  let u = (await q('SELECT * FROM users WHERE email=$1', [email])).rows[0];
  if (!u) {
    // ponytail: OTP-only user has no Supabase password (they use codes to get in).
    u = (await q('INSERT INTO users (id,email,name,phone,role,created_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      ['otp-' + sha256(email).slice(0, 24), email, email.split('@')[0], '', 'user', now()])).rows[0];
  }
  res.json({ user: loginUser(req, res, u, true) });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => res.json({ user: safeUser(req.user) }));

app.patch('/api/me', authReq, async (req, res) => {
  const { name, phone } = req.body || {};
  const upd = [];
  const params = [];
  if (name != null) { upd.push('name=$' + (upd.length + 1)); params.push(String(name)); }
  if (phone != null) { upd.push('phone=$' + (upd.length + 1)); params.push(String(phone)); }
  if (upd.length) {
    params.push(req.user.id);
    await q('UPDATE users SET ' + upd.join(',') + ' WHERE id=$' + params.length, params);
  }
  const u = (await q('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
  res.json({ user: safeUser(u) });
});

app.delete('/api/me', authReq, async (req, res) => {
  await q('DELETE FROM sessions WHERE user_id=$1', [req.user.id]);
  await q('DELETE FROM users WHERE id=$1', [req.user.id]);
  if (sb && !req.user.id.startsWith('otp-')) sb.auth.admin.deleteUser(req.user.id).catch(() => {});
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

app.post('/api/auth/change', authReq, async (req, res) => {
  const { oldPass, newPass } = req.body || {};
  if (!newPass || newPass.length < 6) return res.status(400).json({ error: 'Password must be 6+ chars' });
  if (!sb) return authUnavailable(res);
  const u = (await q('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
  if (u.role !== 'admin') {
    const { error: verr } = await sb.auth.signInWithPassword({ email: u.email, password: String(oldPass || '') });
    if (verr) return res.status(403).json({ error: 'Current password is wrong' });
  }
  // OTP-only profiles (id 'otp-*') have no Supabase password; give them one now.
  if (u.id.startsWith('otp-')) {
    const { error: uerr } = await sb.auth.admin.updateUserById(u.id, { password: newPass });
    // if the user doesn't exist in Supabase yet, create it so password login works
    if (uerr) {
      const { error: cerr } = await sb.auth.admin.createUser({ email: u.email, password: newPass, email_confirm: true });
      if (cerr) return res.status(500).json({ error: 'Could not set password' });
    }
  } else {
    const { error: uerr } = await sb.auth.admin.updateUserById(u.id, { password: newPass });
    if (uerr) return res.status(500).json({ error: 'Could not update password' });
  }
  res.json({ ok: true });
});

// ---------------- bootstrap (single load for shop pages) ----------------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: process.env.DATABASE_URL ? 'postgres' : 'memory', up: Date.now() });
});
app.get('/api/bootstrap', async (req, res) => {
  const u = req.user;
  const products = await allProducts();
  const reviews = (await q('SELECT * FROM reviews ORDER BY id')).rows.map(r => ({
    id: r.id, type: r.type, itemId: r.item_id || null, name: r.name, rating: r.rating, text: r.text, email: r.email, time: r.created_at
  }));
  const messages = (await q('SELECT * FROM messages')).rows.map(rowToMessage);
  let orders = [], cart = [], wishlist = [];
  if (u) {
    const own = u.role === 'admin' ? 'SELECT * FROM orders' : 'SELECT * FROM orders WHERE user_email=$1 OR user_id=$2';
    const params = u.role === 'admin' ? [] : [u.email, u.id];
    orders = (await q(own, params)).rows.map(rowToOrder).sort((a, b) => (b.id || 0) - (a.id || 0));
    cart = await board('cart:' + u.id, '[]');
    wishlist = await board('wish:' + u.id, '[]');
  }
  const vis = u ? messages.filter(m => u.role === 'admin' || m.to === u.email || m.to === 'ALL' || m.from === u.email) : [];
  res.json({ user: safeUser(u), products, reviews, messages: vis, orders, cart, wishlist, seeded: true });
});

async function board(key, fallback) {
  const r = await q('SELECT value FROM boards WHERE key=$1', [key]);
  return r.rows.length ? r.rows[0].value : JSON.parse(fallback);
}
async function setBoard(key, val) {
  await q(`INSERT INTO boards (key,value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=$2::jsonb`, [key, JSON.stringify(val)]);
}

// ---------------- products ----------------
app.get('/api/products', async (req, res) => res.json({ products: await allProducts() }));
app.post('/api/products', adminReq, async (req, res) => {
  const p = req.body;
  const id = Number(p.id) || (await q('SELECT COALESCE(MAX(id),0)+1 AS m FROM products')).rows[0].m;
  await updateProduct(id, { ...p, id });
  res.json({ product: productOut((await q('SELECT * FROM products WHERE id=$1', [id])).rows[0]) });
});
app.put('/api/products/:id', adminReq, async (req, res) => {
  const id = Number(req.params.id);
  await updateProduct(id, { ...req.body, id });
  res.json({ product: productOut((await q('SELECT * FROM products WHERE id=$1', [id])).rows[0]) });
});
app.delete('/api/products/:id', adminReq, async (req, res) => {
  await q('DELETE FROM products WHERE id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

app.get('/api/stock/check', async (req, res) => {
  const { productId, startDate, endDate } = req.query;
  res.json(await bookedQty(productId, startDate, endDate));
});

// ---------------- orders ----------------
function rowToOrder(r) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone, addr: r.addr, city: r.city, zip: r.zip,
    item: r.item, img: r.img, productId: r.product_id, startDate: r.start_date, endDate: r.end_date,
    qty: r.qty, size: r.size, occasion: r.occasion, dates: r.dates, total: r.total, status: r.status,
    refund: r.refund, userEmail: r.user_email, time: r.created_at
  };
}

app.post('/api/orders', authReq, async (req, res) => {
  const { items = [], name, email, phone, addr, city, zip } = req.body || {};
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Empty order' });
  if (!email || !/.*@.*/.test(String(email))) return res.status(400).json({ error: 'A valid email is required' });
  const u = req.user;
  // availability check per product (batch same-product items)
  for (const productId of [...new Set(items.map(i => Number(i.productId)))]) {
    const batch = items.filter(i => Number(i.productId) === productId);
    const need = batch.reduce((s, i) => s + Math.max(Number(i.qty) || 1, 1), 0);
    const av = await bookedQty(productId, batch[0].startDate, batch[0].endDate);
    if (!av.enough || av.available < need) {
      const p = (await q('SELECT name FROM products WHERE id=$1', [productId])).rows[0];
      return res.status(409).json({ error: (p ? p.name : 'Item') + ' is no longer available for the selected dates' });
    }
  }
  const created = [];
  for (const it of items) {
    const r = await q(`INSERT INTO orders (user_id,user_email,name,email,phone,addr,city,zip,item,img,product_id,
                       start_date,end_date,qty,size,occasion,dates,total,status,created_at)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) RETURNING id`,
      [u.id, u.email, String(name), String(email), String(phone || ''), String(addr || ''), String(city || ''),
        String(zip || ''), String(it.name || ''), String(it.img || ''), Number(it.productId),
        String(it.startDate || ''), String(it.endDate || ''), Math.max(Number(it.qty) || 1, 1),
        String(it.size || ''), String(it.occasion || ''), String((it.startDate || 'TBD') + ' — ' + (it.endDate || 'TBD')),
        Math.round(Number(it.total) || rentalTotal(Number(it.price), Number(it.days) || 1, Number(it.qty) || 1)), 'Pending', now()]);
    created.push(r.rows[0].id);
  }
  res.json({ ids: created });
});

app.get('/api/orders', authReq, async (req, res) => {
  const u = req.user;
  const rows = u.role === 'admin'
    ? (await q('SELECT * FROM orders')).rows
    : (await q('SELECT * FROM orders WHERE user_email=$1 OR user_id=$2', [u.email, u.id])).rows;
  res.json({ orders: rows.map(rowToOrder).sort((a, b) => (b.id || 0) - (a.id || 0)) });
});

app.post('/api/orders/:id/cancel', authReq, async (req, res) => {
  const r = (await q('SELECT * FROM orders WHERE id=$1', [Number(req.params.id)])).rows[0];
  if (!r) return res.status(404).json({ error: 'Order not found' });
  const u = req.user;
  if (u.role !== 'admin' && r.user_email !== u.email && r.user_id !== u.id) return res.status(403).json({ error: 'Not your order' });
  if (r.status !== 'Cancelled') {
    await q('UPDATE orders SET status=$1, refund=$2 WHERE id=$3', ['Cancelled', cancelRefund(r.start_date), r.id]);
  }
  res.json({ ok: true });
});
app.put('/api/admin/orders/:id', adminReq, async (req, res) => {
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: 'status required' });
  await q('UPDATE orders SET status=$1 WHERE id=$2', [String(status), Number(req.params.id)]);
  res.json({ ok: true });
});
app.get('/api/admin/orders', adminReq, async (req, res) => {
  const rows = (await q('SELECT * FROM orders ORDER BY id')).rows;
  res.json({ orders: rows.map(rowToOrder) });
});

// ---------------- users (admin) ----------------
app.get('/api/admin/users', adminReq, async (req, res) => {
  const rows = (await q("SELECT id,email,name,phone,role,created_at FROM users WHERE role='user' ORDER BY id")).rows;
  res.json({ users: rows });
});
app.delete('/api/admin/users/:id', adminReq, async (req, res) => {
  const target = req.params.id;
  await q('DELETE FROM sessions WHERE user_id=$1', [target]);
  await q('DELETE FROM users WHERE id=$1 AND role=$2', [target, 'user']);
  if (sb && !String(target).startsWith('otp-')) sb.auth.admin.deleteUser(String(target)).catch(() => {});
  res.json({ ok: true });
});

// ---------------- messages ----------------
function rowToMessage(r) {
  return { id: r.id, from: r.from, to: r.to, body: r.body, time: r.time, readBy: r.read_by || [] };
}
app.get('/api/messages', authReq, async (req, res) => {
  const u = req.user;
  const rows = u.role === 'admin'
    ? (await q('SELECT * FROM messages')).rows
    : (await q('SELECT * FROM messages WHERE "from"=$1 OR "to"=$1 OR "to"=$2', [u.email, 'ALL'])).rows;
  res.json({ messages: rows.map(rowToMessage).sort((a, b) => b.time - a.time) });
});
app.post('/api/messages', authReq, async (req, res) => {
  const { to, body } = req.body || {};
  if (!to || !body) return res.status(400).json({ error: 'to and body required' });
  const r = await q('INSERT INTO messages ("from","to",body,time,read_by) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id',
    [req.user.role === 'admin' ? 'admin' : req.user.email, to === 'admin' ? (req.user.role === 'admin' ? 'ALL' : 'admin') : String(to), String(body), now(), '[]']);
  res.json({ id: r.rows[0].id });
});
app.post('/api/messages/:id/read', authReq, async (req, res) => {
  const r = (await q('SELECT * FROM messages WHERE id=$1', [Number(req.params.id)])).rows[0];
  if (r) {
    const read = r.read_by || [];
    if (!read.includes(req.user.email)) {
      read.push(req.user.email);
      await q('UPDATE messages SET read_by=$1::jsonb WHERE id=$2', [JSON.stringify(read), r.id]);
    }
  }
  res.json({ ok: true });
});
app.post('/api/admin/messages/:id', adminReq, async (req, res) => {
  const { from = 'admin', body } = req.body || {};
  await q('INSERT INTO messages ("from","to",body,time,read_by) VALUES ($1,$2,$3,$4,$5::jsonb)',
    [String(from), 'ALL', String(body || ''), now(), '[]']);
  res.json({ ok: true });
});

// ---------------- reviews ----------------
function rowToReview(r) {
  return { id: r.id, type: r.type, itemId: r.item_id || null, name: r.name, rating: r.rating, text: r.text, email: r.email, time: r.created_at };
}
app.get('/api/reviews', async (req, res) => {
  const { type, itemId } = req.query;
  let rows;
  if (type === 'site') rows = (await q("SELECT * FROM reviews WHERE type='site'")).rows;
  else if (type === 'item') rows = (await q('SELECT * FROM reviews WHERE type=$1 AND item_id=$2', ['item', Number(itemId || 0)])).rows;
  else rows = (await q('SELECT * FROM reviews')).rows;
  res.json({ reviews: rows.map(rowToReview) });
});
app.post('/api/reviews', authReq, async (req, res) => {
  const { type, itemId = 0, rating, text } = req.body || {};
  const r = Number(rating);
  if (!Number.isInteger(r) || r < 1 || r > 5) return res.status(400).json({ error: 'Rating must be 1-5' });
  const ins = await q('INSERT INTO reviews (user_id,name,email,type,item_id,rating,text,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
    [req.user.id, req.user.name, req.user.email, type === 'item' ? 'item' : 'site', Number(itemId || 0), r, String(text || ''), now()]);
  res.json({ id: ins.rows[0].id });
});
app.delete('/api/reviews/:id', adminReq, async (req, res) => {
  await q('DELETE FROM reviews WHERE id=$1', [Number(req.params.id)]);
  res.json({ ok: true });
});

// ---------------- cart / wishlist ----------------
app.get('/api/me/cart', authReq, async (req, res) => res.json({ cart: await board('cart:' + req.user.id, '[]') }));
app.put('/api/me/cart', authReq, async (req, res) => { await setBoard('cart:' + req.user.id, req.body || []); res.json({ ok: true }); });
app.get('/api/me/wishlist', authReq, async (req, res) => res.json({ wishlist: await board('wish:' + req.user.id, '[]') }));
app.put('/api/me/wishlist', authReq, async (req, res) => { await setBoard('wish:' + req.user.id, req.body || []); res.json({ ok: true }); });

// ---------------- migrate (browser localStorage -> DB, admin only) ----------------
app.post('/api/migrate', adminReq, async (req, res) => {
  const { users = [], products = [], orders = [], reviews = [], messages = [] } = req.body || {};
  let u = 0, p = 0, o = 0, r = 0, m = 0;
  for (const usr of users) {
    if (!usr.email) continue;
    const em = String(usr.email).toLowerCase();
    const dup = await q('SELECT id FROM users WHERE email=$1', [em]);
    if (dup.rows.length) continue;
    await q('INSERT INTO users (id,email,name,phone,role,created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      ['lg-' + String(usr.id == null ? Date.now() : usr.id), em,
        String(usr.first ? usr.first + ' ' + (usr.last || '') : (usr.name || em)), String(usr.phone || ''), 'user', Number(usr.created) || now()]);
    u++;
  }
  for (const prod of products) {
    if (prod.id == null) continue;
    await updateProduct(prod.id, prod); p++;
  }
  for (const od of orders) {
    const row = rowToOrder({ ...od, product_id: od.productId, start_date: od.startDate, end_date: od.endDate });
    await q(`INSERT INTO orders (user_id,user_email,name,email,phone,addr,city,zip,item,img,product_id,start_date,end_date,qty,size,occasion,dates,total,status,refund,created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [Number(od.userId) || 0, String(od.userEmail || ''), row.name, row.email, row.phone, row.addr, row.city, row.zip,
        row.item, row.img, row.productId, row.startDate, row.endDate, row.qty, row.size, row.occasion, row.dates,
        row.total, row.status, row.refund || 0, Number(od.time) || now()]);
    o++;
  }
  for (const rv of reviews) {
    await q('INSERT INTO reviews (user_id,name,email,type,item_id,rating,text,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      [0, String(rv.name || ''), String(rv.email || ''), rv.type === 'item' ? 'item' : 'site', Number(rv.itemId || 0),
        Number(rv.rating) || 5, String(rv.text || ''), Number(rv.time) || now()]);
    r++;
  }
  for (const msg of messages) {
    await q('INSERT INTO messages ("from","to",body,time,read_by) VALUES ($1,$2,$3,$4,$5::jsonb)',
      [String(msg.from || ''), String(msg.to || 'ALL'), String(msg.body || ''), Number(msg.time) || now(), JSON.stringify(msg.readBy || [])]);
    m++;
  }
  res.json({ ok: true, imported: { users: u, products: p, orders: o, reviews: r, messages: m } });
});

// ---------------- image upload (img402 free, no keys) ----------------
// ponytail: img402.dev free tier keeps images ≤1MB forever, 1–10MB for 30 days.
// Our admin uploads are downscaled to ~900px JPEG (~100-200KB) → permanent.
app.post('/api/img/upload', async (req, res) => {
  const file = (req.body || {}).file;
  if (!file || typeof file !== 'string' || file.length > 3e6) return res.status(400).json({ error: 'No image data' });
  try {
    const r = await fetch('https://img402.dev/api/free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file })
    });
    const j = await r.json().catch(() => ({}));
    const url = j.url || (j.data && j.data.url);
    if (!r.ok || !url) return res.status(502).json({ error: j.error || 'Image upload failed' });
    res.json({ url });
  } catch (e) { res.status(502).json({ error: 'Image upload failed: ' + e.message }); }
});

// ---------------- AI proxy (key stays server-side) ----------------
async function queryAI(cfg, system, text) {
  if (cfg.provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: 'gpt-4o-mini', temperature: 0.7, messages: [{ role: 'system', content: system }, { role: 'user', content: text }] })
    });
    const j = await r.json();
    return (j.choices && j.choices[0] && j.choices[0].message.content) || null;
  }
  const key = cfg.key || process.env.GEMINI_KEY;
  if (!key) return null;
  // ponytail: gemini free-tier keys hit "503 high demand" spikes; retry across models with backoff.
  const models = ['gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
  for (const model of models) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: system + '\n\nUser: ' + text }] }] })
      });
      const j = await r.json();
      const t = j && j.candidates && j.candidates[0] && j.candidates[0].content.parts[0].text;
      if (t) return t;
    } catch (e) { /* retry next model */ }
    await new Promise(res => setTimeout(res, 700));
  }
  return null;
}
app.post('/api/ai', async (req, res) => {
  const b = req.body || {};
  const t = await queryAI(b.cfg || {}, b.system || '', b.text || '');
  res.json({ text: t });
});

// ---------------- static site ----------------
app.use(express.static(__dirname, { index: 'index.html' }));

// ---------- actually start ----------
seed()
  .then(() => app.listen(PORT, () => console.log('Rent-RO-Vastra live at http://localhost:' + PORT)))
  .catch(e => { console.error('Boot failed:', e.message); process.exit(1); });

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});
