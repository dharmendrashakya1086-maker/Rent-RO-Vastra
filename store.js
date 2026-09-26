// CART
const CURRENCY = '₹';
function formatPrice(n) { return CURRENCY + n.toLocaleString('en-IN'); }
function discountPct(p) { return Math.min(90, Math.max(0, Number(p && p.discount) || 0)); }
function effPrice(p) { return Math.round((Number(p && p.price) || 0) * (1 - discountPct(p) / 100)); }

// ============================================================
// SERVER-BACKED DATA LAYER (full backend). When this page is
// served by the Node/Render backend, everything lives in
// Postgres behind /api/*. When opened over file:// with no
// server running, it falls back to the legacy localStorage
// behaviour (demo mode). All public function names are kept.
// ============================================================
let SERVER = { on: false, user: null, products: [], orders: [], reviews: [], messages: [], cart: [], wishlist: [] };
var SERVER_MODE = false;
let booted = false; const pending = [];

function storeReady(fn) { if (booted) fn(); else pending.push(fn); }

async function api(path, opts) {
  opts = opts || {};
  const res = await fetch(path, {
    method: opts.method || 'GET',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) { const err = new Error(data.error || 'Request failed (' + res.status + ')'); err.status = res.status; throw err; }
  return data;
}

function norm(u) {
  if (!u) return null;
  const parts = String(u.name || '').split(' ');
  return { id: u.id, first: parts[0], last: parts.slice(1).join(' '), email: u.email, phone: u.phone || '', created: u.created, role: u.role };
}

async function boot() {
  try {
    const b = await api('/api/bootstrap');
    SERVER.on = true;
    SERVER_MODE = true;
    SERVER.user = norm(b.user);
    SERVER.products = b.products || [];
    SERVER.orders = b.orders || [];
    SERVER.reviews = b.reviews || [];
    SERVER.messages = b.messages || [];
    SERVER.cart = b.cart || [];
    SERVER.wishlist = b.wishlist || [];
  } catch (e) { SERVER.on = false; }
  booted = true;
  pending.forEach(f => { try { f(); } catch (e) { console.error(e); } });
  pending.length = 0;
}
boot();

// Logged-in users have their own cart/wishlist ("luxe_cart:<email>"); guests share the global keys.
function cartKey() { const u = currentUser(); return u ? 'luxe_cart_' + u.email : 'luxe_cart'; }
function getCart() {
  if (SERVER.on) return currentUser() ? SERVER.cart : JSON.parse(localStorage.getItem('luxe_cart') || '[]');
  return JSON.parse(localStorage.getItem(cartKey()) || '[]');
}
function saveCart(c) {
  if (SERVER.on) {
    SERVER.cart = c;
    if (currentUser()) api('PUT', '/api/me/cart', { body: c }).catch(() => {});
    else localStorage.setItem('luxe_cart', JSON.stringify(c));
    updateCartCount();
    return;
  }
  localStorage.setItem(cartKey(), JSON.stringify(c)); updateCartCount();
}
function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(c => c.id === item.id);
  if (!existing) {
    cart.push({ id: item.id, name: item.name, category: item.category, price: item.price, img: item.img, days: 1, qty: 1, startDate: '', endDate: '' });
    saveCart(cart);
    return true;
  }
  return false;
}
function setCartQty(idx, qty) {
  const cart = getCart();
  if (cart[idx]) { cart[idx].qty = Math.max(1, qty); saveCart(cart); }
}
function removeFromCart(idx) {
  const cart = getCart();
  cart.splice(idx, 1);
  saveCart(cart);
}
function cartCount() { return getCart().length; }
function updateCartCount() {
  document.querySelectorAll('#cartCount').forEach(el => { el.textContent = cartCount(); });
}

// WISHLIST
function wishKey() { const u = currentUser(); return u ? 'luxe_wish_' + u.email : 'luxe_wishlist'; }
function getWishlist() {
  if (SERVER.on) return currentUser() ? SERVER.wishlist : JSON.parse(localStorage.getItem('luxe_wishlist') || '[]');
  return JSON.parse(localStorage.getItem(wishKey()) || '[]');
}
function saveWishlist(w) {
  if (SERVER.on) {
    SERVER.wishlist = w;
    if (currentUser()) api('PUT', '/api/me/wishlist', { body: w }).catch(() => {});
    else localStorage.setItem('luxe_wishlist', JSON.stringify(w));
    updateWishCount();
    return;
  }
  localStorage.setItem(wishKey(), JSON.stringify(w)); updateWishCount();
}
function inWishlist(id) { return getWishlist().some(w => w.id === id); }
function toggleWishlist(item) {
  let w = getWishlist();
  const idx = w.findIndex(x => x.id === item.id);
  if (idx >= 0) w.splice(idx, 1); else w.push(item);
  saveWishlist(w);
  return idx < 0;
}
function removeWishlist(idx) {
  const w = getWishlist();
  w.splice(idx, 1);
  saveWishlist(w);
}
function wishlistCount() { return getWishlist().length; }
function updateWishCount() {
  document.querySelectorAll('#wishBadge').forEach(el => {
    const n = wishlistCount();
    el.textContent = n;
    el.style.display = n > 0 ? '' : 'none';
  });
}

// AUTH
function getUsers() {
  if (SERVER.on) return currentUser() ? [SERVER.user] : [];
  return JSON.parse(localStorage.getItem('luxe_users') || '[]');
}
function saveUsers(u) { if (!SERVER.on) localStorage.setItem('luxe_users', JSON.stringify(u)); }
function currentUser() {
  if (SERVER.on) return SERVER.user;
  const email = sessionStorage.getItem('luxe_current_user');
  if (!email) return null;
  return getUsers().find(u => u.email === email) || null;
}
// Ponytail note: browser-side auth is never real security. We avoid plaintext storage
// (SHA-256 when crypto.subtle exists); file:// has no secure context so it stays plaintext.
function hashPass(pass) {
  if (window.crypto && crypto.subtle) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass))
      .then(buf => Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join(''));
  }
  return Promise.resolve(pass);
}
async function login(email, pass) {
  if (SERVER.on) {
    try {
      const r = await api('POST', '/api/auth/login', { body: { email, password: pass } });
      SERVER.user = norm(r.user);
      await adoptGuestData();
      return SERVER.user;
    } catch (e) { return null; }
  }
  const h = await hashPass(pass);
  const users = getUsers();
  const user = users.find(u => u.email === email && (u.pass === h || u.pass === pass));
  if (user) {
    if (user.pass === pass) { user.pass = h; saveUsers(users); }
    sessionStorage.setItem('luxe_current_user', user.email);
    adoptGuestData();
    return user;
  }
  return null;
}
async function register(data) {
  if (SERVER.on) {
    try {
      const r = await api('POST', '/api/auth/register', {
        body: { name: (data.first || '') + ' ' + (data.last || ''), email: data.email, phone: data.phone || '', password: data.pass }
      });
      SERVER.user = norm(r.user);
      await adoptGuestData();
      return SERVER.user;
    } catch (e) { return null; }
  }
  const users = getUsers();
  if (users.find(u => u.email === data.email)) return null;
  const user = { first: data.first, last: data.last, email: data.email, phone: data.phone, pass: await hashPass(data.pass), created: Date.now() };
  users.push(user);
  saveUsers(users);
  sessionStorage.setItem('luxe_current_user', user.email);
  adoptGuestData();
  return user;
}
// Move guest cart/wishlist into the just-logged-in account, then wipe the guest keys.
async function adoptGuestData() {
  const u = currentUser();
  if (!u) return;
  if (SERVER.on) {
    const guestCart = JSON.parse(localStorage.getItem('luxe_cart') || '[]');
    const guestWish = JSON.parse(localStorage.getItem('luxe_wishlist') || '[]');
    if (guestCart.length) {
      let mine = SERVER.cart.slice();
      guestCart.forEach(g => {
        const ex = mine.find(c => c.id === g.id);
        if (ex) ex.qty += (g.qty || 1); else mine.push(g);
      });
      SERVER.cart = mine;
      api('PUT', '/api/me/cart', { body: mine }).catch(() => {});
      updateCartCount();
    }
    if (guestWish.length) {
      let mine = SERVER.wishlist.slice();
      guestWish.forEach(g => { if (!mine.some(w => w.id === g.id)) mine.push(g); });
      SERVER.wishlist = mine;
      api('PUT', '/api/me/wishlist', { body: mine }).catch(() => {});
      updateWishCount();
    }
    localStorage.removeItem('luxe_cart');
    localStorage.removeItem('luxe_wishlist');
    return;
  }
  const guestCart = JSON.parse(localStorage.getItem('luxe_cart') || '[]');
  const guestWish = JSON.parse(localStorage.getItem('luxe_wishlist') || '[]');
  if (guestCart.length) {
    const mine = getCart();
    guestCart.forEach(g => {
      const ex = mine.find(c => c.id === g.id);
      if (ex) ex.qty += (g.qty || 1);
      else mine.push(g);
    });
    saveCart(mine);
  }
  if (guestWish.length) {
    const mine = getWishlist();
    guestWish.forEach(g => { if (!mine.some(w => w.id === g.id)) mine.push(g); });
    saveWishlist(mine);
  }
  localStorage.removeItem('luxe_cart');
  localStorage.removeItem('luxe_wishlist');
}
function saveUser(data) {
  if (SERVER.on) {
    const body = {};
    if (data.name) body.name = data.name;
    if (data.phone) body.phone = data.phone;
    api('PATCH', '/api/me', { body }).then(r => { SERVER.user = norm(r.user); }).catch(() => {});
    return;
  }
  const users = getUsers();
  const idx = users.findIndex(u => u.email === data.email);
  if (idx >= 0) { users[idx] = { ...users[idx], ...data }; saveUsers(users); }
}
async function deleteUser() {
  if (SERVER.on) {
    try { await api('DELETE', '/api/me'); } catch (e) {}
    SERVER.user = null;
    return;
  }
  const user = currentUser();
  if (user) {
    saveUsers(getUsers().filter(u => u.email !== user.email));
    sessionStorage.removeItem('luxe_current_user');
    localStorage.removeItem('luxe_cart_' + user.email);
    localStorage.removeItem('luxe_wish_' + user.email);
  }
}
function logout() {
  if (SERVER.on) { api('POST', '/api/auth/logout').catch(() => {}); SERVER.user = null; return; }
  sessionStorage.removeItem('luxe_current_user');
}
function isLoggedIn() { return !!currentUser(); }

// MESSAGING
const MSG_KEY = 'luxe_messages';
async function refreshMessages() {
  if (!SERVER.on) return;
  try { SERVER.messages = (await api('GET', '/api/messages')).messages || []; updateMsgCount(); } catch (e) {}
}
function getMessages() {
  if (SERVER.on) return SERVER.messages;
  return JSON.parse(localStorage.getItem(MSG_KEY) || '[]');
}
function saveMessages(m) { if (!SERVER.on) localStorage.setItem(MSG_KEY, JSON.stringify(m)); }
// to = email | 'admin' | 'ALL' (broadcast). Admin sends as 'admin'.
function sendMessage(from, to, body) {
  if (SERVER.on) {
    api('POST', '/api/messages', { body: { to, body } }).then(refreshMessages).catch(() => {});
    return;
  }
  const msgs = getMessages();
  msgs.push({ id: Date.now() + Math.random(), from, to, body, time: Date.now(), readBy: [] });
  saveMessages(msgs);
}
function markMessageRead(id, email) {
  if (SERVER.on) {
    api('POST', '/api/messages/' + id + '/read').then(refreshMessages).catch(() => {});
    const m = SERVER.messages.find(x => x.id === id);
    if (m && !m.readBy.includes(email)) m.readBy.push(email);
    return;
  }
  const msgs = getMessages();
  const m = msgs.find(x => x.id === id);
  if (m && !m.readBy.includes(email)) { m.readBy.push(email); saveMessages(msgs); }
}
// Messages in a user's inbox/outbox: anything addressed to them or broadcast, plus what they sent.
function userMessages(email) {
  return getMessages().filter(m =>
    m.to === email || m.to === 'ALL' || m.from === email
  ).slice().sort((a, b) => b.time - a.time);
}
function unreadCount(email) {
  return getMessages().filter(m => !m.readBy.includes(email) &&
    (m.to === email || m.to === 'ALL') && m.from !== email).length;
}
function conversationPartners(email) {
  const set = {};
  getMessages().forEach(m => {
    if (m.from === 'admin' || m.to === 'admin') set['Rent-RO-Vastra (Admin)'] = 'admin';
    else if (m.from === email && m.to !== 'ALL') set[m.to] = m.to;
    else if (m.to === email && m.from !== 'ALL') set[m.from] = m.from;
  });
  return Object.values(set);
}
function adminMessages() {
  return getMessages().filter(m => m.from === 'admin' || m.to === 'admin' || m.to === 'ALL')
    .slice().sort((a, b) => b.time - a.time);
}
function updateMsgCount() {
  const user = currentUser();
  document.querySelectorAll('#msgBadge').forEach(el => {
    const n = user ? unreadCount(user.email) : 0;
    el.textContent = n;
    el.style.display = n > 0 ? '' : 'none';
  });
}

// ORDERS (user-scoped)
function getOrders() {
  if (SERVER.on) return SERVER.orders;
  return JSON.parse(localStorage.getItem('luxe_orders') || '[]');
}
function saveOrders(o) { if (!SERVER.on) localStorage.setItem('luxe_orders', JSON.stringify(o)); }

// Multi-day pricing: 3+ days = 15% off, 7+ days = 25% off (single source of truth used by cart, checkout, detail calc)
function dayDiscount(days) { return days >= 7 ? 0.25 : days >= 3 ? 0.15 : 0; }
function rentalTotal(price, days, qty) {
  const d = Math.max(days || 1, 1), q = Math.max(qty || 1, 1);
  return price * d * (1 - dayDiscount(d)) * q;
}
// Cancellation: full refund if cancelled 48+ hours before the rental starts, else 50% (see FAQ)
function cancelRefund(o) {
  if (o && o.startDate) {
    const start = new Date(o.startDate + 'T00:00:00');
    if (start - Date.now() < 48 * 3600 * 1000) return 50;
  }
  return 100;
}
async function cancelOrder(id) {
  if (SERVER.on) {
    try {
      await api('POST', '/api/orders/' + id + '/cancel');
      const r = await api('GET', '/api/orders');
      SERVER.orders = r.orders || [];
      return SERVER.orders.find(x => x.id === id);
    } catch (e) { return null; }
  }
  const orders = getOrders();
  const o = orders.find(x => x.id === id);
  if (o && o.status !== 'Cancelled') {
    o.refund = cancelRefund(o);
    o.status = 'Cancelled';
    saveOrders(orders);
  }
  return o;
}

// PRODUCTS + STOCK
function getProducts() {
  if (SERVER.on) return SERVER.products;
  const p = JSON.parse(localStorage.getItem('luxe_products') || DEFAULT_PRODUCTS);
  const defaults = JSON.parse(DEFAULT_PRODUCTS);
  return p.map(prod => {
    if (prod.stock === undefined) prod = Object.assign({}, prod, { stock: 3 });
    if (!prod.images || prod.images.length < 2) {
      const d = defaults.find(x => x.id === prod.id);
      prod = Object.assign({}, prod, { images: (d && d.images && d.images.length >= 2 ? d.images : [prod.img].filter(Boolean)) });
    }
    if (!prod.img) prod = Object.assign({}, prod, { img: prod.images[0] });
    return prod;
  });
}
function saveProducts(p) { if (!SERVER.on) localStorage.setItem('luxe_products', JSON.stringify(p)); }
var DEFAULT_PRODUCTS = JSON.stringify([
  { id: 1, name: 'Sabyasachi Silk Lehenga', category: 'evening', price: 7499, img: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', stock: 3, active: true, images: ['https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80', 'https://images.unsplash.com/photo-1565483299862-1e4e0b0f45f0?w=400&q=80'] },
  { id: 2, name: 'Tarun Tahiliani Sherwani', category: 'formal', price: 5499, img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', stock: 4, active: true, images: ['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80'] },
  { id: 3, name: 'Manish Malhotra Cocktail Gown', category: 'cocktail', price: 6099, img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', stock: 2, active: true, images: ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80', 'https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400&q=80'] },
  { id: 4, name: 'Anita Dongre Anarkali Suit', category: 'outerwear', price: 4699, img: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80', stock: 5, active: true, images: ['https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80', 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=80', 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&q=80'] },
  { id: 5, name: 'Ritu Kumar Bridal Lehenga', category: 'evening', price: 7999, img: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80', stock: 1, active: true, images: ['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80', 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80'] },
  { id: 6, name: 'Rahul Mishra Tuxedo', category: 'formal', price: 9299, img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', stock: 2, active: true, images: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80'] },
  { id: 7, name: 'Kundan Bridal Set', category: 'accessories', price: 3899, img: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&q=80', stock: 6, active: true, images: ['https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&q=80', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80'] },
  { id: 8, name: 'Anamika Khrama Cocktail Dress', category: 'cocktail', price: 6599, img: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80', stock: 3, active: true, images: ['https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', 'https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400&q=80'] },
  { id: 9, name: 'Masaba Gupta Printed Jacket', category: 'outerwear', price: 4099, img: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=80', stock: 4, active: true, images: ['https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=80', 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&q=80', 'https://images.unsplash.com/photo-1544441893-675973e31985?w=400&q=80'] },
  { id: 10, name: 'Sabyasachi Heritage Saree', category: 'accessories', price: 10099, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80', stock: 1, active: true, images: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80', 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&q=80'] },
  { id: 11, name: 'Neeta Lulla Evening Gown', category: 'evening', price: 8899, img: 'https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400&q=80', stock: 2, active: true, images: ['https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400&q=80', 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80'] },
  { id: 12, name: 'Shantanu & Nikhil Blazer', category: 'formal', price: 4999, img: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80', stock: 3, active: true, images: ['https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80'] }
]);

// 10-day cleaning buffer: a booked item is unavailable 10 days before + 10 days after its rental
var STOCK_BUFFER = 10;
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
function rangesOverlap(s1, e1, s2, e2) { return s1 <= e2 && s2 <= e1; }

// availability = total stock minus active bookings whose [start-10, end+10] window overlaps the requested dates
const STOCK_STUB_KEY = {};
function stockAvailability(productId, startDate, endDate) {
  if (SERVER.on) {
    const key = String(productId) + '|' + (startDate || '') + '|' + (endDate || '');
    if (STOCK_STUB_KEY[key]) return STOCK_STUB_KEY[key];
    const product = getProducts().find(p => Number(p.id) === Number(productId));
    const total = product ? (product.stock || 1) : 0;
    const stub = { total: total, booked: 0, available: total, enough: total > 0, exists: !!product, _optimistic: true };
    refreshAvailability(productId, startDate, endDate);
    return stub;
  }
  const product = getProducts().find(p => p.id === productId);
  if (!product) return { total: 0, booked: 0, available: 0, enough: false, exists: false };
  const total = product.stock || 1;
  if (!startDate || !endDate) return { total: total, booked: 0, available: total, enough: total > 0, exists: true };
  const booked = getOrders().filter(o =>
    o.productId === productId &&
    o.status !== 'Cancelled' &&
    o.startDate && o.endDate &&
    rangesOverlap(startDate, endDate, shiftDate(o.startDate, -STOCK_BUFFER), shiftDate(o.endDate, STOCK_BUFFER))
  ).length;
  const available = Math.max(0, total - booked);
  return { total: total, booked: booked, available: available, enough: available > 0, exists: true };
}
async function refreshAvailability(productId, startDate, endDate) {
  if (!SERVER.on) return;
  const qs = new URLSearchParams({ productId, startDate: startDate || '', endDate: endDate || '' });
  try {
    const r = await api('/api/stock/check?' + qs.toString());
    STOCK_STUB_KEY[String(productId) + '|' + (startDate || '') + '|' + (endDate || '')] = r;
    document.dispatchEvent(new CustomEvent('availability-updated'));
  } catch (e) {}
}

// REVIEWS (type: 'site' = whole website, 'item' = one product)
const REVIEWS_KEY = 'luxe_reviews';
function getReviews(type, itemId) {
  const all = SERVER.on ? SERVER.reviews : JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
  return all.filter(r => r.type === type && (type === 'site' || r.itemId === itemId));
}
function addReview(data) {
  if (SERVER.on) {
    api('POST', '/api/reviews', {
      body: { type: data.type || 'site', itemId: data.itemId || 0, rating: data.rating, text: data.text }
    }).then(r => {
      const u = currentUser();
      SERVER.reviews.push({ id: r.id, type: data.type || 'site', itemId: data.itemId || null, name: data.name, rating: data.rating, text: data.text, email: u ? u.email : null, time: Date.now() });
    }).catch(() => {});
    return;
  }
  const r = JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
  const u = currentUser();
  r.push({ id: Date.now() + Math.random(), type: data.type, itemId: data.itemId || null, name: data.name, rating: data.rating, text: data.text, email: u ? u.email : null, time: Date.now() });
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(r));
}
function reviewStars(n) { return '★'.repeat(n) + '☆'.repeat(5 - Math.max(0, n)); }
function reviewAvg(type, itemId) {
  const r = getReviews(type, itemId);
  return r.length ? (r.reduce((s, x) => s + x.rating, 0) / r.length) : 0;
}
function allReviews() {
  if (SERVER.on) return SERVER.reviews;
  return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '[]');
}
function deleteReview(id) {
  if (SERVER.on) {
    api('DELETE', '/api/reviews/' + id).catch(() => {});
    SERVER.reviews = SERVER.reviews.filter(r => r.id !== id);
    return;
  }
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(allReviews().filter(r => r.id !== id)));
}

// Page loader
window.addEventListener('load', () => {
  document.querySelectorAll('.page-loader').forEach(loader => setTimeout(() => loader.classList.add('hide'), 300));
});

// Update cart count on all pages
document.addEventListener('DOMContentLoaded', function () {
  updateCartCount();
  updateWishCount();
  updateMsgCount();
  // Header search stays wired: Enter jumps to catalog filtered by the query
  const hs = document.getElementById('headerSearch');
  if (hs) hs.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      const q = hs.value.trim();
      window.location.href = 'catalog.html' + (q ? '#q=' + encodeURIComponent(q) : '');
    }
  });
});

// Once data (re)loads from the backend, refresh the header badges.
storeReady(() => { updateCartCount(); updateWishCount(); updateMsgCount(); });
