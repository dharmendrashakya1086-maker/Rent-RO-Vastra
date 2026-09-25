// Logic self-check for chat.js NLU (budget/date parsing + search). Run: node test-chat-logic.js
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, 'chat.js'), 'utf8');

const stubs = `
global.currentUser = () => null;
global.localStorage = { getItem:()=>null, setItem(){}, removeItem(){} };
global.sessionStorage = global.localStorage;
const noEl = { addEventListener(){}, classList:{add(){},remove(){},toggle(){},contains(){return false}}, appendChild(){}, style:{}, dataset:{}, value:"", textContent:"", innerHTML:"", children:[], messages:{scrollTop:0,scrollHeight:0,appendChild(){},addEventListener(){}} };
global.document = { getElementById:()=>noEl, querySelector:()=>null, querySelectorAll:()=>[], createElement:()=>({ className:"", dataset:{}, style:{}, classList:{add(){},remove(){}}, appendChild(){}, innerHTML:"" }), addEventListener(){} };
global.window = global;
document.addEventListener('DOMContentLoaded', ()=>{});
`;

const exposed = src.replace(/\}\)\(\);?\s*$/, `\n  global.__chat = { parseBudget, parseDate, parseName, searchProducts, products, hinglish, runIntent, init, hiSpeak };\n})();`);

eval(stubs + exposed);

const c = global.__chat;
c.init(); // sets el.messages so runIntent can render into the stub DOM
let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) pass++; else { fail++; console.log('FAIL', name, 'got', JSON.stringify(got), 'want', JSON.stringify(want)); }
}

eq('budget: under ₹6,000', c.parseBudget('wedding lehenga under ₹6,000'), { low: null, high: 6000, sort: null });
eq('budget: 5000+', c.parseBudget('above ₹5,000'), { low: 5000, high: null, sort: null });
eq('budget: cheapest', c.parseBudget('most cheap piece'), { low: null, high: null, sort: 'price-asc' });
eq('budget: no budget', c.parseBudget('hello there'), null);

const d10 = c.parseDate('what is free on 10 nov');
eq('date: 10 nov', d10 ? d10.start.slice(5) : null, (new Date(new Date().getFullYear(), 10, 10).toISOString().slice(5, 10)));
eq('date: tomorrow exists', !!c.parseDate('tomorrow'), true);
eq('date: none', c.parseDate('no date here'), null);

const all = c.products.filter(p => p.active !== false);
eq('products count', all.length, 12);

const budget = c.searchProducts({ budget: { high: 6000 }, name: 'lehenga', occasion: 'wedding' });
eq('lehenga budget relaxes to a pick', budget.length >= 1, true);

const cheap = c.searchProducts({ budget: { high: 5000 }, sort: 'price-asc' });
const expensive = c.searchProducts({ sort: 'price-desc' });
eq('cheapest all within budget', cheap.every(p => p.price <= 5000), true);
eq('cheapest ascending', cheap.length >= 3 && cheap[0].price <= cheap[2].price, true);
eq('expensive descending', expensive[0].price >= expensive[1].price && expensive[1].price >= expensive[2].price, true);

const women = c.searchProducts({ gender: 'women' });
eq('women filter', women.every(p => p.gender === 'women' || p.gender === 'unisex'), true);

// Trilingual NLU: hinglish() output feeds runIntent
const H = c.hinglish;
eq('hinglish: shaadi -> wedding', H('shaadi ke liye lehenga chahiye'), 'wedding lehenga');
eq('hinglish: budget tak -> within', H('5000 ke andar chahiye'), '5000 within');
eq('hinglish: numbers ek-das', H('teen ladki ke liye sherwani'), '3 mother sherwani');
eq('hinglish: kal -> tomorrow', H('kal kya free hai'), 'tomorrow free');

// Devanagari voice/typed Hindi: hinglish() transliterates so the same rules fire
eq('devanagari: shaadi lehenga', H('शादी के लिए लहंगा चाहिए'), 'wedding lehenga');
eq('devanagari: kal tomorrow', H('कल क्या फ्री है'), 'tomorrow free');
eq('devanagari: numbers ek-das', H('तीन लड़की के लिए शेरवानी'), '3 mother sherwani');
eq('devanagari: budget within 5000', c.parseBudget(H('५००० के अंदर कुछ भी')), { low: null, high: 5000, sort: null });
eq('devanagari: runIntent wedding', c.runIntent(c.hinglish('शादी के लिए लहंगा चाहिए')), true);

// Hindi budget/date parse after normalization
eq('hindi budget within 5000', c.parseBudget(H('5000 se neeche kuch bhi')), { low: null, high: 5000, sort: null });
eq('hindi date tomorrow', !!c.parseDate(H('kal ko kya free hai')), true);
eq('hindi date 10 nov', c.parseDate(H('10 november ko')), c.parseDate('10 nov'));

// Hindi product search through filters
const hindiSearch = c.searchProducts({ occasion: 'wedding', name: 'lehenga' });
eq('hindi wedding lehenga finds picks', hindiSearch.length >= 1, true);

// End-to-end: runIntent handles Hindi phrases (no LLM fallback)
eq('hanlded: shaadi ke liye lehenga', c.runIntent(c.hinglish('shaadi ke liye lehenga chahiye')), true);
eq('hanlded: sasta saree', c.runIntent(c.hinglish('mujhe sasta saree chahiye')), true);
eq('hanlded: namaste greeting', c.runIntent('namaste'), true);

// hiSpeak: Roman/Hinglish replies are spoken in Devanagari Hindi (sirf Hindi bole)
eq('hiSpeak: here are my picks for wedding', c.hiSpeak('Here are my picks for wedding'), 'यहाँ हैं मेरे पिक्स के लिए शादी');
eq('hiSpeak: what is free tomorrow', c.hiSpeak('What is free tomorrow?'), 'क्या है फ्री कल?');
eq('hiSpeak: passes Devanagari through', c.hiSpeak('शादी के लिए लहंगा'), 'शादी के लिए लहंगा');
eq('hiSpeak: keeps prices', c.hiSpeak('under ₹5,000 pieces'), 'कम ₹5,000 पीस');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);