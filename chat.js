(function() {
  // Immutable default seed; real source of truth is luxe_products (admin).
  const defaultProducts = [
    { id: 1, name: 'Sabyasachi Silk Lehenga', category: 'evening', occasion: ['gala', 'wedding', 'reception', 'sangeet'], style: ['elegant', 'classic', 'glamorous'], budget: 'premium', price: 7499, img: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 2, name: 'Tarun Tahiliani Sherwani', category: 'formal', occasion: ['wedding', 'engagement', 'reception', 'formal'], style: ['classic', 'royal', 'sharp'], budget: 'mid', price: 5499, img: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80', link: '/piece/' + id, gender: 'men' },
    { id: 3, name: 'Manish Malhotra Cocktail Gown', category: 'cocktail', occasion: ['party', 'cocktail', 'reception', 'date night'], style: ['glamorous', 'chic', 'feminine'], budget: 'premium', price: 6099, img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 4, name: 'Anita Dongre Anarkali Suit', category: 'outerwear', occasion: ['festival', 'puja', 'family function', 'diwali'], style: ['classic', 'elegant', 'traditional'], budget: 'mid', price: 4699, img: 'https://images.unsplash.com/photo-1617137968427-85924c800a22?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 5, name: 'Ritu Kumar Bridal Lehenga', category: 'evening', occasion: ['wedding', 'sangeet', 'mehendi', 'reception'], style: ['glamorous', 'bridal', 'ornate'], budget: 'premium', price: 7999, img: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 6, name: 'Rahul Mishra Tuxedo', category: 'formal', occasion: ['gala', 'wedding', 'cocktail', 'formal event'], style: ['glamorous', 'bold', 'luxurious'], budget: 'luxury', price: 9299, img: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80', link: '/piece/' + id, gender: 'men' },
    { id: 7, name: 'Kundan Bridal Set', category: 'accessories', occasion: ['wedding', 'engagement', 'reception', 'sangeet'], style: ['elegant', 'classic', 'glamorous'], budget: 'mid', price: 3899, img: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 8, name: 'Anamika Khrama Cocktail Dress', category: 'cocktail', occasion: ['party', 'cocktail', 'night out', 'birthday'], style: ['chic', 'trendy', 'feminine'], budget: 'premium', price: 6599, img: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 9, name: 'Masaba Gupta Printed Jacket', category: 'outerwear', occasion: ['casual', 'brunch', 'college', 'travel'], style: ['edgy', 'bold', 'trendy'], budget: 'mid', price: 4099, img: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&q=80', link: '/piece/' + id, gender: 'unisex' },
    { id: 10, name: 'Sabyasachi Heritage Saree', category: 'accessories', occasion: ['wedding', 'festival', 'diwali', 'pooja'], style: ['classic', 'luxurious', 'traditional'], budget: 'luxury', price: 10099, img: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 11, name: 'Neeta Lulla Evening Gown', category: 'evening', occasion: ['gala', 'black-tie', 'red carpet', 'cocktail'], style: ['glamorous', 'luxurious', 'elegant'], budget: 'luxury', price: 8899, img: 'https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=400&q=80', link: '/piece/' + id, gender: 'women' },
    { id: 12, name: 'Shantanu & Nikhil Blazer', category: 'formal', occasion: ['interview', 'business', 'dinner', 'wedding'], style: ['sharp', 'trendy', 'professional'], budget: 'mid', price: 4999, img: 'https://images.unsplash.com/photo-1593030761757-71fae45fa0e7?w=400&q=80', link: '/piece/' + id, gender: 'men' }
  ];

  const LOG_KEY = 'luxe_chat_log';
  const AI_KEY = 'luxe_chat_ai';

  let products;
  try {
    products = JSON.parse(localStorage.getItem('luxe_products') || 'null') || defaultProducts;
  } catch(e) { products = defaultProducts; }
  products = products.filter(p => p.active !== false);
  if (!products.length) products = defaultProducts;

  const KB = {
    pricing: "Pricing ₹3,899/din se start. Multi-day discount bhi hai — 3 din = 15% off, 7+ din = 25% off. Mainpuri aur Etawah me delivery hamesha free.",
    delivery: "Mainpuri aur Etawah me next-day delivery free. Tumhare event se 1-2 din pehle hi piece pahunch jata hai.",
    returns: "Dry cleaning ki tension mat lo — wapas dete waqt bas bag me daal do, pickup set kar do, baaki hum sambhal lenge.",
    damage: "Normal halka wear chalega. Real damage ya stain hua to repair/replacement charge lagega — woh renter ki jimmedari hai.",
    sizing: "Sizes: ladies XS-XXL, gents S-3XL. Fit na lage to 24 ghante ke andar free exchange ho jata hai.",
    booking: "Best availability ke liye 1-2 hafte pehle book kar lo. Wedding aur festive season me popular pieces jaldi khatam ho jaate hain.",
    cancellation: "Delivery se 48 ghante pehle tak free cancellation. 48 ghante ke andar 50% charge lagta hai.",
    cleaning: "Har rental ke baad sab kuch professional cleaning + ironing hota hai. Tumhe kuch nahi karna.",
    members: "Rent-RO-Vastra members ko new arrivals ki early access, har rental pe 10% off aur free priority delivery milti hai.",
    brands: "Sath chalte hain Sabyasachi, Manish Malhotra, Tarun Tahiliani, Anita Dongre, Rahul Mishra, Ritu Kumar, Neeta Lulla, Masaba Gupta, Anamika Khanna aur 200+ aur brands."
  };

  const el = {};
  const state = { step: 'init', filters: {}, dateCtx: null, lastResult: [] };
  let logLoaded = false;

  // ---------- helpers ----------
  function prop(p, k) { return (p[k] || []).map ? p[k] : (Array.isArray(p[k]) ? p[k] : []); }
  function matchesOccasion(p, o) { return o ? prop(p, 'occasion').some(x => (o + '').length > 1 && x.includes(o)) : true; }
  function normalizeBudget(b) {
    const map = { mid: 'mid', premium: 'premium', luxury: 'luxury' };
    return map[b] || b;
  }
  function fmt(n) { return '₹' + n.toLocaleString('en-IN'); }
  function eff(p) { const d = Math.min(90, Math.max(0, Number(p && p.discount) || 0)); return Math.round((Number(p && p.price) || 0) * (1 - d / 100)); }

  function availFor(p) {
    const c = state.dateCtx;
    if (!c) return null;
    const a = stockAvailability(p.id, c.start, c.end);
    return a;
  }

  function searchProducts(filters) {
    const f = filters || {};
    let res = products.filter(p => {
      if (f.occasion && !matchesOccasion(p, f.occasion)) return false;
      if (f.style && !prop(p, 'style').some(s => s.includes(f.style))) return false;
      if (f.category && p.category !== f.category) return false;
      if (f.gender && p.gender !== f.gender && p.gender !== 'unisex') return false;
      if (typeof f.budget === 'string' && normalizeBudget(p.budget) !== normalizeBudget(f.budget)) return false;
      if (f.budget && typeof f.budget === 'object') {
        if (f.budget.low && p.price < f.budget.low) return false;
        if (f.budget.high && p.price > f.budget.high) return false;
      }
      if (f.name && !p.name.toLowerCase().includes(f.name)) return false;
      if (f.onlyAvailable) {
        const a = availFor(p);
        if (a && !a.enough) return false;
      }
      return true;
    });
    if (f.sort === 'price-asc') res = res.slice().sort((a, b) => a.price - b.price);
    if (f.sort === 'price-desc') res = res.slice().sort((a, b) => b.price - a.price);
    if (Array.isArray(f.budget) === false && typeof f.budget === 'string' && res.length && !(f.occasion || f.style || f.category || f.gender || f.name)) res = res.sort((a, b) => a.price - b.price);
    if (!res.length && typeof f.budget === 'string') { const relaxed = Object.assign({}, f); delete relaxed.budget; res = searchProducts(relaxed); }
    if (!res.length && f.budget && typeof f.budget === 'object') { const relaxed = Object.assign({}, f); delete relaxed.budget; res = searchProducts(relaxed); }
    return res;
  }

  // ---------- DOM ----------
  let _suppress = false;
  function init() {
    el.bubble = document.getElementById('chatBubble');
    el.panel = document.getElementById('chatPanel');
    el.messages = document.getElementById('chatMessages');
    el.input = document.getElementById('chatInput');
    el.sendBtn = document.getElementById('chatSend');
    if (!el.bubble) return;

    if (el.bubble.setAttribute) {
      el.bubble.setAttribute('aria-label', 'Open chat');
      el.bubble.setAttribute('aria-expanded', 'false');
    }

    el.bubble.addEventListener('click', () => {
      if (_suppress) { _suppress = false; return; }
      toggle();
    });
    enableBubbleDrag();
    el.sendBtn.addEventListener('click', sendUserMsg);
    el.input.addEventListener('keydown', e => { if (e.key === 'Enter') sendUserMsg(); });
    el.messages.addEventListener('click', e => {
      const t = e.target.closest('.chat-option');
      if (t && t.dataset && t.dataset.value) handleAction(t.dataset.value);
    });
    buildVoiceUI();
    // Refresh = brand-new chat: wipe any previous session's log so the guest starts fresh.
    clearLog();
  }

  function toggle() {
    const open = el.panel.classList.toggle('open');
    el.bubble.classList.toggle('open', open);
    if (el.bubble.setAttribute) el.bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      restoreLog();
      if (state.step === 'init' && el.messages.children.length === 0) {
        greet();
        state.step = 'menu';
      }
    }
  }

  // Drag the chat bubble anywhere on screen; position persists per device.
  function enableBubbleDrag() {
    const b = el.bubble;
    try {
      const saved = JSON.parse(localStorage.getItem('luxe_chat_bubble_pos') || 'null');
      if (saved) {
        b.style.left = saved.left + 'px';
        b.style.top = saved.top + 'px';
        b.style.right = 'auto';
        b.style.bottom = 'auto';
      }
    } catch (e) {}
    let drag = null;
    b.addEventListener('pointerdown', e => {
      const r = b.getBoundingClientRect();
      drag = { startX: e.clientX, startY: e.clientY, baseX: r.left, baseY: r.top, moved: false };
      b.style.transition = 'none';
      b.classList.add('dragging');
      if (b.setPointerCapture) b.setPointerCapture(e.pointerId);
    });
    b.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
      if (!drag.moved) return;
      const w = b.offsetWidth || 60, h = b.offsetHeight || 60;
      b.style.left = Math.min(Math.max(0, drag.baseX + dx), window.innerWidth - w) + 'px';
      b.style.top = Math.min(Math.max(0, drag.baseY + dy), window.innerHeight - h) + 'px';
      b.style.right = 'auto';
      b.style.bottom = 'auto';
    });
    const end = () => {
      if (!drag) return;
      if (drag.moved) {
        _suppress = true;
        const r = b.getBoundingClientRect();
        try { localStorage.setItem('luxe_chat_bubble_pos', JSON.stringify({ left: Math.round(r.left), top: Math.round(r.top) })); } catch (e) {}
      }
      b.style.transition = '';
      b.classList.remove('dragging');
      drag = null;
    };
    b.addEventListener('pointerup', end);
    b.addEventListener('pointercancel', end);
  }

  // External API: open the chat and ask Styla something (used by "Ask Styla" buttons site-side).
  // Accepts a string, or { product: { id/name/category/price/img/stock } } to show a full product rundown.
  window.askStyla = function (arg) {
    if (!el.panel) return;
    const open = el.panel.classList.contains('open');
    const obj = arg && typeof arg === 'object';
    if (!open) toggle();
    if (obj && arg.product) {
      const go = () => showProductIntro(arg.product);
      if (open) go(); else setTimeout(go, 350);
    } else if (arg) {
      el.input.value = arg;
      if (open) sendUserMsg();
      else setTimeout(sendUserMsg, 350);
    }
  };

  function catLabel(c) {
    return { evening: 'Evening Wear', formal: 'Formal', cocktail: 'Cocktail', outerwear: 'Outerwear', accessories: 'Accessories' }[c] || c;
  }

  function showProductIntro(p) {
    const pro = products.find(x => x.id === p.id) || null;
    if (pro) rememberTaste({ lastView: pro.name, cat: pro.category });
    const name = pro ? pro.name : (p.name || 'ye piece');
    const price = eff(pro || p);
    const a = pro ? stockAvailability(pro.id) : null;
    const stockLine = a ? (a.enough ? `${a.available} of ${a.total} abhi free` : `${a.total} pieces listed`) : '';
    addBotMsg(
      `**${esc(name)}** — ${fmt(price)}/din\n` +
      `• ${catLabel(pro ? pro.category : p.category)}\n` +
      `• Stock: ${stockLine}\n` +
      `• Free next-day delivery · Mainpuri & Etawah\n` +
      `• 3+ din 15% off · 7 din 25% off\n` +
      `• Sizes XS–XXL\n\n` +
      `Apne event date ki live availability, pricing ya koi bhi sawaal — pooch lo, main yahin hoon.`
    );
    if (pro) { const c = document.createElement('div'); c.appendChild(showProductCard(pro)); addBotMsg('', c); }
    showOptions(['check availability', 'pricing', 'browse all', 'start over']);
  }

  function addBotMsg(text, cards) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.innerHTML = esc(text).replace(/\n/g, '<br>');
    if (cards) div.appendChild(cards);
    el.messages.appendChild(div);
    appendLog('bot', div.textContent);
    speak(text);
    scrollDown();
  }

  function addUserMsg(text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = text;
    el.messages.appendChild(div);
    appendLog('user', text);
    scrollDown();
  }

  function showOptions(opts) {
    const wrap = document.createElement('div');
    wrap.className = 'chat-options';
    opts.forEach(o => {
      const btn = document.createElement('button');
      btn.className = 'chat-option';
      btn.textContent = o;
      btn.dataset.value = o;
      btn.dataset.action = o;
      wrap.appendChild(btn);
    });
    el.messages.appendChild(wrap);
    scrollDown();
  }

  function showTyping() {
    if (document.getElementById('typing')) return;
    const div = document.createElement('div');
    div.className = 'chat-msg bot';
    div.id = 'typing';
    div.innerHTML = '<div class="chat-typing"><span></span><span></span><span></span></div>';
    el.messages.appendChild(div);
    scrollDown();
  }
  function removeTyping() { const t = document.getElementById('typing'); if (t) t.remove(); }

  function showProductCard(p, forceAvail) {
    const card = document.createElement('div');
    card.className = 'chat-product-card';
    const a = forceAvail || availFor(p);
    let badge = '';
    if (a) {
      if (a.enough) badge = `<div class="chat-avail good">Available · ${a.available} of ${a.total} bache hain</div>`;
      else badge = `<div class="chat-avail bad">Is window me shayad booked hai</div>`;
    }
    card.innerHTML = `<img src="${esc(p.img)}" alt="${esc(p.name)}"><div class="chat-product-card-body"><h5>${esc(p.name)}</h5><div class="chat-card-price">${fmt(eff(p))}/din — ${p.category}${(p.discount > 0 ? ' <s style="opacity:.6">' + fmt(p.price) + '</s> · ' + p.discount + '% OFF' : '')}</div><div class="chat-card-note">3+ din 15% off · 7 din 25% off</div>${badge}<a href="${p.link || '/piece/' + encodeURIComponent(p.id)}">Dekho aur rent karo</a></div>`;
    return card;
  }

  function showCards(list, heading) {
    const cards = document.createElement('div');
    list.forEach(p => cards.appendChild(showProductCard(p)));
    addBotMsg(heading || `Tumhare liye ${list.length} perfect options:` , cards);
    state.lastResult = list;
  }

  function showMenu() {
    showOptions(['wedding attire', 'under ₹5,000', "what's available", 'pricing', 'help me choose']);
  }

  // ---------- history ----------
  function getLog() { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch(e) { return []; } }
  function appendLog(who, text) {
    if (!logLoaded) return;
    const l = getLog().concat([{ who, text }]).slice(-80);
    localStorage.setItem(LOG_KEY, JSON.stringify(l));
  }
  function restoreLog() {
    if (logLoaded) return;
    logLoaded = true;
    const l = getLog().slice(-14); // last few exchanges only, cards not stored
    l.forEach(m => {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + (m.who === 'user' ? 'user' : 'bot');
      div.textContent = m.text;
      el.messages.appendChild(div);
    });
    if (l.length) scrollDown();
  }
  function clearLog() { logLoaded = false; localStorage.removeItem(LOG_KEY); }

  // ---------- NLU ----------
  function hinglish(s) {
    const nums = { ek: '1', do: '2', teen: '3', chaar: '4', char: '4', paanch: '5', chhe: '6', saat: '7', aath: '8', nau: '9', das: '10' };
    // Devanagari (voice mic / typed Hindi) -> Roman so the rules below fire
    const deva = {
      '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9', '०': '0',
      'शादी': ' shaadi ', 'कल': ' kal ', 'आज': ' aaj ', 'फ्री': ' free ', 'मुफ़्त': ' free ', 'मुफ्त': ' free ',
      'दिखाओ': ' dikhao ', 'दिखा': ' dikha ', 'बताओ': ' batao ', 'बता': ' bata ',
      'कितने': ' kitne ', 'कितना': ' kitna ', 'दाम': ' daam ',
      'अंदर': ' andar ', 'नीचे': ' neeche ', 'कम': ' kam ', 'ऊपर': ' upar ', 'ज़्यादा': ' zyada ', 'ज्यादा': ' zyada ',
      'लड़की': ' ladki ', 'बेटी': ' beti ', 'औरत': ' aurat ', 'माँ': ' maa ', 'मम्मी': ' mummy ',
      'लड़का': ' ladka ', 'बेटा': ' beta ', 'पापा': ' papa ', 'पिता': ' pitaji ',
      'मुझे': ' mujhe ', 'चाहिए': ' chahiye ', 'चाहता': ' chahta ', 'चाहती': ' chahti ',
      'सस्ता': ' sasta ', 'सस्ती': ' sasta ', 'महंगा': ' mehnga ', 'महंगी': ' mehnga ',
      'लेहंगा': ' lehenga ', 'लहंगा': ' lehenga ', 'साड़ी': ' saree ', 'साडी': ' saree ',
      'शेरवानी': ' sherwani ', 'गाउन': ' gown ', 'सूट': ' suit ', 'जैकेट': ' jacket ',
      'एक': ' ek ', 'दो': ' do ', 'तीन': ' teen ', 'चार': ' char ', 'पाँच': ' paanch ', 'पांच': ' paanch ',
      'छह': ' chhe ', 'सात': ' saat ', 'आठ': ' aath ', 'नौ': ' nau ', 'दस': ' das ',
      'है': ' hai ', 'हैं': ' hai ', 'हो': ' ho ', 'का': ' ka ', 'की': ' ki ', 'के': ' ke ', 'को': ' ko ',
      'से': ' se ', 'में': ' mein ', 'मे': ' me ', 'और': ' aur ', 'क्या': ' kya ', 'लिए': ' liye ',
      'यह': ' ye ', 'ये': ' ye ', 'वह': ' wo ', 'वो': ' wo ', 'इसे': ' ise ', 'उसे': ' usko '
    };
    let x = ' ' + s.toLowerCase().replace(/[?!.,;]+/g, ' ') + ' ';
    x = x.replace(new RegExp(Object.keys(deva).sort((a, b) => b.length - a.length).join('|'), 'g'), k => deva[k]);
    x = x.replace(/\s+/g, ' ');
    Object.keys(nums).forEach(k => { x = x.replace(new RegExp('\\b' + k + '\\b', 'g'), ' ' + nums[k] + ' '); });
    x = x
      .replace(/\b(shaadi|shadi)\b/g, ' wedding ')
      .replace(/\b(kitne ka|kitna ka|kitne|kitna|daam kya|daam)\b/g, ' price ')
      .replace(/\b(ke andar|ke bheetar|se neeche|se niche|se kam|se upar tak)\b/g, ' within ')
      .replace(/\b(se upar|se zyada|se jyada|se oopar)\b/g, ' above ')
      .replace(/\b(kal)\b/g, ' tomorrow ')
      .replace(/\b(aaj)\b/g, ' today ')
      .replace(/\b(ladki|mahila|beti|aurat|maa|mummy)\b/g, ' mother ')
      .replace(/\b(ladka|aadmi|beta|papa|pitaji)\b/g, ' father ')
      .replace(/\b(dikhao|dikha|dikh|batao|bata|dekh)\b/g, ' show ')
      .replace(/\b(mujhe|mera|meri|chahiye|chahie|chahte|chahti|hai|hain|ho|ka|ki|ke|ko|se|mein|me|aur|kya|ya|ise|usko|uska|uski|ye|yeh|woh|wo|liye|ke liye)\b /g, ' ');
    return x.replace(/\s+/g, ' ').trim();
  }

  const OCCASIONS = ['gala', 'black-tie', 'wedding', 'engagement', 'reception', 'sangeet', 'mehendi', 'interview', 'business', 'party', 'cocktail', 'birthday', 'date night', 'anniversary', 'festival', 'diwali', 'puja', 'family function', 'dinner', 'red carpet', 'brunch', 'casual', 'travel', 'college'];
  const STYLES = ['elegant', 'glamorous', 'classic', 'edgy', 'trendy', 'minimalist', 'bold', 'chic', 'royal', 'sharp', 'bridal', 'ornate', 'traditional', 'luxurious', 'professional'];
  const WOMEN_WORDS = ['wife', 'mother', 'girlfriend', 'sister', 'daughter', 'fiancee', 'bride', 'women', 'woman', 'female', 'ladies', 'lady', 'her ', 'female guest'];
  const MEN_WORDS = ['husband', 'father', 'boyfriend', 'brother', 'son', 'fiance', 'groom', 'men', 'man', 'male', 'gents', 'him '];

  function parseDate(str) {
    const t = str.toLowerCase();
    const m = t.match(/(?:on |for )?(?:(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?|(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})?|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2}))/) || [];
    let d = null;
    if (m[1] && m[2]) {
      let y = m[3] ? +m[3] : new Date().getFullYear();
      d = new Date(y, +m[2] - 1, +m[1]);
    } else if (m[4] && m[5]) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      let y = m[6] ? +m[6] : new Date().getFullYear();
      d = new Date(y, months.indexOf(m[5].slice(0, 3)), +m[4]);
    } else if (m[7] && m[8] && m[8].length >= 3) {
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      d = new Date(new Date().getFullYear(), months.indexOf(m[7].slice(0, 3)), +m[8]);
    }
    if (t.includes('tomorrow')) d = new Date(Date.now() + 86400000);
    if (t.includes('today')) d = new Date();
    if (!d || isNaN(d)) return null;
    const iso = d.toISOString().split('T')[0];
    return { start: iso, end: iso, label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) };
  }

  function parseBudget(str) {
    const t = str.toLowerCase().replace(/[,\s]/g, '');
    let low = null, high = null, sort = null;
    const num = t.match(/(\d{3,7})/);
    const n = num ? parseInt(num[1], 10) : null;
    if (t.includes('under') || t.includes('below') || t.includes('less') || t.includes('max') || t.includes('upto') || t.includes('within') || t.includes('budget')) {
      if (num) { high = n; }
    } else if (t.includes('above') || t.includes('more') || t.includes('+')) {
      if (num) low = n;
    } else if (t.includes('between') && num) {
      const nums = t.match(/(\d{3,7})/g);
      if (nums && nums.length > 1) { low = Math.min(+nums[0], +nums[1]); high = Math.max(+nums[0], +nums[1]); }
      else { high = n; }
    } else if (num && (t.includes('rs') || t.includes('inr') || t.startsWith('rs') || t.includes('₹'))) {
      high = n;
    }
    if (t.includes('cheap') || t.includes('sasta') || t.includes('afford') || t.includes('lowest') || t.includes('budget')) sort = 'price-asc';
    if (t.includes('expensive') || t.includes('luxury') || t.includes('premium') || t.includes('mehnga') || t.includes('top')) sort = 'price-desc';
    if (low === null && high === null && sort === null) return null;
    return { low, high, sort };
  }

  function parseName(str) {
    const t = str.toLowerCase();
    const known = ['lehenga', 'saree', 'sari', 'gown', 'dress', 'sherwani', 'tuxedo', 'blazer', 'jacket', 'anarkali', 'kurta', 'suit', 'jewelry', 'jewellery', 'set'];
    const brand = ['sabyasachi', 'tarun', 'manish', 'anita dongre', 'anita', 'ritu kumar', 'rahul mishra', 'neeta lulla', 'masaba', 'anamika', 'shantanu', 'nikhil', 'kundan'];
    for (const b of brand) if (t.includes(b)) return b.split(' ')[0];
    for (const k of known) if (t.includes(k)) return k === 'sari' ? 'saree' : k;
    return null;
  }

  function parseGender(str) {
    const t = str.toLowerCase();
    if (WOMEN_WORDS.some(w => t.includes(w))) return 'women';
    if (MEN_WORDS.some(w => t.includes(w))) return 'men';
    return null;
  }

  // ---------- intents ----------
  function runIntent(text) {
    const t = text.toLowerCase().trim();

    if (/^(hi|hii+|hello|hey|yo|namaste|namaskar|pranaam|salaam|hola|ji)\b/.test(t) || t === 'hi') {
      const user = currentUser();
      addBotMsg(`Namaste${user ? ' ' + user.first : ''}! Kisi bhi occasion ke liye outfit dhoondh sakti hoon, budget me piece suggest kar sakti hoon, tumhare event date pe kya actually available hai check kar sakti hoon, ya pricing & policy samjha sakti hoon. Kya chahiye?`);
      showMenu();
      return true;
    }
    if (/thanks|thank you|shukriya|dhanyavad/.test(t)) { addBotMsg("Welcome bhai! Aur kuch chahiye — style, budget ya availability — main yahin hoon."); showMenu(); return true; }
    if (/^(bye|goodbye|see you|exit|quit|alvida|phir milenge|tata)\b/.test(t)) { addBotMsg("Alvida! Shandar dikhna — catalog jab chao khol lena. 👋"); return true; }
    if (/^(help|menu|options|what can you do|what do you do)\b/.test(t) || t.includes('capabilities')) {
      addBotMsg("Main ye sab kar sakti hoon:\n• 💍 Occasion, style & gender ke hisaab se outfits\n• 💰 Budget me pieces\n• 📅 Event date pe real availability check\n• 🔎 Naam ya type se search (lehenga, sherwani, saree…)\n• ℹ️ Pricing, delivery, returns & policy ke jawab\n\nEnglish, Hindi aur Hinglish — teeno samajhti hoon. Try karo: \"shaadi ke liye lehenga\" ya \"wedding lehenga under ₹6,000\".");
      showOptions(['wedding lehenga under ₹6,000', "what's free on 10 Nov", 'pricing', 'start over']);
      return true;
    }
    if (t.includes('clear') || t === 'start over' || t === 'reset') {
      clearLog(); el.messages.innerHTML = ''; state.filters = {}; state.dateCtx = null; state.step = 'init';
      const user = currentUser();
      addBotMsg(`Fresh start${user ? ', ' + user.first : ''}! Aaj kya style karein?`);
      showMenu();
      return true;
    }

    // KB lookups
    for (const [key, val] of Object.entries(KB)) {
      if (t.includes(key) ||
          (key === 'pricing' && /pricing|price|cost|how much|rate/.test(t)) ||
          (key === 'delivery' && /deliver|ship|shipping|dispatch/.test(t)) ||
          (key === 'returns' && /return|give back|send back/.test(t)) ||
          (key === 'sizing' && /size|fit|measurement/.test(t)) ||
          (key === 'brands' && /brand|designer/.test(t)) ||
          (key === 'booking' && /book|reserve/.test(t)) ||
          (key === 'cancellation' && /cancel|refund/.test(t)) ||
          (key === 'members' && /member|subscribe|subscription/.test(t))) {
        addBotMsg(val);
        showMenu();
        return true;
      }
    }

    // Availability on a specific date ("what's free on 10 Nov", "available on...", "10 nov ko kya free hai")
    const hasAvailWord = /availab|free|khali|khaali|left|open|for my event|on that date/.test(t);
    const evtDate = parseDate(t);
    if (hasAvailWord && !evtDate) {
      addBotMsg("Bilkul — kis date ke liye live availability check karoon? Try karo: \"10 Nov\", \"15 november\", \"kal\" ya \"tomorrow\".");
      showOptions(['tomorrow', 'browse all', 'start over']);
      return true;
    }
    if (hasAvailWord && evtDate) {
      state.dateCtx = evtDate;
      state.filters.onlyAvailable = true;
      const list = searchProducts(state.filters).slice(0, 3);
      if (list.length) {
        addBotMsg(`Badhiya — **${evtDate.label}** ki real bookings check kar rahi hoon. Ye rahe actually free pieces:`);
        showCards(list, '');
        addBotMsg("Yehi date rakhu? Har suggestion pe live availability tag kar dungi.", createLink('/collection', 'Poora collection dekho'));
      } else {
        addBotMsg(`${evtDate.label} ke liye abhi sab booked hai — koi aur date try karo ya poora collection dekho.`);
      }
      showOptions(['pick a different date', 'browse all', 'start over']);
      return true;
    }

    // New date given after availability mode
    if (evtDate && state.dateCtx) {
      state.dateCtx = evtDate;
      state.filters.onlyAvailable = true;
      addBotMsg(`Theek hai! ${evtDate.label} pe check karti hoon.`);
      const list = searchProducts(state.filters).slice(0, 3);
      if (list.length) showCards(list, `${evtDate.label} pe ye available hain:`);
      else addBotMsg(`${evtDate.label} pe abhi kuch free nahi hai.`);
      showOptions(['browse all', 'start over']);
      return true;
    }

    // Budget ("under 5000", "cheapest", "affordable")
    const budget = parseBudget(t);
    if (budget) {
      state.filters.budget = budget;
      const range = budget.low !== null || budget.high !== null;
      const list = searchProducts({ ...state.filters, sort: budget.sort }).slice(0, 4);
      const heading = 'Ye raha ' + (range ? 'tumhare budget me fit' : budget.sort === 'price-asc' ? 'hamare sabse saste' : budget.sort === 'price-desc' ? 'hamare sabse premium' : 'options') + ':'
      addBotMsg(heading);
      showCards(list, '');
      showOptions(['make it cheaper', 'more options', 'browse all', 'start over']);
      return true;
    }

    // Stock question for a specific product: "is X available"
    if (evtDate && /(is|does).*(availab|left|free)|availab.*(on|for)|booked/.test(t)) {
      state.dateCtx = evtDate;
      const name = parseName(t);
      const query = products.find(p => name && p.name.toLowerCase().includes(name));
      if (query) {
        const a = stockAvailability(query.id, evtDate.start, evtDate.end);
        addBotMsg(a.enough
          ? `Achhi khabar — ${query.name} ${evtDate.label} pe available hai (${a.available} of ${a.total} bache hain). Isse cart me daal doon?`
          : `Maafi, ${query.name} ${evtDate.label} pe poora booked lag raha hai (${a.available} of ${a.total} free). Aise hi aur styles dekh loon?`);
        const cards = document.createElement('div');
        cards.appendChild(showProductCard(query, true));
        addBotMsg('', cards);
      } else {
        addBotMsg("Wo piece mujhe nahi mila — poore list ke liye catalog dekho. " + (name ? `"${name}" se kuch milta-julta nahi.` : ''));
        addBotMsg('Saare pieces yahin milenge:', createLink('/collection', 'Poora collection dekho'));
      }
      showOptions(['browse all', 'start over']);
      return true;
    }

    // Gender parse
    const gender = parseGender(t);
    if (gender) state.filters.gender = gender;

    // Gather filters from text
    const matchedOccasion = OCCASIONS.find(o => t.includes(o));
    const matchedStyle = STYLES.find(s => t.includes(s));
    const matchedName = parseName(t);
    if (matchedOccasion) state.filters.occasion = matchedOccasion;
    if (matchedStyle) state.filters.style = matchedStyle;
    if (matchedName) state.filters.name = matchedName;
    if (t.includes('casual') || t.includes('everyday')) state.filters.occasion = 'casual';

    // Restate intent ("lehenga instead", "show lehenga") keeps prior filters on top of new one
    if (matchedOccasion || matchedStyle || matchedName || gender || (state.filters.occasion || state.filters.name)) {
      state.step = 'done';
      const list = searchProducts(state.filters).slice(0, 3);
      if (list.length) {
        let what = [];
        if (state.filters.occasion) what.push(state.filters.occasion + ' occasion ke liye');
        if (state.filters.style) what.push(state.filters.style + ' style');
        if (state.filters.name) what.push(state.filters.name);
        if (state.dateCtx) what.push(state.dateCtx.label + ' pe available');
        addBotMsg(`Ye rahe mere picks${what.length ? ' — ' + what.join(', ') : ''}:`);
        showCards(list, '');
      } else {
        addBotMsg("Exact match nahi mila — ye raha alternatives:");
        const fallback = products.filter(p => matchesOccasion(p, state.filters.occasion)).slice(0, 2);
        if (fallback.length) showCards(fallback, '');
        else addBotMsg("Koi aur occasion, style ya budget try karo — ya poora collection dekho.", createLink('/collection', 'Poora collection dekho'));
      }
      showOptions(['show more', 'under ₹5,000', 'browse all', 'start over']);
      return true;
    }

    // Colors — graceful degrade (catalog has no color field)
    const colors = ['red', 'gold', 'black', 'white', 'pink', 'maroon', 'blue', 'green', 'silver', 'navy'];
    if (colors.some(c => t.includes(c))) {
      addBotMsg("Achhi taste! Hamare catalog me abhi color tag nahi hai, par occasion ya style ke hisaab se tumhari vibe wala piece dhoondh sakti hoon. Tumhare event ke liye kya chalta hai?");
      showOptions(['wedding attire', 'elegant evening', 'formal look', 'pricing']);
      return true;
    }

    return false; // use LLM / generic
  }

  // ---------- actions (chip buttons) ----------
  function handleAction(val) {
    const v = val.toLowerCase();
    addUserMsg(val);
    state.step = 'menu';

    if (v === 'wedding attire') {
      addBotMsg("Wedding — badhiya choice! Kiske liye aur kya budget?");
      showOptions(['bride · under ₹8,000', 'groom · under ₹6,000', 'wedding guest · elegant', 'help me choose']);
    } else if (v === 'bride · under ₹8,000' || v === 'bride · under ₹6,000') {
      state.filters = { occasion: 'wedding', gender: 'women', budget: v.includes('6,000') ? { high: 8000 } : null };
      const list = searchProducts(state.filters).slice(0, 3);
      showCards(list, list.length ? 'Dulhan ke liye:' : 'Bridal picks abhi khaali hain:');
      showOptions(['show more', 'under ₹5,000', 'start over']);
    } else if (v === 'groom · under ₹6,000') {
      state.filters = { occasion: 'wedding', gender: 'men', budget: { high: 8000 } };
      const list = searchProducts(state.filters).slice(0, 3);
      showCards(list, 'Dulhe ke liye:');
      showOptions(['show more', 'under ₹5,000', 'start over']);
    } else if (v === 'wedding guest · elegant') {
      const list = searchProducts({ occasion: 'wedding', gender: 'women', budget: { high: 8000 } }).slice(0, 3);
      showCards(list, list.length ? 'Wedding guest picks:' : 'Guest picks abhi khaali hain:');
      showOptions(['show more', 'start over']);
    } else if (v === 'under ₹5,000') {
      state.filters.budget = { high: 5000 };
      const list = searchProducts({ ...state.filters }).slice(0, 4).sort((a, b) => a.price - b.price);
      addBotMsg('₹5,000/din ka tight budget — ye raha best value:');
      showCards(list, '');
      showOptions(['make it cheaper', 'show more', 'start over']);
    } else if (v === "what's available" || v === "what's free" || v.includes('available')) {
      addBotMsg("Apna event date bata do, main check karti hoon ki actually kya free hai — jaise \"10 Nov\" ya \"tomorrow\".");
      showOptions(['tomorrow', 'browse all', 'start over']);
    } else if (v === 'tomorrow') {
      runIntent('what is free tomorrow');
    } else if (v === 'make it cheaper' || v === 'more options' || v === 'show more') {
      const next = searchProducts({ ...state.filters, budget: typeof state.filters.budget === 'object' && state.filters.budget.high ? { high: state.filters.budget.high * 0.7 } : state.filters.budget });
      const list = next.slice(0, 4);
      showCards(list, v === 'make it cheaper' ? 'Budget aur kam kar rahi hoon:' : 'Kuch aur picks:');
      showOptions(['under ₹5,000', 'browse all', 'start over']);
    } else if (v === 'help me choose') {
      runIntent('help');
    } else if (v === 'pricing') {
      runIntent('pricing');
    } else if (v === 'browse all' || v === 'browse') {
      window.location.href = '/collection';
    } else if (v === 'start over' || v === "let's start fresh" || v === 'reset') {
      runIntent('start over');
    } else if (v === 'pick a different date') {
      addBotMsg('Bilkul — kaun si date? (jaise "15 Nov" ya "tomorrow")');
    } else if (/^under ₹\d/.test(v) || /^between ₹/.test(v)) {
      const budget = parseBudget(v);
      if (budget) { state.filters.budget = budget; const list = searchProducts(state.filters).slice(0, 4); showCards(list, 'Is budget me:'); showOptions(['more options', 'start over']); }
    } else {
      // Unmapped chip (e.g. "wedding lehenga under ₹6,000") → run the NL engine, don't double-echo.
      processFreeText(val);
    }
  }

  // ---------- send ----------
  function sendUserMsg() {
    const text = el.input.value.trim();
    if (!text) return;
    addUserMsg(text);
    el.input.value = '';
    noteTaste(text);
    processFreeText(text);
  }

  // ===================================================================
  // PERSONALISATION — Styla remembers this shopper and answers for them.
  // Taste is derived from real data (past orders + wishlist + what they
  // type), so there is nothing extra to store per user on the server.
  // ===================================================================
  const TASTE_KEY = 'luxe_taste';
  function getTaste() { try { return JSON.parse(localStorage.getItem(TASTE_KEY) || '{}') || {}; } catch (e) { return {}; } }
  function rememberTaste(patch) {
    try { localStorage.setItem(TASTE_KEY, JSON.stringify(Object.assign(getTaste(), patch))); } catch (e) {}
  }
  function noteTaste(text) {
    const t = ' ' + hinglish(' ' + text + ' ').toLowerCase() + ' ';
    const patch = {};
    const occ = OCCASIONS.find(o => t.includes(o));
    if (occ) patch.occasion = occ;
    if (/sangeet|mehandi|haldi/.test(t)) patch.occasion = 'sangeet';
    const g = parseGender(t);
    if (g) patch.gender = g;
    const b = parseBudget(t);
    if (b && b.max) patch.budget = 'under ' + fmt(b.max);
    if (Object.keys(patch).length) rememberTaste(patch);
  }
  function topCategories() {
    const wish = (typeof SERVER !== 'undefined' && SERVER.wishlist) || [];
    const orders = (typeof SERVER !== 'undefined' && SERVER.orders) || [];
    const seen = [];
    orders.forEach(o => (o.items || []).forEach(it => seen.push(String(it.name || '').toLowerCase())));
    const tally = {};
    const bump = p => { if (p && p.category) tally[p.category] = (tally[p.category] || 0) + 1; };
    products.forEach(p => { if (seen.indexOf(String(p.name).toLowerCase()) >= 0) bump(p); });
    wish.forEach(w => bump(products.find(p => p.id === w.id) || w));
    const t = getTaste();
    return Object.keys(tally).sort((a, b) => tally[b] - tally[a]).slice(0, 2).concat(t.cat ? [t.cat] : []);
  }
  function customerCard() {
    const u = currentUser();
    const t = getTaste();
    const cats = topCategories().filter(Boolean);
    const orders = (typeof SERVER !== 'undefined' && SERVER.orders) || [];
    const wish = (typeof SERVER !== 'undefined' && SERVER.wishlist) || [];
    const bits = [];
    bits.push(u ? 'name=' + (u.name || u.first) : 'guest (not logged in)');
    if (orders.length) bits.push('previous rentals=' + orders.length);
    if (wish.length) bits.push('wishlist=' + wish.length);
    if (cats.length) bits.push('likes=' + cats.map(catLabel).join('/'));
    if (t.occasion) bits.push('asking for=' + t.occasion);
    if (t.gender) bits.push('shopping for=' + t.gender);
    if (t.budget) bits.push('budget=' + t.budget);
    if (t.lastView) bits.push('last viewed=' + t.lastView);
    return bits.join(' | ') || 'brand-new shopper, no history yet';
  }
  function greet() {
    const u = currentUser();
    const cats = topCategories().filter(Boolean);
    const t = getTaste();
    const who = u ? (u.first || u.name) : 'there';
    let line = 'Namaste ' + who + '! Main Styla hoon — tumhari personal style assistant.';
    if (cats.length) line += '\nTumhe ' + cats.map(catLabel).join(' aur ') + ' pasand hai, to main usi hisaab se suggest karungi.';
    else line += 'Occasion, budget aur date bata do — main usi hisaab se pieces chunke dikhaungi.';
    if (t.occasion) line += '\nPichli baar tumne ' + t.occasion + ' dhoondha tha — phir se dekhun?';
    addBotMsg(line);
    const chips = [];
    if (cats.length) chips.push(catLabel(cats[0]).toLowerCase() + ' for me');
    if (t.occasion) chips.push(t.occasion + ' options');
    chips.push(t.budget || 'under ₹5,000', "what's available", 'help me choose');
    showOptions(chips.slice(0, 4));
  }

  // Instant, honest answers for the questions an LLM would only guess at.
  function quickAnswer(text) {
    const t = text.toLowerCase();
    if (/deliver|shipping|courier|kitne din|kab tak|how long|dispatch/.test(t)) return 'Delivery: hum aapke city/venue ke hisaab se 1-3 din me arrange karte hain (delivery charge city par depend karta hai). Exact date aur amount ke liye WhatsApp/Call karo — hum confirm kar denge.';
    if (/return|waapas|damage|wash|laundry|iron|clean/.test(t)) return 'Return: rental ke baad piece wapas hota hai, hum dry-cleaning aur ironing karte hain. Normal wear pe koi charge nahi; damage/extra stain pe repair cost lagti hai. Policy PDF me hai — exact terms ke liye team se confirm karo.';
    if (/cancel|refund|return policy|paise wapas|deposit/.test(t)) return 'Cancellation/refund: date change aur refund rules booking ke time bataye jaate hain (usually 7+ din pehle full refund, 2-3 din ke andar non-refundable). Exact amount ke liye team se confirm kar lena.';
    if (/payment|pay|card|upi|advance|emi|upi id/.test(t)) return 'Payment: UPI, card aur bank transfer — advance booking confirm karta hai. EMI bhi available hai 3/6 months pe. Invoice turant mil jata hai.';
    if (/address|office|shop|located|where are you|kahan/.test(t)) return 'Hum har city me deliver karte hain. Studio visit bhi book ho sakta hai — apna city batao, exact address + slot share kar denge.';
    if (/size|fitting|measurement|alter|height|weight/.test(t)) return 'Size: har product ke saath size chart hai, aur hum free alteration karte hain. Apni height/weight/measurements bata do, hum exact size suggest kar denge.';
    if (/trust|safe|safety|genuine|original|authentic|scam/.test(t)) return 'Haan — hum verified designer rentals hain. Har booking pe agreement aur care instructions milte hain, payment advance hota hai, aur pieces dry-cleaned hote hain. Doubt ho to pehla order chhota rakho ya team se baat karo.';
    return null;
  }

  // ---------- real AI fallback ----------
  // ponytail: keys live only in server.js — the browser talks to /api/ai, never Gemini directly.
  const AI_PROXY = (function(){ try { return (window.location.protocol === 'file:' ? 'http://localhost:3010' : '') + '/api/ai'; } catch (e) { return '/api/ai'; } })();
  const DEFAULT_AI = { provider: 'gemini', enabled: true };
  function getAI() {
    try { const c = JSON.parse(localStorage.getItem(AI_KEY) || 'null'); return c || DEFAULT_AI; } catch (e) { return DEFAULT_AI; }
  }
  function askLLM(text) {
    const cfg = getAI();
    if (!cfg || !cfg.enabled) return Promise.resolve(null);
    const cats = topCategories().filter(Boolean);
    const pool = (cats.length ? products.filter(p => cats.indexOf(p.category) >= 0) : products).slice(0, 20);
    const catalog = (pool.length ? pool : products.slice(0, 20)).map(p => ({ name: p.name, category: p.category, price: eff(p), gender: p.gender, occasion: prop(p, 'occasion'), style: prop(p, 'style') }));
    const system = 'You are Styla, the friendly style concierge for Rent-RO-Vastra, an Indian designer rental brand. STYLE: always reply in Roman-script Hinglish (Latin letters, no Devanagari) - casual, warm, like a stylish friend chatting on WhatsApp: "Bilkul, sangeet ke liye ye lehenga perfect hai", not formal English and not stiff Hindi. Keep it 1-3 short lines, under 70 words, use ₹ for prices (/day). If the user wants products, list up to 3 by name only and say they can be viewed in the catalog. THIS CUSTOMER: ' + customerCard() + '. Use it - greet them by name, suggest pieces matching their likes/occasion/budget, and reference their history ("jaise tumne pehle Sabyasachi liya tha"). Never invent delivery, refund or discount policies: if you do not know, say the team will confirm. Catalog: ' + JSON.stringify(catalog);
    return fetch(AI_PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cfg: { provider: cfg.provider || 'gemini', key: cfg.key || '' }, system: system, text: text }) })
      .then(r => r.json())
      .then(j => j.text || null)
      .catch(() => null);
  }

  function processFreeText(text) {
    // 1) instant policy/FAQ answer (no waiting, no AI guesswork)
    const quick = quickAnswer(text);
    if (quick) { addBotMsg(quick); showMenu(); return; }
    // Typed/spoken Hindi (Devanagari) + real AI configured → answer straight in Hindi;
    // otherwise fall back to the offline (English-template) intent engine.
    const cfg = getAI();
    const isDeva = /[\u0900-\u097F]/.test(text);
    if (!(isDeva && cfg && cfg.enabled) && runIntent(hinglish(' ' + text + ' '))) return;
    showTyping();
    setTimeout(() => {
      askLLM(text).then(ans => {
        removeTyping();
        if (ans) { addBotMsg(ans); showMenu(); }
        else {
          addBotMsg("Ismein main help kar sakti hoon! Occasion/style/budget ke hisaab se outfits, event date pe live availability, ya policy ke sawaal — English, Hindi ya Hinglish kisi bhi me. Ye try karo:");
          showOptions(['wedding lehenga under ₹6,000', "what's free on 10 Nov", 'pricing', 'start over']);
        }
      });
    }, 500);
  }

  function createLink(href, text) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    a.style.cssText = 'display:inline-block;margin-top:8px;padding:8px 16px;background:var(--gold);color:var(--black);font-size:0.7rem;letter-spacing:2px;text-transform:uppercase;';
    return a;
  }

  function scrollDown() {
    el.messages.scrollTop = el.messages.scrollHeight;
  }

  // ---------- voice (mic input + spoken replies) ----------
  const Voice = { on: localStorage.getItem('luxe_chat_voice') !== '0', rec: null, listening: false };

  function buildVoiceUI() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    // Speaker toggle in the chat header
    const header = document.querySelector('.chat-header');
    if (header && 'speechSynthesis' in window) {
      const spk = document.createElement('button');
      spk.type = 'button';
      spk.className = 'chat-voice-btn chat-voice-speak';
      spk.title = Voice.on ? 'Mute voice replies' : 'Enable voice replies';
      spk.innerHTML = Voice.on
        ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77S18.01 4.14 14 3.23z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.92 8.92 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A9 9 0 0 0 14 21.02c.91-.19 1.79-.54 2.54-.98l1.19 1.19L19 20 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
      spk.addEventListener('click', () => {
        Voice.on = !Voice.on;
        localStorage.setItem('luxe_chat_voice', Voice.on ? '1' : '0');
        spk.innerHTML = Voice.on
          ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77S18.01 4.14 14 3.23z"/></svg>'
          : '<svg viewBox="0 0 24 24"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.92 8.92 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A9 9 0 0 0 14 21.02c.91-.19 1.79-.54 2.54-.98l1.19 1.19L19 20 4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>';
        if (!Voice.on && Voice.rec) { Voice.rec.abort(); setMicState(false); }
      });
      header.appendChild(spk);

      // Clear chat button next to the speaker toggle
      const clr = document.createElement('button');
      clr.type = 'button';
      clr.className = 'chat-voice-btn chat-voice-clear';
      clr.title = 'Clear chat';
      clr.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
      clr.addEventListener('click', () => {
        if (!el.messages) return;
        clearLog();
        el.messages.innerHTML = '';
        state.filters = {}; state.dateCtx = null; state.step = 'init';
        const user = currentUser();
        addBotMsg(`Chat clear ho gayi${user ? ', ' + user.first : ''}! Naya look kya talaash rahe ho?`);
        showMenu();
      });
      header.appendChild(clr);
    }

    // Mic button in the input bar (text->speech)
    const bar = document.querySelector('.chat-input-bar');
    if (bar && SR) {
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.className = 'chat-voice-btn chat-voice-mic';
      mic.title = 'Speak your question';
      mic.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3c0 2.49-2.01 4.5-4.5 4.5S8 13.49 8 11H6a6 6 0 0 0 5 5.91V19H8v2h8v-2h-3v-2.09A6 6 0 0 0 18 11h-2z"/></svg>';
      mic.addEventListener('click', () => { if (Voice.listening) stopMic(); else startMic(mic); });
      bar.insertBefore(mic, el.sendBtn);
    }
  }

  function startMic(micBtn) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    try { Voice.rec = new SR(); } catch(e) { notify('Voice not available in this browser'); return; }
    // hi-IN recognizes Hindi/Hinglish speech (Devanagari transcript feeds hinglish + the Devanagari->LLM path).
    // English questions also work: Chrome transcribes them mixed, and Gemini handles it when the key is on.
    Voice.rec.lang = 'hi-IN';
    Voice.rec.interimResults = true;
    Voice.rec.continuous = false;
    Voice.listening = true;
    const orig = el.input.placeholder;
    el.input.placeholder = 'Listening…';
    Voice.rec.onresult = ev => {
      let t = '';
      for (let i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
      el.input.value = t;
    };
    Voice.rec.onend = () => {
      setMicState(false);
      el.input.placeholder = 'Ask me anything...';
      const t = el.input.value.trim();
      if (t) sendUserMsg();
    };
    Voice.rec.onerror = e => {
      if (e.error === 'not-allowed') notify('Microphone access blocked — allow it in your browser.');
      else if (e.error !== 'aborted' && e.error !== 'no-speech') notify('Voice error: ' + e.error);
      setMicState(false);
      el.input.placeholder = 'Ask me anything...';
    };
    micBtn.classList.add('listening');
    try { Voice.rec.start(); } catch(e) { setMicState(false); }
  }
  function stopMic() { if (Voice.rec) { try { Voice.rec.abort(); } catch(e) {} } setMicState(false); }
  function setMicState(on) {
    Voice.listening = on;
    document.querySelectorAll('.chat-voice-mic').forEach(b => b.classList.toggle('listening', on));
  }

  // ponytail: word-level Roman/Hinglish -> Devanagari so ALL speech is Hindi. Fine for a fixed vocabulary;
  // full grammatical translation = route speech through Gemini (askLLM) instead, add when vocabulary grows.
  const HI_SPOKEN = {
    here:'यहाँ', are:'हैं', my:'मेरे', picks:'पिक्स', pick:'पिक', for:'के लिए', you:'आप', your:'आपके', what:'क्या', is:'है', can:'कर सकती',
    wedding:'शादी', bride:'दुल्हन', groom:'दूल्हे', bridal:'ब्राइडल', guest:'मेहमान', outfit:'आउटफ़िट', outfits:'आउटफ़िट',
    budget:'बजट', under:'कम', above:'ज़्यादा', cheaper:'सस्ता', affordable:'किफ़ायती', premium:'प्रीमियम', luxury:'लक्ज़री',
    available:'उपलब्ध', availability:'अवेलेबिलिटी', free:'फ्री', nothing:'कुछ नहीं', booked:'बुक', bookings:'बुकिंग्स', left:'बचे',
    date:'तारीख', today:'आज', tomorrow:'कल', yesterday:'बीते कल', different:'दूसरी', another:'दूसरी',
    piece:'पीस', pieces:'पीस', catalog:'कैटलॉग', collection:'कलेक्शन', browse:'देखें', full:'पूरा', all:'सारे', see:'देखें', found:'मिले',
    check:'चेक', checking:'चेक', real:'असली', live:'लाइव', actually:'असल में', event:'इवेंट', wear:'पहनें',
    pricing:'कीमतें', price:'कीमत', policy:'पॉलिसी', delivery:'डिलीवरी', returns:'रिटर्न्स', sizing:'साइज़िंग',
    cancellation:'कैंसिलेशन', brands:'ब्रांड्स', members:'मेम्बर्स', rental:'रेंटल', clean:'साफ़',
    question:'सवाल', questions:'सवाल', answer:'जवाब', answers:'जवाब', help:'मदद', welcome:'स्वागत है', fresh:'ताज़ा', start:'शुरुआत',
    show:'दिखाऊँ', more:'और', options:'ऑप्शन्स', menu:'मेन्यू', try:'ट्राई', goes:'हो जाएगा', fit:'फिट',
    good:'अच्छी', news:'खबर', sorry:'माफ़ी', fully:'पूरी तरह', looks:'लगता है', similar:'ऐसे ही', match:'मैच', exact:'एकदम',
    alternative:'विकल्प', alternatives:'विकल्प', occasion:'ऑकेशन', style:'स्टाइल', gender:'जेंडर',
    thanks:'शुक्रिया', thank:'शुक्रिया', bye:'अलविदा', goodbye:'अलविदा', nice:'अच्छा', meet:'मिलकर',
    to:'को', on:'पर', of:'में से', in:'में', with:'के साथ', is:'है', are:'हैं', a:'', the:'', and:'और', that:'वो', this:'यह',
    hindi:'हिंदी', hinglish:'हिंग्लिश', english:'इंग्लिश', both:'दोनों', also:'भी', works:'चलता है',
    shaadi:'शादी', shadi:'शादी', lehenga:'लहंगा', sherwani:'शेरवानी', saree:'साड़ी', sadi:'साड़ी', kal:'कल', aaj:'आज',
    koi:'कोई', aur:'और', batao:'बताओ', dikhao:'दिखाओ', chahiye:'चाहिए', milega:'मिलेगा', bhai:'भाई', mere:'मेरे',
    nahi:'नहीं', hai:'है', ho:'हूँ', ka:'का', ke:'के', ki:'की', mein:'में', ko:'को', se:'से', liye:'लिए', bahut:'बहुत',
    wedding:'शादी', mehnga:'महंगा', sasta:'सस्ता', ladki:'लड़की', ladka:'लड़का'
  };

  function hiSpeak(s) {
    const hasDn = /[\u0900-\u097F]/;
    return (s || '').replace(/\*\*/g, '').split(/(\s+)/).map(w => {
      if (!w.trim() || hasDn.test(w) || /^[\d₹.,]+$/.test(w)) return w;
      const clean = w.toLowerCase().replace(/[^a-z]/g, '');
      return (HI_SPOKEN[clean] || w) + (w.match(/[.!?]/) || [''])[0];
    }).join('');
  }

  function getHindiVoice() {
    const vs = window.speechSynthesis.getVoices();
    const hi = vs.filter(v => (v.lang || '').toLowerCase().startsWith('hi'));
    if (!hi.length) return null;
    const pick = n => hi.find(v => (v.name || '').toLowerCase().includes(n));
    return pick('google') || pick('kalpana') || pick('hemant') || pick('neerja') || hi[0];
  }

  function speak(text) {
    if (!Voice.on || !('speechSynthesis' in window)) return;
    const plain = (text || '').replace(/<[^>]*>/g, '').replace(/\*\*/g, '').trim();
    if (!plain) return;
    try {
      window.speechSynthesis.cancel();
      // Always speak in Hindi (Devanagari). Roman/Hinglish replies are converted too, so voice is sirf Hindi.
      const spoken = /[\u0900-\u097F]/.test(plain) ? plain : hiSpeak(plain);
      const say = () => {
        const u = new SpeechSynthesisUtterance(spoken);
        u.lang = 'hi-IN';
        const v = getHindiVoice();
        if (v) u.voice = v;
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      };
      // getVoices() is empty until the async voiceschanged event fires — wait for it once
      if (window.speechSynthesis.getVoices().length) say();
      else {
        const once = () => { window.speechSynthesis.removeEventListener('voiceschanged', once); say(); };
        window.speechSynthesis.addEventListener('voiceschanged', once);
      }
    } catch(e) {}
  }

  function notify(msg) {
    const div = document.createElement('div');
    div.className = 'chat-msg bot voice-note';
    div.textContent = msg;
    el.messages.appendChild(div);
    scrollDown();
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', init);
})();