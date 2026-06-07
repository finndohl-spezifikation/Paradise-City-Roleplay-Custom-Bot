'use strict';
const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────
function genId() { return crypto.randomBytes(8).toString('hex'); }
function esc(s)  { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmtDatum(ms) {
  const d = new Date(ms);
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function fmtPreis(v, cur) {
  if (cur==='dc') return `${Number(v).toFixed(4)} 🪙`;
  return `${Number(v).toLocaleString('de-DE')} $`;
}

// ── Datenzugriff ──────────────────────────────────────────────────────────────
let DATA_DIR_REF = '';
const fp = n => path.join(DATA_DIR_REF, n);
function ladeJson(file, def={}) { try { return JSON.parse(fs.readFileSync(file,'utf8')); } catch { return def; } }
function speichereJson(file, data) { fs.writeFileSync(file, JSON.stringify(data,null,2),'utf8'); }

function ladeTokens()      { return ladeJson(fp('pcbay_tokens.json'),{}); }
function speichereTokens(d){ speichereJson(fp('pcbay_tokens.json'), d); }
function ladeAngebote()    { return ladeJson(fp('pcbay_listings.json'),[]); }
function speichereAngebote(d){ speichereJson(fp('pcbay_listings.json'), d); }

function getKonto(uid) { const d=ladeJson(fp('konto.json'),{}); return d[uid]??{konto:0,schwarz:0}; }
function setKonto(uid,obj){ const d=ladeJson(fp('konto.json'),{}); d[uid]=obj; speichereJson(fp('konto.json'),d); }
function getWallet(uid){ const d=ladeJson(fp('krypto.json'),{}); return d[uid]||{dc:0}; }
function setWallet(uid,w){ const d=ladeJson(fp('krypto.json'),{}); d[uid]=w; speichereJson(fp('krypto.json'),d); }

function holeOderErstelleToken(userId, username) {
  const toks = ladeTokens();
  for (const [tok, v] of Object.entries(toks)) {
    if (v.userId === userId) {
      if (username) { toks[tok].username = username; speichereTokens(toks); }
      return tok;
    }
  }
  const tok = crypto.randomBytes(24).toString('hex');
  toks[tok] = { userId, username: username||'Unbekannt', createdAt: Date.now() };
  speichereTokens(toks);
  return tok;
}
function prüfeToken(tok) { const toks=ladeTokens(); return toks[tok]||null; }

// ── Kategorien (nur legale Artikel) ───────────────────────────────────────────
const KATEGORIEN = [
  { id:'fahrzeuge',        label:'Fahrzeuge',          icon:'🚗' },
  { id:'immobilien',       label:'Immobilien',         icon:'🏠' },
  { id:'kleidung',         label:'Kleidung & Mode',    icon:'👕' },
  { id:'elektronik',       label:'Elektronik',         icon:'💻' },
  { id:'lebensmittel',     label:'Lebensmittel',       icon:'🍕' },
  { id:'moebel',           label:'Möbel & Wohnen',     icon:'🛋️' },
  { id:'sport',            label:'Sport & Freizeit',   icon:'⚽' },
  { id:'dienstleistungen', label:'Dienstleistungen',   icon:'🛠️' },
  { id:'sonstiges',        label:'Sonstiges',          icon:'📦' },
];

// ── CSS (mobil-first, eBay-ähnlich) ───────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900&display=swap');
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
:root{
  --bg:#111;--bg2:#1a1a1a;--bg3:#222;--bg4:#2a2a2a;
  --border:#333;--border2:#3a3a3a;
  --orange:#E07B00;--orange2:#F59E0B;--orange-glow:rgba(224,123,0,.18);
  --blau:#4285F4;--grün:#34A853;--rot:#EA4335;--gelb:#FBBC05;
  --text:#f0f0f0;--text2:#bbb;--text3:#888;--text4:#555;
  --header-h:60px;--nav-h:44px;--mobile-nav-h:56px;
}
html{scroll-behavior:smooth}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;padding-bottom:var(--mobile-nav-h)}
@media(min-width:768px){body{padding-bottom:0}}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
button,input,select,textarea{font-family:inherit}

/* ═══ HEADER ═════════════════════════════════════════════════════════════ */
.pb-header{
  background:var(--bg2);
  border-bottom:2px solid var(--orange);
  position:sticky;top:0;z-index:200;
  box-shadow:0 2px 16px rgba(0,0,0,.6);
}
.pb-header-inner{
  max-width:1400px;margin:0 auto;
  padding:0 12px;
  height:var(--header-h);
  display:flex;align-items:center;gap:10px;
}
/* Logo */
.pb-logo{display:flex;align-items:center;gap:8px;flex-shrink:0;text-decoration:none}
.pb-logo img{width:36px;height:36px;border-radius:7px;object-fit:cover;flex-shrink:0}
.pb-logo-text{
  font-size:1.25rem;font-weight:900;letter-spacing:-0.5px;white-space:nowrap;
}
.pb-logo-text .p{color:var(--blau)}.pb-logo-text .c{color:var(--grün)}
.pb-logo-text .b{color:var(--rot)}.pb-logo-text .a{color:var(--gelb)}.pb-logo-text .y{color:var(--blau)}
/* Suchfeld */
.pb-search-wrap{flex:1;min-width:0;display:flex;border:2px solid var(--border2);border-radius:8px;overflow:hidden}
.pb-search-wrap:focus-within{border-color:var(--orange)}
.pb-search-wrap input{
  flex:1;min-width:0;
  padding:9px 12px;
  background:var(--bg3);border:none;
  color:var(--text);font-size:.9rem;outline:none;
}
.pb-search-wrap input::placeholder{color:var(--text4)}
.pb-search-wrap button{
  padding:9px 14px;background:var(--orange);
  border:none;color:#fff;font-weight:700;
  cursor:pointer;white-space:nowrap;font-size:.85rem;
  transition:background .15s;flex-shrink:0;
}
.pb-search-wrap button:hover{background:var(--orange2)}
/* Header-Aktionen */
.pb-header-actions{display:flex;align-items:center;gap:4px;flex-shrink:0}
.pb-hbtn{
  display:flex;flex-direction:column;align-items:center;
  padding:6px 8px;border-radius:7px;font-size:.65rem;
  color:var(--text3);cursor:pointer;transition:all .15s;
  text-decoration:none;border:none;background:none;
}
.pb-hbtn .hbtn-icon{font-size:1.15rem;margin-bottom:1px}
.pb-hbtn:hover{background:var(--bg3);color:var(--text)}
.pb-hbtn.sell{background:var(--orange);color:#fff;font-weight:700}
.pb-hbtn.sell:hover{background:var(--orange2)}
.pb-bal-wrap{display:flex;flex-direction:column;align-items:flex-end;font-size:.72rem;color:var(--text3);padding:4px 8px;flex-shrink:0}
.pb-bal-wrap .bal-bank{color:#34A853;font-weight:700}
.pb-bal-wrap .bal-dc{color:var(--orange2);font-weight:700}

/* ═══ KATEGORIE-NAV ══════════════════════════════════════════════════════ */
.pb-catnav{
  background:var(--bg2);border-bottom:1px solid var(--border);
  position:sticky;top:var(--header-h);z-index:190;
}
.pb-catnav-inner{
  max-width:1400px;margin:0 auto;
  padding:0 12px;
  display:flex;gap:0;
  overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
}
.pb-catnav-inner::-webkit-scrollbar{display:none}
.pb-catnav-item{
  display:flex;align-items:center;gap:5px;
  padding:10px 14px;
  white-space:nowrap;font-size:.8rem;font-weight:600;
  color:var(--text3);cursor:pointer;border:none;background:none;
  border-bottom:2px solid transparent;transition:all .15s;
  text-decoration:none;flex-shrink:0;
}
.pb-catnav-item:hover{color:var(--text);border-bottom-color:var(--border2)}
.pb-catnav-item.aktiv{color:var(--orange2);border-bottom-color:var(--orange)}

/* ═══ LAYOUT ═════════════════════════════════════════════════════════════ */
.pb-wrap{max-width:1400px;margin:0 auto;padding:16px 12px}
.pb-layout{display:grid;grid-template-columns:1fr;gap:20px}
@media(min-width:900px){
  .pb-layout{grid-template-columns:220px 1fr;align-items:start}
}

/* ═══ FILTER-SIDEBAR ════════════════════════════════════════════════════ */
.pb-sidebar{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;
}
@media(max-width:899px){.pb-sidebar{display:none}}
.pb-sidebar h3{
  padding:12px 14px;font-size:.7rem;
  text-transform:uppercase;letter-spacing:1.5px;
  color:var(--text4);background:var(--bg3);
  border-bottom:1px solid var(--border);
}
.pb-kat-liste{list-style:none}
.pb-kat-liste li a{
  display:flex;align-items:center;gap:8px;
  padding:10px 14px;font-size:.85rem;
  color:var(--text2);transition:all .12s;
  border-bottom:1px solid var(--bg3);
}
.pb-kat-liste li a:hover,.pb-kat-liste li a.aktiv{
  background:var(--bg3);color:var(--text);
}
.pb-kat-liste li a.aktiv{
  border-left:3px solid var(--orange);
  color:var(--orange2);padding-left:11px;
}
.sidebar-filter{padding:14px;border-top:1px solid var(--border)}
.sidebar-filter h4{font-size:.7rem;text-transform:uppercase;letter-spacing:1px;color:var(--text4);margin-bottom:10px}
.sidebar-filter input,.sidebar-filter select{
  width:100%;padding:8px 10px;margin-bottom:8px;
  background:var(--bg3);border:1px solid var(--border2);
  border-radius:6px;color:var(--text);font-size:.82rem;outline:none;
}
.sidebar-filter input:focus,.sidebar-filter select:focus{border-color:var(--orange)}
.filter-btn{
  width:100%;padding:9px;background:var(--orange);
  border:none;border-radius:7px;color:#fff;
  font-weight:700;font-size:.82rem;cursor:pointer;
}
.filter-btn:hover{background:var(--orange2)}

/* ═══ ANGEBOTS-RASTER ════════════════════════════════════════════════════ */
.angebote-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px}
.angebote-header h2{font-size:1rem;font-weight:700}
.angebote-count{font-size:.8rem;color:var(--text3)}
.sortier-select{padding:6px 10px;background:var(--bg3);border:1px solid var(--border2);border-radius:6px;color:var(--text);font-size:.8rem;outline:none}
.angebote-raster{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:10px;
}
@media(min-width:600px){.angebote-raster{grid-template-columns:repeat(3,1fr)}}
@media(min-width:900px){.angebote-raster{grid-template-columns:repeat(3,1fr)}}
@media(min-width:1100px){.angebote-raster{grid-template-columns:repeat(4,1fr)}}

/* Angebotskarte */
.angebot-karte{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:10px;overflow:hidden;
  display:flex;flex-direction:column;
  transition:transform .18s,border-color .18s,box-shadow .18s;
  text-decoration:none;color:inherit;
}
.angebot-karte:hover{
  border-color:var(--orange);
  transform:translateY(-2px);
  box-shadow:0 6px 24px var(--orange-glow);
}
.karte-bild{
  aspect-ratio:1;background:var(--bg3);
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;position:relative;
  border-bottom:1px solid var(--border);
}
.karte-bild img{width:100%;height:100%;object-fit:cover}
.karte-bild .kein-bild{font-size:2.5rem;opacity:.4}
.zustand-badge-img{
  position:absolute;top:6px;left:6px;
  padding:2px 7px;border-radius:4px;
  font-size:.62rem;font-weight:800;letter-spacing:.3px;
}
.karte-body{padding:10px;flex:1;display:flex;flex-direction:column;gap:3px}
.karte-titel{font-size:.85rem;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.karte-preis{font-size:1.05rem;font-weight:900;margin-top:auto;padding-top:4px}
.karte-preis.bank{color:#34A853}
.karte-preis.dc{color:var(--orange2)}
.karte-verkaeufer{font-size:.7rem;color:var(--text4);margin-top:3px}
.karte-kat{font-size:.68rem;color:var(--text4)}

/* Zustand-Farben */
.zust-neu{background:#064e3b;color:#34d399}
.zust-gut{background:#1e3a5f;color:#60a5fa}
.zust-gebraucht{background:#3b2a1a;color:#f59e0b}
.zust-defekt{background:#3b1a1a;color:#f87171}

/* ═══ HERO-BANNER ════════════════════════════════════════════════════════ */
.pb-hero{
  background:linear-gradient(135deg,#1a0d00 0%,#2d1700 50%,#1a0d00 100%);
  border:1px solid #3a2000;border-radius:14px;
  padding:28px 24px;margin-bottom:20px;
  display:flex;align-items:center;gap:20px;
  position:relative;overflow:hidden;
}
.pb-hero::after{
  content:'';position:absolute;right:-40px;top:-40px;
  width:220px;height:220px;
  background:radial-gradient(circle,rgba(224,123,0,.15),transparent 70%);
  pointer-events:none;
}
.pb-hero-text h1{font-size:1.4rem;font-weight:900;line-height:1.25;margin-bottom:6px}
.pb-hero-text h1 em{color:var(--orange2);font-style:normal}
.pb-hero-text p{color:var(--text2);font-size:.85rem;line-height:1.55;margin-bottom:16px}
.pb-hero-btns{display:flex;gap:10px;flex-wrap:wrap}
.pb-hero-logo{width:100px;flex-shrink:0;opacity:.9}
.pb-hero-logo img{border-radius:12px;width:100%}
@media(max-width:480px){.pb-hero{flex-direction:column;text-align:center}.pb-hero-logo{width:80px}.pb-hero-btns{justify-content:center}}

/* ═══ BUTTONS ════════════════════════════════════════════════════════════ */
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:8px;font-weight:700;font-size:.85rem;border:none;cursor:pointer;transition:all .15s;text-decoration:none}
.btn-primary{background:var(--orange);color:#fff}
.btn-primary:hover{background:var(--orange2)}
.btn-outline{background:transparent;color:var(--orange2);border:2px solid var(--orange)}
.btn-outline:hover{background:var(--orange);color:#fff}
.btn-grün{background:#064e3b;color:#34d399;border:1px solid #34d399}
.btn-grün:hover{background:#34d399;color:#000}
.btn-rot{background:transparent;color:#ef4444;border:1px solid #ef4444;padding:7px 12px;font-size:.78rem}
.btn-rot:hover{background:#ef4444;color:#fff}
.btn-lg{padding:14px 28px;font-size:1rem}
.btn-block{width:100%;justify-content:center}

/* ═══ DETAIL-SEITE ═══════════════════════════════════════════════════════ */
.detail-layout{
  display:grid;grid-template-columns:1fr;gap:20px;
}
@media(min-width:768px){
  .detail-layout{grid-template-columns:1fr 360px;align-items:start}
}
.detail-galerie{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;
  aspect-ratio:1;display:flex;align-items:center;justify-content:center;
  font-size:5rem;
}
.detail-galerie img{width:100%;height:100%;object-fit:contain;padding:16px}
.detail-panel{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px}
.detail-titel{font-size:1.3rem;font-weight:800;line-height:1.35;margin-bottom:6px}
.detail-preis{font-size:2rem;font-weight:900;margin-bottom:14px}
.detail-preis.bank{color:#34A853}
.detail-preis.dc{color:var(--orange2)}
.detail-preis .preis-label{font-size:.85rem;font-weight:500;color:var(--text3);display:block;margin-bottom:2px}
.verkaeufer-box{
  display:flex;align-items:center;gap:10px;
  padding:12px 14px;background:var(--bg3);
  border-radius:9px;margin-bottom:14px;
}
.verk-avatar{
  width:38px;height:38px;border-radius:50%;
  background:var(--orange);display:flex;
  align-items:center;justify-content:center;
  font-weight:800;font-size:.95rem;flex-shrink:0;
}
.verk-name{font-weight:700;font-size:.9rem}
.verk-label{font-size:.7rem;color:var(--text3)}
.detail-meta-grid{
  display:grid;grid-template-columns:1fr 1fr;
  gap:8px;margin-bottom:16px;
}
.meta-box{background:var(--bg3);border-radius:8px;padding:10px 12px}
.meta-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.5px;color:var(--text4);margin-bottom:4px}
.meta-val{font-size:.88rem;font-weight:700}
.detail-beschr{margin-bottom:18px}
.detail-beschr h3{font-size:.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text4);margin-bottom:8px}
.detail-beschr p{font-size:.88rem;color:var(--text2);line-height:1.7;white-space:pre-wrap}
.kauf-box{background:var(--bg3);border-radius:10px;padding:16px;margin-bottom:14px}
.kauf-box h3{font-size:.75rem;text-transform:uppercase;letter-spacing:1px;color:var(--text4);margin-bottom:12px}
.kauf-btn{
  width:100%;padding:15px;border:none;border-radius:10px;
  font-size:1rem;font-weight:800;cursor:pointer;
  background:var(--orange);color:#fff;
  transition:background .15s;letter-spacing:.3px;
}
.kauf-btn:hover{background:var(--orange2)}
.kauf-btn:disabled{background:var(--bg4);color:var(--text4);cursor:not-allowed}
.eigenes-badge{background:#1a3a1a;border:1px solid #2ea043;color:#34d399;padding:12px;border-radius:8px;text-align:center;font-weight:700;font-size:.88rem}
.verkauft-badge{background:var(--bg3);border:1px solid var(--border2);color:var(--text3);padding:12px;border-radius:8px;text-align:center;font-weight:700}

/* ═══ VERKAUFEN-FORMULAR ════════════════════════════════════════════════ */
.formular-wrap{max-width:720px;margin:0 auto}
.formular-karte{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:24px}
.formular-karte h2{font-size:1.2rem;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text3);margin-bottom:6px}
.fg input,.fg select,.fg textarea{
  width:100%;padding:11px 13px;
  background:var(--bg3);border:1.5px solid var(--border2);
  border-radius:8px;color:var(--text);font-size:.88rem;
  outline:none;transition:border .15s;
}
.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:var(--orange)}
.fg textarea{min-height:110px;resize:vertical}
.fg .preis-zeile{display:flex;gap:10px}
.fg .preis-zeile input{flex:1}
.fg .preis-zeile select{width:160px;flex-shrink:0}
.foto-drop{
  border:2px dashed var(--border2);border-radius:10px;
  padding:24px 16px;text-align:center;
  background:var(--bg3);cursor:pointer;
  transition:all .15s;position:relative;
}
.foto-drop:hover,.foto-drop.drag{border-color:var(--orange);background:#1a0d00}
.foto-drop input{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.foto-drop .drop-icon{font-size:2rem;margin-bottom:6px}
.foto-drop p{font-size:.82rem;color:var(--text3)}
.foto-vorschau{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.foto-vor-box{width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border2)}
.foto-vor-box img{width:100%;height:100%;object-fit:cover}
.fg-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:500px){.fg-row{grid-template-columns:1fr}}

/* ═══ MEIN KONTO ════════════════════════════════════════════════════════ */
.kontostand-raster{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:22px}
@media(min-width:600px){.kontostand-raster{grid-template-columns:repeat(4,1fr)}}
.kontostand-karte{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:16px}
.kk-label{font-size:.68rem;text-transform:uppercase;letter-spacing:1px;color:var(--text4);margin-bottom:6px}
.kk-wert{font-size:1.35rem;font-weight:900}
.kk-wert.bank{color:#34A853}.kk-wert.dc{color:var(--orange2)}.kk-wert.neutral{color:var(--text)}
.tab-leiste{display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:18px;overflow-x:auto}
.tab-leiste::-webkit-scrollbar{display:none}
.tab-btn{
  padding:11px 18px;font-size:.85rem;font-weight:700;
  color:var(--text3);border-bottom:3px solid transparent;
  margin-bottom:-2px;cursor:pointer;white-space:nowrap;
  transition:all .15s;flex-shrink:0;
}
.tab-btn.aktiv,.tab-btn:hover{color:var(--text);border-bottom-color:var(--orange)}
.angebot-zeile{
  display:flex;align-items:center;gap:12px;
  padding:12px;background:var(--bg2);border:1px solid var(--border);
  border-radius:10px;margin-bottom:8px;
}
.az-bild{width:60px;height:60px;border-radius:8px;background:var(--bg3);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:1.5rem}
.az-bild img{width:100%;height:100%;object-fit:cover}
.az-info{flex:1;min-width:0}
.az-titel{font-weight:700;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.az-meta{font-size:.72rem;color:var(--text3);margin-top:2px}
.az-preis{font-weight:800;font-size:.9rem;flex-shrink:0}
.az-preis.bank{color:#34A853}.az-preis.dc{color:var(--orange2)}
.az-aktionen{display:flex;gap:6px;flex-shrink:0}
.status-pill{display:inline-block;padding:3px 8px;border-radius:20px;font-size:.68rem;font-weight:800}
.sp-aktiv{background:#064e3b;color:#34d399}
.sp-verkauft{background:#1a1a3a;color:#818cf8}

/* ═══ LEGAL-HINWEIS ══════════════════════════════════════════════════════ */
.legal-hinweis{
  display:flex;align-items:flex-start;gap:10px;
  background:#1a1200;border:1px solid #854d0e;
  border-radius:9px;padding:11px 14px;
  margin-bottom:18px;font-size:.82rem;
}
.legal-hinweis .hinweis-icon{font-size:1.1rem;flex-shrink:0;margin-top:1px}
.legal-hinweis strong{color:#f59e0b}
.legal-hinweis span{color:var(--text3)}

/* ═══ BROTKRÜMEL ═════════════════════════════════════════════════════════ */
.brotkrümel{font-size:.78rem;color:var(--text4);margin-bottom:16px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.brotkrümel a{color:var(--orange2)}.brotkrümel a:hover{text-decoration:underline}

/* ═══ SEITENNAVIGATION (Pagination) ══════════════════════════════════════ */
.seitennavigation{display:flex;gap:6px;margin-top:20px;justify-content:center;flex-wrap:wrap}
.seite-btn{padding:8px 13px;background:var(--bg2);border:1px solid var(--border2);border-radius:7px;color:var(--text3);font-size:.82rem;font-weight:600;cursor:pointer;transition:all .15s;text-decoration:none}
.seite-btn:hover,.seite-btn.aktiv{background:var(--orange);border-color:var(--orange);color:#fff}

/* ═══ MODAL ══════════════════════════════════════════════════════════════ */
.modal-hintergrund{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px}
.modal-box{background:var(--bg2);border:1px solid var(--orange);border-radius:14px;padding:24px;max-width:420px;width:100%;animation:modal-ein .28s ease}
@keyframes modal-ein{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
.modal-box h3{font-size:1.05rem;font-weight:800;margin-bottom:8px}
.modal-box p{font-size:.85rem;color:var(--text2);margin-bottom:18px;line-height:1.6}
.modal-btnzeile{display:flex;gap:10px}
.modal-btnzeile button{flex:1;padding:11px;border-radius:8px;font-weight:700;font-size:.85rem;cursor:pointer;border:none}
.modal-bestätigen{background:var(--orange);color:#fff}
.modal-abbrechen{background:var(--bg3);color:var(--text)}

/* ═══ TOAST ══════════════════════════════════════════════════════════════ */
.toast{position:fixed;bottom:72px;right:14px;padding:12px 18px;border-radius:10px;font-weight:700;font-size:.85rem;z-index:999;max-width:300px;box-shadow:0 6px 24px rgba(0,0,0,.5);animation:toast-ein .3s ease}
@media(min-width:768px){.toast{bottom:24px;right:24px}}
.toast-ok{background:#064e3b;border:1px solid #34d399;color:#34d399}
.toast-err{background:#450a0a;border:1px solid #ef4444;color:#ef4444}
@keyframes toast-ein{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes toast-aus{from{opacity:1}to{opacity:0;transform:translateY(10px)}}

/* ═══ MOBILE BOTTOM-NAV ══════════════════════════════════════════════════ */
.mobile-nav{
  position:fixed;bottom:0;left:0;right:0;
  height:var(--mobile-nav-h);z-index:300;
  background:var(--bg2);border-top:1px solid var(--border);
  display:flex;align-items:stretch;
  box-shadow:0 -4px 20px rgba(0,0,0,.5);
}
@media(min-width:768px){.mobile-nav{display:none}}
.mnav-btn{
  flex:1;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:2px;
  font-size:.6rem;color:var(--text4);text-decoration:none;
  transition:color .15s;border:none;background:none;cursor:pointer;
}
.mnav-btn .mnav-icon{font-size:1.25rem}
.mnav-btn.aktiv{color:var(--orange2)}
.mnav-btn.verkaufen-nav{color:var(--orange);font-weight:700}

/* ═══ LEER-ZUSTAND ═══════════════════════════════════════════════════════ */
.leer-zustand{text-align:center;padding:60px 20px;color:var(--text3)}
.leer-zustand .lz-icon{font-size:3.5rem;margin-bottom:14px;opacity:.6}
.leer-zustand h3{font-size:1.1rem;color:var(--text2);margin-bottom:8px}
.leer-zustand p{font-size:.85rem;margin-bottom:20px}

/* ═══ DIVERSES ════════════════════════════════════════════════════════════ */
.seiten-titel{font-size:1.4rem;font-weight:800;margin-bottom:20px}
.meldung{padding:11px 14px;border-radius:8px;font-size:.85rem;margin-bottom:14px}
.meldung-fehler{background:#450a0a;border:1px solid #ef4444;color:#f87171}
.meldung-ok{background:#064e3b;border:1px solid #34d399;color:#34d399}
hr.trenn{border:none;border-top:1px solid var(--border);margin:18px 0}

/* Fix für sticky oben auf Category-Nav */
@supports(position:sticky){
  .pb-catnav{top:calc(var(--header-h))}
}
`;

// ── Hilfsfunktionen für HTML ──────────────────────────────────────────────────
function layout(titel, inhalt, nutzer, aktiveNav='') {
  const kon = nutzer ? getKonto(nutzer.userId) : null;
  const dc  = nutzer ? getWallet(nutzer.userId) : null;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1a1a1a">
<title>${esc(titel)} — PC Bay</title>
<style>${CSS}</style>
</head>
<body>

<!-- ═══ HEADER ═══════════════════════════════════════════════════════════════ -->
<header class="pb-header">
  <div class="pb-header-inner">
    <a href="/pcbay" class="pb-logo">
      <img src="/pcbay/logo" alt="PC Bay">
      <div class="pb-logo-text">
        <span class="p">P</span><span class="c">C</span>&nbsp;<span class="b">B</span><span class="a">A</span><span class="y">Y</span>
      </div>
    </a>
    <form class="pb-search-wrap" action="/pcbay/suche" method="get">
      <input type="text" name="q" placeholder="Auf PC Bay suchen..." autocomplete="off" value="">
      <button type="submit">Suchen</button>
    </form>
    <div class="pb-header-actions">
      ${nutzer ? `
        <div class="pb-bal-wrap">
          <span class="bal-bank">💵 ${(kon.konto||0).toLocaleString('de-DE')} $</span>
          <span class="bal-dc">🪙 ${Number(dc.dc||0).toFixed(2)}</span>
        </div>
        <a href="/pcbay/mein-konto" class="pb-hbtn"><span class="hbtn-icon">👤</span>Konto</a>
        <a href="/pcbay/verkaufen" class="pb-hbtn sell"><span class="hbtn-icon">＋</span>Verkaufen</a>
      ` : `<a href="/pcbay" class="pb-hbtn"><span class="hbtn-icon">🔒</span>Login</a>`}
    </div>
  </div>
</header>

<!-- ═══ KATEGORIE-NAVIGATION ══════════════════════════════════════════════════ -->
<nav class="pb-catnav">
  <div class="pb-catnav-inner">
    <a href="/pcbay/suche" class="pb-catnav-item ${!aktiveNav?'aktiv':''}">🏪 Alle</a>
    ${KATEGORIEN.map(k=>`<a href="/pcbay/suche?kat=${k.id}" class="pb-catnav-item ${aktiveNav===k.id?'aktiv':''}">${k.icon} ${k.label}</a>`).join('')}
  </div>
</nav>

<!-- ═══ INHALT ════════════════════════════════════════════════════════════════ -->
<main>
${inhalt}
</main>

<!-- ═══ MOBILE BOTTOM-NAV ════════════════════════════════════════════════════ -->
<nav class="mobile-nav">
  <a href="/pcbay" class="mnav-btn ${aktiveNav===''?'aktiv':''}">
    <span class="mnav-icon">🏠</span>Start
  </a>
  <a href="/pcbay/suche" class="mnav-btn">
    <span class="mnav-icon">🔍</span>Suche
  </a>
  <a href="/pcbay/verkaufen" class="mnav-btn verkaufen-nav">
    <span class="mnav-icon">＋</span>Verkaufen
  </a>
  ${nutzer ? `<a href="/pcbay/mein-konto" class="mnav-btn ${aktiveNav==='konto'?'aktiv':''}"><span class="mnav-icon">👤</span>Konto</a>` : `<a href="/pcbay" class="mnav-btn"><span class="mnav-icon">🔒</span>Login</a>`}
</nav>

<script>
// Toast-Funktion
function toast(text, ok=true){
  const t=document.createElement('div');
  t.className='toast '+(ok?'toast-ok':'toast-err');
  t.textContent=text;
  document.body.appendChild(t);
  setTimeout(()=>{t.style.animation='toast-aus .3s ease forwards';setTimeout(()=>t.remove(),350)},3200);
}
// Kategorie-Navigation aktiv markieren
(function(){
  const params=new URLSearchParams(location.search);
  const kat=params.get('kat');
  document.querySelectorAll('.pb-catnav-item').forEach(el=>{
    const url=new URL(el.href,location.href);
    const ekid=url.searchParams.get('kat');
    el.classList.toggle('aktiv', el.href===location.href || (kat&&kat===ekid));
  });
})();
</script>
</body>
</html>`;
}

// ── Logo-Auslieferung ─────────────────────────────────────────────────────────
let _logoData=null, _logoMime='image/jpeg';
function holeLogo() {
  if (_logoData) return _logoData;
  for (const p of [path.join(__dirname,'assets','pcbay_logo.jpeg'), path.join(__dirname,'lapd_logo.png')]) {
    if (fs.existsSync(p)) { _logoData=fs.readFileSync(p); _logoMime=p.endsWith('.png')?'image/png':'image/jpeg'; break; }
  }
  return _logoData;
}

// ── Bildverzeichnis ───────────────────────────────────────────────────────────
function bilderVerzeichnis() {
  const d=path.join(DATA_DIR_REF,'pcbay_bilder');
  if (!fs.existsSync(d)) fs.mkdirSync(d,{recursive:true});
  return d;
}

// ── Angebotskarte HTML ────────────────────────────────────────────────────────
function angebotKarte(a) {
  const zustandKlasse={neu:'zust-neu',gut:'zust-gut',gebraucht:'zust-gebraucht',defekt:'zust-defekt'}[a.zustand]||'zust-gebraucht';
  const zustandText={neu:'Neu',gut:'Gut',gebraucht:'Gebraucht',defekt:'Defekt'}[a.zustand]||a.zustand;
  const katObj=KATEGORIEN.find(k=>k.id===a.kategorie)||{icon:'📦'};
  const bildHtml=a.bildId
    ? `<img src="/pcbay/bild/${a.bildId}" alt="${esc(a.titel)}" loading="lazy">`
    : `<div class="kein-bild">${katObj.icon}</div>`;
  const preisKlasse=a.währung==='dc'?'dc':'bank';
  const preisText=a.währung==='dc'
    ? `🪙 ${Number(a.preis).toFixed(4)}`
    : `💵 ${Number(a.preis).toLocaleString('de-DE')} $`;
  return `
<a href="/pcbay/angebot/${a.id}" class="angebot-karte">
  <div class="karte-bild">
    ${bildHtml}
    <span class="zustand-badge-img ${zustandKlasse}">${zustandText}</span>
  </div>
  <div class="karte-body">
    <div class="karte-titel">${esc(a.titel)}</div>
    <div class="karte-preis ${preisKlasse}">${preisText}</div>
    <div class="karte-verkaeufer">von ${esc(a.verkäuferName)}</div>
  </div>
</a>`;
}

// ── Hauptmodul ────────────────────────────────────────────────────────────────
module.exports = function pcBayStart(app, DATA_DIR, client) {
  DATA_DIR_REF = DATA_DIR;
  const express = require('express');
  const multer  = require('multer');

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {fileSize:5*1024*1024,files:1},
    fileFilter:(_,f,cb)=>/image\/(jpeg|png|webp|gif)/.test(f.mimetype)?cb(null,true):cb(new Error('Nur Bilder erlaubt'))
  });

  // Authentifizierung prüfen
  function auth(req) {
    const tok = req.session&&req.session.pcbay_token;
    if (!tok) return null;
    return prüfeToken(tok);
  }

  // ── Logo ──────────────────────────────────────────────────────────────────
  app.get('/pcbay/logo', (_,res)=>{
    const d=holeLogo();
    if (!d) return res.status(404).end();
    res.setHeader('Content-Type',_logoMime);
    res.setHeader('Cache-Control','public,max-age=86400');
    res.send(d);
  });

  // ── Bild-Auslieferung ─────────────────────────────────────────────────────
  app.get('/pcbay/bild/:id', (req,res)=>{
    const p=path.join(bilderVerzeichnis(), req.params.id.replace(/[^a-zA-Z0-9._-]/g,''));
    if (!fs.existsSync(p)) return res.status(404).end();
    res.setHeader('Cache-Control','public,max-age=604800');
    res.sendFile(p);
  });

  // ── Login via Token ───────────────────────────────────────────────────────
  app.get('/pcbay/login/:token', (req,res)=>{
    const nutzer=prüfeToken(req.params.token);
    if (!nutzer) {
      return res.send(layout('Ungültiger Link',
        `<div class="pb-wrap"><div class="meldung meldung-fehler">❌ Dieser Link ist ungültig. Bitte klicke erneut auf den Button im Discord-Server.</div></div>`,null));
    }
    req.session.pcbay_token=req.params.token;
    res.redirect('/pcbay');
  });

  // ── Startseite ────────────────────────────────────────────────────────────
  app.get('/pcbay', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) {
      return res.send(layout('PC Bay — Marktplatz',`
<div class="pb-wrap">
  <div class="pb-hero" style="justify-content:center;text-align:center;flex-direction:column;padding:48px 24px">
    <div class="pb-hero-logo" style="margin:0 auto 18px"><img src="/pcbay/logo" style="width:100px;border-radius:50%;margin:0 auto"></div>
    <div class="pb-hero-text">
      <h1>Willkommen bei <em>PC Bay</em></h1>
      <p>Der Marktplatz von Paradise City Roleplay.<br>Kaufe und verkaufe Artikel aller Art mit deinem Ingame-Geld.</p>
      <div class="pb-hero-btns" style="justify-content:center">
        <div class="btn btn-outline" style="cursor:default">🔒 Melde dich über den Discord-Button an</div>
      </div>
    </div>
  </div>
</div>`,null));
    }

    const alle=ladeAngebote().filter(a=>a.aktiv&&!a.verkauft);
    const neueste=alle.slice().sort((a,b)=>b.erstelltAm-a.erstelltAm).slice(0,12);

    res.send(layout('PC Bay — Marktplatz',`
<div class="pb-wrap">
  <!-- Hero -->
  <div class="pb-hero">
    <div class="pb-hero-text">
      <h1>Kaufen &amp; Verkaufen auf <em>PC Bay</em></h1>
      <p>Dein Marktplatz in Paradise City — bezahle mit Bankgeld oder PC Coin. Nur legale Artikel erlaubt.</p>
      <div class="pb-hero-btns">
        <a href="/pcbay/verkaufen" class="btn btn-primary">＋ Artikel verkaufen</a>
        <a href="/pcbay/suche" class="btn btn-outline">Alle Angebote</a>
      </div>
    </div>
    <div class="pb-hero-logo"><img src="/pcbay/logo" alt="PC Bay"></div>
  </div>

  <!-- Legaler Hinweis -->
  <div class="legal-hinweis">
    <span class="hinweis-icon">⚖️</span>
    <span><strong>Nur legale Artikel!</strong> <span>Waffen, Drogen und andere illegale Gegenstände sind auf PC Bay verboten und werden sofort entfernt.</span></span>
  </div>

  <!-- Kategorien-Übersicht -->
  <h2 style="font-size:.9rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:12px">Kategorien</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:24px">
    ${KATEGORIEN.map(k=>`
    <a href="/pcbay/suche?kat=${k.id}" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 10px;text-align:center;text-decoration:none;transition:all .15s;display:block">
      <div style="font-size:1.6rem;margin-bottom:5px">${k.icon}</div>
      <div style="font-size:.72rem;font-weight:700;color:var(--text2)">${k.label}</div>
    </a>`).join('')}
  </div>

  <!-- Neueste Angebote -->
  <div class="angebote-header">
    <h2>🔥 Neueste Angebote</h2>
    <span class="angebote-count">${alle.length} Angebot${alle.length!==1?'e':''}</span>
  </div>
  ${neueste.length
    ? `<div class="angebote-raster">${neueste.map(angebotKarte).join('')}</div>
       <div style="text-align:center;margin-top:18px"><a href="/pcbay/suche" class="btn btn-outline">Alle Angebote ansehen</a></div>`
    : `<div class="leer-zustand"><div class="lz-icon">🛒</div><h3>Noch keine Angebote</h3><p>Sei der Erste und verkaufe etwas!</p><a href="/pcbay/verkaufen" class="btn btn-primary">Jetzt verkaufen</a></div>`}
</div>`, nutzer));
  });

  // ── Suche ─────────────────────────────────────────────────────────────────
  app.get('/pcbay/suche', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const {q='',kat='',wäh='',min='',max='',zustand='',sort='neueste'} = req.query;
    const seite=Math.max(0,parseInt(req.query.seite)||0);
    const PRO_SEITE=20;

    let ergebnisse=ladeAngebote().filter(a=>a.aktiv&&!a.verkauft);
    if (q) ergebnisse=ergebnisse.filter(a=>a.titel.toLowerCase().includes(q.toLowerCase())||a.beschreibung.toLowerCase().includes(q.toLowerCase()));
    if (kat) ergebnisse=ergebnisse.filter(a=>a.kategorie===kat);
    if (wäh) ergebnisse=ergebnisse.filter(a=>a.währung===wäh);
    if (zustand) ergebnisse=ergebnisse.filter(a=>a.zustand===zustand);
    if (min) ergebnisse=ergebnisse.filter(a=>a.preis>=parseFloat(min));
    if (max) ergebnisse=ergebnisse.filter(a=>a.preis<=parseFloat(max));
    if (sort==='preis_auf') ergebnisse.sort((a,b)=>a.preis-b.preis);
    else if (sort==='preis_ab') ergebnisse.sort((a,b)=>b.preis-a.preis);
    else ergebnisse.sort((a,b)=>b.erstelltAm-a.erstelltAm);

    const gesamt=ergebnisse.length;
    const seiten=Math.ceil(gesamt/PRO_SEITE)||1;
    const ausschnitt=ergebnisse.slice(seite*PRO_SEITE,(seite+1)*PRO_SEITE);

    function seiteUrl(s){ const p={...req.query,seite:s}; return '/pcbay/suche?'+new URLSearchParams(p).toString(); }

    const pagination=seiten>1?`<div class="seitennavigation">
      ${seite>0?`<a href="${seiteUrl(seite-1)}" class="seite-btn">← Zurück</a>`:''}
      ${Array.from({length:Math.min(seiten,7)},(_,i)=>{
        const pg=i+(seite>3&&seiten>7?seite-3:0);
        return pg<seiten?`<a href="${seiteUrl(pg)}" class="seite-btn ${pg===seite?'aktiv':''}">${pg+1}</a>`:'';
      }).join('')}
      ${seite<seiten-1?`<a href="${seiteUrl(seite+1)}" class="seite-btn">Weiter →</a>`:''}
    </div>`:'';

    const katObj=KATEGORIEN.find(k=>k.id===kat);

    res.send(layout(q?`Suche: ${q}`:katObj?katObj.label:'Alle Angebote',`
<div class="pb-wrap">
  <div class="pb-layout">
    <!-- Sidebar -->
    <aside class="pb-sidebar">
      <h3>Kategorien</h3>
      <ul class="pb-kat-liste">
        <li><a href="/pcbay/suche${q?'?q='+encodeURIComponent(q):''}" class="${!kat?'aktiv':''}">🏪 Alle Kategorien</a></li>
        ${KATEGORIEN.map(k=>`<li><a href="/pcbay/suche?${new URLSearchParams({...req.query,kat:k.id,seite:0})}" class="${kat===k.id?'aktiv':''}">${k.icon} ${k.label}</a></li>`).join('')}
      </ul>
      <form class="sidebar-filter" method="get" action="/pcbay/suche">
        <input type="hidden" name="q" value="${esc(q)}">
        <input type="hidden" name="kat" value="${esc(kat)}">
        <h4>Preis filtern</h4>
        <input type="number" name="min" placeholder="Mindestpreis" value="${esc(min)}" min="0">
        <input type="number" name="max" placeholder="Höchstpreis" value="${esc(max)}" min="0">
        <h4 style="margin-top:10px">Währung</h4>
        <select name="wäh">
          <option value="">Alle Währungen</option>
          <option value="konto" ${wäh==='konto'?'selected':''}>💵 Bankgeld ($)</option>
          <option value="dc" ${wäh==='dc'?'selected':''}>🪙 PC Coin</option>
        </select>
        <h4 style="margin-top:10px">Zustand</h4>
        <select name="zustand">
          <option value="">Alle Zustände</option>
          <option value="neu" ${zustand==='neu'?'selected':''}>✨ Neu</option>
          <option value="gut" ${zustand==='gut'?'selected':''}>👍 Gut</option>
          <option value="gebraucht" ${zustand==='gebraucht'?'selected':''}>📦 Gebraucht</option>
          <option value="defekt" ${zustand==='defekt'?'selected':''}>🔧 Defekt</option>
        </select>
        <button class="filter-btn" type="submit" style="margin-top:12px">Filter anwenden</button>
      </form>
    </aside>
    <!-- Ergebnisse -->
    <div>
      <div class="angebote-header">
        <h2>${q?`Ergebnisse für „${esc(q)}"`:katObj?katObj.label:'Alle Angebote'}</h2>
        <div style="display:flex;align-items:center;gap:10px">
          <span class="angebote-count">${gesamt} Ergebnis${gesamt!==1?'se':''}</span>
          <form method="get" action="/pcbay/suche" style="display:inline">
            ${Object.entries({q,kat,wäh,min,max,zustand}).map(([k,v])=>v?`<input type="hidden" name="${k}" value="${esc(v)}">`:'').join('')}
            <select name="sort" class="sortier-select" onchange="this.form.submit()">
              <option value="neueste" ${sort==='neueste'?'selected':''}>Neueste zuerst</option>
              <option value="preis_auf" ${sort==='preis_auf'?'selected':''}>Günstigste zuerst</option>
              <option value="preis_ab" ${sort==='preis_ab'?'selected':''}>Teuerste zuerst</option>
            </select>
          </form>
        </div>
      </div>
      ${ausschnitt.length
        ? `<div class="angebote-raster">${ausschnitt.map(angebotKarte).join('')}</div>${pagination}`
        : `<div class="leer-zustand"><div class="lz-icon">🔍</div><h3>Keine Angebote gefunden</h3><p>Versuche andere Suchbegriffe oder entferne Filter.</p></div>`}
    </div>
  </div>
</div>`, nutzer, kat));
  });

  // ── Angebot-Detailseite ───────────────────────────────────────────────────
  app.get('/pcbay/angebot/:id', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const angebot=ladeAngebote().find(a=>a.id===req.params.id);
    if (!angebot) return res.send(layout('Nicht gefunden',`<div class="pb-wrap"><div class="meldung meldung-fehler">❌ Angebot nicht gefunden.</div><a href="/pcbay" class="btn btn-primary" style="margin-top:14px;display:inline-flex">← Zurück zur Startseite</a></div>`,nutzer));

    const kon=getKonto(nutzer.userId);
    const dc=getWallet(nutzer.userId);
    const istEigen=angebot.verkäuferId===nutzer.userId;
    const katObj=KATEGORIEN.find(k=>k.id===angebot.kategorie)||{label:'Sonstiges',icon:'📦'};
    const zustandTexte={neu:'✨ Neu',gut:'👍 Gut',gebraucht:'📦 Gebraucht',defekt:'🔧 Defekt'};

    const bildHtml=angebot.bildId
      ? `<img src="/pcbay/bild/${angebot.bildId}" alt="${esc(angebot.titel)}">`
      : katObj.icon;

    let aktionsbereich='';
    if (angebot.verkauft) {
      aktionsbereich=`<div class="verkauft-badge">✅ Dieser Artikel wurde bereits verkauft.</div>`;
    } else if (istEigen) {
      aktionsbereich=`
        <div class="eigenes-badge">📋 Das ist dein eigenes Angebot.</div>
        <form method="post" action="/pcbay/api/löschen/${angebot.id}" style="margin-top:10px" onsubmit="return confirm('Angebot wirklich löschen?')">
          <button class="btn btn-rot btn-block" style="padding:12px">🗑️ Angebot löschen</button>
        </form>`;
    } else {
      const kannBank=angebot.währung==='konto'&&(kon.konto||0)>=angebot.preis;
      const kannDc=angebot.währung==='dc'&&(Number(dc.dc)||0)>=angebot.preis;
      const kannKaufen=kannBank||kannDc;
      const kaufBtnText=kannKaufen
        ? `✅ Jetzt kaufen — ${angebot.währung==='dc'?`🪙 ${Number(angebot.preis).toFixed(4)}`:`💵 ${Number(angebot.preis).toLocaleString('de-DE')} $`}`
        : `❌ Nicht genug Guthaben`;
      aktionsbereich=`
        <div class="kauf-box">
          <h3>Kaufoptionen</h3>
          <div style="padding:12px;background:var(--bg4);border-radius:8px;margin-bottom:12px">
            <div style="font-size:.75rem;color:var(--text3);margin-bottom:4px">Dein Guthaben</div>
            <div style="font-weight:700">💵 ${(kon.konto||0).toLocaleString('de-DE')} $ &nbsp;|&nbsp; 🪙 ${Number(dc.dc||0).toFixed(4)}</div>
          </div>
          <button class="kauf-btn" onclick="kaufenModal()" ${kannKaufen?'':'disabled'}>${kaufBtnText}</button>
        </div>`;
    }

    res.send(layout(angebot.titel,`
<div class="pb-wrap">
  <div class="brotkrümel">
    <a href="/pcbay">PC Bay</a> <span>›</span>
    <a href="/pcbay/suche?kat=${angebot.kategorie}">${katObj.icon} ${katObj.label}</a> <span>›</span>
    <span>${esc(angebot.titel)}</span>
  </div>
  <div class="detail-layout">
    <!-- Bild -->
    <div class="detail-galerie">${bildHtml}</div>
    <!-- Panel -->
    <div class="detail-panel">
      <div class="detail-titel">${esc(angebot.titel)}</div>
      <div class="detail-preis ${angebot.währung==='dc'?'dc':'bank'}">
        <span class="preis-label">${angebot.währung==='dc'?'PC Coin':'Bankgeld'}</span>
        ${angebot.währung==='dc'
          ? `🪙 ${Number(angebot.preis).toFixed(4)}`
          : `💵 ${Number(angebot.preis).toLocaleString('de-DE')} $`}
      </div>
      <div class="verkaeufer-box">
        <div class="verk-avatar">${esc(angebot.verkäuferName||'?').charAt(0).toUpperCase()}</div>
        <div><div class="verk-name">${esc(angebot.verkäuferName)}</div><div class="verk-label">Verkäufer</div></div>
      </div>
      <div class="detail-meta-grid">
        <div class="meta-box"><div class="meta-label">Kategorie</div><div class="meta-val">${katObj.icon} ${katObj.label}</div></div>
        <div class="meta-box"><div class="meta-label">Zustand</div><div class="meta-val">${zustandTexte[angebot.zustand]||angebot.zustand}</div></div>
        <div class="meta-box"><div class="meta-label">Eingestellt</div><div class="meta-val">${fmtDatum(angebot.erstelltAm)}</div></div>
        <div class="meta-box"><div class="meta-label">Status</div><div class="meta-val">${angebot.verkauft?'<span class="status-pill sp-verkauft">VERKAUFT</span>':'<span class="status-pill sp-aktiv">AKTIV</span>'}</div></div>
      </div>
      <div class="detail-beschr">
        <h3>Beschreibung</h3>
        <p>${esc(angebot.beschreibung||'Keine Beschreibung angegeben.')}</p>
      </div>
      ${aktionsbereich}
    </div>
  </div>
</div>

<!-- Kauf-Bestätigungsmodal -->
<div id="kaufModal" class="modal-hintergrund" style="display:none">
  <div class="modal-box">
    <h3>💳 Kauf bestätigen</h3>
    <p>Möchtest du diesen Artikel wirklich kaufen?<br>
    <strong>${esc(angebot.titel)}</strong><br>
    Preis: <strong>${angebot.währung==='dc'?`🪙 ${Number(angebot.preis).toFixed(4)} PC Coin`:`💵 ${Number(angebot.preis).toLocaleString('de-DE')} $`}</strong></p>
    <div class="modal-btnzeile">
      <button class="modal-abbrechen" onclick="document.getElementById('kaufModal').style.display='none'">Abbrechen</button>
      <button class="modal-bestätigen" id="kaufBtn" onclick="kaufBestätigen('${angebot.id}')">Kaufen</button>
    </div>
  </div>
</div>
<script>
function kaufenModal(){ document.getElementById('kaufModal').style.display='flex'; }
async function kaufBestätigen(id) {
  const btn=document.getElementById('kaufBtn');
  btn.disabled=true; btn.textContent='…';
  document.getElementById('kaufModal').style.display='none';
  try {
    const r=await fetch('/pcbay/api/kaufen/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(d.ok){ toast('✅ Kauf erfolgreich!'); setTimeout(()=>location.reload(),1600); }
    else{ toast('❌ '+d.fehler,false); btn.disabled=false; btn.textContent='Kaufen'; }
  } catch(e){ toast('❌ Fehler: '+e.message,false); btn.disabled=false; btn.textContent='Kaufen'; }
}
</script>`, nutzer, angebot.kategorie));
  });

  // ── Kauf-API ──────────────────────────────────────────────────────────────
  app.post('/pcbay/api/kaufen/:id', express.json(), async (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.status(401).json({fehler:'Nicht angemeldet'});
    const liste=ladeAngebote();
    const idx=liste.findIndex(a=>a.id===req.params.id);
    if (idx===-1) return res.json({fehler:'Angebot nicht gefunden'});
    const a=liste[idx];
    if (a.verkauft||!a.aktiv) return res.json({fehler:'Angebot nicht mehr verfügbar'});
    if (a.verkäuferId===nutzer.userId) return res.json({fehler:'Du kannst deinen eigenen Artikel nicht kaufen'});
    // Zahlung
    if (a.währung==='konto') {
      const k=getKonto(nutzer.userId);
      if ((k.konto||0)<a.preis) return res.json({fehler:`Nicht genug Bankgeld. Guthaben: ${(k.konto||0).toLocaleString('de-DE')} $`});
      k.konto=Math.round(((k.konto||0)-a.preis)*100)/100; setKonto(nutzer.userId,k);
      const sk=getKonto(a.verkäuferId); sk.konto=Math.round(((sk.konto||0)+a.preis)*100)/100; setKonto(a.verkäuferId,sk);
    } else {
      const w=getWallet(nutzer.userId);
      if ((Number(w.dc)||0)<a.preis) return res.json({fehler:`Nicht genug PC Coin. Guthaben: ${Number(w.dc||0).toFixed(4)}`});
      w.dc=Math.round(((Number(w.dc)||0)-a.preis)*1e8)/1e8; setWallet(nutzer.userId,w);
      const sw=getWallet(a.verkäuferId); sw.dc=Math.round(((Number(sw.dc)||0)+a.preis)*1e8)/1e8; setWallet(a.verkäuferId,sw);
    }
    liste[idx].verkauft=true; liste[idx].aktiv=false;
    liste[idx].käuferId=nutzer.userId; liste[idx].käuferName=nutzer.username; liste[idx].verkauftAm=Date.now();
    speichereAngebote(liste);
    // Verkäufer per DM benachrichtigen
    if (client) {
      try {
        const verk=await client.users.fetch(a.verkäuferId).catch(()=>null);
        if (verk) {
          const {EmbedBuilder}=require('discord.js');
          await verk.send({embeds:[new EmbedBuilder().setColor(0xE07B00).setTitle('🛒 Artikel verkauft!')
            .addFields(
              {name:'📦 Artikel',value:a.titel,inline:true},
              {name:'👤 Käufer',value:nutzer.username,inline:true},
              {name:'💰 Betrag',value:a.währung==='dc'?`🪙 ${Number(a.preis).toFixed(4)} PC Coin`:`💵 ${Number(a.preis).toLocaleString('de-DE')} $`,inline:true}
            ).setFooter({text:'PC Bay • Paradise City Roleplay'}).setTimestamp()
          ]}).catch(()=>{});
        }
      } catch {}
    }
    res.json({ok:true});
  });

  // ── Verkaufen-Formular ────────────────────────────────────────────────────
  app.get('/pcbay/verkaufen', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const fehler=req.query.fehler?`<div class="meldung meldung-fehler">❌ ${esc(req.query.fehler)}</div>`:'';
    res.send(layout('Artikel verkaufen',`
<div class="pb-wrap">
  <div class="formular-wrap">
    <div class="brotkrümel"><a href="/pcbay">PC Bay</a> <span>›</span> <span>Verkaufen</span></div>
    <div class="formular-karte">
      <h2>🏪 Artikel verkaufen</h2>
      ${fehler}
      <div class="legal-hinweis">
        <span class="hinweis-icon">⚖️</span>
        <span><strong>Hinweis:</strong> <span>Nur legale Artikel erlaubt — keine Waffen, Drogen oder sonstige illegale Gegenstände.</span></span>
      </div>
      <form method="post" action="/pcbay/api/einstellen" enctype="multipart/form-data">
        <div class="fg">
          <label>Titel *</label>
          <input type="text" name="titel" required maxlength="100" placeholder="z.B. Elegy RH8, Designer-Jacke, Laptop…">
        </div>
        <div class="fg-row">
          <div class="fg">
            <label>Kategorie *</label>
            <select name="kategorie" required>
              ${KATEGORIEN.map(k=>`<option value="${k.id}">${k.icon} ${k.label}</option>`).join('')}
            </select>
          </div>
          <div class="fg">
            <label>Zustand *</label>
            <select name="zustand" required>
              <option value="neu">✨ Neu</option>
              <option value="gut">👍 Gut</option>
              <option value="gebraucht" selected>📦 Gebraucht</option>
              <option value="defekt">🔧 Defekt</option>
            </select>
          </div>
        </div>
        <div class="fg">
          <label>Preis &amp; Währung *</label>
          <div class="preis-zeile">
            <input type="number" name="preis" required min="1" step="0.0001" placeholder="Preis eingeben…">
            <select name="währung">
              <option value="konto">💵 Bankgeld ($)</option>
              <option value="dc">🪙 PC Coin</option>
            </select>
          </div>
        </div>
        <div class="fg">
          <label>Beschreibung *</label>
          <textarea name="beschreibung" required maxlength="1000" placeholder="Beschreibe deinen Artikel genau…"></textarea>
        </div>
        <div class="fg">
          <label>Foto (optional, max. 5 MB)</label>
          <div class="foto-drop" id="fotoDrop">
            <input type="file" name="foto" accept="image/*" id="fotoInput" onchange="vorschau(this)">
            <div class="drop-icon">📸</div>
            <p>Foto hierher ziehen oder antippen</p>
          </div>
          <div class="foto-vorschau" id="fotoVorschau"></div>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="submit" style="margin-top:6px">📤 Angebot einstellen</button>
      </form>
    </div>
  </div>
</div>
<script>
function vorschau(inp){
  const vp=document.getElementById('fotoVorschau'); vp.innerHTML='';
  if(inp.files&&inp.files[0]){
    const r=new FileReader();
    r.onload=e=>{vp.innerHTML='<div class="foto-vor-box"><img src="'+e.target.result+'"></div>';};
    r.readAsDataURL(inp.files[0]);
  }
}
const drop=document.getElementById('fotoDrop');
drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag')});
drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');const fi=drop.querySelector('input');fi.files=e.dataTransfer.files;vorschau(fi)});
</script>`, nutzer,''));
  });

  // ── Angebot einstellen POST ───────────────────────────────────────────────
  app.post('/pcbay/api/einstellen', upload.single('foto'), (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const {titel,beschreibung,kategorie,zustand,preis,währung}=req.body;
    if (!titel||!beschreibung||!kategorie||!preis) return res.redirect('/pcbay/verkaufen?fehler=Bitte alle Pflichtfelder ausfüllen');
    const preisZahl=parseFloat(preis);
    if (isNaN(preisZahl)||preisZahl<=0) return res.redirect('/pcbay/verkaufen?fehler=Ungültiger Preis eingegeben');
    if (!KATEGORIEN.find(k=>k.id===kategorie)) return res.redirect('/pcbay/verkaufen?fehler=Ungültige Kategorie gewählt');
    let bildId=null;
    if (req.file) {
      const ext=req.file.mimetype.includes('png')?'png':req.file.mimetype.includes('webp')?'webp':'jpg';
      bildId=genId()+'.'+ext;
      fs.writeFileSync(path.join(bilderVerzeichnis(),bildId),req.file.buffer);
    }
    const liste=ladeAngebote();
    const angebot={
      id:genId(), verkäuferId:nutzer.userId, verkäuferName:nutzer.username,
      titel:String(titel).slice(0,100), beschreibung:String(beschreibung).slice(0,1000),
      kategorie:kategorie, zustand:['neu','gut','gebraucht','defekt'].includes(zustand)?zustand:'gebraucht',
      preis:preisZahl, währung:währung==='dc'?'dc':'konto',
      bildId, aktiv:true, verkauft:false, erstelltAm:Date.now()
    };
    liste.push(angebot);
    speichereAngebote(liste);
    res.redirect('/pcbay/angebot/'+angebot.id+'?neu=1');
  });

  // ── Angebot löschen ───────────────────────────────────────────────────────
  app.post('/pcbay/api/löschen/:id', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const liste=ladeAngebote();
    const idx=liste.findIndex(a=>a.id===req.params.id&&a.verkäuferId===nutzer.userId);
    if (idx===-1) return res.redirect('/pcbay/mein-konto?fehler=Angebot nicht gefunden');
    if (liste[idx].bildId) { try { fs.unlinkSync(path.join(bilderVerzeichnis(),liste[idx].bildId)); } catch {} }
    liste.splice(idx,1); speichereAngebote(liste);
    res.redirect('/pcbay/mein-konto?ok=Angebot erfolgreich gelöscht');
  });

  // ── Mein Konto ────────────────────────────────────────────────────────────
  app.get('/pcbay/mein-konto', (req,res)=>{
    const nutzer=auth(req);
    if (!nutzer) return res.redirect('/pcbay');
    const tab=req.query.tab||'angebote';
    const kon=getKonto(nutzer.userId);
    const dc=getWallet(nutzer.userId);
    const alle=ladeAngebote();
    const meineAngebote=alle.filter(a=>a.verkäuferId===nutzer.userId).sort((a,b)=>b.erstelltAm-a.erstelltAm);
    const meineKäufe=alle.filter(a=>a.käuferId===nutzer.userId).sort((a,b)=>(b.verkauftAm||0)-(a.verkauftAm||0));
    const fehler=req.query.fehler?`<div class="meldung meldung-fehler">❌ ${esc(req.query.fehler)}</div>`:'';
    const okMsg=req.query.ok?`<div class="meldung meldung-ok">✅ ${esc(req.query.ok)}</div>`:'';

    function zeigeZeile(a, istEigen) {
      const katObj=KATEGORIEN.find(k=>k.id===a.kategorie)||{icon:'📦'};
      const bildHtml=a.bildId?`<img src="/pcbay/bild/${a.bildId}" alt="">`:katObj.icon;
      const preisKlasse=a.währung==='dc'?'dc':'bank';
      const preisText=a.währung==='dc'?`🪙 ${Number(a.preis).toFixed(4)}`:`💵 ${Number(a.preis).toLocaleString('de-DE')} $`;
      const statusHtml=a.verkauft?'<span class="status-pill sp-verkauft">VERKAUFT</span>':'<span class="status-pill sp-aktiv">AKTIV</span>';
      return `
<div class="angebot-zeile">
  <div class="az-bild">${bildHtml}</div>
  <div class="az-info">
    <div class="az-titel"><a href="/pcbay/angebot/${a.id}">${esc(a.titel)}</a></div>
    <div class="az-meta">${katObj.icon} ${(KATEGORIEN.find(k=>k.id===a.kategorie)||{label:'Sonstiges'}).label} &bull; ${fmtDatum(a.erstelltAm)} ${a.verkauft&&istEigen?` &bull; Käufer: ${esc(a.käuferName||'?')}`:''} ${!istEigen&&a.verkäuferName?` &bull; Verkäufer: ${esc(a.verkäuferName)}`:''}</div>
    <div>${statusHtml}</div>
  </div>
  <div class="az-preis ${preisKlasse}">${preisText}</div>
  ${istEigen&&!a.verkauft?`<div class="az-aktionen"><form method="post" action="/pcbay/api/löschen/${a.id}" onsubmit="return confirm('Angebot wirklich löschen?')"><button class="btn btn-rot">🗑️</button></form></div>`:''}
</div>`;
    }

    res.send(layout('Mein Konto',`
<div class="pb-wrap">
  <div class="brotkrümel"><a href="/pcbay">PC Bay</a> <span>›</span> <span>Mein Konto</span></div>
  <h1 class="seiten-titel">👤 ${esc(nutzer.username)}</h1>
  ${fehler}${okMsg}
  <div class="kontostand-raster">
    <div class="kontostand-karte"><div class="kk-label">💵 Bankgeld</div><div class="kk-wert bank">${(kon.konto||0).toLocaleString('de-DE')} $</div></div>
    <div class="kontostand-karte"><div class="kk-label">🪙 PC Coin</div><div class="kk-wert dc">${Number(dc.dc||0).toFixed(4)}</div></div>
    <div class="kontostand-karte"><div class="kk-label">📦 Aktive Angebote</div><div class="kk-wert neutral">${meineAngebote.filter(a=>a.aktiv).length}</div></div>
    <div class="kontostand-karte"><div class="kk-label">✅ Verkäufe</div><div class="kk-wert neutral">${meineAngebote.filter(a=>a.verkauft).length}</div></div>
  </div>
  <div class="tab-leiste">
    <div class="tab-btn ${tab==='angebote'?'aktiv':''}" onclick="wechselTab('angebote')">📦 Meine Angebote (${meineAngebote.length})</div>
    <div class="tab-btn ${tab==='käufe'?'aktiv':''}" onclick="wechselTab('käufe')">🛒 Meine Käufe (${meineKäufe.length})</div>
  </div>
  <div id="tab-angebote" ${tab!=='angebote'?'style="display:none"':''}>
    <div style="margin-bottom:14px"><a href="/pcbay/verkaufen" class="btn btn-primary">＋ Neues Angebot</a></div>
    ${meineAngebote.length?meineAngebote.map(a=>zeigeZeile(a,true)).join('')
      :'<div class="leer-zustand"><div class="lz-icon">📦</div><h3>Keine Angebote</h3><p>Stelle deinen ersten Artikel zum Verkauf ein!</p></div>'}
  </div>
  <div id="tab-käufe" ${tab!=='käufe'?'style="display:none"':''}>
    ${meineKäufe.length?meineKäufe.map(a=>zeigeZeile(a,false)).join('')
      :'<div class="leer-zustand"><div class="lz-icon">🛒</div><h3>Noch keine Käufe</h3><p>Stöbere in den Angeboten!</p></div>'}
  </div>
</div>
<script>
function wechselTab(t){
  ['angebote','käufe'].forEach(id=>{
    document.getElementById('tab-'+id).style.display=id===t?'':'none';
  });
  document.querySelectorAll('.tab-btn').forEach((el,i)=>{
    el.classList.toggle('aktiv',['angebote','käufe'][i]===t);
  });
  history.replaceState(null,'','/pcbay/mein-konto?tab='+t);
}
</script>`, nutzer, 'konto'));
  });
};
