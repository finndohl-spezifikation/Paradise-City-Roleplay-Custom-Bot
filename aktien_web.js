'use strict';
// ─── Aktien Web Module ────────────────────────────────────────────────────────
// Required by web.js — registers all /aktien routes on the express app

module.exports = function registerAktienRoutes(app, express, DATA_DIR) {
  const fs   = require('fs');
  const path = require('path');

  const AKTIEN_FILE_W     = path.join(DATA_DIR, 'aktien.json');
  const PORTFOLIO_FILE_W  = path.join(DATA_DIR, 'aktien_portfolio.json');
  const AKTIEN_TOK_FILE_W = path.join(DATA_DIR, 'aktien_tokens.json');
  const KONTO_FILE_AK     = path.join(DATA_DIR, 'konto.json');

  function loadAktienW()     { try { return JSON.parse(fs.readFileSync(AKTIEN_FILE_W,'utf8')); } catch { return {}; } }
  function loadPortfolioW()  { try { return JSON.parse(fs.readFileSync(PORTFOLIO_FILE_W,'utf8')); } catch { return {}; } }
  function savePortfolioW(d) { fs.writeFileSync(PORTFOLIO_FILE_W, JSON.stringify(d,null,2),'utf8'); }
  function loadAktienToksW() { try { return JSON.parse(fs.readFileSync(AKTIEN_TOK_FILE_W,'utf8')); } catch { return {}; } }
  function getKontoAK(uid)   { try { const d=JSON.parse(fs.readFileSync(KONTO_FILE_AK,'utf8')); return d[uid]??{konto:0,schwarz:0}; } catch { return {konto:0,schwarz:0}; } }
  function setKontoAK(uid,obj){ let d={}; try{d=JSON.parse(fs.readFileSync(KONTO_FILE_AK,'utf8'));}catch{} d[uid]=obj; fs.writeFileSync(KONTO_FILE_AK,JSON.stringify(d,null,2),'utf8'); }

  const STOCKS_META = [
    { id:'maze',       name:'Maze Bank',   emoji:'\u{1F3E6}', colorHex:'#1565C0', startPrice:350  },
    { id:'benefactor', name:'Benefactor',  emoji:'\u{1F697}', colorHex:'#2E7D32', startPrice:1200 },
    { id:'goldwand',   name:'Goldwand',    emoji:'\u{1F3C6}', colorHex:'#F9A825', startPrice:650  },
    { id:'diamond',    name:'The Diamond', emoji:'\u{1F48E}', colorHex:'#6A1B9A', startPrice:2800 },
  ];

  function validateToken(token) {
    const toks = loadAktienToksW();
    const e = toks[token];
    return (!e || e.expiresAt < Date.now()) ? null : e;
  }

  function getStocks() {
    const aktien = loadAktienW();
    return STOCKS_META.map(s => {
      const d = aktien[s.id] || { price: s.startPrice, history: [] };
      return { id:s.id, name:s.name, emoji:s.emoji, colorHex:s.colorHex, price:d.price, history:d.history.slice(-24) };
    });
  }

  // ── GET /aktien ────────────────────────────────────────────────────────────
  // Public: no token required → read-only view
  // Private: valid token → full trading UI
  // ?stock=ID: only show that single stock
  app.get('/aktien', (req, res) => {
    const token     = req.query.token || '';
    const focusId   = req.query.stock  || '';
    const entry     = validateToken(token);
    let   stocks    = getStocks();
    if (focusId) stocks = stocks.filter(s => s.id === focusId);

    if (!entry) {
      return res.send(buildPage('', focusId, stocks, {}, 0, false));
    }

    const portfolio = loadPortfolioW();
    const konto     = getKontoAK(entry.userId);
    return res.send(buildPage(token, focusId, stocks, portfolio[entry.userId] || {}, konto.konto || 0, true));
  });

  // ── GET /api/aktien/data ───────────────────────────────────────────────────
  // Public: returns stock data without portfolio/balance
  app.get('/api/aktien/data', (req, res) => {
    const token   = req.query.token || '';
    const focusId = req.query.stock || '';
    const entry   = validateToken(token);
    let   stocks  = getStocks();
    if (focusId) stocks = stocks.filter(s => s.id === focusId);
    if (!entry) {
      return res.json({ ok:true, loggedIn:false, stocks });
    }
    const portfolio = loadPortfolioW();
    const konto     = getKontoAK(entry.userId);
    return res.json({ ok:true, loggedIn:true, balance:konto.konto||0, portfolio:portfolio[entry.userId]||{}, stocks });
  });

  // ── POST /api/aktien/buy ───────────────────────────────────────────────────
  app.post('/api/aktien/buy', express.json(), (req, res) => {
    const { token, stockId, amount } = req.body || {};
    if (!token || !stockId || !amount || amount < 1) return res.json({ ok:false, error:'Ungültige Anfrage' });
    const entry = validateToken(token);
    if (!entry) return res.json({ ok:false, error:'Token abgelaufen \u2014 bitte öffne die Seite erneut über den Button im Discord-Channel.' });
    const stock = STOCKS_META.find(s => s.id === stockId);
    if (!stock) return res.json({ ok:false, error:'Unbekannte Aktie' });
    const aktien= loadAktienW();
    const price = (aktien[stockId]||{price:stock.startPrice}).price;
    const cost  = price * amount;
    const konto = getKontoAK(entry.userId);
    if ((konto.konto||0) < cost) return res.json({ ok:false, error:'Nicht genug Geld. Benötigt: ' + cost.toLocaleString('de-DE') + '\u00a0$' });
    konto.konto -= cost;
    setKontoAK(entry.userId, konto);
    const portfolio = loadPortfolioW();
    if (!portfolio[entry.userId]) portfolio[entry.userId] = {};
    portfolio[entry.userId][stockId] = (portfolio[entry.userId][stockId]||0) + amount;
    savePortfolioW(portfolio);
    return res.json({ ok:true, cost, balance:konto.konto, owned:portfolio[entry.userId][stockId] });
  });

  // ── POST /api/aktien/sell ──────────────────────────────────────────────────
  app.post('/api/aktien/sell', express.json(), (req, res) => {
    const { token, stockId, amount } = req.body || {};
    if (!token || !stockId || !amount || amount < 1) return res.json({ ok:false, error:'Ungültige Anfrage' });
    const entry = validateToken(token);
    if (!entry) return res.json({ ok:false, error:'Token abgelaufen \u2014 bitte öffne die Seite erneut über den Button im Discord-Channel.' });
    const stock = STOCKS_META.find(s => s.id === stockId);
    if (!stock) return res.json({ ok:false, error:'Unbekannte Aktie' });
    const portfolio = loadPortfolioW();
    const owned = (portfolio[entry.userId]||{})[stockId]||0;
    if (owned < amount) return res.json({ ok:false, error:'Nicht genug Aktien. Du besitzt: ' + owned });
    const aktien  = loadAktienW();
    const price   = (aktien[stockId]||{price:stock.startPrice}).price;
    const revenue = price * amount;
    const konto   = getKontoAK(entry.userId);
    konto.konto   = (konto.konto||0) + revenue;
    setKontoAK(entry.userId, konto);
    if (!portfolio[entry.userId]) portfolio[entry.userId]={};
    portfolio[entry.userId][stockId] = owned - amount;
    if (portfolio[entry.userId][stockId] <= 0) delete portfolio[entry.userId][stockId];
    savePortfolioW(portfolio);
    return res.json({ ok:true, revenue, balance:konto.konto, owned:portfolio[entry.userId][stockId]||0 });
  });
};

// ── Page builder ─────────────────────────────────────────────────────────────
function buildPage(token, focusId, stocks, portfolio, balance, loggedIn) {
  const sj      = JSON.stringify(stocks);
  const pj      = JSON.stringify(portfolio);
  const bal     = Number(balance)||0;
  const lg      = !!loggedIn;
  const focusMeta = focusId && stocks.length === 1 ? stocks[0] : null;
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${focusMeta ? focusMeta.emoji + ' ' + focusMeta.name + ' — Aktienmarkt' : 'Paradise City — Aktienmarkt'}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d1117;color:#e0e0e0;font-family:'Segoe UI',sans-serif;min-height:100vh}
header{background:linear-gradient(135deg,#1a1f2e,#0f1623);border-bottom:1px solid #21262d;padding:18px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
header h1{font-size:1.25em;font-weight:700;color:#fff;letter-spacing:1px}
header h1 span{color:#3b82f6}
.bal{background:#161b22;border:1px solid #21262d;border-radius:10px;padding:8px 18px;font-size:.95em;color:#8b949e}
.bal b{color:#22c55e;font-size:1.1em}
.badge-pub{background:#1e293b;border:1px solid #3b82f6;color:#3b82f6;border-radius:10px;padding:8px 16px;font-size:.85em;font-weight:600}
.ticker-bar{background:#111827;border-bottom:1px solid #21262d;padding:6px 0;overflow:hidden;white-space:nowrap}
.ti{display:inline-block;animation:tick 35s linear infinite}
@keyframes tick{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
.ti span{display:inline-block;margin:0 28px;font-size:.82em;font-weight:600}
.tu{color:#22c55e}.td{color:#ef4444}.tf{color:#8b949e}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:20px;padding:24px;max-width:1400px;margin:0 auto}
.card{background:#161b22;border:1px solid #21262d;border-radius:14px;overflow:hidden;transition:border-color .2s}
.card:hover{border-color:#3b82f6}
.ch{padding:16px 20px 10px;display:flex;align-items:center;gap:12px}
.cem{font-size:2em}
.ct{font-size:1em;font-weight:700;color:#fff}
.cp{font-size:1.55em;font-weight:800;color:#fff;margin-top:3px}
.cc{font-size:.84em;margin-top:2px;font-weight:600}
.up{color:#22c55e}.dn{color:#ef4444}.fl{color:#8b949e}
.cw{padding:0 14px 2px;height:100px}
.cb{padding:12px 18px 16px;border-top:1px solid #21262d;margin-top:8px}
.oi{font-size:.82em;color:#8b949e;margin-bottom:10px}
.oi b{color:#e0e0e0}
.ov{color:#3b82f6}
.tr{display:flex;gap:8px;margin-top:4px}
.tr input{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:8px 10px;color:#e0e0e0;font-size:.88em;outline:none;min-width:0}
.tr input:focus{border-color:#3b82f6}
.btn{border:none;border-radius:8px;padding:8px 13px;font-size:.85em;font-weight:700;cursor:pointer;transition:background .15s;white-space:nowrap}
.bb{background:#22c55e;color:#000}.bb:hover{background:#16a34a}
.bs{background:#ef4444;color:#fff}.bs:hover{background:#b91c1c}
.msg{font-size:.8em;margin-top:6px;min-height:16px;font-weight:600}
.mo{color:#22c55e}.me{color:#ef4444}
.login-hint{background:#0f1d2e;border:1px solid #1d4ed8;border-radius:10px;padding:10px 14px;font-size:.82em;color:#60a5fa;margin-top:6px;text-align:center}
.footer{text-align:center;padding:22px;color:#484f58;font-size:.78em}
@media(max-width:480px){.grid{padding:12px;grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <h1>&#x1F4CA; Paradise City <span>Aktienmarkt</span></h1>
  ${lg
    ? '<div class="bal">&#x1F4B0; Kontostand: <b id=\"bd\">' + bal.toLocaleString('de-DE') + '&nbsp;$</b></div>'
    : '<div class="badge-pub">&#x1F441;&#xFE0F; Live-Ansicht &mdash; Klicke den Channel-Button zum Handeln</div>'
  }
</header>
<div class="ticker-bar"><div class="ti" id="ti">Lade...</div></div>
<div class="grid" id="sg"></div>
<div class="footer">Paradise City Roleplay &bull; Kurse aktualisieren sich st&uuml;ndlich</div>
<script>
var TK=${JSON.stringify(token)},ST=${sj},PT=${pj},BAL=${bal},LG=${lg},CH={};
function f(n){return(+n).toLocaleString('de-DE');}
function ticker(){
  var h=ST.map(function(s){
    var hi=s.history,pv=hi.length>1?hi[hi.length-2].price:s.price;
    var d=s.price-pv,pc=pv?((d/pv)*100).toFixed(2):'0.00';
    var c=d>0?'tu':d<0?'td':'tf',si=d>=0?'+':'';
    return '<span class="'+c+'">'+s.emoji+' '+s.name+' <b>'+f(s.price)+' $</b> ('+si+pc+'%)</span>';
  }).join('');
  document.getElementById('ti').innerHTML=h+h;
}
function card(s){
  var own=LG?(PT[s.id]||0):null,hi=s.history,pv=hi.length>1?hi[hi.length-2].price:s.price;
  var d=s.price-pv,pc=pv?((d/pv)*100).toFixed(2):'0.00',si=d>=0?'+':'',cl=d>0?'up':d<0?'dn':'fl';
  var ar=d>0?'\u25b2':d<0?'\u25bc':'\u25a0';
  var el=document.createElement('div'); el.className='card';
  var tradeHtml = LG
    ? '<div class="oi">Im Besitz: <b id="o_'+s.id+'">'+(own===null?'–':f(own))+'</b> Aktien '
      +'<span class="ov" id="ov_'+s.id+'">(\u2248 '+f((own||0)*s.price)+' $)</span></div>'
      +'<div class="tr">'
      +'<input type="number" id="i_'+s.id+'" min="1" step="1" placeholder="Anzahl">'
      +'<button class="btn bb" id="bb_'+s.id+'">Kaufen</button>'
      +'<button class="btn bs" id="bs_'+s.id+'">Verkaufen</button>'
      +'</div>'
      +'<div class="msg" id="m_'+s.id+'"></div>'
    : '<div class="login-hint">&#x1F517; Klicke den <b>\u201eZum Aktienmarkt\u201c</b>-Button im Discord-Channel um zu handeln.</div>';
  el.innerHTML=
    '<div class="ch"><div class="cem">'+s.emoji+'</div><div>'
    +'<div class="ct">'+s.name+'</div>'
    +'<div class="cp" id="p_'+s.id+'">'+f(s.price)+' $</div>'
    +'<div class="cc '+cl+'" id="c_'+s.id+'">'+ar+' '+si+f(d)+' $ ('+si+pc+'%)</div>'
    +'</div></div>'
    +'<div class="cw"><canvas id="ch_'+s.id+'"></canvas></div>'
    +'<div class="cb">'+tradeHtml+'</div>';
  document.getElementById('sg').appendChild(el);
  if(LG){
    document.getElementById('bb_'+s.id).onclick=function(){trade(s.id,'buy');};
    document.getElementById('bs_'+s.id).onclick=function(){trade(s.id,'sell');};
  }
  var ctx=document.getElementById('ch_'+s.id);
  var lbl=s.history.map(function(_,i){return i===s.history.length-1?'Jetzt':'-'+(s.history.length-1-i)+'h';});
  var pr=s.history.map(function(h){return h.price;});
  CH[s.id]=new Chart(ctx,{type:'line',data:{labels:lbl,datasets:[{data:pr,borderColor:s.colorHex,backgroundColor:s.colorHex+'22',borderWidth:2,pointRadius:0,fill:true,tension:0.4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{mode:'index',intersect:false,callbacks:{label:function(c){return f(c.parsed.y)+' $';}}}},scales:{x:{display:false},y:{display:false}},animation:{duration:300}}});
}
async function trade(id,ac){
  var inp=document.getElementById('i_'+id),msg=document.getElementById('m_'+id);
  var amt=parseInt(inp.value,10);
  if(!amt||amt<1){msg.className='msg me';msg.textContent='Bitte eine g\u00fcltige Anzahl eingeben.';return;}
  msg.className='msg';msg.textContent='\u23f3 Verarbeite...';
  try{
    var r=await fetch('/api/aktien/'+ac,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TK,stockId:id,amount:amt})});
    var j=await r.json();
    if(j.ok){
      BAL=j.balance; PT[id]=j.owned;
      document.getElementById('bd').innerHTML=f(BAL)+'&nbsp;$';
      document.getElementById('o_'+id).textContent=f(j.owned);
      var s=ST.find(function(x){return x.id===id;});
      document.getElementById('ov_'+id).innerHTML='(\u2248 '+f(j.owned*(s?s.price:0))+' $)';
      msg.className='msg mo';
      msg.textContent=ac==='buy'?'\u2705 '+f(amt)+' Aktien gekauft \u2014 '+f(j.cost)+' $ abgezogen':'\u2705 '+f(amt)+' Aktien verkauft \u2014 '+f(j.revenue)+' $ gutgeschrieben';
      inp.value='';
    }else{msg.className='msg me';msg.textContent='\u274c '+j.error;}
  }catch(e){msg.className='msg me';msg.textContent='\u274c Verbindungsfehler.';}
}
ticker(); ST.forEach(card);
<\/script>
</body>
</html>`;
}
