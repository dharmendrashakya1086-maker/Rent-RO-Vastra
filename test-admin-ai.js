// Logic self-check for admin AI chat flows (confirm booking, reviews, delete). Run: node test-admin-ai.js
const fs = require('fs');
const path = require('path');
const h = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
const bodies = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const script = bodies.sort((a, b) => b.length - a.length)[0];

const seed = {
  luxe_products: JSON.stringify([
    { id: 1, name: 'Sabyasachi Silk Lehenga', category: 'evening', price: 7499, stock: 3, active: true, occasion: ['wedding'], style: ['elegant'], gender: 'women', budget: 'premium', img: 'x', images: ['x'] },
    { id: 2, name: 'Tarun Tahiliani Sherwani', category: 'formal', price: 5499, stock: 4, active: true, occasion: ['wedding'], style: ['classic'], gender: 'men', budget: 'mid', img: 'y', images: ['y'] }
  ]),
  luxe_orders: JSON.stringify([
    { id: 9001, name: 'Aarti Singh', item: 'Sabyasachi Silk Lehenga', productId: 1, total: 14998, status: 'Pending', startDate: '2026-11-10', endDate: '2026-11-12', dates: '2026-11-10 - 2026-11-12', category: 'evening' }
  ]),
  luxe_reviews: JSON.stringify([{ id: 1, type: 'site', itemId: null, name: 'Ravi', rating: 3, text: 'okay service', email: 'r@x.com', time: Date.now() }]),
  luxe_messages: JSON.stringify([{ id: 7, from: 'u@x.com', to: 'admin', body: 'hi, need longer dates', time: Date.now(), readBy: [] }]),
  luxe_users: JSON.stringify([{ first: 'Aarti', email: 'u@x.com' }])
};

const mockEl = () => ({
  innerHTML: '', value: '', textContent: '', scrollTop: 0, scrollHeight: 0, style: {}, dataset: {},
  classList: { add(){}, remove(){}, contains(){return false} },
  addEventListener(){}, appendChild(){}, children: []
});
const storage = Object.assign({}, seed);
global.localStorage = { getItem: k => storage[k] || null, setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } };
global.sessionStorage = global.localStorage;
global.document = {
  getElementById: () => mockEl(),
  querySelectorAll: () => ([]),
  createElement: () => mockEl(),
  addEventListener() {}
};
global.location = { search: '', href: '' };
global.window = global;

const exposed = script.replace(/\}\)\(\);?\s*$/, `\n  global.__admin = { aiProcessInput, getOrders, getReviewsAll, getProducts, getMessages, getPass };\n})();`);
eval(exposed);

const A = global.__admin;
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); }
}

A.aiProcessInput('Confirm bookings');
A.aiProcessInput('1');
eq('order confirmed', A.getOrders()[0].status, 'Confirmed');

A.aiProcessInput('Bookings');

A.aiProcessInput('Manage reviews');
A.aiProcessInput('Website reviews');
A.aiProcessInput('1');
A.aiProcessInput('Yes, delete it');
eq('review deleted', A.getReviewsAll().length, 0);

A.aiProcessInput('Delete product');
A.aiProcessInput('formal');
A.aiProcessInput('1');
A.aiProcessInput('Yes, delete it');
eq('product hidden', A.getProducts().find(p => p.id === 2).active, false);

// restore product 2 so later quick-op tests target a live product
const psr = JSON.parse(global.localStorage.getItem('luxe_products'));
psr.find(p => p.id === 2).active = true;
global.localStorage.setItem('luxe_products', JSON.stringify(psr));

// 5. Hinglish one-shot: change price of a product
A.aiProcessInput('sabyasachi ka price 7000 karo');
eq('hinglish price', A.getProducts().find(p => p.id === 1).price, 7000);

// 6. Hinglish one-shot: change stock
A.aiProcessInput('sherwani stock 2 karo');
eq('hinglish stock', A.getProducts().find(p => p.id === 2).stock, 2);

// 7. Inbox: list -> reply to sender
A.aiProcessInput('inbox dikhao');
A.aiProcessInput('1');
A.aiProcessInput('sure, dates flex hai');
eq('reply sent', A.getMessages().filter(m => m.from === 'admin').length, 1);

// 8. Change password via voice-style Hinglish
A.aiProcessInput('password badal');
A.aiProcessInput('newpass123');
A.aiProcessInput('luxe123');
eq('password changed', A.getPass(), 'newpass123');

// 9. Customers list (no throw)
A.aiProcessInput('customers dikhao');

// 10. Availability intents don't crash
A.aiProcessInput('check availability');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);