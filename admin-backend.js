// ponytail: the admin panel is a huge self-contained script that only talks to
// localStorage. This shim routes those storage reads/writes through the backend
// (same session as the shop pages), so the whole panel works server-backed with
// zero changes to its internals. file:// + no server = native localStorage as before.
(function () {
  const BASE = (function () { try { return (window.location.protocol === 'file:' ? 'http://localhost:3010' : '') + '/api'; } catch (e) { return '/api'; } })();
  function api(path, opts) {
    opts = opts || {};
    return fetch(BASE + path, {
      method: opts.method || 'GET',
      headers: (opts.body ? { 'Content-Type': 'application/json' } : {}),
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(async r => {
      let j = {};
      try { j = await r.json(); } catch (e) {}
      if (!r.ok) { const e = new Error(j.error || j.message || 'Request failed (' + r.status + ')'); e.status = r.status; throw e; }
      return j;
    });
  }

  const cache = { products: [], orders: [], users: [], messages: [], reviews: [] };
  const KEYDB = { luxe_products: 'products', luxe_orders: 'orders', luxe_users: 'users', luxe_messages: 'messages', luxe_reviews: 'reviews' };
  const nativeGet = Storage.prototype.getItem, nativeSet = Storage.prototype.setItem, nativeRemove = Storage.prototype.removeItem;
  let routed = false, booting = false;

  window.ADMIN = { server: false, email: null, api: api };

  function routeStorage() {
    if (routed) return;
    routed = true;
    Storage.prototype.getItem = function (k) {
      if (ADMIN.server && KEYDB[k]) return JSON.stringify(cache[KEYDB[k]]);
      return nativeGet.call(this, k);
    };
    Storage.prototype.setItem = function (k, v) {
      if (!(ADMIN.server && KEYDB[k])) { nativeSet.call(this, k, v); return; }
      let next = [];
      try { next = JSON.parse(v) || []; } catch (e) {}
      const key = KEYDB[k];
      if (key === 'products') syncProducts(next);
      else if (key === 'orders') syncOrders(next);
      else if (key === 'messages') syncMessages(next);
      else if (key === 'reviews') syncReviews(next);
      cache[key] = next;
    };
    Storage.prototype.removeItem = function (k) {
      if (ADMIN.server && KEYDB[k]) cache[KEYDB[k]] = [];
      nativeRemove.call(this, k);
    };
  }

  function syncProducts(next) {
    const prev = cache.products;
    const prevIds = new Set(prev.map(p => String(p.id))), nextIds = new Set(next.map(p => String(p.id)));
    next.forEach(p => {
      if (!p || p.id === undefined || p.id === null) return;
      const before = prev.find(o => String(o.id) === String(p.id));
      if (before && JSON.stringify(before) === JSON.stringify(p)) return;
      api('/products/' + p.id, { method: 'PUT', body: p }).then(refresh).catch(() => {});
    });
    prev.forEach(p => { if (!nextIds.has(String(p.id))) api('/products/' + p.id, { method: 'DELETE' }).then(refresh).catch(() => {}); });
  }

  function syncOrders(next) {
    const pm = {}; cache.orders.forEach(o => pm[String(o.id)] = o);
    next.forEach(o => {
      const before = pm[String(o.id)];
      if (before && before.status !== o.status) api('/admin/orders/' + o.id, { method: 'PUT', body: { status: o.status } }).then(refresh).catch(() => {});
    });
  }

  function syncMessages(next) {
    const ids = new Set(cache.messages.map(m => String(m.id)));
    next.forEach(m => {
      if (m && m.from === 'admin' && m.to && m.body && !ids.has(String(m.id)))
        api('/messages', { method: 'POST', body: { to: m.to, body: m.body } }).then(refresh).catch(() => {});
    });
  }

  function syncReviews(next) {
    const prevIds = new Set(cache.reviews.map(r => String(r.id))), nextIds = new Set(next.map(r => String(r.id)));
    prevIds.forEach(id => { if (!nextIds.has(id)) api('/reviews/' + id, { method: 'DELETE' }).then(refresh).catch(() => {}); });
  }

  function refresh(extra) {
    return Promise.all([api('/bootstrap'), api('/admin/users').catch(() => null)]).then(([b, us]) => {
      ADMIN.server = true; ADMIN.email = (b.user && b.user.email) || null;
      cache.products = b.products || []; cache.orders = b.orders || [];
      cache.messages = b.messages || []; cache.reviews = b.reviews || [];
      if (us) cache.users = us.users || [];
      window.dispatchEvent(new CustomEvent('admin-data', { detail: extra || {} }));
      return b;
    }).catch(() => null);
  }

  ADMIN.login = function (email, password) {
    return api('/auth/login', { method: 'POST', body: { email: email, password: password } })
      .then(() => refresh()).then(b => (b && b.user) || null);
  };
  ADMIN.changePass = function (oldPass, newPass) {
    return api('/auth/change', { method: 'POST', body: { oldPass: oldPass, newPass: newPass } }).then(() => true).catch(() => false);
  };
  ADMIN.logout = function () { api('/auth/logout', { method: 'POST' }).catch(() => {}); };

  function ensureLockEmail() {
    if (document.getElementById('lockEmail')) return;
    const pass = document.getElementById('lockPass');
    if (!pass || !pass.parentNode) return;
    const wrap = pass.parentNode.parentNode;
    const em = document.createElement('input');
    em.type = 'email'; em.id = 'lockEmail'; em.placeholder = 'Admin email'; em.autocomplete = 'username';
    em.style.cssText = 'width:100%;padding:14px 18px;background:var(--dark2);border:1px solid rgba(201,169,110,0.2);color:var(--text);font-family:var(--sans);font-size:0.9rem;border-radius:8px;margin-bottom:10px;';
    const btn = document.getElementById('lockBtn');
    wrap.insertBefore(em, btn);
    if (em.addEventListener) {
      em.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = document.getElementById('lockBtn'); if (b) b.click(); } });
    }
  }
  window.ADMIN.ensureLockEmail = ensureLockEmail;

  // Boot: probe the server once. Admin session cookie present -> unlock immediately.
  routeStorage();
  fetch(BASE + '/bootstrap').then(r => r.json()).then(b => {
    if (!b || !b.user) return;
    ADMIN.server = true; ADMIN.email = b.user.email;
    ensureLockEmail();
    cache.products = b.products || []; cache.orders = b.orders || []; cache.messages = b.messages || []; cache.reviews = b.reviews || [];
    api('/admin/users').then(j => { cache.users = j.users || []; }).catch(() => {});
    if (b.user.role === 'admin') {
      window.dispatchEvent(new CustomEvent('admin-auth', { detail: { ok: true } }));
      window.dispatchEvent(new CustomEvent('admin-data'));
    }
  }).catch(() => {});
})();