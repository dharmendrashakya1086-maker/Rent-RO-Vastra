// Assert-based check of the auth backend. Uses a throwaway data file and port.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const port = 3199;
const base = 'http://127.0.0.1:' + port;
const dataFile = path.join(os.tmpdir(), 'rv-auth-test-' + process.pid + '.json');
const child = cp.spawn(process.execPath, [path.join(__dirname, 'server.js')], {
  cwd: __dirname,
  env: Object.assign({}, process.env, { PORT: String(port), AUTH_DATA_FILE: dataFile }),
  stdio: ['ignore', 'pipe', 'pipe']
});
let log = '';
child.stdout.on('data', d => { log += d; });
child.stderr.on('data', d => { log += d; });

let cookie = '';
async function call(method, url, body) {
  const r = await fetch(base + url, {
    method,
    headers: Object.assign({}, body ? { 'Content-Type': 'application/json' } : {}, cookie ? { Cookie: cookie } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const d = await r.json().catch(() => ({}));
  return { status: r.status, data: d };
}
function check(name, cond) { assert.ok(cond, name); console.log('PASS ' + name); }

(async () => {
  // wait for boot
  for (let i = 0; i < 60; i++) {
    try { await call('GET', '/api/auth/me'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
  check('server boots', /auth server on/.test(log));

  for (const [clean, file] of [['/', '/index.html'], ['/login', '/auth.html'], ['/collection', '/catalog.html']]) {
    const a = await (await fetch(base + clean)).text();
    const b = await (await fetch(base + file)).text();
    check('clean URL ' + clean + ' serves ' + file, a === b && /html/i.test(a));
  }

  let r = await call('GET', '/api/auth/me');
  check('me is null when signed out', r.status === 200 && r.data.user === null);

  const email = 'test' + Date.now() + '@example.com';
  r = await call('POST', '/api/auth/otp/send', { email });
  check('otp send returns a code', r.status === 200 && /^\d{6}$/.test(r.data.code || ''));
  const code = r.data.code;

  r = await call('GET', '/api/auth/username?u=testuser');
  check('username available', r.data.available === true);

  check('firebase config present', !!JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-config.json'), 'utf8')).apiKey);
  const servedCfg = await (await fetch(base + '/firebase-config.json')).json();
  check('firebase config served to browser', !!servedCfg.apiKey && !!servedCfg.projectId);
  r = await call('POST', '/api/auth/firebase', {});
  check('firebase exchange rejects missing token', r.status === 400);

  r = await call('POST', '/api/auth/register', { first: 'Test', last: 'User', username: 'testuser', email, phone: '', pass: 'password123', code });
  check('register creates account', r.status === 200 && r.data.user && r.data.user.email === email);
  check('password hash never leaves server', JSON.stringify(r.data).indexOf('scrypt') < 0 && !r.data.user.pass);

  r = await call('GET', '/api/auth/me');
  check('session cookie identifies user', r.data.user && r.data.user.email === email);

  r = await call('GET', '/api/users');
  check('user list has no password field', r.data.users.length === 1 && !('pass' in r.data.users[0]));

  r = await call('POST', '/api/auth/logout', {});
  r = await call('GET', '/api/auth/me');
  check('logout clears session', r.data.user === null);

  r = await call('POST', '/api/auth/login', { idOrEmail: email, pass: 'wrongpass' });
  check('wrong password rejected', r.status === 401);
  r = await call('POST', '/api/auth/login', { idOrEmail: email, pass: 'password123' });
  check('correct password logs in', r.status === 200 && r.data.user.email === email);

  r = await call('PATCH', '/api/me', { first: 'Changed', username: 'newname' });
  check('profile update persists', r.data.user.first === 'Changed' && r.data.user.username === 'newname');

  r = await call('POST', '/api/auth/change', { old: 'password123', pass: 'newpassword' });
  check('password change works', r.status === 200);
  r = await call('POST', '/api/auth/logout', {});
  r = await call('POST', '/api/auth/login', { idOrEmail: email, pass: 'newpassword' });
  check('new password logs in', r.status === 200);

  r = await call('POST', '/api/auth/otp/send', { email });
  const resetCode = r.data.code;
  r = await call('POST', '/api/auth/reset', { email, code: resetCode, pass: 'resetpass1' });
  check('otp password reset works', r.status === 200);

  r = await call('DELETE', '/api/me');
  check('delete account works', r.status === 200);
  r = await call('GET', '/api/auth/me');
  check('deleted user is signed out', r.data.user === null);

  console.log('ALL AUTH TESTS PASSED');
})().catch(e => { console.error('FAIL:', e.message, '\n' + log); process.exitCode = 1; })
  .finally(() => { child.kill(); try { fs.unlinkSync(dataFile); } catch (e) {} });
