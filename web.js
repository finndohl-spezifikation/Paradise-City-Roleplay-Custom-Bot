const express = require('express');
const multer  = require('multer');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const ROLE_REMOVE   = '1490855725516460234';
const ROLES_ALL     = ['1490855719853887569','1490855722534310003','1495982076703539310','1497051373672599622','1490855731950256128','1490855741647618251','1490855728473178282','1490855779694280876'];
const ROLES_LEGAL   = ['1490855729635135489','1490855750329696446','1490855788829216940','1490855796932739093','1498392324277796965'];
const ROLES_ILLEGAL = ['1490855730767597738','1498393200426221679'];

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#0d1117;color:#e0e0e0;min-height:100vh;padding:20px 0 40px}
.wrap{max-width:780px;margin:0 auto;padding:0 16px}
.authority{text-align:center;background:linear-gradient(135deg,#bf360c,#e65100);padding:26px 20px 22px;border-radius:14px 14px 0 0}
.authority .seal{font-size:2.4em;margin-bottom:6px}
.authority h1{color:#fff;font-size:1.05em;letter-spacing:3px;text-transform:uppercase;font-weight:700}
.authority h2{color:#ffd180;font-size:.82em;letter-spacing:1px;margin-top:4px;font-weight:400}
.card{background:#161b22;border:1px solid #30363d;border-top:none;border-radius:0 0 14px 14px;padding:28px}
.section-title{color:#ffd180;font-size:.78em;letter-spacing:2px;text-transform:uppercase;margin:22px 0 10px;display:flex;align-items:center;gap:8px}
.section-title::after{content:'';flex:1;height:1px;background:#e65100;opacity:.35}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
.form-row.one{grid-template-columns:1fr}
.form-group{display:flex;flex-direction:column;gap:5px}
label{color:#ffd180;font-size:.8em;font-weight:600;letter-spacing:.5px}
label .req{color:#ff5252;margin-left:2px}
input[type=text],input[type=date],select{width:100%;padding:9px 13px;background:#0d1117;border:1px solid #30363d;border-radius:7px;color:#e0e0e0;font-size:.92em;outline:none;transition:border .15s}
input[type=text]:focus,input[type=date]:focus,select:focus{border-color:#e65100}
.file-box{border:2px dashed #30363d;border-radius:8px;padding:16px;text-align:center;cursor:pointer;transition:border .15s;position:relative;background:#0d1117}
.file-box:hover{border-color:#e65100}
.file-box input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}
.file-box .file-label{color:#8b949e;font-size:.85em}
.file-box .file-label span{display:block;font-size:1.6em;margin-bottom:4px}
.file-box .file-name{color:#ffd180;font-size:.8em;margin-top:6px;display:none}
.person-block{background:#0d1117;border:1px solid #30363d;border-left:3px solid #e65100;border-radius:8px;padding:18px;margin-bottom:14px}
.person-block .person-head{color:#ffd180;font-size:.85em;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.btn{width:100%;padding:14px;background:#e65100;color:#fff;border:none;border-radius:8px;font-size:1em;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:22px;transition:background .15s}
.btn:hover{background:#bf360c}
.btn-confirm{background:#1a3a1a;border:1px solid #2ea043;color:#2ea043;margin-top:10px}
.btn-confirm:hover{background:#2ea043;color:#fff}
.error-box{background:#1c0a0a;border:1px solid #f85149;color:#f85149;padding:12px 16px;border-radius:8px;margin-bottom:18px;font-size:.88em}
.success-wrap{text-align:center;padding:40px 20px}
.success-wrap .icon{font-size:3.5em;margin-bottom:14px}
.success-wrap h2{color:#3fb950;font-size:1.4em;margin-bottom:10px}
.success-wrap p{color:#8b949e;font-size:.9em;line-height:1.6}
.select-grid{display:grid;gap:14px;margin-top:4px}
.select-card{background:#0d1117;border:2px solid #30363d;border-radius:10px;padding:20px;cursor:pointer;transition:all .2s;display:block;text-decoration:none;color:inherit}
.select-card:hover,.select-card:focus{border-color:#e65100;background:#161b22;outline:none}
.select-card .sc-icon{font-size:1.8em;margin-bottom:8px}
.select-card .sc-title{font-size:1em;font-weight:700;color:#fff;margin-bottom:4px}
.select-card .sc-desc{font-size:.8em;color:#8b949e;line-height:1.5}
.warning-text{color:#f85149;font-size:.72em;text-align:center;margin-top:24px;line-height:1.6;border-top:1px solid #21262d;padding-top:14px}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2000;display:flex;align-items:center;justify-content:center;animation:fadeIn .35s ease;overflow:hidden}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes popIn{from{opacity:0;transform:scale(.7) translateY(40px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes popOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.7) translateY(40px)}}
  .modal-box{background:#161b22;border:1px solid #e65100;border-radius:16px;padding:32px 28px;max-width:480px;width:92%;animation:popIn .45s cubic-bezier(.34,1.56,.64,1) forwards;position:relative}
  .modal-box.closing{animation:popOut .35s ease forwards}
  .modal-title{color:#ffd180;font-size:1.1em;font-weight:700;letter-spacing:1px;text-align:center;margin-bottom:20px}
  .modal-rule{display:flex;gap:12px;margin-bottom:14px;align-items:flex-start;font-size:.88em;line-height:1.6;color:#c9d1d9}
  .modal-rule .num{background:#e65100;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.8em;flex-shrink:0;margin-top:1px}
  .modal-wish{text-align:center;color:#3fb950;font-size:.88em;margin:18px 0 22px;font-weight:600}
  .modal-btn-wrap{display:flex;justify-content:center;min-height:48px;position:relative;overflow:visible}
  .modal-btn{padding:13px 36px;background:#e65100;color:#fff;border:none;border-radius:9px;font-size:.97em;font-weight:700;cursor:pointer;transition:background .15s;position:relative}
  .modal-btn:hover{background:#bf360c}
.toggle-group{display:flex;gap:0;margin-bottom:18px;border:1px solid #30363d;border-radius:8px;overflow:hidden}
.toggle-btn{flex:1;padding:11px;text-align:center;cursor:pointer;font-size:.88em;font-weight:600;background:#0d1117;color:#8b949e;border:none;transition:all .15s}
.toggle-btn.active{background:#e65100;color:#fff}
.hidden{display:none}
.discord-note{font-size:.75em;color:#8b949e;margin-top:4px}
hr.divider{border:none;border-top:1px solid #21262d;margin:20px 0}
@media(max-width:560px){.form-row{grid-template-columns:1fr}}
  .member-search{width:100%;padding:9px 13px;background:#0d1117;border:1px solid #30363d;border-radius:7px 7px 0 0;color:#e0e0e0;font-size:.92em;outline:none;transition:border .15s}
  .member-search:focus{border-color:#e65100}
  .member-select{width:100%;padding:4px 2px;background:#0d1117;border:1px solid #30363d;border-top:none;border-radius:0 0 7px 7px;color:#e0e0e0;font-size:.9em;min-height:140px}
  .member-select:focus{border-color:#e65100;outline:none}
  .member-select option{padding:6px 10px;cursor:pointer}
`;

function header(subtitle) {
  return `
    <div class="authority">
      <div class="seal">🏛️</div>
      <h1>Los Angeles Einwohner Melde Amt</h1>
      <h2>${subtitle}</h2>
    </div>`;
}

function warning() {
  return `<p class="warning-text">⚠️ Bitte gebe bei der Erstellung deines Charakters nur korrekte Daten an.<br>Änderungen können nicht vorgenommen werden.</p>`;
}

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function memberPicker(name, label, defaultId) {
    return `
    <div class="form-group">
      <label>${label} <span class="req">*</span></label>
      <input type="text" class="member-search" placeholder="🔍 Mitglied suchen..." autocomplete="off">
      <select name="${name}" class="member-select" required data-default="${defaultId||''}">
        <option value="">— Wird geladen... —</option>
      </select>
    </div>`;
  }

  function page(title, body) {
  return `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Paradise City Roleplay</title>
<style>${CSS}.btn-sm{display:inline-block;padding:3px 10px;background:#e65100;color:#fff;border:none;border-radius:6px;font-size:.78em;cursor:pointer;text-decoration:none;vertical-align:middle;margin-left:4px;line-height:1.6}
  
    /* ── Team-Banner ── */
    #team-banner{position:fixed;top:0;left:0;right:0;z-index:3000;background:#1a1a1a;border-bottom:3px solid #e65100;transform:translateY(-110%);transition:transform .45s cubic-bezier(.22,1,.36,1);box-shadow:0 4px 24px rgba(0,0,0,.6)}
    #team-banner.show{transform:translateY(0)}
    #team-banner .tb-bar{display:flex;align-items:center;justify-content:space-between;padding:10px 20px;gap:12px}
    #team-banner .tb-label{background:#e65100;color:#fff;font-size:.72em;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:.06em;flex-shrink:0}
    #team-banner .tb-text{color:#ffd180;font-size:.9em;font-weight:600;flex:1}
    #team-banner .tb-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
    #team-banner .tb-more{background:#e65100;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:.8em;cursor:pointer;font-weight:600}
    #team-banner .tb-close{background:none;border:none;color:#888;font-size:1.2em;cursor:pointer;line-height:1;padding:2px 6px}
    #team-banner .tb-close:hover{color:#fff}
    #team-banner .tb-detail{display:none;padding:0 20px 16px;color:#ccc;font-size:.85em;line-height:1.7;border-top:1px solid #2a2a2a;margin-top:4px}
    #team-banner .tb-detail.open{display:block}
    #team-banner .tb-detail ul{margin:8px 0 10px 18px;padding:0}
    #team-banner .tb-detail ul li{margin-bottom:4px}
    #team-banner .tb-detail .tb-apply{display:inline-block;margin-top:4px;background:#e65100;color:#fff;padding:6px 16px;border-radius:8px;font-size:.84em;font-weight:600;text-decoration:none}
  </style></head><body>
<div class="wrap">${body}</div>
<script>
document.querySelectorAll('.file-box input[type=file]').forEach(inp => {
  inp.addEventListener('change', function() {
    const name = this.files[0]?.name;
    const el = this.closest('.file-box').querySelector('.file-name');
    if (el && name) { el.textContent = '📎 ' + name; el.style.display = 'block'; }
  });
});
(async function initMemberPickers() {
  let members = [];
  try { const r = await fetch('/api/members'); members = await r.json(); } catch(e) {}
  document.querySelectorAll('.member-search').forEach(function(search) {
    const sel = search.nextElementSibling;
    function populate(f) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">\u2014 Mitglied ausw\u00e4hlen \u2014</option>' +
        members.filter(function(m) { return !f || m.name.toLowerCase().includes(f.toLowerCase()); })
               .map(function(m) { return '<option value="' + m.id + '"' + (m.id===prev?' selected':'') + '>' + m.name + '</option>'; }).join('');
    }

function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    populate('');
    const def = sel.getAttribute('data-default'); if (def) sel.value = def;
    search.addEventListener('input', function() { populate(search.value); });
  });
})();

  // Geburtsdatum auto-format: nur Zahlen, Punkte automatisch
  document.querySelectorAll('[data-date]').forEach(function(el) {
    el.addEventListener('input', function(e) {
      var v = el.value.replace(/[^0-9]/g, '');
      if (v.length > 4) v = v.slice(0,2) + '.' + v.slice(2,4) + '.' + v.slice(4,8);
      else if (v.length > 2) v = v.slice(0,2) + '.' + v.slice(2);
      el.value = v;
    });
    el.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && (el.value.endsWith('.')) ) {
        e.preventDefault(); el.value = el.value.slice(0, -2);
      }
    });
  });
  </script>

    <div id="team-banner">
      <div class="tb-bar">
        <span class="tb-label">INFO</span>
        <span class="tb-text">Teammitglieder Gesucht</span>
        <div class="tb-actions">
          <button class="tb-more" onclick="document.querySelector('.tb-detail').classList.toggle('open');this.textContent=document.querySelector('.tb-detail').classList.contains('open')?'Schließen':'Mehr erfahren'">Mehr erfahren</button>
          <button class="tb-close" onclick="document.getElementById('team-banner').classList.remove('show')" title="Schließen">✕</button>
        </div>
      </div>
      <div class="tb-detail">
        <p>Du möchtest gerne ein Teil des Teams von Paradise City werden? Dann lies dir kurz die Voraussetzungen durch und bewirb dich danach in einem Ticket.</p>
        <ul>
          <li>Du bist mindestens <strong>16 Jahre</strong> alt</li>
          <li>Du bist interessiert an <strong>Teamarbeit</strong> und der Entwicklung des Servers</li>
          <li>Du kannst in hitzigen Situationen trotzdem <strong>ruhig bleiben</strong></li>
          <li>Du bist <strong>zuverlässig</strong></li>
        </ul>
        <p>Wenn das alles zu dir passt, bewirb dich noch heute und werde ein Teil des Teams von <strong>Paradise City</strong>!</p>
      </div>
    </div>
    <script>
      (function(){
        // Banner nach 800ms einblenden (nach eventuellem ersten Popup)
        setTimeout(function(){ document.getElementById('team-banner').classList.add('show'); }, 800);
      })();
    </script>
  </body></html>`;
}

function charFields(prefix, idx, vals) {
  return `
  <div class="form-row">
    <div class="form-group">
      <label for="${prefix}vorname_${idx}">Vorname <span class="req">*</span></label>
      <input type="text" id="${prefix}vorname_${idx}" name="${prefix}vorname_${idx}" value="${escHtml(vals && vals[prefix+'vorname_'+idx] || '')}" required placeholder="Max">
    </div>
    <div class="form-group">
      <label for="${prefix}nachname_${idx}">Nachname <span class="req">*</span></label>
      <input type="text" id="${prefix}nachname_${idx}" name="${prefix}nachname_${idx}" value="${escHtml(vals && vals[prefix+'nachname_'+idx] || '')}" required placeholder="Mustermann">
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label for="${prefix}geburtsdatum_${idx}">Geburtsdatum <span class="req">*</span></label>
      <input type="text" id="${prefix}geburtsdatum_${idx}" name="${prefix}geburtsdatum_${idx}" placeholder="TT.MM.JJJJ" required data-date="1" inputmode="numeric" maxlength="10" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="${prefix}geburtsort_${idx}">Geburtsort <span class="req">*</span></label>
      <input type="text" id="${prefix}geburtsort_${idx}" name="${prefix}geburtsort_${idx}" value="${escHtml(vals && vals[prefix+'geburtsort_'+idx] || '')}" required placeholder="Los Angeles">
    </div>
  </div>
  <div class="form-row one">
    <div class="form-group">
      <label for="${prefix}nationalitaet_${idx}">Nationalität <span class="req">*</span></label>
      <input type="text" id="${prefix}nationalitaet_${idx}" name="${prefix}nationalitaet_${idx}" value="${escHtml(vals && vals[prefix+'nationalitaet_'+idx] || '')}" required placeholder="Amerikanisch">
    </div>
  </div>
  <div class="form-row one">
    <div class="form-group">
      <label for="${prefix}geschlecht_${idx}">Geschlecht <span class="req">*</span></label>
      <select id="${prefix}geschlecht_${idx}" name="${prefix}geschlecht_${idx}" required>
        <option value="" disabled selected>Bitte wählen</option>
        <option value="Männlich">Männlich</option>
        <option value="Weiblich">Weiblich</option>
      </select>
    </div>
  </div>
  <div class="form-row one">
    <div class="form-group">
      <label for="${prefix}psn_${idx}">PSN Name <span class="req">*</span></label>
      <input type="text" id="${prefix}psn_${idx}" name="${prefix}psn_${idx}" value="${escHtml(vals && vals[prefix+'psn_'+idx] || '')}" required placeholder="dein_psn_name">
    </div>
  </div>`;
}

function buildScratchPage(token, entry) {
    const grid  = entry.grid;
    const cells = grid.map((sym, i) => '<div class="cell" id="c'+i+'" data-i="'+i+'"><span class="sym">'+sym+'</span><canvas class="cv" width="104" height="104"></canvas></div>').join('');
    const gridJ = JSON.stringify(grid);
    return `<!DOCTYPE html>
  <html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Rubbellos — Paradise City Roleplay</title>
  <style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0d1117;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px 48px}
  .hdr{text-align:center;margin-bottom:28px}
  .hdr .ico{font-size:3em;margin-bottom:8px}
  .hdr h1{color:#ffd180;font-size:1.35em;font-weight:700;letter-spacing:2px;text-transform:uppercase}
  .hdr p{color:#8b949e;font-size:.85em;margin-top:6px}
  .card{background:#161b22;border:2px solid #e65100;border-radius:18px;padding:28px 24px;max-width:430px;width:100%}
  .hint{color:#8b949e;font-size:.78em;text-align:center;margin-bottom:14px}
  .grid{display:grid;grid-template-columns:repeat(3,104px);grid-template-rows:repeat(3,104px);gap:8px;margin:0 auto;width:fit-content}
  .cell{position:relative;width:104px;height:104px;background:#0d1117;border:2px solid #30363d;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .sym{font-size:2.4em;pointer-events:none;user-select:none}
  .cv{position:absolute;inset:0;width:104px;height:104px;border-radius:8px;cursor:crosshair;touch-action:none}
  .prog-wrap{margin:16px 0 8px}
  .prog-txt{color:#8b949e;font-size:.78em;text-align:center;margin-bottom:6px}
  .prog-bar{height:5px;background:#21262d;border-radius:3px;overflow:hidden}
  .prog-fill{height:100%;background:linear-gradient(90deg,#bf360c,#e65100);transition:width .25s;width:0%}
  .claim-btn{display:none;width:100%;padding:16px;background:#e65100;color:#fff;border:none;border-radius:10px;font-size:1.05em;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:12px;transition:background .15s}
  .claim-btn:hover{background:#bf360c}
  .claim-btn.show{display:block}
  .claim-btn:disabled{background:#555;cursor:not-allowed}
  .result{display:none;text-align:center;margin-top:20px;padding-top:18px;border-top:1px solid #21262d}
  .result.show{display:block}
  .result .ri{font-size:3em;margin-bottom:10px}
  .result h2{color:#ffd180;font-size:1.15em;margin-bottom:8px}
  .result p{font-size:.9em;line-height:1.6;color:#c9d1d9}
  .win{color:#3fb950;font-weight:700}
  .lose{color:#8b949e}
  .spinner{display:inline-block;width:18px;height:18px;border:2px solid #555;border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .expire{color:#555;font-size:.7em;text-align:center;margin-top:18px}
  .live-count{min-height:36px;margin:14px 0 4px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center}
  .chip{display:inline-flex;align-items:center;gap:5px;background:#21262d;border:1px solid #30363d;border-radius:20px;padding:5px 12px;font-size:.93em;transition:all .25s}
  .chip b{color:#c9d1d9}
  .chip em{font-style:normal;color:#8b949e}
  .win-chip{border-color:#3fb950;background:#0d2311;box-shadow:0 0 8px rgba(63,185,80,.35)}
  .win-chip em{color:#3fb950;font-weight:700}
  .cell.done{border-color:#3fb950!important;box-shadow:inset 0 0 14px rgba(63,185,80,.18),0 0 8px rgba(63,185,80,.25)}
  .sym.txt{font-size:.85em;font-weight:700;text-align:center;line-height:1.2;padding:0 4px;word-break:break-word;color:#e6e6e6}
  @media(max-width:380px){.grid{grid-template-columns:repeat(3,90px);grid-template-rows:repeat(3,90px)}.cell,.cv{width:90px;height:90px}}
  </style></head><body>
  <div class="hdr"><div class="ico">🎟️</div><h1>Paradise City Rubbellos</h1><p>Rubbele alle 9 Felder frei und sichere deinen Gewinn!</p></div>
  <div class="card">
  <p class="hint">🖱️ Maus gedrückt halten &amp; rubbeln &mdash; oder auf dem Handy mit dem Finger</p>
  <div class="grid">${cells}</div>
  <div class="live-count" id="lc"></div>
  <div class="prog-wrap"><p class="prog-txt" id="pt">0 % freigerubbelt</p><div class="prog-bar"><div class="prog-fill" id="pf"></div></div></div>
  <button class="claim-btn" id="cb" onclick="claim()">🏆 Gewinn jetzt sichern!</button>
  <div class="result" id="res"></div>
  <p class="expire">⏰ Dieser Link ist 30 Minuten gültig &bull; Du kannst ihn nur einmal verwenden</p>
  </div>
  <script>
  const TOKEN='${token}';
  const GRID=${gridJ};
  const PRIZE=${JSON.stringify(entry.prize)};
  const SYM_MAP={'\u274C':'Niete','\uD83D\uDCB5':'1.000 \u0024','\uD83D\uDCB4':'2.500 \u0024','\uD83D\uDCB6':'5.000 \u0024','\uD83D\uDCB7':'10.000 \u0024','\uD83D\uDCB0':'25.000 \u0024','\uD83D\uDEAC':'10\u00D7 Marlboro Rot','\uD83D\uDEB2':'Elektro Fahrrad','\u26F3':'Golfschl\u00E4ger','\uD83C\uDFB0':'Lottoschein','\uD83C\uDF9F\uFE0F':'20% Gutschein Autohaus','\uD83C\uDFCE\uFE0F':'SPORTWAGEN'};
  const CASH_SYMS=new Set(['\uD83D\uDCB5','\uD83D\uDCB4','\uD83D\uDCB6','\uD83D\uDCB7','\uD83D\uDCB0']);
  const scratched=new Array(9).fill(0);
  const GSIZE=14;
  const GCELLS=GSIZE*GSIZE;
  const covered=Array.from({length:9},()=>new Uint8Array(GCELLS));
  let claimed=false;

  // Paint each canvas with scratch coating
  document.querySelectorAll('.cv').forEach((cv,i)=>{
    const ctx=cv.getContext('2d');
    ctx.globalCompositeOperation='source-over';
    const g=ctx.createLinearGradient(0,0,cv.width,cv.height);
    g.addColorStop(0,'#9e9e9e');g.addColorStop(.5,'#c8c8c8');g.addColorStop(1,'#757575');
    ctx.beginPath();ctx.rect(0,0,cv.width,cv.height);
    ctx.fillStyle=g;ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.4)';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('RUBBELN',cv.width/2,cv.height/2);
    ctx.fillStyle='rgba(255,255,255,.2)';
    for(let s=0;s<6;s++){ctx.beginPath();ctx.arc(Math.random()*(cv.width-14)+7,Math.random()*(cv.height-14)+7,2,0,Math.PI*2);ctx.fill();}
  });


  function symLabel(sym){
    if(sym!==PRIZE.sym)return '';
    if(PRIZE.type==='cash')return PRIZE.amount.toLocaleString('de-DE')+' \u0024';
    if(PRIZE.type==='item')return (PRIZE.menge||1)+'\u00D7 '+PRIZE.item;
    if(PRIZE.type==='ticket')return '\uD83C\uDFCE\uFE0F SPORTWAGEN';
    return '';
  }
  function updateCounter(){
    const lc=document.getElementById('lc');
    const counts={};
    GRID.forEach((sym,i)=>{if(scratched[i]>=40)counts[sym]=(counts[sym]||0)+1;});
    const keys=Object.keys(counts);
    if(!keys.length){lc.innerHTML='';return;}
    lc.innerHTML=keys.map(sym=>{
      const cnt=counts[sym];
      const lbl=symLabel(sym);
      const isWin=sym===PRIZE.sym&&PRIZE.type!=='nichts'&&cnt>=3;
      return '<span class="chip'+(isWin?' win-chip':'')+'">'+sym+' <b>\u00D7'+cnt+'</b>'+(lbl?' <em>'+lbl+'</em>':'')+'</span>';
    }).join('');
  }
  function pct(){return Math.round(scratched.reduce((a,b)=>a+b,0)/9);}
  function upd(){
    const p=pct();
    document.getElementById('pf').style.width=p+'%';
    document.getElementById('pt').textContent=p+'\u0025 freigerubbelt';
    if(p>=80)document.getElementById('cb').classList.add('show');
    updateCounter();
  }

  function markDone(i){
    if(scratched[i]===100)return;
    scratched[i]=100;
    const cv2=canvases[i];const ctx2=cv2.getContext('2d');
    ctx2.clearRect(0,0,cv2.width,cv2.height);
    const cell=document.getElementById('c'+i);cell.classList.add('done');
    const sym=GRID[i];const lbl=SYM_MAP[sym]||sym;
    const spanEl=cell.querySelector('.sym');
    if(CASH_SYMS.has(sym)){spanEl.textContent=lbl;spanEl.classList.add('txt');}
    upd();
  }
  function scrAt(cv,i,x,y,r){
    if(scratched[i]===100)return;
    // Erase on canvas
    const ctx=cv.getContext('2d');
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    ctx.globalCompositeOperation='source-over';
    // Track coverage via virtual 14x14 grid (no getImageData needed)
    const cov=covered[i];const cw=cv.width;const cellSz=cw/GSIZE;const r2=r*r;
    for(let gy=0;gy<GSIZE;gy++){for(let gx=0;gx<GSIZE;gx++){
      const cx=(gx+.5)*cellSz,cy=(gy+.5)*cellSz;
      const dx=cx-x,dy=cy-y;
      if(dx*dx+dy*dy<=r2)cov[gy*GSIZE+gx]=1;
    }}
    let cnt=0;for(let k=0;k<GCELLS;k++)if(cov[k])cnt++;
    scratched[i]=Math.round(cnt/GCELLS*100);
    if(scratched[i]>=55)markDone(i);else upd();
  }
  let dn=false;
  const R=window.innerWidth<380?30:42;
  const canvases=[...document.querySelectorAll('.cv')];
  canvases.forEach((cv,i)=>{
    const go=(e,type)=>{
      if(type==='start')dn=true;
      if(!dn)return;
      if(type==='end'){dn=false;return;}
      const rect=cv.getBoundingClientRect();
      const src=e.touches?e.touches[0]:e;
      const sx=(src.clientX-rect.left)*(cv.width/rect.width);
      const sy=(src.clientY-rect.top)*(cv.height/rect.height);
      scrAt(cv,i,sx,sy,R);
    };
    cv.addEventListener('mousedown',e=>go(e,'start'));
    cv.addEventListener('mousemove',e=>go(e,'move'));
    cv.addEventListener('touchstart',e=>{e.preventDefault();go(e,'start');},{passive:false});
    cv.addEventListener('touchmove',e=>{e.preventDefault();go(e,'move');},{passive:false});
    cv.addEventListener('touchend',e=>go(e,'end'));
  });
  document.addEventListener('mouseup',()=>{dn=false;});

  // allow scratch to cross cell borders
  document.querySelector('.grid').addEventListener('mousemove',e=>{
    if(!dn)return;
    canvases.forEach((cv,i)=>{
      const r=cv.getBoundingClientRect();
      const x=(e.clientX-r.left)*(cv.width/r.width);
      const y=(e.clientY-r.top)*(cv.height/r.height);
      if(x>=0&&x<=cv.width&&y>=0&&y<=cv.height)scrAt(cv,i,x,y,R);
    });
  });

  async function claim(){
    if(claimed)return;
    claimed=true;
    const btn=document.getElementById('cb');
    btn.disabled=true;
    btn.innerHTML='<span class="spinner"></span>Wird gebucht\u2026';
    try{
      const r=await fetch('/api/rubbellos/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN})});
      const d=await r.json();
      const res=document.getElementById('res');
      res.classList.add('show');
      btn.style.display='none';
      if(d.ok){
        const p=d.prize;
        let ico=p.sym||'🎁',h='',msg='';
        if(p.type==='cash'){h='🎉 Gewonnen!';msg='<span class="win">💰 '+p.amount.toLocaleString('de-DE')+' \u0024 wurden deinem Bargeld gutgeschrieben!</span>';}
        else if(p.type==='item'){h='🎉 Gewonnen!';msg='<span class="win">🎁 '+(p.menge||1)+'\u00D7 '+p.item+' wurde deinem Inventar hinzugef\u00FCgt!</span>';}
        else if(p.type==='ticket'){h='🏆 HAUPTGEWINN!';ico='🏎️';msg='<span class="win">🏎️ SPORTWAGEN! Bitte ein Support-Ticket in Discord erstellen!</span>';}
        else{h='😢 Leider Niete';msg='<span class="lose">Kein Gewinn diesmal — viel Gl\u00FCck beim n\u00E4chsten Mal!</span>';}
        res.innerHTML='<div class="ri">'+ico+'</div><h2>'+h+'</h2><p>'+msg+'</p><p style="color:#555;font-size:.75em;margin-top:14px">Du kannst dieses Fenster schlie\u00DFen.</p>';
      }else{
        res.innerHTML='<div class="ri">❌</div><h2>Fehler</h2><p>'+(d.error||'Unbekannter Fehler')+'</p>';
        claimed=false;btn.disabled=false;btn.innerHTML='🏆 Gewinn jetzt sichern!';
      }
    }catch(e){
      document.getElementById('res').innerHTML='<div class="ri">❌</div><h2>Verbindungsfehler</h2><p>Bitte erneut versuchen.</p>';
      document.getElementById('res').classList.add('show');
      claimed=false;const btn=document.getElementById('cb');btn.disabled=false;btn.innerHTML='🏆 Gewinn jetzt sichern!';
    }
  }
  </script></body></html>`;
  }

  const rubbellosTokens = new Map();

module.exports = function startWebServer(client, DATA_DIR) {
  const app        = express();
  const CODES_FILE   = path.join(DATA_DIR, 'einreise_codes.json');
  const EINREISE_TOKEN_FILE = path.join(DATA_DIR, 'einreise_tokens.json');
  function loadEinreiseTokens() { try { return JSON.parse(fs.readFileSync(EINREISE_TOKEN_FILE,'utf8')); } catch { return {}; } }
  function saveEinreiseTokens(d) { fs.writeFileSync(EINREISE_TOKEN_FILE, JSON.stringify(d,null,2)); }
  function genEinreiseTok() { return Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }
  const AUSWEIS_FILE = path.join(DATA_DIR, 'ausweis.json');
  function loadCodes()    { try { return JSON.parse(fs.readFileSync(CODES_FILE,   'utf8')); } catch { return {}; } }

  const AUSWEIS_TOKEN_FILE = path.join(DATA_DIR, 'ausweis_tokens.json');
  if (!fs.existsSync(AUSWEIS_TOKEN_FILE)) fs.writeFileSync(AUSWEIS_TOKEN_FILE, '{}', 'utf8');
  function loadAusweisTokens()  { try { return JSON.parse(fs.readFileSync(AUSWEIS_TOKEN_FILE, 'utf8')); } catch { return {}; } }
  function saveAusweisTokens(d) { fs.writeFileSync(AUSWEIS_TOKEN_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  function saveCodes(d)   { fs.writeFileSync(CODES_FILE,   JSON.stringify(d, null, 2), 'utf8'); }
  function loadAusweis()  { try { return JSON.parse(fs.readFileSync(AUSWEIS_FILE, 'utf8')); } catch { return {}; } }
  function saveAusweis(d) { fs.writeFileSync(AUSWEIS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Nur Bilder (JPG/PNG) erlaubt'));
    }
  });

  app.use(express.urlencoded({ extended: true, limit: '60mb' }));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'paradise-city-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }
  }));

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function getGuild() { return client.guilds.cache.first(); }

  async function getMember(userId) {
    const guild = getGuild();
    if (!guild) return null;
    try { return await guild.members.fetch(userId); }
    catch { return null; }
  }

  async function validateApplicant(userId) {
    if (!/^\d{17,20}$/.test(userId)) return { ok: false, reason: 'Ungültige Discord ID (nur Zahlen, 17-20 Stellen).' };
    const member = await getMember(userId);
    if (!member) return { ok: false, reason: `Discord ID \`${userId}\` ist nicht auf diesem Server.` };
    return { ok: true, member };
  }

  async function applyRoles(userId, isLegal) {
    const member = await getMember(userId);
    if (!member) return false;
    try {
      const toAdd = [...ROLES_ALL, ...(isLegal ? ROLES_LEGAL : ROLES_ILLEGAL)];
      await member.roles.remove(ROLE_REMOVE).catch(() => {});
      for (const roleId of toAdd) await member.roles.add(roleId).catch(() => {});
      return true;
    } catch { return false; }
  }

  // ── GET /api/members — Servermitglieder für Picker ─────────────────────────
    app.get('/api/members', async (req, res) => {
        const guild = getGuild();
        if (!guild) return res.json([]);
        try {
          const fetched = await guild.members.fetch();
          const list = [...fetched.values()]
            .filter(m => !m.user.bot && m.roles.cache.has(ROLE_REMOVE))
            .map(m => ({ id: m.user.id, name: m.displayName || m.user.username }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
          res.json(list);
        } catch(err) {
          console.error('members fetch error:', err.message);
          const list = [...guild.members.cache.values()]
            .filter(m => !m.user.bot && m.roles.cache.has(ROLE_REMOVE))
            .map(m => ({ id: m.user.id, name: m.displayName || m.user.username }))
            .sort((a, b) => a.name.localeCompare(b.name, 'de'));
          res.json(list);
        }
      });

    // ── GET / — Root Redirect ────────────────────────────────────────────────
    app.get('/', (req, res) => res.redirect('/einreise'));

    // ── GET /einreise — Auswahlseite ─────────────────────────────────────────
  app.get('/einreise', (req, res) => {
      res.send(`<!DOCTYPE html><html lang="de"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Einreise — Paradise City Roleplay</title>
  <style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0d1117;color:#e0e0e0;min-height:100vh}
  /* Modal */
  #introOverlay{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9000;display:flex;align-items:center;justify-content:center}
  #introBox{background:#161b22;border:2px solid #e65100;border-radius:16px;padding:32px 26px;max-width:460px;width:92%;animation:popIn .5s cubic-bezier(.34,1.56,.64,1)}
  @keyframes popIn{from{opacity:0;transform:scale(.6) translateY(60px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes popOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.7) translateY(40px)}}
  .mo-title{color:#ffd180;font-size:1.05em;font-weight:700;text-align:center;margin-bottom:22px;letter-spacing:.5px}
  .mo-rule{display:flex;gap:12px;margin-bottom:13px;font-size:.87em;line-height:1.65;color:#c9d1d9;align-items:flex-start}
  .mo-num{background:#e65100;color:#fff;border-radius:50%;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.78em;flex-shrink:0;margin-top:2px}
  .mo-wish{text-align:center;color:#3fb950;font-size:.86em;margin:18px 0 24px;font-weight:600;line-height:1.5}
  #introBtn{display:block;margin:0 auto;padding:13px 40px;background:#e65100;color:#fff;border:none;border-radius:9px;font-size:.97em;font-weight:700;cursor:pointer;position:relative}
  /* Page */
  .wrap{max-width:780px;margin:0 auto;padding:0 16px 40px}
  .authority{text-align:center;background:linear-gradient(135deg,#bf360c,#e65100);padding:26px 20px 22px;border-radius:14px 14px 0 0;margin-top:20px}
  .authority .seal{font-size:2.4em;margin-bottom:6px}
  .authority h1{color:#fff;font-size:1.05em;letter-spacing:3px;text-transform:uppercase;font-weight:700}
  .authority h2{color:#ffd180;font-size:.82em;letter-spacing:1px;margin-top:4px;font-weight:400}
  .card{background:#161b22;border:1px solid #30363d;border-top:none;border-radius:0 0 14px 14px;padding:28px}
  .section-title{color:#ffd180;font-size:.78em;letter-spacing:2px;text-transform:uppercase;margin:22px 0 10px;display:flex;align-items:center;gap:8px}
  .section-title::after{content:'';flex:1;height:1px;background:#e65100;opacity:.35}
  .select-grid{display:grid;gap:14px;margin-top:4px}
  .select-card{background:#0d1117;border:2px solid #30363d;border-radius:10px;padding:20px;cursor:pointer;transition:all .2s;display:block;text-decoration:none;color:inherit}
  .select-card:hover{border-color:#e65100;background:#161b22}
  .select-card .sc-icon{font-size:1.8em;margin-bottom:8px}
  .select-card .sc-title{font-size:1em;font-weight:700;color:#fff;margin-bottom:4px}
  .select-card .sc-desc{font-size:.8em;color:#8b949e;line-height:1.5}
  </style>
  </head><body>
  <div id="introOverlay">
    <div id="introBox">
      <div class="mo-title">🏛️ Paradise City Roleplay — Willkommen!</div>
      <div class="mo-rule"><div class="mo-num">1</div><div>Bitte lies dir vor dem Erstellen deines Charakters das <strong>Regelwerk</strong> durch.</div></div>
      <div class="mo-rule"><div class="mo-num">2</div><div>Stelle sicher, dass du <strong>DM-Nachrichten aktiviert</strong> hast, damit unser Bot dir Nachrichten senden kann.</div></div>
      <div class="mo-rule"><div class="mo-num">3</div><div>Solltest du <strong>legal einreisen</strong>, gib bitte nur korrekte Daten zu deinem IC-Charakter an. Eine Änderung ist später nur durch den <strong>Tod deines Charakters</strong> möglich.</div></div>
      <div class="mo-wish">Wir wünschen dir viel Spaß bei deinem Start auf Paradise City Roleplay! 🎮</div>
      <button id="introBtn">Ich habe verstanden ✅</button>
    </div>
  </div>
  <script>
  (function(){
    var btn=document.getElementById('introBtn');
    var ov=document.getElementById('introOverlay');
    var box=document.getElementById('introBox');
    document.body.style.overflow='hidden';
    function done(){
        box.style.animation='popOut .35s ease forwards';
        setTimeout(function(){ov.style.display='none';document.body.style.overflow='';},340);
      }
      btn.addEventListener('click',done);
  })();
  </script>
  <div class="wrap">
    <div class="authority">
      <div class="seal">🏛️</div>
      <h1>Los Angeles Einwohner Melde Amt</h1>
      <h2>Einreisebehörde — Bitte wähle deinen Einreiseweg</h2>
    </div>
    <div class="card">
      <p class="section-title">Einreiseweg wählen</p>
      <div class="select-grid">
        <a class="select-card" href="/einreise/legal">
            <div class="sc-icon">🟢</div>
            <div class="sc-title">Legale Einreise</div>
            <div class="sc-desc">Du reist offiziell ein und bist legal im Staat registriert. Du erhältst einen Ausweis und darfst staatliche Jobs ausführen. Illegale Aktivitäten sind verboten.</div>
          </a>
        <a class="select-card" href="/einreise/illegal">
            <div class="sc-icon">🔴</div>
            <div class="sc-title">Illegale Einreise</div>
            <div class="sc-desc">Du reist ohne offizielle Registrierung ein. Kein Ausweis, keine staatlichen Jobs. Du kannst illegale Aktivitäten ausführen — werde nicht erwischt.</div>
          </a>
        <a class="select-card" href="/einreise/gruppe">
          <div class="sc-icon">🟡</div>
          <div class="sc-title">Gruppen Einreise</div>
          <div class="sc-desc">Ab mindestens 4 Personen. Alle müssen denselben Lebensweg wählen und erhalten exklusive Gruppen-Boni.</div>
        </a>
      </div>
    </div>
  </div>
  </body></html>`);
    });

  // ── GET /einreise/legal ───────────────────────────────────────────────────
  // ── GET /einreise/legal (backward compat — redirect to error) ──────────────
  app.get('/einreise/legal', (req, res) => {
      const error    = req.session.legalError || ''; delete req.session.legalError;
      const legalForm = req.session.legalForm  || {}; delete req.session.legalForm;
      res.send(page('Legale Einreise', `
        ${header('Legale Einreise — Ausweis Erstellung')}
        <div class="card">
          ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
          <form method="POST" action="/einreise/legal" enctype="multipart/form-data" id="legalForm">
            <p class="section-title">💬 Discord Nutzername</p>
            <div class="form-row one"><div class="form-group">
              <label>Discord Nutzername <span class="req">*</span></label>
              <input type="text" name="discord_username" value="${escHtml(legalForm.discord_username||'')}" placeholder="z.B. maxmustermann" required autocomplete="off">
              <small style="color:#e8a000;margin-top:6px;display:block">⚠️ Bitte gib deinen Nutzernamen korrekt an und achte auf Groß- und Kleinschreibung.</small>
            </div></div>
            <hr class="divider">
            <p class="section-title">📋 IC Charakter Daten</p>
            ${charFields('', 0, legalForm)}
            <hr class="divider">
            <p class="section-title">📷 Passbild</p>
            <div class="form-row one"><div class="form-group">
              <label>Passbild Hinzufügen <span class="req">*</span></label>
              <div class="file-box">
                <input type="file" name="foto" accept="image/*" required id="fotoInput">
                <div class="file-label"><span>📷</span>Passbild Hinzufügen<br><small style="color:#555">JPG / PNG — max. 8 MB</small></div>
                <div class="file-name"></div>
              </div>
            </div></div>
            <button type="submit" class="btn">✅ Einreise Bestätigen</button>
            ${warning()}
          </form>
        </div>
      `));
    });

    app.post('/einreise/legal', upload.single('foto'), async (req, res) => {
        const discordUsername = (req.body.discord_username || '').trim();
        function errBack(msg) { req.session.legalError = msg; req.session.legalForm = Object.assign({}, req.body); return res.redirect('/einreise/legal'); }
        if (!discordUsername) return errBack('Bitte gib deinen Discord Nutzernamen ein.');
        await (client.guilds.cache.first()?.members.fetch().catch(()=>{}));
        const _lMember = client.guilds.cache.first()?.members.cache.find(m => m.user.username === discordUsername || m.user.tag === discordUsername || m.displayName === discordUsername);
        if (!_lMember) return errBack(`Kein Mitglied mit dem Namen "${escHtml(discordUsername)}" gefunden. Bitte achte auf Groß- und Kleinschreibung.`);
        const discordId = _lMember.id;
        const v = await validateApplicant(discordId);
        if (!v.ok) return errBack(v.reason);
      const { vorname_0, nachname_0, geburtsdatum_0, geburtsort_0, nationalitaet_0 } = req.body;
      const geschlecht_0 = (req.body.geschlecht_0 || '').trim();
      const psn_0 = (req.body.psn_0 || '').trim();
      if (!req.file) return errBack('Kein Passbild hochgeladen.');
      if (!vorname_0 || !nachname_0 || !geburtsdatum_0 || !geburtsort_0 || !nationalitaet_0 || !psn_0) return errBack('Bitte alle Pflichtfelder ausfüllen.');
      if (!geschlecht_0 || !['Männlich','Weiblich'].includes(geschlecht_0)) return errBack('Bitte wähle ein Geschlecht aus.');
      const _existA = loadAusweis();
      if (_existA[discordId]) return errBack('Dieser Spieler hat bereits einen Ausweis.');
      try { const ext = req.file.mimetype.includes('png')?'png':req.file.mimetype.includes('webp')?'webp':'jpg'; fs.writeFileSync(path.join(DATA_DIR,'uploads',discordId+'.'+ext), req.file.buffer); } catch {}
      const ausweis = loadAusweis();
      ausweis[discordId] = { vorname: vorname_0, nachname: nachname_0, geburtsdatum: geburtsdatum_0, geburtsort: geburtsort_0, nationalitaet: nationalitaet_0, psn: psn_0, geschlecht: geschlecht_0, createdAt: new Date().toISOString() };
      saveAusweis(ausweis);
      try {
        const _kf=path.join(DATA_DIR,'konto.json'); const _tf=path.join(DATA_DIR,'transaktionen.json');
        let _k={}; try{_k=JSON.parse(fs.readFileSync(_kf,'utf8'));}catch{}
        if(!_k[discordId]) _k[discordId]={konto:0,schwarz:0};
        if(!_k[discordId]._startgeld){_k[discordId].konto+=5000;_k[discordId]._startgeld=true;fs.writeFileSync(_kf,JSON.stringify(_k,null,2));
          let _t={}; try{_t=JSON.parse(fs.readFileSync(_tf,'utf8'));}catch{} if(!_t[discordId])_t[discordId]=[];
          _t[discordId].unshift({ts:Date.now(),text:'+5.000 $ Startgeld (Legale Einreise)',betrag:5000}); fs.writeFileSync(_tf,JSON.stringify(_t,null,2));}
      } catch {}
      res.send(page('Einreise Erfolgreich', `
        ${header('Einreise Bestätigt')}
        <div class="card"><div class="success-wrap">
          <div class="icon">✅</div>
          <h2>Legale Einreise Bestätigt!</h2>
          <p>Charakter <strong>${vorname_0} ${nachname_0}</strong> wurde eingetragen. 5.000 $ Startgeld wurden gutgeschrieben.</p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div></div>
      `));
      setImmediate(async () => {
        try {
          const guild  = client.guilds.cache.first();
          const member = guild ? await guild.members.fetch(discordId).catch(()=>null) : null;
          if (member) {
            await member.roles.remove(ROLE_REMOVE).catch(()=>{});
            for (const r of [...ROLES_ALL, ...ROLES_LEGAL]) await member.roles.add(r).catch(()=>{});
            await member.setNickname(`${vorname_0} ${nachname_0} | ${psn_0}`).catch(()=>{});
          }
        } catch {}
      });
    });


  
    // ── GET /einreise/discord-id-help — Discord ID per DM anfragen ───────────
    app.get('/einreise/discord-id-help', (req, res) => {
      const error = req.session.didHelpErr || ''; delete req.session.didHelpErr;
      const done  = req.session.didHelpOk  || false; delete req.session.didHelpOk;
      res.send(page('Discord ID per DM', `
        ${header('Discord ID per DM erhalten')}
        <div class="card">
          ${done ? `<div class="success-wrap"><div class="icon">📬</div><h2 style="color:#ffd180">DM gesendet!</h2><p>Schau in deine Discord-DMs — wir haben dir deine ID geschickt.</p></div>` : `
            ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
            <form method="POST" action="/einreise/discord-id-help">
              <p class="section-title">Discord Benutzername eingeben</p>
              <div class="form-row one"><div class="form-group">
                <label>Dein Discord Benutzername <span class="req">*</span></label>
                <input type="text" name="username" placeholder="z.B. meinname oder meinname#1234" required autofocus>
                <small style="color:#aaa">Nur den Nutzernamen eingeben — kein @</small>
              </div></div>
              <button type="submit" class="btn" style="margin-top:14px">📨 ID per DM senden</button>
            </form>
          `}
        </div>
      `));
    });

    // ── POST /einreise/discord-id-help ───────────────────────────────────────
    app.post('/einreise/discord-id-help', async (req, res) => {
      const username = (req.body.username || '').trim().toLowerCase().replace(/^@/, '');
      if (!username) { req.session.didHelpErr = 'Bitte gib deinen Discord Nutzernamen ein.'; return res.redirect('/einreise/discord-id-help'); }
      try {
        const guild = client.guilds.cache.first();
        if (!guild) throw new Error('Server nicht gefunden');
        await guild.members.fetch();
        const member = guild.members.cache.find(m =>
          m.user.username.toLowerCase() === username ||
          m.user.tag.toLowerCase() === username ||
          m.displayName.toLowerCase() === username
        );
        if (!member) { req.session.didHelpErr = `Kein Mitglied mit dem Namen "${escHtml(username)}" gefunden. Prüfe die Schreibweise.`; return res.redirect('/einreise/discord-id-help'); }
        await member.send({ embeds: [{
          color: 0xE65100,
          title: '🆔  Deine Discord ID',
          description: `Hier ist deine Discord ID für die Einreise-Seite:\n\n\`${member.id}\`\n\nKopiere sie und trage sie im Formular ein.`,
          footer: { text: 'Paradise City Roleplay  •  Einreise' },
          timestamp: new Date().toISOString(),
        }]});
        req.session.didHelpOk = true;
        res.redirect('/einreise/discord-id-help');
      } catch (e) {
        const msg = e.message?.includes('Cannot send') ? 'Deine Discord-DMs sind deaktiviert. Aktiviere DMs von Servermitgliedern und versuche es erneut.' : 'Fehler beim Senden der DM. Wende dich ans Team.';
        req.session.didHelpErr = msg;
        res.redirect('/einreise/discord-id-help');
      }
    });

    // ── GET /einreise/anfordern/:userId — Token generieren & DM senden ────────
    app.get('/einreise/anfordern/:userId', async (req, res) => {
      const userId = req.params.userId;
      // Cooldown: nicht mehrfach innerhalb von 15 Min anfordern
      const toks  = loadEinreiseTokens();
      const now   = Date.now();
      const existing = Object.values(toks).find(e => e.userId === userId && e.art === 'einreise' && e.expiresAt > now);
      if (existing) {
        const minLeft = Math.ceil((existing.expiresAt - now) / 60000);
        return res.send(page('Link bereits aktiv', `${header('Link bereits aktiv')}<div class="card"><div class="success-wrap"><div class="icon">⏳</div><h2 style="color:#ffd180">Schau in deine DMs!</h2><p>Du hast bereits einen aktiven Einreise-Link. Schau in deine Discord-DMs.</p><p style="margin-top:10px;color:#aaa;font-size:.82em">Noch gültig: ca. ${minLeft} Minute${minLeft === 1 ? '' : 'n'}</p></div></div>`));
      }
      // Token generieren (15 Min)
      const tok  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const domain = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const link = `https://${domain}/einreise/start/${tok}`;
      toks[tok] = { token: tok, userId, art: 'einreise', expiresAt: now + 15 * 60 * 1000 };
      saveEinreiseTokens(toks);
      // DM via Discord senden
      try {
        const dmUser = await client.users.fetch(userId);
        await dmUser.send({ embeds: [{
          color: 0xE65100,
          title: '🎭  Dein persönlicher Einreise-Link',
          description: `Klicke auf den Link unten um deinen Charakter zu erstellen.\n\nDieser Link ist **15 Minuten** gültig und nur für dich persönlich.`,
          fields: [{ name: '👉  Einreise starten', value: `[${link}](${link})`, inline: false }],
          footer: { text: 'Paradise City Roleplay  •  Einreise' },
          timestamp: new Date().toISOString(),
        }]});
        res.send(page('DM gesendet', `${header('DM gesendet')}<div class="card"><div class="success-wrap"><div class="icon">📬</div><h2 style="color:#ffd180">Schau in deine DMs!</h2><p>Wir haben dir einen persönlichen Einreise-Link per Discord-DM geschickt.<br>Öffne deine DMs und klicke auf den Link. Er ist <strong>15 Minuten</strong> gültig.</p></div></div>`));
      } catch {
        res.send(page('DM fehlgeschlagen', `${header('DM fehlgeschlagen')}<div class="card"><div class="error-box">⚠️ Deine Discord-DMs sind deaktiviert. Bitte aktiviere DMs von Servermitgliedern und versuche es erneut.<br><br><a href="/einreise/anfordern/${userId}" class="btn" style="display:inline-block;margin-top:10px">🔄 Erneut versuchen</a></div></div>`));
      }
    });

    // ── GET /einreise/start/:token — Auswahl Legal/Illegal ──────────────────────
    app.get('/einreise/start/:token', (req, res) => {
      const toks  = loadEinreiseTokens();
      const entry = toks[req.params.token];
      if (!entry || entry.expiresAt < Date.now()) {
        return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><div class="error-box">⚠️ Dieser Link ist ungültig oder abgelaufen. Wende dich ans Team.</div></div>`));
      }
      const tok = req.params.token;
      res.send(page('Einreise — Auswahl', `
        ${header('Einreise — Bitte wählen')}
        <div class="card">
          <p class="section-title">Einreiseweg wählen</p>
          <div class="select-grid">
            <a class="select-card" href="/einreise/legal/${tok}">
              <div class="sc-icon">🟢</div>
              <div class="sc-title">Legale Einreise</div>
              <div class="sc-desc">Du reist offiziell ein. Du erhältst einen Ausweis, darfst staatliche Jobs ausführen und startest mit 5.000 $ auf dem Konto.</div>
            </a>
            <a class="select-card" href="/einreise/illegal/${tok}">
              <div class="sc-icon">🔴</div>
              <div class="sc-title">Illegale Einreise</div>
              <div class="sc-desc">Du reist ohne Registrierung ein. Kein Ausweis, keine staatlichen Jobs. Du startest mit 5.000 $ Schwarzgeld — bleib unter dem Radar.</div>
            </a>
          </div>
        </div>
      `));
    });

    // ── GET /einreise/legal/:token ───────────────────────────────────────────────
  app.get('/einreise/legal/:token', (req, res) => {
    const toks = loadEinreiseTokens();
    const entry = toks[req.params.token];
    if (!entry || !['legal','einreise'].includes(entry.art) || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><div class="error-box">⚠️ Dieser Link ist ungültig oder abgelaufen. Bitte wende dich ans Team.</div></div>`));
    }
    const error = req.session['legalError_'+entry.userId] || ''; delete req.session['legalError_'+entry.userId];
    const legalForm = req.session['legalForm_'+entry.userId] || {}; delete req.session['legalForm_'+entry.userId];
    res.send(page('Legale Einreise', `
      ${header('Legale Einreise — Ausweis Erstellung')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/einreise/legal/${req.params.token}" enctype="multipart/form-data" id="legalForm">
          <p class="section-title">📋 IC Charakter Daten</p>
          ${charFields('', 0, legalForm)}
          <hr class="divider">
          <p class="section-title">📷 Passbild</p>
          <div class="form-row one"><div class="form-group">
            <label>Passbild Hinzufügen <span class="req">*</span></label>
            <div class="file-box">
              <input type="file" name="foto" accept="image/*" required id="fotoInput">
              <div class="file-label"><span>📷</span>Passbild Hinzufügen<br><small style="color:#555">JPG / PNG — max. 8 MB</small></div>
              <div class="file-name"></div>
            </div>
          </div></div>
          <button type="submit" class="btn">✅ Einreise Bestätigen</button>
          ${warning()}
        </form>
      </div>
    `));
  });

  // ── POST /einreise/legal ──────────────────────────────────────────────────
  // ── POST /einreise/legal/:token ─────────────────────────────────────────────
  app.post('/einreise/legal/:token', upload.single('foto'), async (req, res) => {
    const toks = loadEinreiseTokens();
    const entry = toks[req.params.token];
    const tok = req.params.token;
    if (!entry || entry.art !== 'legal' || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><div class="error-box">⚠️ Dieser Link ist ungültig oder abgelaufen.</div></div>`));
    }
    const discordId = entry.userId;
    const uid = entry.userId;
    function errBack(msg) {
      req.session['legalError_'+uid] = msg;
      req.session['legalForm_'+uid]  = Object.assign({}, req.body);
      return res.redirect('/einreise/legal/'+tok);
    }
    const { vorname_0, nachname_0, geburtsdatum_0, geburtsort_0, nationalitaet_0 } = req.body;
    const geschlecht_0 = (req.body.geschlecht_0 || '').trim();
    const psn_0 = (req.body.psn_0 || '').trim();
    if (!req.file) return errBack('Kein Passbild hochgeladen. Bitte füge ein Bild hinzu.');
    if (!vorname_0 || !nachname_0 || !geburtsdatum_0 || !geburtsort_0 || !nationalitaet_0 || !psn_0) return errBack('Bitte alle Pflichtfelder ausfüllen.');
    if (!geschlecht_0 || !['Männlich','Weiblich'].includes(geschlecht_0)) return errBack('Bitte wähle ein Geschlecht aus.');
    const _existA = loadAusweis();
    if (_existA[discordId]) return errBack('Du hast bereits einen Ausweis. Wende dich ans Team.');
    // Passbild speichern
    try { const ext = req.file.mimetype.includes('png')?'png':req.file.mimetype.includes('webp')?'webp':'jpg'; fs.writeFileSync(path.join(DATA_DIR,'uploads',discordId+'.'+ext), req.file.buffer); } catch {}
    // Ausweis speichern
    const ausweis = loadAusweis();
    ausweis[discordId] = { vorname: vorname_0, nachname: nachname_0, geburtsdatum: geburtsdatum_0, geburtsort: geburtsort_0, nationalitaet: nationalitaet_0, psn: psn_0, geschlecht: geschlecht_0, createdAt: new Date().toISOString() };
    saveAusweis(ausweis);
    // Startgeld (einmalig)
    try {
      const _kf=path.join(DATA_DIR,'konto.json'); const _tf=path.join(DATA_DIR,'transaktionen.json');
      let _k={}; try{_k=JSON.parse(fs.readFileSync(_kf,'utf8'));}catch{}
      if(!_k[discordId]) _k[discordId]={konto:0,schwarz:0};
      if(!_k[discordId]._startgeld){_k[discordId].konto+=5000;_k[discordId]._startgeld=true;fs.writeFileSync(_kf,JSON.stringify(_k,null,2));
        let _t={}; try{_t=JSON.parse(fs.readFileSync(_tf,'utf8'));}catch{} if(!_t[discordId])_t[discordId]=[];
        _t[discordId].unshift({ts:Date.now(),text:'+5.000 $ Startgeld (Legale Einreise)',betrag:5000}); fs.writeFileSync(_tf,JSON.stringify(_t,null,2));}
    } catch {}
    // Token verbrauchen
    delete toks[tok]; saveEinreiseTokens(toks);
    // Antwort SOFORT senden — Rollen im Hintergrund vergeben
    res.send(page('Einreise Erfolgreich', `
      ${header('Einreise Bestätigt')}
      <div class="card"><div class="success-wrap">
        <div class="icon">✅</div>
        <h2>Legale Einreise Bestätigt!</h2>
        <p>Willkommen in Paradise City, <strong>${vorname_0} ${nachname_0}</strong>!<br>
        Dein Charakter wurde offiziell registriert. Du hast nun Zugriff auf alle legalen Aktivitäten.</p>
        <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
      </div></div>
    `));
    // Rollen + Nickname im Hintergrund (kein await vor res.send)
    setImmediate(async () => {
      try {
        const guild  = client.guilds.cache.first();
        const member = guild ? await guild.members.fetch(discordId).catch(()=>null) : null;
        if (member) {
          await member.roles.remove(ROLE_REMOVE).catch(()=>{});
          for (const r of [...ROLES_ALL, ...ROLES_LEGAL]) await member.roles.add(r).catch(()=>{});
          await member.setNickname(`${vorname_0} ${nachname_0} | ${psn_0}`).catch(()=>{});
        }
      } catch {}
    });
  });

  // ── GET /einreise/illegal ─────────────────────────────────────────────────
  // ── GET /einreise/illegal (backward compat) ───────────────────────────────
  app.get('/einreise/illegal', (req, res) => {
      const error  = req.session.illError || ''; delete req.session.illError;
      const illForm = req.session.illForm  || {}; delete req.session.illForm;
      res.send(page('Illegale Einreise', `
        ${header('Illegale Einreise')}
        <div class="card">
          ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
          <form method="POST" action="/einreise/illegal" id="illegalForm">
            <p class="section-title">💬 Discord Nutzername</p>
            <div class="form-row one"><div class="form-group">
              <label>Discord Nutzername <span class="req">*</span></label>
              <input type="text" name="discord_username" value="${escHtml(illForm.discord_username||'')}" placeholder="z.B. maxmustermann" required autocomplete="off">
              <small style="color:#e8a000;margin-top:6px;display:block">⚠️ Bitte gib deinen Nutzernamen korrekt an und achte auf Groß- und Kleinschreibung.</small>
            </div></div>
            <hr class="divider">
            <p class="section-title">🎭 Charakter Name</p>
            <div class="form-row">
              <div class="form-group">
                <label>Vorname <span class="req">*</span></label>
                <input type="text" name="vorname" value="${escHtml(illForm.vorname||'')}" placeholder="Vorname" required>
              </div>
              <div class="form-group">
                <label>Nachname <span class="req">*</span></label>
                <input type="text" name="nachname" value="${escHtml(illForm.nachname||'')}" placeholder="Nachname" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>PSN Name <span class="req">*</span></label>
                <input type="text" name="psn" value="${escHtml(illForm.psn||'')}" placeholder="dein_psn_name" required>
              </div>
              <div class="form-group">
                <label>Geschlecht <span class="req">*</span></label>
                <select name="geschlecht" required>
                  <option value="" disabled selected>Bitte wählen</option>
                  <option value="Männlich" ${illForm.geschlecht==='Männlich'?'selected':''}>Männlich</option>
                  <option value="Weiblich" ${illForm.geschlecht==='Weiblich'?'selected':''}>Weiblich</option>
                </select>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
              <input type="checkbox" id="confirm" name="confirm" value="1" required style="width:18px;height:18px;accent-color:#e65100;cursor:pointer;flex-shrink:0">
              <label for="confirm" style="color:#e0e0e0;font-size:.88em;cursor:pointer">Ich verstehe die Konsequenzen und möchte illegal einreisen.</label>
            </div>
            <button type="submit" class="btn" style="background:#b71c1c">🚨 Jetzt Einreisen</button>
          </form>
        </div>
      `));
    });

    app.post('/einreise/illegal', async (req, res) => {
        const discordUsername = (req.body.discord_username || '').trim();
        function errBack(msg) { req.session.illError = msg; req.session.illForm = Object.assign({}, req.body); return res.redirect('/einreise/illegal'); }
        if (!discordUsername) return errBack('Bitte gib deinen Discord Nutzernamen ein.');
        await (client.guilds.cache.first()?.members.fetch().catch(()=>{}));
        const _iMember = client.guilds.cache.first()?.members.cache.find(m => m.user.username === discordUsername || m.user.tag === discordUsername || m.displayName === discordUsername);
        if (!_iMember) return errBack(`Kein Mitglied mit dem Namen "${escHtml(discordUsername)}" gefunden. Bitte achte auf Groß- und Kleinschreibung.`);
        const discordId = _iMember.id;
        const v = await validateApplicant(discordId);
        if (!v.ok) return errBack(v.reason);
      const { confirm, vorname: ill_vor, nachname: ill_nach, psn: ill_psn, geschlecht: ill_geschlecht } = req.body;
      if (!confirm) return errBack('Du musst die Konsequenzen bestätigen.');
      const illVor = (ill_vor||'').trim(), illNach = (ill_nach||'').trim(), illPsn = (ill_psn||'').trim(), illGeschlecht = (ill_geschlecht||'').trim();
      if (!illVor || !illNach) return errBack('Bitte gib deinen Charakter Vor- und Nachnamen an.');
      if (!illPsn) return errBack('Bitte gib deinen PSN Namen an.');
      if (!illGeschlecht || !['Männlich','Weiblich'].includes(illGeschlecht)) return errBack('Bitte wähle ein Geschlecht aus.');
      const _existA = loadAusweis();
      if (_existA[discordId]) return errBack('Dieser Spieler hat bereits einen Ausweis.');
      const illAusweis = loadAusweis();
      illAusweis[discordId] = { vorname: illVor, nachname: illNach, psn: illPsn, geschlecht: illGeschlecht, typ: 'illegal', createdAt: new Date().toISOString() };
      saveAusweis(illAusweis);
      try {
        const _kf=path.join(DATA_DIR,'konto.json'); const _tf=path.join(DATA_DIR,'transaktionen.json');
        let _k={}; try{_k=JSON.parse(fs.readFileSync(_kf,'utf8'));}catch{}
        if(!_k[discordId]) _k[discordId]={konto:0,schwarz:0};
        if(!_k[discordId]._startgeld){_k[discordId].schwarz+=5000;_k[discordId]._startgeld=true;fs.writeFileSync(_kf,JSON.stringify(_k,null,2));
          let _t={}; try{_t=JSON.parse(fs.readFileSync(_tf,'utf8'));}catch{} if(!_t[discordId])_t[discordId]=[];
          _t[discordId].unshift({ts:Date.now(),text:'+5.000 $ Startgeld (Illegale Einreise)',betrag:5000}); fs.writeFileSync(_tf,JSON.stringify(_t,null,2));}
      } catch {}
      res.send(page('Einreise Erfolgreich', `
        ${header('Einreise Bestätigt')}
        <div class="card"><div class="success-wrap">
          <div class="icon">⚠️</div>
          <h2 style="color:#f85149">Illegale Einreise Bestätigt</h2>
          <p>Du bist nun illegal in Paradise City. Bleib unter dem Radar — und pass auf dich auf.<br>5.000 $ Schwarzgeld wurden gutgeschrieben.</p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div></div>
      `));
      setImmediate(async () => {
        try {
          const guild  = client.guilds.cache.first();
          const member = guild ? await guild.members.fetch(discordId).catch(()=>null) : null;
          if (member) {
            await member.roles.remove(ROLE_REMOVE).catch(()=>{});
            for (const r of [...ROLES_ALL, ...ROLES_ILLEGAL]) await member.roles.add(r).catch(()=>{});
            await member.setNickname(`${illVor} ${illNach} | ${illPsn}`).catch(()=>{});
          }
        } catch {}
      });
    });

  // ── GET /einreise/illegal/:token ─────────────────────────────────────────────
  app.get('/einreise/illegal/:token', (req, res) => {
    const toks = loadEinreiseTokens();
    const entry = toks[req.params.token];
    if (!entry || !['illegal','einreise'].includes(entry.art) || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><div class="error-box">⚠️ Dieser Link ist ungültig oder abgelaufen. Bitte wende dich ans Team.</div></div>`));
    }
    const uid = entry.userId;
    const error = req.session['illError_'+uid] || ''; delete req.session['illError_'+uid];
    const illForm = req.session['illForm_'+uid] || {}; delete req.session['illForm_'+uid];
    res.send(page('Illegale Einreise', `
      ${header('Illegale Einreise')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/einreise/illegal/${req.params.token}" id="illegalForm">
          <p class="section-title">🎭 Charakter Name</p>
          <div class="form-row">
            <div class="form-group">
              <label>Vorname <span class="req">*</span></label>
              <input type="text" name="vorname" value="${escHtml(illForm.vorname||'')}" placeholder="Vorname" required>
            </div>
            <div class="form-group">
              <label>Nachname <span class="req">*</span></label>
              <input type="text" name="nachname" value="${escHtml(illForm.nachname||'')}" placeholder="Nachname" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>PSN Name <span class="req">*</span></label>
              <input type="text" name="psn" value="${escHtml(illForm.psn||'')}" placeholder="dein_psn_name" required>
            </div>
            <div class="form-group">
              <label>Geschlecht <span class="req">*</span></label>
              <select name="geschlecht" required>
                <option value="" disabled selected>Bitte wählen</option>
                <option value="Männlich" ${illForm.geschlecht==='Männlich'?'selected':''}>Männlich</option>
                <option value="Weiblich" ${illForm.geschlecht==='Weiblich'?'selected':''}>Weiblich</option>
              </select>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:14px">
            <input type="checkbox" id="confirm" name="confirm" value="1" required style="width:18px;height:18px;accent-color:#e65100;cursor:pointer;flex-shrink:0">
            <label for="confirm" style="color:#e0e0e0;font-size:.88em;cursor:pointer">Ich verstehe die Konsequenzen und möchte illegal einreisen.</label>
          </div>
          <button type="submit" class="btn" style="background:#b71c1c">🚨 Jetzt Einreisen</button>
        </form>
      </div>
    `));
  });

  // ── POST /einreise/illegal ────────────────────────────────────────────────
  // ── POST /einreise/illegal/:token ────────────────────────────────────────────
  app.post('/einreise/illegal/:token', async (req, res) => {
    const toks = loadEinreiseTokens();
    const entry = toks[req.params.token];
    const tok = req.params.token;
    if (!entry || entry.art !== 'illegal' || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><div class="error-box">⚠️ Dieser Link ist ungültig oder abgelaufen.</div></div>`));
    }
    const discordId = entry.userId;
    const uid = entry.userId;
    function errBack(msg) {
      req.session['illError_'+uid] = msg;
      req.session['illForm_'+uid]  = Object.assign({}, req.body);
      return res.redirect('/einreise/illegal/'+tok);
    }
    const { confirm, vorname: ill_vor, nachname: ill_nach, psn: ill_psn, geschlecht: ill_geschlecht } = req.body;
    if (!confirm) return errBack('Du musst die Konsequenzen bestätigen.');
    const illVor  = (ill_vor  || '').trim();
    const illNach = (ill_nach || '').trim();
    const illPsn  = (ill_psn  || '').trim();
    const illGeschlecht = (ill_geschlecht || '').trim();
    if (!illVor || !illNach) return errBack('Bitte gib deinen Charakter Vor- und Nachnamen an.');
    if (!illPsn) return errBack('Bitte gib deinen PSN Namen an.');
    if (!illGeschlecht || !['Männlich','Weiblich'].includes(illGeschlecht)) return errBack('Bitte wähle ein Geschlecht aus.');
    const _existA = loadAusweis();
    if (_existA[discordId]) return errBack('Du hast bereits einen Ausweis. Wende dich ans Team.');
    // Ausweis speichern
    const illAusweis = loadAusweis();
    illAusweis[discordId] = { vorname: illVor, nachname: illNach, psn: illPsn, geschlecht: illGeschlecht, typ: 'illegal', createdAt: new Date().toISOString() };
    saveAusweis(illAusweis);
    // Startgeld (einmalig, Schwarzgeld)
    try {
      const _kf=path.join(DATA_DIR,'konto.json'); const _tf=path.join(DATA_DIR,'transaktionen.json');
      let _k={}; try{_k=JSON.parse(fs.readFileSync(_kf,'utf8'));}catch{}
      if(!_k[discordId]) _k[discordId]={konto:0,schwarz:0};
      if(!_k[discordId]._startgeld){_k[discordId].schwarz+=5000;_k[discordId]._startgeld=true;fs.writeFileSync(_kf,JSON.stringify(_k,null,2));
        let _t={}; try{_t=JSON.parse(fs.readFileSync(_tf,'utf8'));}catch{} if(!_t[discordId])_t[discordId]=[];
        _t[discordId].unshift({ts:Date.now(),text:'+5.000 $ Startgeld (Illegale Einreise)',betrag:5000}); fs.writeFileSync(_tf,JSON.stringify(_t,null,2));}
    } catch {}
    // Token verbrauchen
    delete toks[tok]; saveEinreiseTokens(toks);
    // Antwort SOFORT senden
    res.send(page('Einreise Erfolgreich', `
      ${header('Einreise Bestätigt')}
      <div class="card"><div class="success-wrap">
        <div class="icon">⚠️</div>
        <h2 style="color:#f85149">Illegale Einreise Bestätigt</h2>
        <p>Du bist nun illegal in Paradise City.<br>Bleib unter dem Radar — und pass auf dich auf.</p>
        <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
      </div></div>
    `));
    // Rollen + Nickname im Hintergrund
    setImmediate(async () => {
      try {
        const guild  = client.guilds.cache.first();
        const member = guild ? await guild.members.fetch(discordId).catch(()=>null) : null;
        if (member) {
          await member.roles.remove(ROLE_REMOVE).catch(()=>{});
          for (const r of [...ROLES_ALL, ...ROLES_ILLEGAL]) await member.roles.add(r).catch(()=>{});
          await member.setNickname(`${illVor} ${illNach} | ${illPsn}`).catch(()=>{});
        }
      } catch {}
    });
  });

  // ── GET /einreise/gruppe ──────────────────────────────────────────────────
  app.get('/einreise/gruppe', (req, res) => {
    const error = req.session.gruppeError || '';
    delete req.session.gruppeError;

    let personBlocks = '';
    for (let i = 0; i < 4; i++) {
      personBlocks += `
        <div class="person-block">
          <div class="person-head">👤 Person ${i + 1}${i === 0 ? ' (Du)' : ''}</div>
          <div class="form-row one">
              <div class="form-group">
                <label>Discord Nutzername <span class="req">*</span></label>
                <input type="text" name="discord_username_${i}" placeholder="z.B. maxmustermann" required autocomplete="off">
                <small style="color:#e8a000;margin-top:6px;display:block">⚠️ Bitte gib den Nutzernamen korrekt an und achte auf Groß- und Kleinschreibung.</small>
              </div>
            </div>
          <div class="char-name hidden" id="char_name_${i}">
              <hr class="divider" style="margin:10px 0">
              <p style="color:#ffd180;font-size:.78em;margin-bottom:12px">🎭 Charakter Name</p>
              <div class="form-row two">
                <div class="form-group">
                  <label>Vorname <span class="req">*</span></label>
                  <input type="text" name="g_ill_vorname_${i}" placeholder="Vorname">
                </div>
                <div class="form-group">
                  <label>Nachname <span class="req">*</span></label>
                  <input type="text" name="g_ill_nachname_${i}" placeholder="Nachname">
                </div>
              </div>
              <div class="form-row one">
                <div class="form-group">
                  <label>PSN Name <span class="req">*</span></label>
                  <input type="text" name="g_ill_psn_${i}" placeholder="dein_psn_name">
                </div>
              </div>
            </div>
            <div class="char-data hidden" id="char_${i}">
            <hr class="divider" style="margin:10px 0">
            <p style="color:#ffd180;font-size:.78em;margin-bottom:12px">📋 IC Charakter Daten</p>
            ${charFields('g_', i)}
            <div class="form-row one" style="margin-top:12px">
              <div class="form-group">
                <label>Passbild <span class="req">*</span></label>
                <div class="file-box">
                  <input type="file" name="foto_${i}" accept="image/*" class="gruppe-foto">
                  <div class="file-label"><span>📷</span>Passbild Hinzufügen<br><small style="color:#555">JPG / PNG — max. 8 MB</small></div>
                  <div class="file-name"></div>
                </div>
              </div>
            </div>
          </div>
        </div>`;
    }

    res.send(page('Gruppen Einreise', `
      ${header('Gruppen Einreise — Ab 4 Personen')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/einreise/gruppe" enctype="multipart/form-data" id="gruppeForm">

          <p class="section-title">⚙️ Einreiseart der Gruppe</p>
          <div class="toggle-group">
            <button type="button" class="toggle-btn" id="btn_legal" onclick="setMode('legal')">🟢 Legale Einreise</button>
            <button type="button" class="toggle-btn" id="btn_illegal" onclick="setMode('illegal')">🔴 Illegale Einreise</button>
          </div>
          <input type="hidden" name="gruppe_mode" id="gruppe_mode" value="" required>

          <p class="section-title">👥 Gruppen-Mitglieder (4 Personen)</p>
          ${personBlocks}

          <button type="submit" class="btn" id="submitBtn" disabled>✅ Gruppen-Einreise Bestätigen</button>
          ${warning()}
        </form>
      </div>
      <script>
        function setMode(mode) {
          document.getElementById('gruppe_mode').value = mode;
          document.getElementById('btn_legal').classList.toggle('active', mode === 'legal');
          document.getElementById('btn_illegal').classList.toggle('active', mode === 'illegal');
          document.getElementById('submitBtn').disabled = false;
          for (let i = 0; i < 4; i++) {
            const cd = document.getElementById('char_' + i);
            if (cd) cd.classList.toggle('hidden', mode !== 'legal');
              const cn = document.getElementById('char_name_' + i);
              if (cn) cn.classList.toggle('hidden', mode !== 'illegal');
            const fotos = document.querySelectorAll('.gruppe-foto');
            fotos.forEach(f => { f.required = mode === 'legal'; });
          }
          document.querySelectorAll('[name^="g_ill_vorname"]').forEach(f => f.required = mode === 'illegal');
            document.querySelectorAll('[name^="g_ill_nachname"]').forEach(f => f.required = mode === 'illegal');
          document.querySelectorAll('[name^="g_ill_psn"]').forEach(f => f.required = mode === 'illegal');
            document.querySelectorAll('[name^="g_vorname"]').forEach(f => f.required = mode === 'legal');
          document.querySelectorAll('[name^="g_nachname"]').forEach(f => f.required = mode === 'legal');
          document.querySelectorAll('[name^="g_geburtsdatum"]').forEach(f => f.required = mode === 'legal');
          document.querySelectorAll('[name^="g_geburtsort"]').forEach(f => f.required = mode === 'legal');
          document.querySelectorAll('[name^="g_nationalitaet"]').forEach(f => f.required = mode === 'legal');
        }

        document.querySelectorAll('.file-box input[type=file]').forEach(inp => {
          inp.addEventListener('change', function() {
            const n = this.files[0]?.name;
            const el = this.closest('.file-box').querySelector('.file-name');
            if (el && n) { el.textContent = '📎 ' + n; el.style.display = 'block'; }
          });
        });
              // Standard: Legale Einreise vorausgewählt
          setMode('legal');
        </script>
    `));
  });

  // ── POST /einreise/gruppe ─────────────────────────────────────────────────
  const gruppeFields = [];
  for (let i = 0; i < 4; i++) gruppeFields.push({ name: `foto_${i}`, maxCount: 1 });

  app.post('/einreise/gruppe', upload.fields(gruppeFields), async (req, res) => {
    const { gruppe_mode } = req.body;
    if (!gruppe_mode) { req.session.gruppeError = 'Bitte wähle eine Einreiseart (Legal/Illegal).'; return res.redirect('/einreise/gruppe'); }

    const isLegal = gruppe_mode === 'legal';
    const ids = [];
    const errors = [];

    await (client.guilds.cache.first()?.members.fetch().catch(()=>{}));
      for (let i = 0; i < 4; i++) {
        const uname = (req.body[`discord_username_${i}`] || '').trim();
        if (!uname) { errors.push(`Person ${i + 1}: Discord Nutzername fehlt.`); continue; }
        const _gm = client.guilds.cache.first()?.members.cache.find(m => m.user.username === uname || m.user.tag === uname || m.displayName === uname);
        if (!_gm) { errors.push(`Person ${i + 1}: Kein Mitglied "${uname}" gefunden. Achte auf Groß- und Kleinschreibung.`); continue; }
        const uid = _gm.id;
        if (ids.includes(uid)) { errors.push(`Person ${i + 1}: "${uname}" ist bereits in dieser Gruppe.`); continue; }
        ids.push(uid);
        const _existG = loadAusweis();
        if (_existG[uid]) { errors.push(`Person ${i + 1}: "${uname}" hat bereits einen Ausweis.`); continue; }
        const v = await validateApplicant(uid);
        if (!v.ok) { errors.push(`Person ${i + 1}: ${v.reason}`); }
      }

    if (isLegal) {
      for (let i = 0; i < 4; i++) {
        if (!req.body[`g_vorname_${i}`] || !req.body[`g_nachname_${i}`] || !req.body[`g_geburtsdatum_${i}`] || !req.body[`g_geburtsort_${i}`] || !req.body[`g_nationalitaet_${i}`])
          errors.push(`Person ${i + 1}: Charakter-Daten unvollständig.`);
        if (!req.files?.[`foto_${i}`]?.[0])
          errors.push(`Person ${i + 1}: Kein Passbild hochgeladen.`);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        if (!req.body[`g_ill_vorname_${i}`] || !req.body[`g_ill_nachname_${i}`])
          errors.push(`Person ${i + 1}: Charakter Name fehlt.`);
      }
    }

    if (errors.length > 0) {
      req.session.gruppeError = errors.join('<br>');
      return res.redirect('/einreise/gruppe');
    }

    const failed = [];
    for (let gi = 0; gi < ids.length; gi++) {
      const uid = ids[gi];
      const ok  = await applyRoles(uid, isLegal);
      if (!ok) { failed.push(uid); continue; }
        try {
          const _kf2=path.join(DATA_DIR,'konto.json'); const _tf2=path.join(DATA_DIR,'transaktionen.json');
          let _k2={}; try{_k2=JSON.parse(fs.readFileSync(_kf2,'utf8'));}catch{}
          if(!_k2[uid]) _k2[uid]={konto:0,schwarz:0};
          if(!_k2[uid]._startgeld){
            if(isLegal){_k2[uid].konto+=5000;}else{_k2[uid].schwarz+=5000;}
            _k2[uid]._startgeld=true; fs.writeFileSync(_kf2,JSON.stringify(_k2,null,2));
            let _t2={}; try{_t2=JSON.parse(fs.readFileSync(_tf2,'utf8'));}catch{} if(!_t2[uid])_t2[uid]=[];
            _t2[uid].unshift({ts:Date.now(),text:'+5.000 $ Startgeld (Gruppen-Einreise '+(isLegal?'Legal':'Illegal')+')',betrag:5000}); fs.writeFileSync(_tf2,JSON.stringify(_t2,null,2));
          }
        } catch {}
        const nick = isLegal
        ? (`${req.body[`g_vorname_${gi}`]||''} ${req.body[`g_nachname_${gi}`]||''} | ${req.body[`g_psn_${gi}`]||''}`).trim()
        : (`${req.body[`g_ill_vorname_${gi}`]||''} ${req.body[`g_ill_nachname_${gi}`]||''} | ${req.body[`g_ill_psn_${gi}`]||''}`).trim();
      const mem = await client.guilds.cache.first()?.members.fetch(uid).catch(() => null);
      if (mem && nick) await mem.setNickname(nick).catch(e => console.error('[Nickname] gruppe uid=' + uid + ':', e.message));
    }

    if (failed.length > 0) {
      req.session.gruppeError = `Rollen konnten für folgende IDs nicht vergeben werden: ${failed.join(', ')}. Wende dich an einen Admin.`;
      return res.redirect('/einreise/gruppe');
    }

    res.send(page('Gruppen-Einreise Erfolgreich', `
      ${header('Gruppen-Einreise Bestätigt')}
      <div class="card">
        <div class="success-wrap">
          <div class="icon">${isLegal ? '✅' : '⚠️'}</div>
          <h2 style="color:${isLegal ? '#3fb950' : '#f85149'}">Gruppen-Einreise Bestätigt!</h2>
          <p>Alle 4 Mitglieder wurden erfolgreich in Paradise City eingetragen.<br>
          Einreiseart: <strong>${isLegal ? 'Legal' : 'Illegal'}</strong></p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div>
      </div>
    `));
  });

  // ── GET /ausweis/photo/:userId — Passbild ausliefern ────────────────────────
    app.get('/ausweis/photo/:userId', (req, res) => {
      const uid  = req.params.userId;
      const exts = ['jpg','jpeg','png','webp'];
      for (const ext of exts) {
        const p = path.join(DATA_DIR, 'uploads', uid + '.' + ext);
        if (fs.existsSync(p)) return res.sendFile(p);
      }
      res.status(404).send('Kein Foto');
    });

    // ── GET /ausweis/view/:userId — Ausweis-Karte ────────────────────────────────
    app.get('/ausweis/view/:userId', (req, res) => {
      const uid     = req.params.userId;
      const ausweise = loadAusweis();
      const e       = ausweise[uid];
      if (!e) return res.status(404).send('Kein Ausweis gefunden.');
      const issued  = new Date(e.createdAt).toLocaleDateString('de-DE');
      const hasPhoto = ['jpg','jpeg','png','webp'].some(x => fs.existsSync(path.join(DATA_DIR,'uploads', uid+'.'+x)));
      res.send(`<!DOCTYPE html><html lang="de"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Ausweis — ${e.vorname} ${e.nachname}</title>
  <style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{width:100%;max-width:520px;background:linear-gradient(145deg,#111827,#1a2332);border-radius:18px;overflow:hidden;box-shadow:0 0 0 2px #c8a84b,0 20px 60px rgba(0,0,0,.8);position:relative}
  .card::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(200,168,75,.03) 10px,rgba(200,168,75,.03) 11px);pointer-events:none}
  .header{background:linear-gradient(135deg,#0f1f3d 0%,#1a3a6b 50%,#0f1f3d 100%);padding:18px 22px;display:flex;align-items:center;gap:14px;border-bottom:3px solid #c8a84b}
  .seal{width:54px;height:54px;border-radius:50%;background:radial-gradient(circle,#c8a84b,#8b6914);display:flex;align-items:center;justify-content:center;font-size:1.6em;flex-shrink:0;box-shadow:0 0 12px rgba(200,168,75,.5)}
  .header-text h1{color:#c8a84b;font-size:.72em;letter-spacing:3px;text-transform:uppercase;font-weight:700}
  .header-text h2{color:#e0e0e0;font-size:.85em;letter-spacing:1.5px;margin-top:3px;font-weight:400}
  .header-text h3{color:#a0b4c8;font-size:.7em;margin-top:2px;letter-spacing:1px}
  .body{display:flex;gap:0;padding:22px}
  .photo-col{flex-shrink:0;margin-right:20px}
  .photo{width:110px;height:140px;border-radius:8px;object-fit:cover;border:2px solid #c8a84b;box-shadow:0 4px 16px rgba(0,0,0,.5)}
  .photo-placeholder{width:110px;height:140px;border-radius:8px;background:#1e2a3a;border:2px dashed #3a4a5a;display:flex;align-items:center;justify-content:center;font-size:2.5em;color:#3a4a5a}
  .id-num{color:#c8a84b;font-size:.65em;margin-top:8px;text-align:center;letter-spacing:2px;font-weight:700}
  .data-col{flex:1;min-width:0}
  .field{margin-bottom:13px}
  .field-label{color:#a0b4c8;font-size:.6em;letter-spacing:2px;text-transform:uppercase;font-weight:700;margin-bottom:3px}
  .field-value{color:#f0f0f0;font-size:.95em;font-weight:600;border-bottom:1px solid rgba(200,168,75,.2);padding-bottom:5px}
  .name-big{color:#ffffff;font-size:1.2em;font-weight:800;letter-spacing:.5px;border-bottom:2px solid #c8a84b;padding-bottom:6px;margin-bottom:14px}
  .footer{background:#0f1f3d;padding:12px 22px;display:flex;justify-content:space-between;align-items:center;border-top:2px solid #c8a84b}
  .footer-text{color:#6a7a8a;font-size:.62em;letter-spacing:1.5px;text-transform:uppercase}
  .valid-badge{background:#c8a84b;color:#000;font-size:.6em;font-weight:800;padding:4px 10px;border-radius:4px;letter-spacing:2px}
  .watermark{position:absolute;right:-10px;top:50%;transform:translateY(-50%) rotate(-30deg);font-size:5em;color:rgba(200,168,75,.04);font-weight:900;letter-spacing:8px;pointer-events:none;user-select:none}
  </style></head><body>
  <div class="card">
    <div class="watermark">PARADISE CITY</div>
    <div class="header">
      <div class="seal">🏛️</div>
      <div class="header-text">
        <h1>Paradise City Roleplay</h1>
        <h2>Offizieller Personalausweis</h2>
        <h3>Los Angeles Einwohner Melde Amt</h3>
      </div>
    </div>
    <div class="body">
      <div class="photo-col">
        ${hasPhoto ? `<img class="photo" src="/ausweis/photo/${uid}" alt="Passbild">` : '<div class="photo-placeholder">👤</div>'}
        <div class="id-num">ID-${uid.slice(-6).toUpperCase()}</div>
      </div>
      <div class="data-col">
        <div class="name-big">${e.vorname} ${e.nachname}</div>
        <div class="field"><div class="field-label">Geburtsdatum</div><div class="field-value">${e.geburtsdatum}</div></div>
        <div class="field"><div class="field-label">Geburtsort</div><div class="field-value">${e.geburtsort}</div></div>
        <div class="field"><div class="field-label">Nationalität</div><div class="field-value">${e.nationalitaet}</div></div>
        <div class="field"><div class="field-label">Ausgestellt am</div><div class="field-value">${issued}</div></div>
      </div>
    </div>
    <div class="footer">
      <div class="footer-text">Paradise City • Offizielles Dokument</div>
      <div class="valid-badge">GüLTIG</div>
    </div>
  </div>
  </body></html>`);
    });

    // ── GET /ausweis/create/:token ──────────────────────────────────────────────
  app.get('/ausweis/create/:token', (req, res) => {
    const tokens = loadAusweisTokens();
    const entry  = tokens[req.params.token];
    if (!entry || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><p style="color:#f85149;text-align:center">Dieser Link ist ungültig oder abgelaufen.</p></div>`));
    }
    const error = req.session.ausweisError || ''; delete req.session.ausweisError;
    res.send(page('Ausweis erstellen', `
      ${header('Ausweis Erstellen')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/ausweis/create/${req.params.token}" enctype="multipart/form-data">
          <p class="section-title">Charakter-Daten</p>
          <div class="form-row two">
            <div class="form-group">
              <label>Vorname <span class="req">*</span></label>
              <input type="text" name="vorname" required placeholder="Max">
            </div>
            <div class="form-group">
              <label>Nachname <span class="req">*</span></label>
              <input type="text" name="nachname" required placeholder="Mustermann">
            </div>
          </div>
          <div class="form-row two">
            <div class="form-group">
              <label>Geburtsdatum <span class="req">*</span></label>
              <input type="text" name="geburtsdatum" required placeholder="TT.MM.JJJJ">
            </div>
            <div class="form-group">
              <label>Geburtsort <span class="req">*</span></label>
              <input type="text" name="geburtsort" required placeholder="Berlin">
            </div>
          </div>
          <div class="form-row one">
            <div class="form-group">
              <label>Nationalität <span class="req">*</span></label>
              <input type="text" name="nationalitaet" required placeholder="Deutsch">
            </div>
          </div>
          <div class="form-row one">
            <div class="form-group">
              <label>Passbild <span class="req">*</span></label>
              <input type="file" name="foto" accept="image/*" required>
            </div>
          </div>
          <button type="submit" class="btn">✅ Ausweis einreichen</button>
          ${warning()}
        </form>
      </div>
    `));
  });

  // ── POST /ausweis/create/:token ─────────────────────────────────────────────
  app.post('/ausweis/create/:token', upload.single('foto'), async (req, res) => {
    const tokens = loadAusweisTokens();
    const entry  = tokens[req.params.token];
    if (!entry || entry.expiresAt < Date.now()) {
      return res.send(page('Ungültiger Link', `${header('Ungültiger Link')}<div class="card"><p style="color:#f85149;text-align:center">Dieser Link ist ungültig oder abgelaufen.</p></div>`));
    }
    const { vorname, nachname, geburtsdatum, geburtsort, nationalitaet, psn: aw_psn } = req.body;
    if (!req.file) { req.session.ausweisError = 'Kein Passbild hochgeladen.'; return res.redirect(`/ausweis/create/${req.params.token}`); }
    if (!vorname || !nachname || !geburtsdatum || !geburtsort || !nationalitaet || !aw_psn) {
      req.session.ausweisError = 'Bitte alle Pflichtfelder ausfüllen.'; return res.redirect(`/ausweis/create/${req.params.token}`);
    }
    // Prüfe ob bereits ein Ausweis existiert
    const ausweise = loadAusweis();
    if (ausweise[entry.userId]) {
      // Existierender Ausweis wird überschrieben (Nickname wird immer aktualisiert)
    }
    // Passbild speichern
    try {
      const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('webp') ? 'webp' : 'jpg';
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', entry.userId + '.' + ext), req.file.buffer);
    } catch {}
    // Ausweis speichern (keine Rollenvergabe)
    ausweise[entry.userId] = { vorname, nachname, geburtsdatum, geburtsort, nationalitaet, psn: aw_psn, createdAt: new Date().toISOString(), createdBy: entry.createdBy };
    saveAusweis(ausweise);
    // Nickname setzen
    try {
      const guild9 = client.guilds.cache.first();
      const mem9   = guild9 ? await guild9.members.fetch(entry.userId).catch(() => null) : null;
      if (mem9) await mem9.setNickname(`${vorname} ${nachname} | ${aw_psn || ''}`).catch(e => console.error('[Nickname] ausweis:', e.message));
    } catch {}
    // Token verbrauchen
    delete tokens[req.params.token];
    saveAusweisTokens(tokens);
    res.send(page('Ausweis Erstellt', `
      ${header('Ausweis Erstellt')}
      <div class="card">
        <div class="success-wrap">
          <div class="icon">🆔</div>
          <h2>Ausweis erfolgreich erstellt!</h2>
          <p>Dein Charakter <strong>${vorname} ${nachname}</strong> wurde registriert.</p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div>
      </div>
    `));
  });


    // ─── RUBBELLOS SCRATCH CARD ──────────────────────────────────────────────────

    // Helper: cash + inventory access from web context
    (function() {
      const BARGELD_FILE  = path.join(DATA_DIR, 'bargeld.json');
      const INVENTAR_FILE = path.join(DATA_DIR, 'inventar.json');
      function _lb() { try { return JSON.parse(fs.readFileSync(BARGELD_FILE,'utf8')); } catch { return {}; } }
      function _sb(d) { fs.writeFileSync(BARGELD_FILE, JSON.stringify(d,null,2),'utf8'); }
      function _li() { try { return JSON.parse(fs.readFileSync(INVENTAR_FILE,'utf8')); } catch { return {}; } }
      function _si(d) { fs.writeFileSync(INVENTAR_FILE, JSON.stringify(d,null,2),'utf8'); }
      app._rCash   = uid => (_lb()[uid]||0);
      app._wCash   = (uid,amt) => { const d=_lb(); d[uid]=amt; _sb(d); };
      app._rInv    = uid => (_li()[uid]||{});
      app._wInv    = (uid,items) => { const d=_li(); d[uid]=items; _si(d); };
    })();

    // GET /rubbellos?token=XXX  — serves the scratch card page
    app.get('/rubbellos', (req, res) => {
      const entry = rubbellosTokens.get(req.query.token||'');
      if (!entry || entry.usedAt || entry.expiresAt < Date.now()) {
        return res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ungültig</title><style>body{background:#0d1117;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}</style></head><body><div style="font-size:3em">❌</div><h2 style="color:#f85149">Link ungültig oder abgelaufen</h2><p style="color:#8b949e">Bitte löse das Rubbellos erneut über Discord ein.</p></body></html>');
      }
      res.send(buildScratchPage(req.query.token, entry));
    });

    // POST /api/rubbellos/claim  — validates token and credits prize
    app.post('/api/rubbellos/claim', express.json(), (req, res) => {
      const token = (req.body||{}).token||'';
      const entry = rubbellosTokens.get(token);
      if (!entry || entry.usedAt || entry.expiresAt < Date.now()) {
        return res.json({ ok: false, error: 'Token ungültig oder bereits verwendet.' });
      }
      entry.usedAt = Date.now();
      const prize = entry.prize;
      const uid   = entry.uid;
      try {
        if (prize.type === 'cash') {
          app._wCash(uid, app._rCash(uid) + prize.amount);
        } else if (prize.type === 'item') {
          const inv = app._rInv(uid);
          inv[prize.item] = (inv[prize.item]||0) + (prize.menge||1);
          app._wInv(uid, inv);
        }
        // ticket type: no auto-credit, user creates a support ticket
      } catch(e) {
        console.error('[Rubbellos claim]', e.message);
        return res.json({ ok: false, error: 'Serverfehler beim Gutschreiben.' });
      }
      res.json({ ok: true, prize });
    });

    // ── Start ────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Web-Server läuft auf Port ${PORT}`));
};
module.exports.tokens = rubbellosTokens;

