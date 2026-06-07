'use strict';
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── helpers ──────────────────────────────────────────────────────────────────
function genId() { return crypto.randomBytes(8).toString('hex'); }
function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function ts()    { return Date.now(); }
function fmtDate(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+
         d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}
function fmtPrice(v, cur) {
  if (cur==='dc') return `<span class="pc-coin">${Number(v).toFixed(4)} 🪙</span>`;
  return `<span class="bank-price">${Number(v).toLocaleString('de-DE')} $</span>`;
}

// ── data helpers ──────────────────────────────────────────────────────────────
let DATA_DIR_REF = '';
const f = n => path.join(DATA_DIR_REF, n);

function loadJson(file, def={}) {
  try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return def; }
}
function saveJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data,null,2),'utf8');
}

function loadTokens()     { return loadJson(f('pcbay_tokens.json'),{}); }
function saveTokens(d)    { saveJson(f('pcbay_tokens.json'), d); }
function loadListings()   { return loadJson(f('pcbay_listings.json'),[]); }
function saveListings(d)  { saveJson(f('pcbay_listings.json'), d); }
function loadTransactions(){ return loadJson(f('pcbay_transactions.json'),[]); }
function saveTx(d)        { saveJson(f('pcbay_transactions.json'), d); }

function getKonto(uid) {
  const d = loadJson(f('konto.json'),{});
  return d[uid] ?? { konto: 0, schwarz: 0 };
}
function setKonto(uid, obj) {
  const d = loadJson(f('konto.json'),{});
  d[uid] = obj;
  saveJson(f('konto.json'), d);
}
function getWallet(uid) {
  const d = loadJson(f('krypto.json'),{});
  return d[uid] || { dc: 0 };
}
function setWallet(uid, w) {
  const d = loadJson(f('krypto.json'),{});
  d[uid] = w;
  saveJson(f('krypto.json'), d);
}

// persistent token per user
function getOrCreateToken(userId, username) {
  const toks = loadTokens();
  // find existing
  for (const [tok, v] of Object.entries(toks)) {
    if (v.userId === userId) {
      if (username) { toks[tok].username = username; saveTokens(toks); }
      return tok;
    }
  }
  // create new
  const tok = crypto.randomBytes(24).toString('hex');
  toks[tok] = { userId, username: username||'Unbekannt', createdAt: Date.now() };
  saveTokens(toks);
  return tok;
}
function validateToken(tok) {
  const toks = loadTokens();
  return toks[tok] || null;
}

// ── categories ────────────────────────────────────────────────────────────────
const CATS = [
  { id:'fahrzeuge',   label:'🚗 Fahrzeuge',     icon:'🚗' },
  { id:'immobilien',  label:'🏠 Immobilien',    icon:'🏠' },
  { id:'waffen',      label:'🔫 Waffen',         icon:'🔫' },
  { id:'kleidung',    label:'👕 Kleidung',       icon:'👕' },
  { id:'drogen',      label:'💊 Drogen',         icon:'💊' },
  { id:'elektronik',  label:'💻 Elektronik',     icon:'💻' },
  { id:'dienstleistungen', label:'🛠️ Dienstleistungen', icon:'🛠️' },
  { id:'sonstiges',   label:'📦 Sonstiges',      icon:'📦' },
];

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0a;
  --bg2:#111;
  --bg3:#1a1a1a;
  --bg4:#222;
  --border:#2a2a2a;
  --orange:#E07B00;
  --orange2:#F59E0B;
  --orange3:#ff9500;
  --blue:#4285F4;
  --green:#34A853;
  --red:#EA4335;
  --yellow:#FBBC05;
  --text:#f0f0f0;
  --text2:#aaa;
  --text3:#777;
}
body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
a{color:inherit;text-decoration:none}
img{max-width:100%}

/* ── header ── */
.pb-header{background:var(--bg2);border-bottom:2px solid var(--orange);position:sticky;top:0;z-index:100;box-shadow:0 2px 20px rgba(224,123,0,.25)}
.pb-header-inner{max-width:1400px;margin:0 auto;padding:0 20px;display:flex;align-items:center;gap:16px;height:64px}
.pb-logo{display:flex;align-items:center;gap:10px;text-decoration:none;flex-shrink:0}
.pb-logo img{height:44px;width:44px;border-radius:8px;object-fit:cover}
.pb-logo-text{font-size:1.4rem;font-weight:900;letter-spacing:-0.5px}
.pb-logo-text .p{color:var(--blue)}.pb-logo-text .c{color:var(--green)}.pb-logo-text .space{color:var(--text)}.pb-logo-text .b{color:var(--red)}.pb-logo-text .a{color:var(--yellow)}.pb-logo-text .y{color:var(--blue)}
.pb-search{flex:1;max-width:600px;display:flex;gap:0;border-radius:8px;overflow:hidden;border:2px solid var(--border)}
.pb-search:focus-within{border-color:var(--orange)}
.pb-search input{flex:1;padding:10px 14px;background:var(--bg3);border:none;color:var(--text);font-size:.9rem;outline:none}
.pb-search select{padding:10px 10px;background:var(--bg4);border:none;border-left:1px solid var(--border);color:var(--text2);font-size:.8rem;cursor:pointer;outline:none}
.pb-search button{padding:10px 16px;background:var(--orange);border:none;color:#fff;font-weight:700;cursor:pointer;font-size:.85rem;white-space:nowrap}
.pb-search button:hover{background:var(--orange3)}
.pb-nav{display:flex;align-items:center;gap:4px;margin-left:auto;flex-shrink:0}
.pb-nav a{padding:8px 12px;border-radius:7px;font-size:.82rem;font-weight:600;color:var(--text2);transition:all .15s}
.pb-nav a:hover{background:var(--bg3);color:var(--text)}
.pb-nav .pb-sell-btn{background:var(--orange);color:#fff;padding:8px 16px;border-radius:7px}
.pb-nav .pb-sell-btn:hover{background:var(--orange3);color:#fff}
.pb-nav .pb-bal{color:var(--orange2);font-weight:700;font-size:.8rem}

/* ── layout ── */
.pb-wrap{max-width:1400px;margin:0 auto;padding:24px 20px}
.pb-grid{display:grid;grid-template-columns:240px 1fr;gap:24px;align-items:start}
@media(max-width:900px){.pb-grid{grid-template-columns:1fr}}

/* ── sidebar ── */
.pb-sidebar{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;position:sticky;top:80px}
.pb-sidebar h3{padding:14px 16px;font-size:.75rem;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);border-bottom:1px solid var(--border)}
.pb-cat-list{list-style:none}
.pb-cat-list li a{display:flex;align-items:center;gap:10px;padding:11px 16px;font-size:.88rem;color:var(--text2);transition:all .15s;border-bottom:1px solid #1a1a1a}
.pb-cat-list li a:hover,.pb-cat-list li a.active{background:var(--bg3);color:var(--text);padding-left:20px}
.pb-cat-list li a.active{border-left:3px solid var(--orange);color:var(--orange2)}
.pb-sidebar .filter-section{padding:16px;border-top:1px solid var(--border)}
.pb-sidebar .filter-section h4{font-size:.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:12px}
.pb-sidebar input[type=number]{width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.85rem;outline:none;margin-bottom:8px}
.pb-sidebar input[type=number]:focus{border-color:var(--orange)}
.pb-sidebar select{width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:.85rem;outline:none}
.filter-btn{width:100%;padding:9px;background:var(--orange);border:none;border-radius:7px;color:#fff;font-weight:700;cursor:pointer;font-size:.85rem;margin-top:10px}
.filter-btn:hover{background:var(--orange3)}

/* ── listing grid ── */
.listings-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px}
.listings-header h2{font-size:1.1rem;font-weight:700}
.listings-count{font-size:.82rem;color:var(--text3)}
.listings-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}
.listing-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;transition:all .2s;cursor:pointer;display:block}
.listing-card:hover{border-color:var(--orange);transform:translateY(-3px);box-shadow:0 8px 30px rgba(224,123,0,.2)}
.listing-card .card-img{aspect-ratio:1;background:var(--bg3);display:flex;align-items:center;justify-content:center;overflow:hidden;border-bottom:1px solid var(--border)}
.listing-card .card-img img{width:100%;height:100%;object-fit:cover}
.listing-card .card-img .no-img{font-size:3rem;opacity:.5}
.listing-card .card-body{padding:12px}
.listing-card .card-title{font-size:.9rem;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.listing-card .card-cat{font-size:.72rem;color:var(--text3);margin-bottom:8px}
.listing-card .card-price{font-size:1.05rem;font-weight:800;color:var(--orange2)}
.listing-card .card-seller{font-size:.72rem;color:var(--text3);margin-top:6px}
.listing-card .card-condition{display:inline-block;padding:2px 6px;border-radius:4px;font-size:.68rem;font-weight:700;margin-top:4px}
.cond-neu{background:#064e3b;color:#34d399}.cond-gut{background:#1e3a5f;color:#60a5fa}.cond-gebraucht{background:#3b2a1a;color:#f59e0b}.cond-defekt{background:#3b1a1a;color:#f87171}
.pc-coin{color:var(--orange2)}.bank-price{color:#34d399}

/* ── empty state ── */
.empty-state{text-align:center;padding:80px 20px;color:var(--text3)}
.empty-state .es-icon{font-size:4rem;margin-bottom:16px}
.empty-state h3{font-size:1.2rem;color:var(--text2);margin-bottom:8px}

/* ── hero ── */
.pb-hero{background:linear-gradient(135deg,#1a0d00,#2a1500,#1a0d00);border:1px solid #3a2000;border-radius:16px;padding:40px;margin-bottom:28px;display:flex;align-items:center;gap:32px;overflow:hidden;position:relative}
.pb-hero::before{content:'';position:absolute;right:-60px;top:-60px;width:300px;height:300px;background:radial-gradient(circle,rgba(224,123,0,.15) 0%,transparent 70%);pointer-events:none}
.pb-hero-text h1{font-size:2rem;font-weight:900;margin-bottom:8px;line-height:1.2}
.pb-hero-text h1 span{color:var(--orange2)}
.pb-hero-text p{color:var(--text2);font-size:.95rem;margin-bottom:20px}
.pb-hero-btns{display:flex;gap:12px;flex-wrap:wrap}
.btn-primary{display:inline-block;padding:11px 24px;background:var(--orange);color:#fff;border-radius:8px;font-weight:700;font-size:.9rem;border:none;cursor:pointer;transition:background .15s}
.btn-primary:hover{background:var(--orange3)}
.btn-secondary{display:inline-block;padding:11px 24px;background:transparent;color:var(--orange2);border:2px solid var(--orange);border-radius:8px;font-weight:700;font-size:.9rem;cursor:pointer;transition:all .15s}
.btn-secondary:hover{background:var(--orange);color:#fff}
.pb-hero-logo{width:160px;flex-shrink:0;opacity:.9}
.pb-hero-logo img{width:100%;border-radius:16px}

/* ── category pills ── */
.cat-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px}
.cat-pill{display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:50px;font-size:.8rem;font-weight:600;color:var(--text2);cursor:pointer;transition:all .15s;text-decoration:none}
.cat-pill:hover,.cat-pill.active{background:var(--orange);border-color:var(--orange);color:#fff}

/* ── detail page ── */
.detail-wrap{display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:start}
@media(max-width:900px){.detail-wrap{grid-template-columns:1fr}}
.detail-images{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:5rem}
.detail-images img{width:100%;height:100%;object-fit:contain;padding:20px}
.detail-side{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px}
.detail-title{font-size:1.4rem;font-weight:800;margin-bottom:8px;line-height:1.3}
.detail-price{font-size:2rem;font-weight:900;color:var(--orange2);margin-bottom:16px}
.detail-price .currency-label{font-size:.9rem;font-weight:500;color:var(--text3)}
.detail-seller{display:flex;align-items:center;gap:10px;padding:14px;background:var(--bg3);border-radius:8px;margin-bottom:16px}
.detail-seller .seller-avatar{width:36px;height:36px;border-radius:50%;background:var(--orange);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.9rem;flex-shrink:0}
.detail-seller .seller-info .seller-name{font-weight:700;font-size:.9rem}
.detail-seller .seller-info .seller-label{font-size:.72rem;color:var(--text3)}
.detail-desc{margin-bottom:20px}
.detail-desc h3{font-size:.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:8px}
.detail-desc p{font-size:.9rem;color:var(--text2);line-height:1.7;white-space:pre-wrap}
.detail-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px}
.meta-item{background:var(--bg3);border-radius:8px;padding:10px 12px}
.meta-item .meta-label{font-size:.7rem;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:4px}
.meta-item .meta-val{font-size:.88rem;font-weight:700}
.buy-section{background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:16px}
.buy-section h3{font-size:.8rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:12px}
.pay-options{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
.pay-opt{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg4);border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:all .15s}
.pay-opt:hover{border-color:var(--orange)}
.pay-opt.selected{border-color:var(--orange);background:#2a1500}
.pay-opt input[type=radio]{display:none}
.pay-opt .po-icon{font-size:1.2rem}
.pay-opt .po-info .po-name{font-weight:700;font-size:.88rem}
.pay-opt .po-info .po-bal{font-size:.76rem;color:var(--text3)}
.buy-btn{width:100%;padding:14px;background:var(--orange);border:none;border-radius:9px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;transition:background .15s;letter-spacing:.5px}
.buy-btn:hover{background:var(--orange3)}
.buy-btn:disabled{background:#333;color:#666;cursor:not-allowed}
.own-badge{background:#1a3a1a;border:1px solid #2ea043;color:#34d399;padding:12px 14px;border-radius:8px;text-align:center;font-weight:700;font-size:.9rem}
.sold-badge{background:#1a1a1a;border:1px solid #444;color:#666;padding:12px 14px;border-radius:8px;text-align:center;font-weight:700;font-size:.9rem}

/* ── sell form ── */
.sell-wrap{max-width:760px;margin:0 auto}
.sell-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:32px}
.sell-card h2{font-size:1.3rem;font-weight:800;margin-bottom:24px;display:flex;align-items:center;gap:10px}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.form-row.one{grid-template-columns:1fr}
.form-group{display:flex;flex-direction:column;gap:6px;margin-bottom:16px}
.form-group label{font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3)}
.form-group input,.form-group select,.form-group textarea{padding:11px 14px;background:var(--bg3);border:1.5px solid var(--border);border-radius:8px;color:var(--text);font-size:.9rem;outline:none;transition:border .15s;font-family:inherit}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--orange)}
.form-group textarea{min-height:120px;resize:vertical}
.price-row{display:flex;gap:10px}
.price-row input{flex:1}
.price-row select{width:160px;flex-shrink:0}
.submit-btn{width:100%;padding:14px;background:var(--orange);border:none;border-radius:9px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;transition:background .15s;margin-top:8px}
.submit-btn:hover{background:var(--orange3)}
.img-preview{margin-top:12px;display:flex;gap:8px;flex-wrap:wrap}
.img-prev-box{width:80px;height:80px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;overflow:hidden}
.img-prev-box img{width:100%;height:100%;object-fit:cover}
.file-drop{border:2px dashed var(--border);border-radius:10px;padding:24px;text-align:center;cursor:pointer;transition:all .15s;background:var(--bg3);position:relative}
.file-drop:hover,.file-drop.drag{border-color:var(--orange);background:#1a0d00}
.file-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.file-drop p{color:var(--text3);font-size:.85rem;margin-top:6px}

/* ── my account ── */
.my-tabs{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:24px}
.my-tab{padding:12px 20px;font-size:.88rem;font-weight:700;cursor:pointer;color:var(--text3);border-bottom:3px solid transparent;margin-bottom:-2px;transition:all .15s}
.my-tab.active,.my-tab:hover{color:var(--text);border-bottom-color:var(--orange)}
.my-listing-row{display:flex;align-items:center;gap:14px;padding:14px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:10px}
.my-listing-row .ml-img{width:64px;height:64px;background:var(--bg3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;overflow:hidden;flex-shrink:0}
.my-listing-row .ml-img img{width:100%;height:100%;object-fit:cover}
.my-listing-row .ml-info{flex:1;min-width:0}
.my-listing-row .ml-title{font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.my-listing-row .ml-meta{font-size:.76rem;color:var(--text3);margin-top:3px}
.my-listing-row .ml-price{font-weight:800;color:var(--orange2);font-size:.95rem;flex-shrink:0}
.my-listing-row .ml-actions{display:flex;gap:6px;flex-shrink:0}
.btn-del{padding:7px 12px;background:transparent;border:1px solid #ef4444;color:#ef4444;border-radius:7px;font-size:.78rem;font-weight:700;cursor:pointer;transition:all .15s}
.btn-del:hover{background:#ef4444;color:#fff}
.status-badge{display:inline-block;padding:3px 8px;border-radius:4px;font-size:.72rem;font-weight:700}
.badge-active{background:#064e3b;color:#34d399}.badge-sold{background:#1a1a3a;color:#818cf8}.badge-own{background:#1a3a00;color:#86efac}

/* ── balance card ── */
.balance-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;margin-bottom:28px}
.balance-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px}
.balance-card .bc-label{font-size:.72rem;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:8px}
.balance-card .bc-val{font-size:1.5rem;font-weight:900}
.balance-card.konto .bc-val{color:#34d399}
.balance-card.dc .bc-val{color:var(--orange2)}
.balance-card.schwarz .bc-val{color:#f87171}

/* ── toast ── */
.toast{position:fixed;bottom:28px;right:28px;padding:14px 20px;border-radius:10px;font-weight:700;font-size:.9rem;z-index:9999;animation:slideIn .3s ease;max-width:340px;box-shadow:0 8px 30px rgba(0,0,0,.5)}
.toast-ok{background:#064e3b;border:1px solid #34d399;color:#34d399}
.toast-err{background:#450a0a;border:1px solid #ef4444;color:#ef4444}
@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes slideOut{from{transform:translateX(0);opacity:1}to{transform:translateX(120%);opacity:0}}

/* ── modal ── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px}
.modal-box{background:var(--bg2);border:1px solid var(--orange);border-radius:16px;padding:28px;max-width:440px;width:100%;animation:popIn .3s ease}
@keyframes popIn{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.modal-box h3{font-size:1.1rem;font-weight:800;margin-bottom:8px}
.modal-box p{font-size:.88rem;color:var(--text2);margin-bottom:20px;line-height:1.6}
.modal-box .modal-btns{display:flex;gap:10px}
.modal-box .modal-btns button{flex:1;padding:11px;border-radius:8px;font-weight:700;font-size:.88rem;cursor:pointer;border:none}
.modal-confirm{background:var(--orange);color:#fff}
.modal-cancel{background:var(--bg3);color:var(--text)}

/* ── breadcrumb ── */
.breadcrumb{font-size:.8rem;color:var(--text3);margin-bottom:20px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.breadcrumb a{color:var(--orange2)}.breadcrumb a:hover{text-decoration:underline}
.breadcrumb span{color:var(--text3)}

/* ── pagination ── */
.pagination{display:flex;gap:6px;margin-top:24px;justify-content:center}
.pag-btn{padding:8px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:7px;color:var(--text2);font-size:.85rem;font-weight:600;cursor:pointer;transition:all .15s;text-decoration:none}
.pag-btn:hover,.pag-btn.active{background:var(--orange);border-color:var(--orange);color:#fff}

/* ── misc ── */
.page-title{font-size:1.5rem;font-weight:800;margin-bottom:24px}
.alert{padding:12px 16px;border-radius:8px;font-size:.88rem;margin-bottom:16px}
.alert-err{background:#450a0a;border:1px solid #ef4444;color:#f87171}
.alert-ok{background:#064e3b;border:1px solid #34d399;color:#34d399}
@media(max-width:700px){.pb-hero{flex-direction:column;text-align:center}.pb-hero-logo{width:100px}.detail-meta{grid-template-columns:1fr}.form-row{grid-template-columns:1fr}.sell-card{padding:20px}}
`;

// ── shared layout ─────────────────────────────────────────────────────────────
function layout(title, body, user, extraHead='') {
  const bal = user ? getKonto(user.userId) : null;
  const dc  = user ? getWallet(user.userId) : null;
  return `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — PC Bay</title>
${extraHead}
<style>${CSS}</style>
</head><body>
<header class="pb-header">
  <div class="pb-header-inner">
    <a href="/pcbay" class="pb-logo">
      <img src="/pcbay/logo" alt="PC Bay Logo">
      <div class="pb-logo-text"><span class="p">P</span><span class="c">C</span> <span class="b">B</span><span class="a">A</span><span class="y">Y</span></div>
    </a>
    <form class="pb-search" action="/pcbay/search" method="get">
      <input type="text" name="q" placeholder="Artikel suchen..." value="">
      <select name="cat">
        <option value="">Alle Kategorien</option>
        ${CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.id.charAt(0).toUpperCase()+c.id.slice(1)}</option>`).join('')}
      </select>
      <button type="submit">Suchen</button>
    </form>
    <nav class="pb-nav">
      ${user ? `
        <span class="pb-bal">💵 ${bal?(bal.konto||0).toLocaleString('de-DE'):0}$ &nbsp;|&nbsp; 🪙 ${dc?Number(dc.dc||0).toFixed(2):0}</span>
        <a href="/pcbay/my">Mein Konto</a>
        <a href="/pcbay/sell" class="pb-sell-btn">+ Verkaufen</a>
      ` : `<a href="/pcbay">Anmelden</a>`}
    </nav>
  </div>
</header>
<main>
${body}
</main>
<script>
function toast(msg,ok=true){
  const t=document.createElement('div');
  t.className='toast '+(ok?'toast-ok':'toast-err');
  t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>{t.style.animation='slideOut .3s ease forwards';setTimeout(()=>t.remove(),300);},3200);
}
document.querySelectorAll('.cat-pill,.pb-cat-list li a').forEach(el=>{
  const url=new URL(el.href,location.href);
  if(url.searchParams.get('cat')===new URLSearchParams(location.search).get('cat')&&url.pathname===location.pathname){
    el.classList.add('active');
  }
});
document.querySelectorAll('.pay-opt').forEach(el=>{
  el.addEventListener('click',()=>{
    document.querySelectorAll('.pay-opt').forEach(x=>x.classList.remove('selected'));
    el.classList.add('selected');
    el.querySelector('input[type=radio]').checked=true;
  });
});
// auto select first pay option
const firstOpt=document.querySelector('.pay-opt');
if(firstOpt){firstOpt.classList.add('selected');const r=firstOpt.querySelector('input[type=radio]');if(r)r.checked=true;}
</script>
</body></html>`;
}

// ── logo handler ──────────────────────────────────────────────────────────────
let _logoData = null;
let _logoMime = 'image/jpeg';
function getLogoData() {
  if (_logoData) return _logoData;
  const candidates = [
    path.join(__dirname,'assets','pcbay_logo.jpeg'),
    path.join(__dirname,'lapd_logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      _logoData = fs.readFileSync(p);
      _logoMime = p.endsWith('.png') ? 'image/png' : 'image/jpeg';
      break;
    }
  }
  return _logoData;
}

// ── listing card HTML ──────────────────────────────────────────────────────────
function listingCard(l) {
  const condClass = {neu:'cond-neu',gut:'cond-gut',gebraucht:'cond-gebraucht',defekt:'cond-defekt'}[l.condition]||'cond-gebraucht';
  const condLabel = {neu:'NEU',gut:'GUT',gebraucht:'GEBRAUCHT',defekt:'DEFEKT'}[l.condition]||l.condition;
  const imgHtml = l.imageId
    ? `<img src="/pcbay/img/${l.imageId}" alt="${esc(l.title)}" loading="lazy">`
    : `<div class="no-img">${(CATS.find(c=>c.id===l.category)||{icon:'📦'}).icon}</div>`;
  const priceHtml = l.currency==='dc'
    ? `<span class="pc-coin">🪙 ${Number(l.price).toFixed(4)}</span>`
    : `<span class="bank-price">💵 ${Number(l.price).toLocaleString('de-DE')} $</span>`;
  return `
<a href="/pcbay/listing/${l.id}" class="listing-card">
  <div class="card-img">${imgHtml}</div>
  <div class="card-body">
    <div class="card-title">${esc(l.title)}</div>
    <div class="card-cat">${(CATS.find(c=>c.id===l.category)||{label:'📦 Sonstiges'}).label}</div>
    <div class="card-price">${priceHtml}</div>
    <div class="card-condition"><span class="status-badge ${condClass}">${condLabel}</span></div>
    <div class="card-seller">👤 ${esc(l.sellerName)}</div>
  </div>
</a>`;
}

// ── image store ───────────────────────────────────────────────────────────────
function getImgDir() {
  const d = path.join(DATA_DIR_REF, 'pcbay_images');
  if (!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true});
  return d;
}

// ── main module ───────────────────────────────────────────────────────────────
module.exports = function initPcBay(app, DATA_DIR, client) {
  DATA_DIR_REF = DATA_DIR;
  const express = require('express');
  const multer  = require('multer');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5*1024*1024, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (/image\/(jpeg|png|webp|gif)/.test(file.mimetype)) cb(null,true);
      else cb(new Error('Nur Bilder erlaubt'));
    }
  });

  // session guard
  function auth(req) {
    const tok = req.session && req.session.pcbay_token;
    if (!tok) return null;
    return validateToken(tok);
  }

  // ── logo ──────────────────────────────────────────────────────────────────
  app.get('/pcbay/logo', (req,res) => {
    const data = getLogoData();
    if (!data) return res.status(404).send('');
    res.setHeader('Content-Type', _logoMime);
    res.setHeader('Cache-Control','public,max-age=86400');
    res.send(data);
  });

  // ── image serve ───────────────────────────────────────────────────────────
  app.get('/pcbay/img/:id', (req,res) => {
    const imgPath = path.join(getImgDir(), req.params.id.replace(/[^a-zA-Z0-9_-]/g,''));
    if (!fs.existsSync(imgPath)) return res.status(404).send('');
    res.setHeader('Cache-Control','public,max-age=604800');
    res.sendFile(imgPath);
  });

  // ── login via token ───────────────────────────────────────────────────────
  app.get('/pcbay/login/:token', (req,res) => {
    const user = validateToken(req.params.token);
    if (!user) {
      return res.send(layout('Ungültiger Link','<div class="pb-wrap"><div class="alert alert-err">❌ Dieser Link ist ungültig oder abgelaufen. Bitte den Bot erneut anklicken.</div></div>',null));
    }
    req.session.pcbay_token = req.params.token;
    res.redirect('/pcbay');
  });

  // ── homepage ──────────────────────────────────────────────────────────────
  app.get('/pcbay', (req,res) => {
    const user = auth(req);
    if (!user) {
      return res.send(layout('PC Bay — Marketplace', `
<div class="pb-wrap">
  <div class="pb-hero" style="justify-content:center;text-align:center;flex-direction:column;padding:60px 40px">
    <div class="pb-hero-logo" style="margin-bottom:20px"><img src="/pcbay/logo" style="width:120px;border-radius:50%"></div>
    <div class="pb-hero-text">
      <h1>Willkommen auf <span>PC Bay</span></h1>
      <p>Der Marktplatz von Paradise City Roleplay.<br>Kaufe und verkaufe Artikel, Fahrzeuge und mehr mit deinem Ingame-Geld.</p>
      <div class="pb-hero-btns" style="justify-content:center">
        <div class="btn-secondary" style="cursor:default">🔒 Melde dich über den Discord-Button an</div>
      </div>
    </div>
  </div>
</div>`, null));
    }

    const all = loadListings().filter(l=>l.active&&!l.sold);
    const featured = all.slice().sort((a,b)=>b.createdAt-a.createdAt).slice(0,8);

    res.send(layout('PC Bay — Marketplace', `
<div class="pb-wrap">
  <div class="pb-hero">
    <div class="pb-hero-text">
      <h1>Kaufe &amp; Verkaufe auf <span>PC Bay</span></h1>
      <p>Dein Marktplatz in Paradise City — bezahle mit Bankgeld oder PC Coin.</p>
      <div class="pb-hero-btns">
        <a href="/pcbay/sell" class="btn-primary">+ Artikel verkaufen</a>
        <a href="/pcbay/search" class="btn-secondary">Alle Angebote</a>
      </div>
    </div>
    <div class="pb-hero-logo"><img src="/pcbay/logo" alt="PC Bay"></div>
  </div>

  <div class="cat-pills">
    <a href="/pcbay/search" class="cat-pill active">🏪 Alle</a>
    ${CATS.map(c=>`<a href="/pcbay/search?cat=${c.id}" class="cat-pill">${c.icon} ${c.id.charAt(0).toUpperCase()+c.id.slice(1)}</a>`).join('')}
  </div>

  <div class="listings-header">
    <h2>🔥 Neueste Angebote</h2>
    <span class="listings-count">${all.length} Angebote insgesamt</span>
  </div>
  ${featured.length ? `<div class="listings-grid">${featured.map(listingCard).join('')}</div><div style="text-align:center;margin-top:20px"><a href="/pcbay/search" class="btn-secondary">Alle Angebote anzeigen</a></div>`
    : `<div class="empty-state"><div class="es-icon">🛒</div><h3>Noch keine Angebote</h3><p>Sei der Erste und verkaufe etwas!</p><a href="/pcbay/sell" class="btn-primary" style="margin-top:12px;display:inline-block">Jetzt verkaufen</a></div>`}
</div>`, user));
  });

  // ── search ────────────────────────────────────────────────────────────────
  app.get('/pcbay/search', (req,res) => {
    const user = auth(req);
    if (!user) return res.redirect('/pcbay');
    const { q='', cat='', cur='', min='', max='', cond='', sort='newest' } = req.query;
    const page = Math.max(0, parseInt(req.query.page)||0);
    const PER_PAGE = 20;

    let results = loadListings().filter(l=>l.active&&!l.sold);
    if (q) results = results.filter(l=>l.title.toLowerCase().includes(q.toLowerCase())||l.description.toLowerCase().includes(q.toLowerCase()));
    if (cat) results = results.filter(l=>l.category===cat);
    if (cur) results = results.filter(l=>l.currency===cur);
    if (cond) results = results.filter(l=>l.condition===cond);
    if (min) results = results.filter(l=>l.price>=parseFloat(min));
    if (max) results = results.filter(l=>l.price<=parseFloat(max));

    if (sort==='price_asc')  results.sort((a,b)=>a.price-b.price);
    else if (sort==='price_desc') results.sort((a,b)=>b.price-a.price);
    else results.sort((a,b)=>b.createdAt-a.createdAt);

    const total = results.length;
    const pages = Math.ceil(total/PER_PAGE);
    const slice = results.slice(page*PER_PAGE,(page+1)*PER_PAGE);

    const qStr = new URLSearchParams({q,cat,cur,min,max,cond,sort}).toString();
    const paginationHtml = pages>1 ? `<div class="pagination">
      ${page>0?`<a href="/pcbay/search?${new URLSearchParams({...req.query,page:page-1})}" class="pag-btn">← Zurück</a>`:''}
      ${Array.from({length:Math.min(pages,7)},(_,i)=>{
        const pg=i+(page>3&&pages>7?page-3:0);
        return pg<pages?`<a href="/pcbay/search?${new URLSearchParams({...req.query,page:pg})}" class="pag-btn ${pg===page?'active':''}">${pg+1}</a>`:'';
      }).join('')}
      ${page<pages-1?`<a href="/pcbay/search?${new URLSearchParams({...req.query,page:page+1})}" class="pag-btn">Weiter →</a>`:''}
    </div>`:''

    res.send(layout(`Suche: ${q||cat||'Alle Angebote'}`, `
<div class="pb-wrap">
  <div class="pb-grid">
    <aside class="pb-sidebar">
      <h3>Kategorien</h3>
      <ul class="pb-cat-list">
        <li><a href="/pcbay/search?${new URLSearchParams({...req.query,cat:'',page:0})}" class="${!cat?'active':''}">🏪 Alle Kategorien</a></li>
        ${CATS.map(c=>`<li><a href="/pcbay/search?${new URLSearchParams({...req.query,cat:c.id,page:0})}" class="${cat===c.id?'active':''}">${c.icon} ${c.id.charAt(0).toUpperCase()+c.id.slice(1)}</a></li>`).join('')}
      </ul>
      <form class="filter-section" method="get" action="/pcbay/search">
        <input type="hidden" name="q" value="${esc(q)}">
        <input type="hidden" name="cat" value="${esc(cat)}">
        <h4>Preis filtern</h4>
        <input type="number" name="min" placeholder="Min. Preis" value="${esc(min)}" min="0">
        <input type="number" name="max" placeholder="Max. Preis" value="${esc(max)}" min="0">
        <h4 style="margin-top:12px">Währung</h4>
        <select name="cur">
          <option value="">Alle</option>
          <option value="konto" ${cur==='konto'?'selected':''}>💵 Bankgeld ($)</option>
          <option value="dc" ${cur==='dc'?'selected':''}>🪙 PC Coin</option>
        </select>
        <h4 style="margin-top:12px">Zustand</h4>
        <select name="cond">
          <option value="">Alle</option>
          <option value="neu" ${cond==='neu'?'selected':''}>✨ Neu</option>
          <option value="gut" ${cond==='gut'?'selected':''}>👍 Gut</option>
          <option value="gebraucht" ${cond==='gebraucht'?'selected':''}>📦 Gebraucht</option>
          <option value="defekt" ${cond==='defekt'?'selected':''}>🔧 Defekt</option>
        </select>
        <h4 style="margin-top:12px">Sortierung</h4>
        <select name="sort">
          <option value="newest" ${sort==='newest'?'selected':''}>🕒 Neueste zuerst</option>
          <option value="price_asc" ${sort==='price_asc'?'selected':''}>💹 Günstigste zuerst</option>
          <option value="price_desc" ${sort==='price_desc'?'selected':''}>💎 Teuerste zuerst</option>
        </select>
        <button class="filter-btn" type="submit">Filter anwenden</button>
      </form>
    </aside>
    <div>
      <div class="listings-header">
        <h2>${q?`Ergebnisse für "${esc(q)}"`:cat?(CATS.find(c=>c.id===cat)||{label:'Alle'}).label:'Alle Angebote'}</h2>
        <span class="listings-count">${total} Ergebnis${total!==1?'se':''}</span>
      </div>
      ${slice.length ? `<div class="listings-grid">${slice.map(listingCard).join('')}</div>${paginationHtml}`
        : `<div class="empty-state"><div class="es-icon">🔍</div><h3>Keine Angebote gefunden</h3><p>Versuche andere Suchbegriffe oder Filter.</p></div>`}
    </div>
  </div>
</div>`, user));
  });

  // ── listing detail ────────────────────────────────────────────────────────
  app.get('/pcbay/listing/:id', (req,res) => {
    const user = auth(req);
    if (!user) return res.redirect('/pcbay');
    const listing = loadListings().find(l=>l.id===req.params.id);
    if (!listing) return res.send(layout('Nicht gefunden','<div class="pb-wrap"><div class="alert alert-err">❌ Angebot nicht gefunden.</div><a href="/pcbay" class="btn-primary" style="display:inline-block;margin-top:12px">Zurück</a></div>',user));

    const bal  = getKonto(user.userId);
    const dc   = getWallet(user.userId);
    const isOwn   = listing.sellerId === user.userId;
    const isSold  = listing.sold;
    const catObj  = CATS.find(c=>c.id===listing.category)||{label:'Sonstiges',icon:'📦'};
    const condLabel = {neu:'✨ Neu',gut:'👍 Gut',gebraucht:'📦 Gebraucht',defekt:'🔧 Defekt'}[listing.condition]||listing.condition;

    const imgHtml = listing.imageId
      ? `<img src="/pcbay/img/${listing.imageId}" alt="${esc(listing.title)}">`
      : `${catObj.icon}`;

    let actionHtml = '';
    if (isSold) {
      actionHtml = `<div class="sold-badge">✅ Dieses Angebot wurde bereits verkauft.</div>`;
    } else if (isOwn) {
      actionHtml = `<div class="own-badge">📋 Dies ist dein eigenes Angebot.</div>
        <form method="post" action="/pcbay/api/delete/${listing.id}" style="margin-top:10px" onsubmit="return confirm('Angebot wirklich löschen?')">
          <button class="btn-del" style="width:100%;padding:11px">🗑️ Angebot löschen</button>
        </form>`;
    } else {
      const canAffordKonto = listing.currency==='konto' && (bal.konto||0) >= listing.price;
      const canAffordDc    = listing.currency==='dc'    && (Number(dc.dc)||0) >= listing.price;
      const canAfford = canAffordKonto || canAffordDc;
      const payLabel = listing.currency==='dc'
        ? `🪙 ${Number(listing.price).toFixed(4)} PC Coin`
        : `💵 ${Number(listing.price).toLocaleString('de-DE')} $`;

      actionHtml = `
        <div class="buy-section">
          <h3>Kaufoptionen</h3>
          <div class="pay-options">
            <label class="pay-opt" style="cursor:pointer">
              <input type="radio" name="pay_method" value="${listing.currency}" checked>
              <div class="po-icon">${listing.currency==='dc'?'🪙':'💵'}</div>
              <div class="po-info">
                <div class="po-name">${listing.currency==='dc'?'PC Coin':'Bankgeld'}</div>
                <div class="po-bal">Dein Guthaben: ${listing.currency==='dc'
                  ? `🪙 ${Number(dc.dc||0).toFixed(4)}`
                  : `💵 ${Number(bal.konto||0).toLocaleString('de-DE')} $`}</div>
              </div>
            </label>
          </div>
          <button class="buy-btn" id="buyBtn" onclick="doBuy('${listing.id}')" ${canAfford?'':'disabled'}>
            ${canAfford ? `✅ Jetzt kaufen für ${payLabel}` : `❌ Nicht genug Guthaben`}
          </button>
        </div>`;
    }

    res.send(layout(listing.title, `
<div class="pb-wrap">
  <div class="breadcrumb">
    <a href="/pcbay">PC Bay</a> <span>›</span>
    <a href="/pcbay/search?cat=${listing.category}">${catObj.label}</a> <span>›</span>
    <span>${esc(listing.title)}</span>
  </div>
  <div class="detail-wrap">
    <div>
      <div class="detail-images">${imgHtml}</div>
    </div>
    <div class="detail-side">
      <div class="detail-title">${esc(listing.title)}</div>
      <div class="detail-price">
        ${listing.currency==='dc'
          ? `🪙 ${Number(listing.price).toFixed(4)} <span class="currency-label">PC Coin</span>`
          : `💵 ${Number(listing.price).toLocaleString('de-DE')} <span class="currency-label">$</span>`}
      </div>
      <div class="detail-seller">
        <div class="seller-avatar">${esc(listing.sellerName||'?').charAt(0).toUpperCase()}</div>
        <div class="seller-info">
          <div class="seller-name">${esc(listing.sellerName)}</div>
          <div class="seller-label">Verkäufer</div>
        </div>
      </div>
      <div class="detail-meta">
        <div class="meta-item"><div class="meta-label">Kategorie</div><div class="meta-val">${catObj.label}</div></div>
        <div class="meta-item"><div class="meta-label">Zustand</div><div class="meta-val">${condLabel}</div></div>
        <div class="meta-item"><div class="meta-label">Eingestellt</div><div class="meta-val">${fmtDate(listing.createdAt)}</div></div>
        <div class="meta-item"><div class="meta-label">Status</div><div class="meta-val">${isSold?'<span class="status-badge badge-sold">VERKAUFT</span>':'<span class="status-badge badge-active">AKTIV</span>'}</div></div>
      </div>
      <div class="detail-desc">
        <h3>Beschreibung</h3>
        <p>${esc(listing.description||'Keine Beschreibung.')}</p>
      </div>
      ${actionHtml}
    </div>
  </div>
</div>
<div id="confirmModal" class="modal-overlay" style="display:none">
  <div class="modal-box">
    <h3>💳 Kauf bestätigen</h3>
    <p>Möchtest du diesen Artikel wirklich kaufen?<br>
    <strong>${esc(listing.title)}</strong><br>
    Preis: <strong>${listing.currency==='dc'?`🪙 ${Number(listing.price).toFixed(4)} PC Coin`:`💵 ${Number(listing.price).toLocaleString('de-DE')} $`}</strong></p>
    <div class="modal-btns">
      <button class="modal-cancel" onclick="document.getElementById('confirmModal').style.display='none'">Abbrechen</button>
      <button class="modal-confirm" id="confirmBuyBtn" onclick="confirmBuy('${listing.id}')">Kaufen</button>
    </div>
  </div>
</div>
<script>
function doBuy(id){ document.getElementById('confirmModal').style.display='flex'; }
async function confirmBuy(id) {
  const btn = document.getElementById('confirmBuyBtn');
  btn.disabled=true; btn.textContent='...';
  document.getElementById('confirmModal').style.display='none';
  try {
    const r = await fetch('/pcbay/api/buy/'+id, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
    const d = await r.json();
    if(d.ok){ toast('✅ Kauf erfolgreich!'); setTimeout(()=>location.reload(),1500); }
    else{ toast('❌ '+d.error, false); btn.disabled=false; btn.textContent='Kaufen'; }
  } catch(e){ toast('❌ Fehler: '+e.message,false); btn.disabled=false; }
}
</script>`, user));
  });

  // ── buy API ───────────────────────────────────────────────────────────────
  app.post('/pcbay/api/buy/:id', express.json(), async (req,res) => {
    const user = auth(req);
    if (!user) return res.status(401).json({error:'Nicht angemeldet'});

    const listings = loadListings();
    const idx = listings.findIndex(l=>l.id===req.params.id);
    if (idx===-1) return res.json({error:'Angebot nicht gefunden'});
    const l = listings[idx];
    if (l.sold || !l.active) return res.json({error:'Angebot nicht mehr verfügbar'});
    if (l.sellerId===user.userId) return res.json({error:'Du kannst deinen eigenen Artikel nicht kaufen'});

    // check balance & deduct
    if (l.currency==='konto') {
      const k = getKonto(user.userId);
      if ((k.konto||0) < l.price) return res.json({error:`Nicht genug Bankgeld. Du hast ${(k.konto||0).toLocaleString('de-DE')} $`});
      k.konto = Math.round(((k.konto||0) - l.price)*100)/100;
      setKonto(user.userId, k);
      // add to seller
      const sk = getKonto(l.sellerId);
      sk.konto = Math.round(((sk.konto||0) + l.price)*100)/100;
      setKonto(l.sellerId, sk);
    } else {
      const w = getWallet(user.userId);
      if ((Number(w.dc)||0) < l.price) return res.json({error:`Nicht genug PC Coin. Du hast ${Number(w.dc||0).toFixed(4)}`});
      w.dc = Math.round(((Number(w.dc)||0) - l.price)*1e8)/1e8;
      setWallet(user.userId, w);
      // add to seller
      const sw = getWallet(l.sellerId);
      sw.dc = Math.round(((Number(sw.dc)||0) + l.price)*1e8)/1e8;
      setWallet(l.sellerId, sw);
    }

    // mark sold
    listings[idx].sold = true;
    listings[idx].active = false;
    listings[idx].buyerId = user.userId;
    listings[idx].buyerName = user.username;
    listings[idx].soldAt = Date.now();
    saveListings(listings);

    // save transaction
    const txs = loadTransactions();
    txs.push({ id: genId(), listingId: l.id, title: l.title, buyerId: user.userId, buyerName: user.username, sellerId: l.sellerId, sellerName: l.sellerName, price: l.price, currency: l.currency, ts: Date.now() });
    saveTx(txs);

    // notify seller via DM
    if (client) {
      try {
        const seller = await client.users.fetch(l.sellerId).catch(()=>null);
        if (seller) {
          const { EmbedBuilder } = require('discord.js');
          await seller.send({ embeds: [new EmbedBuilder()
            .setColor(0xE07B00)
            .setTitle('🛒 Dein Artikel wurde verkauft!')
            .addFields(
              {name:'📦 Artikel',value:l.title,inline:true},
              {name:'👤 Käufer',value:user.username,inline:true},
              {name:'💰 Betrag',value:l.currency==='dc'?`🪙 ${Number(l.price).toFixed(4)} PC Coin`:`💵 ${Number(l.price).toLocaleString('de-DE')} $`,inline:true}
            )
            .setFooter({text:'PC Bay • Paradise City Roleplay'})
            .setTimestamp()
          ]}).catch(()=>{});
        }
      } catch {}
    }

    res.json({ok:true});
  });

  // ── sell form ──────────────────────────────────────────────────────────────
  app.get('/pcbay/sell', (req,res) => {
    const user = auth(req);
    if (!user) return res.redirect('/pcbay');
    const errMsg = req.query.err ? `<div class="alert alert-err">❌ ${esc(req.query.err)}</div>` : '';
    res.send(layout('Artikel verkaufen', `
<div class="pb-wrap">
  <div class="sell-wrap">
    <div class="breadcrumb"><a href="/pcbay">PC Bay</a> <span>›</span> <span>Verkaufen</span></div>
    <div class="sell-card">
      <h2>🏪 Artikel verkaufen</h2>
      ${errMsg}
      <form method="post" action="/pcbay/api/sell" enctype="multipart/form-data">
        <div class="form-group">
          <label>Titel *</label>
          <input type="text" name="title" required maxlength="100" placeholder="z.B. Elegy RH8, AK-47, Appartement Downtown...">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Kategorie *</label>
            <select name="category" required>
              ${CATS.map(c=>`<option value="${c.id}">${c.icon} ${c.id.charAt(0).toUpperCase()+c.id.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Zustand *</label>
            <select name="condition" required>
              <option value="neu">✨ Neu</option>
              <option value="gut">👍 Gut</option>
              <option value="gebraucht" selected>📦 Gebraucht</option>
              <option value="defekt">🔧 Defekt</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Preis &amp; Währung *</label>
          <div class="price-row">
            <input type="number" name="price" required min="1" step="0.0001" placeholder="Preis eingeben...">
            <select name="currency">
              <option value="konto">💵 Bankgeld ($)</option>
              <option value="dc">🪙 PC Coin</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Beschreibung *</label>
          <textarea name="description" required maxlength="1000" placeholder="Beschreibe deinen Artikel genau..."></textarea>
        </div>
        <div class="form-group">
          <label>Bild (optional, max. 5MB)</label>
          <div class="file-drop" id="fileDrop">
            <input type="file" name="image" accept="image/*" id="fileInput" onchange="previewImg(this)">
            <div style="font-size:2rem">📸</div>
            <p>Bild hierher ziehen oder klicken</p>
          </div>
          <div class="img-preview" id="imgPreview"></div>
        </div>
        <button class="submit-btn" type="submit">📤 Angebot einstellen</button>
      </form>
    </div>
  </div>
</div>
<script>
function previewImg(input) {
  const preview = document.getElementById('imgPreview');
  preview.innerHTML = '';
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.innerHTML = '<div class="img-prev-box"><img src="'+e.target.result+'"></div>';
    };
    reader.readAsDataURL(input.files[0]);
  }
}
const drop = document.getElementById('fileDrop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');const fi=drop.querySelector('input');fi.files=e.dataTransfer.files;previewImg(fi)});
</script>`, user));
  });

  // ── sell POST ─────────────────────────────────────────────────────────────
  app.post('/pcbay/api/sell', upload.single('image'), (req,res) => {
    const user = auth(req);
    if (!user) return res.status(401).redirect('/pcbay');
    const { title, description, category, condition, price, currency } = req.body;
    if (!title||!description||!category||!price) return res.redirect('/pcbay/sell?err=Bitte alle Felder ausfüllen');
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)||priceNum<=0) return res.redirect('/pcbay/sell?err=Ungültiger Preis');

    let imageId = null;
    if (req.file) {
      const ext = req.file.mimetype.includes('png')?'png':req.file.mimetype.includes('webp')?'webp':'jpg';
      imageId = genId()+'.'+ext;
      fs.writeFileSync(path.join(getImgDir(), imageId), req.file.buffer);
    }

    const listings = loadListings();
    const listing = {
      id: genId(), sellerId: user.userId, sellerName: user.username,
      title: String(title).slice(0,100), description: String(description).slice(0,1000),
      category: CATS.find(c=>c.id===category)?category:'sonstiges',
      condition: ['neu','gut','gebraucht','defekt'].includes(condition)?condition:'gebraucht',
      price: priceNum, currency: currency==='dc'?'dc':'konto',
      imageId, active: true, sold: false, createdAt: Date.now()
    };
    listings.push(listing);
    saveListings(listings);
    res.redirect(`/pcbay/listing/${listing.id}?ok=1`);
  });

  // ── delete listing ────────────────────────────────────────────────────────
  app.post('/pcbay/api/delete/:id', (req,res) => {
    const user = auth(req);
    if (!user) return res.redirect('/pcbay');
    const listings = loadListings();
    const idx = listings.findIndex(l=>l.id===req.params.id&&l.sellerId===user.userId);
    if (idx===-1) return res.redirect('/pcbay/my?err=Nicht gefunden');
    // delete image if exists
    if (listings[idx].imageId) {
      const ip = path.join(getImgDir(), listings[idx].imageId);
      if (fs.existsSync(ip)) fs.unlinkSync(ip);
    }
    listings.splice(idx,1);
    saveListings(listings);
    res.redirect('/pcbay/my?ok=Angebot gelöscht');
  });

  // ── my account ────────────────────────────────────────────────────────────
  app.get('/pcbay/my', (req,res) => {
    const user = auth(req);
    if (!user) return res.redirect('/pcbay');
    const tab = req.query.tab||'listings';
    const bal = getKonto(user.userId);
    const dc  = getWallet(user.userId);
    const all = loadListings();
    const myListings = all.filter(l=>l.sellerId===user.userId).sort((a,b)=>b.createdAt-a.createdAt);
    const myBuys = all.filter(l=>l.buyerId===user.userId).sort((a,b)=>(b.soldAt||0)-(a.soldAt||0));
    const errMsg = req.query.err ? `<div class="alert alert-err">❌ ${esc(req.query.err)}</div>` : '';
    const okMsg  = req.query.ok  ? `<div class="alert alert-ok">✅ ${esc(req.query.ok)}</div>`  : '';

    function renderRow(l, isOwn) {
      const imgHtml = l.imageId ? `<img src="/pcbay/img/${l.imageId}" alt="">` : (CATS.find(c=>c.id===l.category)||{icon:'📦'}).icon;
      const priceHtml = l.currency==='dc' ? `🪙 ${Number(l.price).toFixed(4)}` : `💵 ${Number(l.price).toLocaleString('de-DE')} $`;
      const statusHtml = l.sold ? `<span class="status-badge badge-sold">VERKAUFT</span>` : `<span class="status-badge badge-active">AKTIV</span>`;
      return `
<div class="my-listing-row">
  <div class="ml-img">${imgHtml}</div>
  <div class="ml-info">
    <div class="ml-title"><a href="/pcbay/listing/${l.id}">${esc(l.title)}</a></div>
    <div class="ml-meta">${(CATS.find(c=>c.id===l.category)||{label:'Sonstiges'}).label} • ${fmtDate(l.createdAt)} ${l.sold&&isOwn?`• Verkauft an: ${esc(l.buyerName||'?')}`:''}${!isOwn&&l.sellerName?`• Verkäufer: ${esc(l.sellerName)}`:''}</div>
    <div>${statusHtml}</div>
  </div>
  <div class="ml-price">${priceHtml}</div>
  ${isOwn&&!l.sold?`<div class="ml-actions"><form method="post" action="/pcbay/api/delete/${l.id}" onsubmit="return confirm('Angebot löschen?')"><button class="btn-del">🗑️</button></form></div>`:''}
</div>`;
    }

    res.send(layout('Mein Konto', `
<div class="pb-wrap">
  <div class="breadcrumb"><a href="/pcbay">PC Bay</a> <span>›</span> <span>Mein Konto</span></div>
  <h1 class="page-title">👤 Mein Konto — ${esc(user.username)}</h1>
  ${errMsg}${okMsg}
  <div class="balance-cards">
    <div class="balance-card konto"><div class="bc-label">💵 Bankgeld</div><div class="bc-val">${(bal.konto||0).toLocaleString('de-DE')} $</div></div>
    <div class="balance-card dc"><div class="bc-label">🪙 PC Coin</div><div class="bc-val">${Number(dc.dc||0).toFixed(4)}</div></div>
    <div class="balance-card"><div class="bc-label">📦 Aktive Angebote</div><div class="bc-val">${myListings.filter(l=>l.active).length}</div></div>
    <div class="balance-card"><div class="bc-label">✅ Verkäufe</div><div class="bc-val">${myListings.filter(l=>l.sold).length}</div></div>
    <div class="balance-card"><div class="bc-label">🛒 Käufe</div><div class="bc-val">${myBuys.length}</div></div>
  </div>
  <div class="my-tabs">
    <div class="my-tab ${tab==='listings'?'active':''}" onclick="setTab('listings')">📦 Meine Angebote (${myListings.length})</div>
    <div class="my-tab ${tab==='buys'?'active':''}" onclick="setTab('buys')">🛒 Meine Käufe (${myBuys.length})</div>
  </div>
  <div id="tab-listings" ${tab!=='listings'?'style="display:none"':''}>
    <div style="margin-bottom:16px"><a href="/pcbay/sell" class="btn-primary" style="display:inline-block">+ Neues Angebot</a></div>
    ${myListings.length ? myListings.map(l=>renderRow(l,true)).join('') : '<div class="empty-state"><div class="es-icon">📦</div><h3>Keine Angebote</h3><p>Stell deinen ersten Artikel zum Verkauf ein!</p></div>'}
  </div>
  <div id="tab-buys" ${tab!=='buys'?'style="display:none"':''}>
    ${myBuys.length ? myBuys.map(l=>renderRow(l,false)).join('') : '<div class="empty-state"><div class="es-icon">🛒</div><h3>Noch keine Käufe</h3><p>Stöbere in den Angeboten!</p></div>'}
  </div>
</div>
<script>
function setTab(t){
  ['listings','buys'].forEach(id=>{
    document.getElementById('tab-'+id).style.display=id===t?'':'none';
    document.querySelectorAll('.my-tab').forEach((el,i)=>el.classList.toggle('active',(['listings','buys'][i])===t));
  });
  history.replaceState(null,'','/pcbay/my?tab='+t);
}
</script>`, user));
  });
};
