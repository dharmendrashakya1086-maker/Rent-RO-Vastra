// Fresh backend, piece 1: authentication. Node built-ins only — no npm install.
// Serves the static site and the /api/auth/* endpoints. Users + sessions live in data/auth.json.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = process.env.AUTH_DATA_FILE || path.join(DATA_DIR, 'auth.json');
const PORT = Number(process.env.PORT) || 3010;
// Firebase web config is public by design; the server needs the key only to verify ID tokens.
let FIREBASE_KEY = '';
try { FIREBASE_KEY = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-config.json'), 'utf8')).apiKey || ''; } catch (e) {}
const COOKIE = 'rv_sid';
const SESSION_MS = 30 * 24 * 3600 * 1000;
const OTP_MS = 10 * 60 * 1000;

fs.mkdirSync(DATA_DIR, { recursive: true });
let db;
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { db = {}; }
db.users = db.users || [];
db.sessions = db.sessions || {};
db.otps = db.otps || {};
function persist() {
  fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db, null, 2));
  fs.renameSync(DATA_FILE + '.tmp', DATA_FILE);
}

// ---- helpers ----
function json(res, status, obj, extra) {
  res.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}));
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { resolve({}); } });
    req.on('error', reject);
  });
}
const clean = v => String(v == null ? '' : v).trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME = /^[a-z0-9._]{3,20}$/;
function hash(pass, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pass, salt, 64).toString('hex');
}
function passOk(pass, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const salt = stored.slice(0, stored.indexOf(':'));
  const got = crypto.scryptSync(String(pass), salt, 64);
  const want = Buffer.from(stored.slice(salt.length + 1), 'hex');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function safe(u) {
  return { id: u.id, first: u.first || '', last: u.last || '', name: ((u.first || '') + ' ' + (u.last || '')).trim(),
    username: u.username || '', email: u.email, phone: u.phone || '', created: u.created, role: u.role || 'user' };
}
function cookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}
function setCookie(res, token, maxAge, req) {
  const https = req.headers['x-forwarded-proto'] === 'https';
  res.setHeader('Set-Cookie', COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(maxAge / 1000) + (https ? '; Secure' : ''));
}
function me(req) {
  const token = cookie(req, COOKIE);
  const s = token && db.sessions[token];
  if (!s) return null;
  if (s.exp < Date.now()) { delete db.sessions[token]; persist(); return null; }
  return db.users.find(u => u.id === s.userId) || null;
}
function signIn(res, user, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.sessions[token] = { userId: user.id, exp: Date.now() + SESSION_MS };
  persist();
  setCookie(res, token, SESSION_MS, req);
  return safe(user);
}
// cheap in-memory throttle: auth endpoints only, keyed by IP + target
const hits = new Map();
function throttle(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return Math.ceil((list[0] + windowMs - now) / 1000); }
  list.push(now); hits.set(key, list); return 0;
}
const ip = req => String(req.socket.remoteAddress || '');
function issueOtp(email) {
  const code = String(crypto.randomInt(100000, 1000000));
  db.otps[email] = { code, exp: Date.now() + OTP_MS };
  persist();
  console.log('[auth] demo OTP for ' + email + ': ' + code + ' (no email service in this piece)');
  return code;
}
function otpOk(email, code) {
  const r = db.otps[clean(email).toLowerCase()];
  return !!(r && r.code === clean(code) && r.exp > Date.now());
}
function newUser(fields) {
  return { id: 'u_' + crypto.randomBytes(8).toString('hex'), first: fields.first || '', last: fields.last || '',
    username: fields.username || '', email: clean(fields.email).toLowerCase(), phone: fields.phone || '',
    pass: fields.pass, created: Date.now(), role: 'user' };
}

// ---- static files (clean URLs map to .html) ----
const ALIASES = { '/': 'index.html', '/login': 'auth.html', '/collection': 'catalog.html',
  '/client-looks': 'ugc.html', '/admin': 'admin.html', '/404': '404.html' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' };
function staticFile(req, res, pathname) {
  let rel = ALIASES[pathname] || (path.extname(pathname) ? pathname.slice(1) : pathname.slice(1) + '.html');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/html' }); return fs.createReadStream(path.join(ROOT, '404.html')).pipe(res); }
    res.writeHead(200, { 'Content-Type': (TYPES[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8' });
    res.end(buf);
  });
}

// ---- API ----
async function handle(req, res) {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;
  if (req.method === 'GET' && !p.startsWith('/api/')) return staticFile(req, res, p);
  if (!p.startsWith('/api/')) { res.writeHead(404); return res.end(); }

  // public (no session needed)
  if (p === '/api/auth/me' && req.method === 'GET') {
    const user = me(req);
    return json(res, 200, { user: user ? safe(user) : null });
  }
  if (p === '/api/users' && req.method === 'GET') {
    return json(res, 200, { users: db.users.map(safe) });
  }
  if (p === '/api/auth/username' && req.method === 'GET') {
    const name = clean(u.searchParams.get('u') || '').toLowerCase();
    const taken = !USERNAME.test(name) || db.users.some(x => (x.username || '').toLowerCase() === name);
    return json(res, 200, { available: !taken });
  }
  // Firebase (Google sign-in + email/password): exchange a Firebase ID token for our own session.
  // Google validates the token through accounts:lookup — no server-side Firebase SDK needed.
  if (p === '/api/auth/firebase' && req.method === 'POST') {
    const idToken = clean((await body(req)).idToken);
    if (!idToken) return json(res, 400, { error: 'Missing sign-in token' });
    if (!FIREBASE_KEY) return json(res, 500, { error: 'Firebase is not configured' });
    let vr, vd;
    try {
      vr = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
      });
      vd = await vr.json();
    } catch (e) { return json(res, 502, { error: 'Could not reach Google to verify sign-in' }); }
    const fu = vd.users && vd.users[0];
    if (!vr.ok || !fu || !fu.email) return json(res, 401, { error: 'Sign-in expired — please sign in again' });
    const email = clean(fu.email).toLowerCase();
    let user = db.users.find(x => x.email === email);
    if (!user) {
      const parts = clean(fu.displayName || email.split('@')[0]).split(/\s+/);
      user = newUser({ first: parts[0] || '', last: parts.slice(1).join(' '), email,
        pass: hash(crypto.randomBytes(24).toString('hex')) });
      db.users.push(user);
    }
    user.firebaseUid = fu.localId;
    user.verified = !!fu.emailVerified;
    persist();
    return json(res, 200, { user: signIn(res, user, req) });
  }
  if ((p === '/api/auth/otp/send' || p === '/api/auth/forgot') && req.method === 'POST') {
    const email = clean((await body(req)).email).toLowerCase();
    if (!EMAIL.test(email)) return json(res, 400, { error: 'Enter a valid email' });
    const wait = throttle('otp:' + ip(req) + email, 5, 10 * 60 * 1000);
    if (wait) return json(res, 429, { error: 'Wait ' + wait + ' seconds before requesting another code' });
    const code = issueOtp(email);
    return json(res, 200, { sent: true, delivery: 'dev', code });
  }

  const b = (req.method === 'POST' || req.method === 'PATCH') ? await body(req) : {};

  if (p === '/api/auth/register' && req.method === 'POST') {
    const email = clean(b.email).toLowerCase();
    const username = clean(b.username).toLowerCase();
    if (!EMAIL.test(email)) return json(res, 400, { error: 'Enter a valid email' });
    if (!USERNAME.test(username)) return json(res, 400, { error: 'Username: 3-20 letters, numbers, dot or underscore' });
    if (clean(b.pass).length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
    if (db.users.some(x => x.email === email)) return json(res, 409, { error: 'Email already registered' });
    if (db.users.some(x => (x.username || '').toLowerCase() === username)) return json(res, 409, { error: 'Username already taken' });
    if (!otpOk(email, b.code)) return json(res, 400, { error: 'Wrong or expired code' });
    const user = newUser({ first: clean(b.first), last: clean(b.last), username, email,
      phone: clean(b.phone), pass: hash(clean(b.pass)) });
    db.users.push(user); delete db.otps[email];
    return json(res, 200, { user: signIn(res, user, req) });
  }
  if (p === '/api/auth/login' && req.method === 'POST') {
    const key = clean(b.idOrEmail).toLowerCase();
    const wait = throttle('login:' + ip(req), 10, 15 * 60 * 1000);
    if (wait) return json(res, 429, { error: 'Too many attempts. Try again in ' + wait + ' seconds' });
    const user = db.users.find(x => x.email === key || (x.phone || '') === key || (x.first || '').toLowerCase() === key);
    if (!user || !passOk(b.pass, user.pass)) return json(res, 401, { error: 'Wrong email or password' });
    return json(res, 200, { user: signIn(res, user, req) });
  }
  if (p === '/api/auth/otp/verify' && req.method === 'POST') {
    const email = clean(b.email).toLowerCase();
    if (!otpOk(email, b.code)) return json(res, 400, { error: 'Wrong or expired code' });
    let user = db.users.find(x => x.email === email);
    if (!user) user = newUser({ email, first: email.split('@')[0], pass: hash(crypto.randomBytes(16).toString('hex')) });
    else db.users = db.users.filter(x => x.id !== user.id);
    db.users.push(user); delete db.otps[email];
    return json(res, 200, { user: signIn(res, user, req) });
  }
  if (p === '/api/auth/reset' && req.method === 'POST') {
    const email = clean(b.email).toLowerCase();
    if (!otpOk(email, b.code)) return json(res, 400, { error: 'Wrong or expired code' });
    if (clean(b.pass).length < 8) return json(res, 400, { error: 'Password must be at least 8 characters' });
    const user = db.users.find(x => x.email === email);
    if (!user) return json(res, 404, { error: 'No account for that email' });
    user.pass = hash(clean(b.pass)); delete db.otps[email]; persist();
    return json(res, 200, { user: signIn(res, user, req) });
  }
  if (p === '/api/auth/logout' && req.method === 'POST') {
    const token = cookie(req, COOKIE);
    if (token) { delete db.sessions[token]; persist(); }
    setCookie(res, '', 0, req);
    return json(res, 200, { ok: true });
  }

  // session required
  const user = me(req);
  if (!user) return json(res, 401, { error: 'Not signed in' });
  if (p === '/api/auth/change' && req.method === 'POST') {
    if (!passOk(b.old, user.pass)) return json(res, 400, { error: 'Current password is incorrect' });
    if (clean(b.pass).length < 6) return json(res, 400, { error: 'At least 6 characters' });
    user.pass = hash(clean(b.pass)); persist();
    return json(res, 200, { ok: true });
  }
  if (p === '/api/me' && req.method === 'PATCH') {
    if (b.username !== undefined) {
      const name = clean(b.username).toLowerCase();
      if (!USERNAME.test(name)) return json(res, 400, { error: 'Invalid username' });
      if (db.users.some(x => x.id !== user.id && (x.username || '').toLowerCase() === name)) return json(res, 409, { error: 'Username already taken' });
      user.username = name;
    }
    for (const k of ['first', 'last', 'phone']) if (b[k] !== undefined) user[k] = clean(b[k]);
    persist();
    return json(res, 200, { user: safe(user) });
  }
  if (p === '/api/me' && req.method === 'DELETE') {
    db.users = db.users.filter(x => x.id !== user.id);
    for (const t in db.sessions) if (db.sessions[t].userId === user.id) delete db.sessions[t];
    persist();
    setCookie(res, '', 0, req);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Not found' });
}

http.createServer((req, res) => {
  handle(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, 500, { error: 'Server error' }); });
}).listen(PORT, () => console.log('Rent-RO-Vastra auth server on http://localhost:' + PORT));
