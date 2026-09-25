// ADMIN ACCESS via ?Author in URL
if (location.search.toLowerCase().includes('author')) {
  location.href = 'admin.html' + location.search;
}

// Mobile: pull the hamburger into the main header (far right) and lift the
// drawer out of the floating glass nav so that nav can be hidden entirely.
(function () {
  if (window.innerWidth > 900) return;
  const hb = document.querySelector('.hamburger');
  const links = document.getElementById('navLinks');
  const wrap = document.querySelector('nav:not(.account-nav)');
  const icons = document.querySelector('.header-icons');
  if (!hb || !links || !wrap || !icons) return;
  document.body.appendChild(links);   // drawer becomes viewport-fixed body child
  icons.appendChild(hb);              // hamburger lands inside the header, right side
  wrap.style.display = 'none';        // glass navbar gone on mobile
})();

// Nav pill — transfers between links, settles on the active link, hidden on pages outside the menu
(function () {
  const host = document.querySelector('nav:not(.account-nav) .nav-links');
  if (!host) return;
  const pill = host.querySelector('.nav-pill') || (function () { const s = document.createElement('span'); s.className = 'nav-pill'; host.prepend(s); return s; })();
  const links = Array.prototype.filter.call(host.querySelectorAll(':scope > a'), a => !a.classList.contains('hamburger'));
  const active = host.querySelector('a.active') || null;
  const setPill = (a) => {
    if (a) {
      pill.style.opacity = 1;
      pill.style.width = a.offsetWidth + 'px';
      pill.style.transform = 'translateX(' + a.offsetLeft + 'px)';
    } else {
      pill.style.opacity = 0;
    }
  };
  setPill(active);
  links.forEach(a => a.addEventListener('mouseenter', () => setPill(a)));
  host.addEventListener('mouseleave', () => setPill(active));
})();

// Header icon pill — matches current page (cart on cart/checkout, heart on wishlist, account on account/auth)
(function () {
  const page = location.pathname.split('/').pop();
  let sel = null;
  if (page === 'cart.html' || page === 'checkout.html') sel = 'a[href="cart.html"]';
  else if (page === 'wishlist.html') sel = 'a[href="wishlist.html"]';
  else if (page === 'messages.html') sel = 'a[href="messages.html"]';
  else if (page === 'account.html' || page === 'auth.html') sel = 'a.header-account';
  if (!sel) return;
  const icon = document.querySelector('.header-icons ' + sel);
  if (icon) icon.classList.add('active');
})();

// Toast notification
let toastTimer;
function showToast(msg) {
  let t = document.getElementById('siteToast');
  if (!t) { t = document.createElement('div'); t.id = 'siteToast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// Bounce the header cart icon
function bounceCart() {
  const icon = document.querySelector('.header-icons a[href="cart.html"]');
  if (!icon) return;
  icon.classList.remove('bounce');
  void icon.offsetWidth;
  icon.classList.add('bounce');
}

// Fly a mini-picture of the item into a header icon (cart or wishlist), starting from the clicked element
function flyToIcon(item, iconSel, okMsg, originEl) {
  let icon = document.querySelector('.header-icons ' + iconSel);
  if (!icon && window.innerWidth <= 900) icon = document.querySelector('.bottom-nav ' + iconSel);
  if (!icon || !item || !item.img) {
    if (icon) { icon.classList.remove('bounce'); void icon.offsetWidth; icon.classList.add('bounce'); }
    showToast(okMsg); return;
  }
  const start = originEl
    ? { x: originEl.getBoundingClientRect().left + originEl.getBoundingClientRect().width / 2 - 35, y: originEl.getBoundingClientRect().top + originEl.getBoundingClientRect().height / 2 - 45 }
    : { x: window.innerWidth / 2 - 35, y: window.innerHeight / 2 - 45 };
  const iconR = icon.getBoundingClientRect();
  const dx = iconR.left + iconR.width / 2 - 35 - start.x;
  const dy = iconR.top + iconR.height / 2 - 45 - start.y;
  const img = document.createElement('img');
  img.alt = '';
  img.src = item.img;
  img.style.cssText = 'position:fixed;left:' + start.x + 'px;top:' + start.y + 'px;width:70px;height:90px;object-fit:cover;border-radius:8px;border:1px solid rgba(201,169,110,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.6);z-index:9999;pointer-events:none;transform:scale(1);opacity:1;';
  document.body.appendChild(img);
  img.style.transition = 'transform 0.75s cubic-bezier(0.55,-0.25,0.7,0.4)';
  void img.offsetWidth;
  requestAnimationFrame(() => {
    img.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(0.12)';
    img.style.opacity = '0.9';
  });
  setTimeout(() => {
    img.remove();
    icon.classList.remove('bounce'); void icon.offsetWidth; icon.classList.add('bounce');
    showToast(okMsg);
  }, 780);
}

// Fly to cart icon (shorthand)
function flyToCart(item, originEl) { flyToIcon(item, 'a[href="cart.html"]', 'Added to cart', originEl); }

// Fly to wishlist heart icon
function flyToWishlist(item, originEl) { flyToIcon(item, 'a[href="wishlist.html"]', 'Added to wishlist', originEl); }

// Mobile bottom nav (app-style icon bar) — injected once, shows only on small screens.
(function () {
  const page = location.pathname.split('/').pop();
  const svg = {
    home: '<svg viewBox="0 0 24 24"><path d="M12 3l10 8h-3v9h-5v-6h-4v6H5v-9H2z"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M4 3h6v6H4zM14 3h6v6h-6zM4 13h6v6H4zM14 13h6v6h-6z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg>',
    me: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
  };
  const items = [
    ['index.html', 'Home', svg.home],
    ['catalog.html', 'Shop', svg.shop],
    ['wishlist.html', 'Wishlist', svg.heart, 'wishBadge'],
    ['cart.html', 'Cart', svg.cart, 'cartCount'],
    ['account.html', 'Me', svg.me]
  ];
  let active = 'index.html';
  if (page === 'catalog.html') active = 'catalog.html';
  else if (page === 'wishlist.html') active = 'wishlist.html';
  else if (page === 'cart.html' || page === 'checkout.html') active = 'cart.html';
  else if (page === 'account.html' || page === 'auth.html') active = 'account.html';
  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Mobile navigation');
  nav.innerHTML = items.map(it => {
    const badge = it[3] ? '<span class="h-badge" id="' + it[3] + '"' + (it[3] === 'cartCount' ? '' : ' style="display:none"') + '>0</span>' : '';
    return '<a href="' + it[0] + '"' + (active === it[0] ? ' class="active"' : '') + '>' + it[2] + '<span>' + it[1] + '</span>' + badge + '</a>';
  }).join('');
  document.body.appendChild(nav);
})();

// Nav scroll effect
window.addEventListener('scroll', () => {
  document.querySelector('nav').classList.toggle('scrolled', window.scrollY > 50);
});

// Catalog filter
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.card').forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.category === filter) ? '' : 'none';
    });
  });
});

// Multi-day pricing note under every product card price (catalog + home)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.card-price').forEach(p => {
    if (!p.querySelector('.card-multi')) {
      const n = document.createElement('div');
      n.className = 'card-multi';
      n.textContent = '3+ days −15% · 7+ days −25%';
      p.appendChild(n);
    }
  });
});

// Rental price calculator
const startEl = document.getElementById('rentStart');
const endEl = document.getElementById('rentEnd');
if (startEl && endEl) {
  const calc = () => {
    const start = new Date(startEl.value);
    const end = new Date(endEl.value);
    if (start && end && end >= start) {
      const days = Math.ceil((end - start) / 86400000) + 1;
      const base = window.PRODUCT_PRICE || 7499;
      const discount = dayDiscount(days);
      const total = (base * days * (1 - discount)).toFixed(2);
      document.getElementById('dayCount').textContent = days;
      document.getElementById('totalPrice').textContent = '₹' + total;
      const hint = document.getElementById('discountHint');
      if (hint) hint.innerHTML = discount
        ? '<span style="color:#4CAF50;">&#10003; ' + (days >= 7 ? '25%' : '15%') + ' off applied for ' + days + ' days</span>'
        : '<span style="color:#999;">1&ndash;2 days &mdash; standard per-day rate (no discount)</span>';
    }
  };
  startEl.addEventListener('change', calc);
  endEl.addEventListener('change', calc);
}

// Set min dates
const today = new Date().toISOString().split('T')[0];
document.querySelectorAll('input[type="date"]').forEach(el => el.min = today);

// Reviews — mounts a star-rating form + list into any [data-review-type] block.
// data-review-type="site" = whole website, data-review-type="item" (with data-item="productID") = one product.
document.addEventListener('DOMContentLoaded', function () {
  const starHTML = '<button type="button" class="rev-star" data-v="1" aria-label="1 star">&#9733;</button><button type="button" class="rev-star" data-v="2" aria-label="2 stars">&#9733;</button><button type="button" class="rev-star" data-v="3" aria-label="3 stars">&#9733;</button><button type="button" class="rev-star" data-v="4" aria-label="4 stars">&#9733;</button><button type="button" class="rev-star" data-v="5" aria-label="5 stars">&#9733;</button>';
  const CONSENT_NOTE = 'By submitting you consent to us storing and displaying your review. See our <a href="privacy.html" target="_blank">Privacy Policy</a>.';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  document.querySelectorAll('[data-review-type]').forEach(block => {
    const type = block.dataset.reviewType;
    const itemId = parseInt(block.dataset.item) || null;
    block.innerHTML =
      '<div class="rev-form">' +
      '<div class="form-group"><label>Your Name</label><input type="text" id="revName" maxlength="50"></div>' +
      '<div class="form-group"><label>Rating</label><div class="rev-stars" role="radiogroup" aria-label="Star rating">' + starHTML + '</div></div>' +
      '<div class="form-group"><label>Review</label><textarea id="revText" rows="3" maxlength="500" placeholder="Share your experience..."></textarea></div>' +
      '<label style="display:flex;align-items:flex-start;gap:8px;font-size:0.78rem;color:var(--text-muted);margin-bottom:16px;cursor:pointer;"><input type="checkbox" id="revConsent" style="accent-color:var(--gold);margin-top:3px;" required> ' + CONSENT_NOTE + '</label>' +
      '<button class="btn-primary" type="button" id="revSubmit">Post Review</button>' +
      '<div id="revMsg" style="margin-top:12px;font-size:0.85rem;"></div>' +
      '</div>' +
      '<div class="rev-reviews"><div class="rev-summary"></div><div class="rev-list"></div></div>';

    const refs = {
      name: block.querySelector('#revName'),
      text: block.querySelector('#revText'),
      stars: block.querySelector('.rev-stars'),
      consent: block.querySelector('#revConsent'),
      msg: block.querySelector('#revMsg'),
      avg: block.querySelector('.rev-summary'),
      list: block.querySelector('.rev-list'),
      submit: block.querySelector('#revSubmit'),
      rating: 0
    };

    function renderStars() {
      const list = getReviews(type, itemId);
      const n = list.length;
      const avg = reviewAvg(type, itemId);
      const fill = i => i < Math.round(avg) ? '#f5c518' : '#999';
      refs.avg.innerHTML = n
        ? '<div class="rev-summary"><div class="rev-summary-stars">' + [1, 2, 3, 4, 5].map(i => fill(i)).map(c => '<span style="color:' + c + '">&#9733;</span>').join('') + '</div><div class="rev-summary-num">' + avg.toFixed(1) + ' / 5 &mdash; ' + n + (n === 1 ? ' review' : ' reviews') + '</div></div>'
        : '<div class="rev-summary rev-none">No reviews yet &mdash; be the first to review.</div>';
      refs.list.innerHTML = n
        ? list.slice().sort((a, b) => b.time - a.time).map(r => '<div class="rev-card"><div class="rev-card-head"><span class="rev-card-name">' + esc(r.name || 'Anonymous') + '</span><span class="rev-card-stars">' + reviewStars(r.rating) + '</span></div><p>' + esc(r.text) + '</p></div>').join('')
        : '';
    }
    function resetForm() {
      refs.rating = 0;
      refs.name.value = (function () { const u = currentUser(); return u ? u.first + ' ' + (u.last || '') : ''; }());
      refs.text.value = '';
      refs.consent.checked = false;
      [].forEach.call(refs.stars.querySelectorAll('.rev-star'), s => s.classList.remove('on'));
    }

    refs.stars.addEventListener('click', e => {
      const star = e.target.closest('.rev-star');
      if (!star) return;
      refs.rating = parseInt(star.dataset.v);
      [].forEach.call(refs.stars.querySelectorAll('.rev-star'), s => s.classList.toggle('on', parseInt(s.dataset.v) <= refs.rating));
    });
    refs.stars.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const star = e.target.closest('.rev-star');
      if (!star) return;
      e.preventDefault();
      refs.rating = parseInt(star.dataset.v);
      [].forEach.call(refs.stars.querySelectorAll('.rev-star'), s => s.classList.toggle('on', parseInt(s.dataset.v) <= refs.rating));
    });
    refs.submit.addEventListener('click', () => {
      const name = refs.name.value.trim();
      const text = refs.text.value.trim();
      if (!refs.rating) { refs.msg.innerHTML = '<span style="color:#ff8a80;">Please select a star rating.</span>'; return; }
      if (!text) { refs.msg.innerHTML = '<span style="color:#ff8a80;">Please write a short review.</span>'; return; }
      if (!refs.consent.checked) { refs.msg.innerHTML = '<span style="color:#ff8a80;">Please confirm you agree to your review being shown.</span>'; return; }
      addReview({ type: type, itemId: itemId, name: name || 'Anonymous', rating: refs.rating, text: text });
      refs.msg.innerHTML = '<span style="color:#4CAF50;">&#10003; Thanks for your review!</span>';
      renderStars();
      resetForm();
    });
    resetForm();
    renderStars();
  });
});

// Storage & AI consent notice (honest: no tracking cookies, data lives in localStorage; chat goes to Google)
document.addEventListener('DOMContentLoaded', function () {
  if (typeof localStorage === 'undefined') return;
  if (localStorage.getItem('luxe_consent')) return;
  const b = document.createElement('div');
  b.id = 'consentBanner';
  b.setAttribute('role', 'region');
  b.setAttribute('aria-label', 'Data and storage notice');
  const p = document.createElement('p');
  p.innerHTML = 'Rent-RO-Vastra stores your cart, orders and messages only in your own browser (localStorage) and uses <strong>no tracking cookies</strong>. The optional chat assistant sends your message to our AI provider (Google) to generate a reply. See our <a href="privacy.html">Privacy Policy</a> and <a href="cookies.html">Cookie &amp; Storage Policy</a>.';
  const btn = document.createElement('button');
  btn.textContent = 'Got it';
  btn.addEventListener('click', () => { localStorage.setItem('luxe_consent', '1'); b.remove(); });
  b.appendChild(p);
  b.appendChild(btn);
  document.body.appendChild(b);
});

// Global a11y pass: accessible names for common icon/placeholder-only controls
document.addEventListener('DOMContentLoaded', function () {
  const search = document.getElementById('headerSearch');
  if (search && !search.getAttribute('aria-label')) { search.setAttribute('aria-label', 'Search products'); search.setAttribute('placeholder', 'Search designer pieces...'); }
  document.querySelectorAll('.hamburger').forEach(h => {
    if (!h.getAttribute('aria-label')) h.setAttribute('aria-label', 'Toggle navigation menu');
    h.setAttribute('aria-expanded', 'false');
    h.addEventListener('click', () => h.setAttribute('aria-expanded', h.classList.contains('open') ? 'false' : 'true'));
  });
});

// Hover gallery on catalog product cards — shows ‹ › arrows over the image to click through gallery images manually
document.addEventListener('DOMContentLoaded', function () {
  if (!location.pathname.endsWith('catalog.html') && !location.pathname.endsWith('index.html')) return;
  document.querySelectorAll('#catalogGrid .card').forEach(card => {
    const wrap = card.querySelector('.card-img-wrap');
    const img = card.querySelector('.card-img');
    if (!wrap || !img) return;
    const orig = img.src;
    const title = card.querySelector('.card-title');
    const p = title ? getProducts().find(x => x.name === title.textContent) : null;
    const imgs = p && p.images && p.images.length > 1
      ? p.images.map(s => s.replace('w=400', 'w=600'))
      : null;
    if (!imgs) return;

    const prev = document.createElement('button');
    const next = document.createElement('button');
    prev.className = 'card-nav card-nav-prev'; prev.innerHTML = '&#10094;';
    next.className = 'card-nav card-nav-next'; next.innerHTML = '&#10095;';
    let i = 0;
    const show = () => { prev.style.opacity = 1; next.style.opacity = 1; };
    const hide = () => { prev.style.opacity = 0; next.style.opacity = 0; };
    prev.addEventListener('click', e => { e.stopPropagation(); i = (i + imgs.length - 1) % imgs.length; img.src = imgs[i]; });
    next.addEventListener('click', e => { e.stopPropagation(); i = (i + 1) % imgs.length; img.src = imgs[i]; });
    card.addEventListener('mouseenter', () => { i = 0; img.src = orig; show(); });
    card.addEventListener('mouseleave', () => { img.src = orig; hide(); });
    wrap.appendChild(prev);
    wrap.appendChild(next);
    hide();
  });
});
