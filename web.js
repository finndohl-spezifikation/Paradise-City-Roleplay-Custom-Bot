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


function buildInvalidPage(title, msg) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+title+'</title><style>body{background:#0d1117;color:#e0e0e0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}</style></head><body><div style="font-size:3em">❌</div><h2 style="color:#f85149">'+title+'</h2><p style="color:#8b949e">'+msg+'</p></body></html>';
}

function buildClaimedPage(entry) {
  const p = entry.prize;
  const grid = entry.grid;
  let h = '', msg = '', ico = p.sym || '🎁';
  if (p.type === 'cash')   { h = '🎉 Bereits eingelöst!'; msg = p.amount.toLocaleString('de-DE') + ' $ wurden deinem Bargeld gutgeschrieben.'; }
  else if (p.type === 'item')   { h = '🎉 Bereits eingelöst!'; msg = (p.menge||1) + '× ' + p.item + ' wurde deinem Inventar hinzugefügt.'; }
  else if (p.type === 'ticket') { h = '🏆 Hauptgewinn eingelöst!'; ico = '🏎️'; msg = 'Sportwagen-Gewinn! Bitte ein Support-Ticket in Discord erstellen.'; }
  else { h = '😢 Leider Niete'; msg = 'Kein Gewinn diesmal — viel Glück beim nächsten Mal!'; }
  const cells = (entry.scratchedCells||[]).map((v,i) => {
    const sym = grid[i];
    return '<div style="width:80px;height:80px;background:#161b22;border:2px solid #3fb950;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:1.8em;">'+sym+'</div>';
  }).join('');
  return `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rubbellos — Paradise City Roleplay</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#0d1117;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:32px 16px;text-align:center}h1{color:#ffd180;font-size:1.3em;letter-spacing:2px;text-transform:uppercase;margin:12px 0 6px}.card{background:#161b22;border:2px solid #3fb950;border-radius:18px;padding:28px 24px;max-width:400px;width:100%;margin-top:20px}.ico{font-size:3em;margin-bottom:10px}.grid{display:grid;grid-template-columns:repeat(3,80px);gap:6px;margin:16px auto;width:fit-content}.prize{font-size:1.1em;font-weight:700;color:#3fb950;margin:12px 0 6px}.note{color:#8b949e;font-size:.8em;margin-top:16px}</style></head>
<body>
<div style="font-size:2.8em;margin-bottom:8px">🎟️</div>
<h1>Paradise City Rubbellos</h1>
<div class="card">
  <div class="ico">${ico}</div>
  <h2 style="color:#ffd180;font-size:1.1em;margin-bottom:8px">${h}</h2>
  <p style="color:#c9d1d9;font-size:.9em">${msg}</p>
  <div class="grid">${cells}</div>
  <p class="note">Dieses Rubbellos wurde bereits eingelöst.</p>
</div>
</body></html>`;
}

function buildScratchPage(token, entry, scratchedCells) {
    if (!scratchedCells) scratchedCells = new Array(9).fill(0);
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
  .cell{position:relative;width:104px;height:104px;background:#1a1f2e;border:2px solid #30363d;border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;transition:border-color .3s,box-shadow .3s}
  .sym{font-size:2.4em;pointer-events:none;user-select:none;visibility:hidden;transition:transform .3s}
  .cv{position:absolute;inset:0;width:104px;height:104px;border-radius:8px;cursor:crosshair;touch-action:none;will-change:transform}
  .prog-wrap{margin:16px 0 8px}
  .prog-txt{color:#8b949e;font-size:.78em;text-align:center;margin-bottom:6px}
  .prog-bar{height:6px;background:#21262d;border-radius:3px;overflow:hidden}
  .prog-fill{height:100%;background:linear-gradient(90deg,#bf360c,#ff6d00);transition:width .2s;width:0%;box-shadow:0 0 6px rgba(230,81,0,.5)}
  .claim-btn{display:none;width:100%;padding:16px;background:linear-gradient(135deg,#e65100,#ff6d00);color:#fff;border:none;border-radius:10px;font-size:1.05em;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:12px;transition:all .2s;box-shadow:0 4px 15px rgba(230,81,0,.4)}
  .claim-btn:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(230,81,0,.5)}
  .claim-btn.show{display:block;animation:fadeUp .4s ease}
  .claim-btn:disabled{background:#555;cursor:not-allowed;box-shadow:none;transform:none}
  .result{display:none;text-align:center;margin-top:20px;padding-top:18px;border-top:1px solid #21262d}
  .result.show{display:block}
  .result .ri{font-size:3em;margin-bottom:10px}
  .result h2{color:#ffd180;font-size:1.15em;margin-bottom:8px}
  .result p{font-size:.9em;line-height:1.6;color:#c9d1d9}
  .win{color:#3fb950;font-weight:700}
  .lose{color:#8b949e}
  .spinner{display:inline-block;width:18px;height:18px;border:2px solid #555;border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;vertical-align:middle;margin-right:6px}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes pop{0%{transform:scale(1)}30%{transform:scale(1.15)}60%{transform:scale(0.95)}80%{transform:scale(1.05)}100%{transform:scale(1)}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 8px rgba(63,185,80,.35),inset 0 0 10px rgba(63,185,80,.1)}50%{box-shadow:0 0 22px rgba(63,185,80,.7),inset 0 0 20px rgba(63,185,80,.2)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes symPop{from{transform:scale(0.5);opacity:0}to{transform:scale(1);opacity:1}}
  .cell.done{border-color:#3fb950!important;animation:glowPulse 2s ease infinite}
  .cell.done .sym{animation:symPop .35s cubic-bezier(.34,1.56,.64,1) both}
  .particle{position:fixed;border-radius:50%;pointer-events:none;z-index:9999;will-change:transform,opacity}
  .sym.txt{font-size:.82em;font-weight:700;text-align:center;line-height:1.2;padding:0 4px;word-break:break-word;color:#f0f0f0}
  .expire{color:#555;font-size:.7em;text-align:center;margin-top:18px}
  .live-count{min-height:36px;margin:14px 0 4px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-items:center}
  .chip{display:inline-flex;align-items:center;gap:5px;background:#21262d;border:1px solid #30363d;border-radius:20px;padding:5px 12px;font-size:.93em;transition:all .3s}
  .chip b{color:#c9d1d9}
  .chip em{font-style:normal;color:#8b949e}
  .win-chip{border-color:#3fb950;background:#0d2311;box-shadow:0 0 10px rgba(63,185,80,.4)}
  .win-chip em{color:#3fb950;font-weight:700}
  @media(max-width:380px){.grid{grid-template-columns:repeat(3,90px);grid-template-rows:repeat(3,90px)}.cell,.cv{width:90px;height:90px}}
  </style></head><body>
  <div class="hdr"><div class="ico">🎟️</div><h1>Paradise City Rubbellos</h1><p>Rubbele alle 9 Felder frei und sichere deinen Gewinn!</p></div>
  <div class="card">
  <p class="hint">🖱️ Maus gedrückt halten &amp; rubbeln &mdash; oder auf dem Handy mit dem Finger wischen</p>
  <div class="grid" id="grid">${cells}</div>
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
  const SYM_MAP={'\u274C':'Niete','\uD83D\uDCB5':"1'000 \u0024",'\uD83D\uDCB4':"2'500 \u0024",'\uD83D\uDCB6':"5'000 \u0024",'\uD83D\uDCB0':"25'000 \u0024",'\uD83D\uDEAC':'10\u00D7 Marlboro Rot','\uD83D\uDEB2':'Elektro Fahrrad','\uD83C\uDFC3\u200D\u2642\uFE0F':'Golfschl\u00E4ger','\uD83C\uDF9F\uFE0F':'Lottoschein','\uD83C\uDFAB':'20% Rabatt beim Autohaus'};
  const SCRATCH_STATE=${JSON.stringify(scratchedCells)};
  const CASH_SYMS=new Set(['\uD83D\uDCB5','\uD83D\uDCB4','\uD83D\uDCB6','\uD83D\uDCB0']);
  const scratched=[...SCRATCH_STATE];
  const GSIZE=14;const GCELLS=GSIZE*GSIZE;
  const covered=Array.from({length:9},()=>new Uint8Array(GCELLS));
  const lastPos=new Array(9).fill(null);
  let claimed=false;

  // ── Paint metallic silver coating ───────────────────────────────────────────
  document.querySelectorAll('.cv').forEach((cv,i)=>{
    if(SCRATCH_STATE[i]>=100){cv.style.display='none';return;} // already done
    const ctx=cv.getContext('2d');
    const w=cv.width,h=cv.height;
    ctx.globalCompositeOperation='source-over';

    // Base silver metallic gradient
    const g=ctx.createLinearGradient(0,0,w,h);
    g.addColorStop(0,'#888');g.addColorStop(.2,'#bbb');
    g.addColorStop(.45,'#d8d8d8');g.addColorStop(.55,'#cfcfcf');
    g.addColorStop(.8,'#aaa');g.addColorStop(1,'#777');
    ctx.fillStyle=g;ctx.fillRect(0,0,w,h);

    // Diagonal specular shine streaks
    for(let k=0;k<4;k++){
      const ox=Math.random()*w*.7;
      const sh=ctx.createLinearGradient(ox,0,ox+w*.25,h);
      sh.addColorStop(0,'rgba(255,255,255,0)');
      sh.addColorStop(.4,'rgba(255,255,255,'+(.06+Math.random()*.1)+')');
      sh.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=sh;ctx.fillRect(0,0,w,h);
    }

    // Subtle noise texture (silver grain)
    for(let n=0;n<60;n++){
      const v=Math.random()>.5?255:0;
      ctx.fillStyle='rgba('+v+','+v+','+v+','+(Math.random()*.06)+')';
      ctx.fillRect(Math.random()*w|0,Math.random()*h|0,1,1);
    }

    // Pre-scratched texture lines (make it look used)
    ctx.save();
    for(let s=0;s<6;s++){
      ctx.strokeStyle='rgba(255,255,255,'+(Math.random()*.15)+')';
      ctx.lineWidth=Math.random()*1.5+.3;
      ctx.lineCap='round';
      ctx.beginPath();
      const x1=Math.random()*w,y1=Math.random()*h;
      ctx.moveTo(x1,y1);
      ctx.lineTo(x1+(Math.random()-.5)*30,y1+(Math.random()-.5)*20);
      ctx.stroke();
    }
    for(let s=0;s<4;s++){
      ctx.strokeStyle='rgba(0,0,0,'+(Math.random()*.08)+')';
      ctx.lineWidth=.5;
      ctx.beginPath();
      ctx.moveTo(Math.random()*w,Math.random()*h);
      ctx.lineTo(Math.random()*w,Math.random()*h);
      ctx.stroke();
    }
    ctx.restore();

    // "RUBBELN" text with emboss effect
    ctx.font='bold 13px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(80,80,80,.6)';ctx.fillText('RUBBELN',w/2+1,h/2+1);
    ctx.fillStyle='rgba(240,240,240,.9)';ctx.fillText('RUBBELN',w/2,h/2);

    // Coin hint below text
    ctx.font='14px serif';
    ctx.fillStyle='rgba(180,180,180,.55)';
    ctx.fillText('\u25A1',w/2,h/2+18);
  });

  // Reveal symbols under the coating
  document.querySelectorAll('.sym').forEach(s=>s.style.visibility='visible');
  // Restore server-persisted scratch state on page load
  (function restoreState(){
    SCRATCH_STATE.forEach((v,i)=>{
      if(v>=100){
        scratched[i]=100;
        finalise(i,false);
      }
    });
    upd();
  })();

  // ── Particle system ──────────────────────────────────────────────────────────
  function spawnParticles(clientX,clientY){
    const count=2+Math.floor(Math.random()*3);
    const colors=['#c0c0c0','#d8d8d8','#b8b8b8','#e8e8e8','#a0a0a0'];
    for(let p=0;p<count;p++){
      const el=document.createElement('div');
      el.className='particle';
      const size=1.5+Math.random()*2.5;
      el.style.width=size+'px';el.style.height=size+'px';
      el.style.left=clientX+'px';el.style.top=clientY+'px';
      el.style.background=colors[Math.floor(Math.random()*colors.length)];
      document.body.appendChild(el);
      const angle=(Math.random()*Math.PI*2);
      const speed=1.5+Math.random()*3;
      let vx=Math.cos(angle)*speed;
      let vy=Math.sin(angle)*speed-2;
      let life=1;let cx=clientX;let cy=clientY;
      const tick=()=>{
        life-=.055;if(life<=0){el.remove();return;}
        vy+=.15;cx+=vx;cy+=vy;
        el.style.transform='translate('+cx+'px,'+cy+'px) translate(-'+clientX+'px,-'+clientY+'px)';
        el.style.opacity=life;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  function symLabel(sym){
    if(sym!==PRIZE.sym)return '';
    if(PRIZE.type==='cash')return PRIZE.amount.toLocaleString('de-DE')+'\u0020\u0024';
    if(PRIZE.type==='item')return (PRIZE.menge||1)+'\u00D7 '+PRIZE.item;
    if(PRIZE.type==='ticket')return '\uD83C\uDFCE\uFE0F SPORTWAGEN';
    return '';
  }
  function updateCounter(){
    const lc=document.getElementById('lc');
    const counts={};
    GRID.forEach((sym,idx)=>{if(scratched[idx]>=40)counts[sym]=(counts[sym]||0)+1;});
    const keys=Object.keys(counts);
    if(!keys.length){lc.innerHTML='';return;}
    lc.innerHTML=keys.map(sym=>{
      const cnt=counts[sym];const lbl=symLabel(sym);
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
    // Animate the clear
    let alpha=1;
    const fadeOut=()=>{
      alpha-=.07;
      if(alpha<=0){ctx2.clearRect(0,0,cv2.width,cv2.height);finalise(i);return;}
      ctx2.globalCompositeOperation='destination-out';
      ctx2.fillStyle='rgba(0,0,0,'+.07+')';
      ctx2.fillRect(0,0,cv2.width,cv2.height);
      ctx2.globalCompositeOperation='source-over';
      requestAnimationFrame(fadeOut);
    };
    requestAnimationFrame(fadeOut);
  }
  function saveProgress(){try{fetch('/api/rubbellos/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN,cells:scratched})});}catch(e){}}
  function finalise(i,doSave){if(doSave===undefined)doSave=true;
    const cell=document.getElementById('c'+i);cell.classList.add('done');
    const sym=GRID[i];
    const spanEl=cell.querySelector('.sym');
    if(CASH_SYMS.has(sym)){spanEl.textContent=SYM_MAP[sym]||sym;spanEl.classList.add('txt');}
    spanEl.style.visibility='visible';
    upd();
    if(doSave)saveProgress();
  }

  // ── Scratch at position ──────────────────────────────────────────────────────
  function scrAt(cv,i,x,y,r,clientX,clientY){
    if(scratched[i]===100)return;
    const ctx=cv.getContext('2d');
    ctx.globalCompositeOperation='destination-out';

    const last=lastPos[i];
    if(last){
      const dx=x-last.x,dy=y-last.y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      const steps=Math.max(1,Math.floor(dist/3));
      for(let s=0;s<=steps;s++){
        const t=s/steps;
        const px=last.x+dx*t,py=last.y+dy*t;
        ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();
        // Natural jitter
        if(s%2===0){
          const jx=px+(Math.random()-.5)*r*.5,jy=py+(Math.random()-.5)*r*.5;
          ctx.beginPath();ctx.arc(jx,jy,r*.55,0,Math.PI*2);ctx.fill();
        }
      }
      // Spawn particles only every few pixels to avoid flooding
      if(dist>8&&clientX!==undefined){spawnParticles(clientX,clientY);}
    } else {
      ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
    }
    lastPos[i]={x,y};
    ctx.globalCompositeOperation='source-over';

    // Track coverage (virtual 14x14 grid)
    const cov=covered[i];const cw=cv.width;const cellSz=cw/GSIZE;const r2=r*r;
    const startGx=Math.max(0,Math.floor((x-r)/cellSz)),endGx=Math.min(GSIZE-1,Math.floor((x+r)/cellSz));
    const startGy=Math.max(0,Math.floor((y-r)/cellSz)),endGy=Math.min(GSIZE-1,Math.floor((y+r)/cellSz));
    for(let gy=startGy;gy<=endGy;gy++){for(let gx=startGx;gx<=endGx;gx++){
      const cx2=(gx+.5)*cellSz,cy2=(gy+.5)*cellSz;
      const dx2=cx2-x,dy2=cy2-y;
      if(dx2*dx2+dy2*dy2<=r2)cov[gy*GSIZE+gx]=1;
    }}
    let cnt=0;for(let k=0;k<GCELLS;k++)if(cov[k])cnt++;
    scratched[i]=Math.round(cnt/GCELLS*100);
    if(scratched[i]>=75)markDone(i);else upd();
  }

  const R=window.innerWidth<380?20:28;
  const canvases=[...document.querySelectorAll('.cv')];

  // ── Pointer events (works on mouse, touch, stylus) ───────────────────────────
  canvases.forEach((cv,i)=>{
    cv.addEventListener('pointerdown',e=>{
      e.preventDefault();
      try{cv.setPointerCapture(e.pointerId);}catch(err){}
      lastPos[i]=null;
      const rect=cv.getBoundingClientRect();
      const sx=(e.clientX-rect.left)*(cv.width/rect.width);
      const sy=(e.clientY-rect.top)*(cv.height/rect.height);
      scrAt(cv,i,sx,sy,R,e.clientX,e.clientY);
    },{passive:false});
    cv.addEventListener('pointermove',e=>{
      if(e.buttons===0)return;
      const rect=cv.getBoundingClientRect();
      const sx=(e.clientX-rect.left)*(cv.width/rect.width);
      const sy=(e.clientY-rect.top)*(cv.height/rect.height);
      scrAt(cv,i,sx,sy,R,e.clientX,e.clientY);
    },{passive:false});
    cv.addEventListener('pointerup',e=>{lastPos[i]=null;});
    cv.addEventListener('pointercancel',e=>{lastPos[i]=null;});
  });

  async function claim(){
    if(claimed)return;claimed=true;
    const btn=document.getElementById('cb');
    btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Wird gebucht\u2026';
    try{
      const r=await fetch('/api/rubbellos/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:TOKEN})});
      const d=await r.json();
      const res=document.getElementById('res');
      res.classList.add('show');btn.style.display='none';
      if(d.ok){
        const p=d.prize;let ico=p.sym||'\uD83C\uDF81',h='',msg='';
        if(p.type==='cash'){h='\uD83C\uDF89 Gewonnen!';msg='<span class="win">'+p.amount.toLocaleString('de-CH').replace(/\./g,"'")+' \u0024 wurden deinem Bargeld gutgeschrieben!</span>';}
        else if(p.type==='item'){h='\uD83C\uDF89 Gewonnen!';msg='<span class="win">\uD83C\uDF81 '+(p.menge||1)+'\u00D7 '+p.item+' wurde deinem Inventar hinzugef\u00FCgt!</span>';}
        else if(p.type==='ticket'){h='\uD83C\uDFC6 HAUPTGEWINN!';ico='\uD83C\uDFCE\uFE0F';msg='<span class="win">\uD83C\uDFCE\uFE0F SPORTWAGEN! Bitte ein Support-Ticket in Discord erstellen!</span>';}
        else{h='\uD83D\uDE22 Leider Niete';msg='<span class="lose">Kein Gewinn diesmal \u2014 viel Gl\u00FCck beim n\u00E4chsten Mal!</span>';}
        res.innerHTML='<div class="ri">'+ico+'</div><h2>'+h+'</h2><p>'+msg+'</p><p style="color:#555;font-size:.75em;margin-top:14px">Du kannst dieses Fenster schlie\u00DFen.</p>';
      }else{
        res.innerHTML='<div class="ri">\u274C</div><h2>Fehler</h2><p>'+(d.error||'Unbekannter Fehler')+'</p>';
        claimed=false;btn.disabled=false;btn.innerHTML='\uD83C\uDFC6 Gewinn jetzt sichern!';
      }
    }catch(e){
      document.getElementById('res').innerHTML='<div class="ri">\u274C</div><h2>Verbindungsfehler</h2><p>Bitte erneut versuchen.</p>';
      document.getElementById('res').classList.add('show');
      claimed=false;const btn2=document.getElementById('cb');btn2.disabled=false;btn2.innerHTML='\uD83C\uDFC6 Gewinn jetzt sichern!';
    }
  }
  </script></body></html>`;
  }
  const rubbellosTokens = new Map();
  const lottoTokens = new Map();

// ─── LOTTO PAGE BUILDER ───────────────────────────────────────────────────────
function buildLottoPage(token) {
  return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Lotto — Paradise City Roleplay</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--gold:#FFD700;--gold2:#FFA500;--gold3:#B8860B;--bg:#0a0c10;--card:#111318;--border:#2a2d35;--text:#e8e8e8;--sub:#8b949e}
body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px 12px 60px;user-select:none}

/* ── Header ── */
.hdr{text-align:center;margin-bottom:26px}
.hdr-logo{font-size:3.2em;filter:drop-shadow(0 0 18px rgba(255,215,0,.6));animation:floatLogo 3s ease-in-out infinite;display:inline-block;margin-bottom:6px}
@keyframes floatLogo{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.hdr h1{color:var(--gold);font-size:1.4em;font-weight:800;letter-spacing:3px;text-transform:uppercase;text-shadow:0 0 20px rgba(255,215,0,.4)}
.hdr p{color:var(--sub);font-size:.82em;margin-top:5px}

/* ── Card ── */
.card{background:var(--card);border:1.5px solid var(--border);border-radius:20px;padding:24px 20px;max-width:560px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.6)}

/* ── Section label ── */
.sec{color:var(--gold);font-size:.72em;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;margin:0 0 12px;display:flex;align-items:center;gap:8px}
.sec::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,rgba(255,215,0,.4),transparent)}

/* ── Number grid ── */
.nums-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin-bottom:6px}
.ball{width:100%;aspect-ratio:1;border-radius:50%;border:2px solid var(--border);background:radial-gradient(circle at 35% 35%,#1e2330,#0d1020);display:flex;align-items:center;justify-content:center;font-size:.78em;font-weight:700;cursor:pointer;transition:all .18s;position:relative;color:#9099aa}
.ball:hover{border-color:rgba(255,215,0,.5);color:#ccc;transform:scale(1.08)}
.ball.sel{background:radial-gradient(circle at 35% 35%,#ffe066,#e6a000);border-color:var(--gold);color:#3a2000;box-shadow:0 0 12px rgba(255,215,0,.55),inset 0 1px 0 rgba(255,255,255,.35);transform:scale(1.12);animation:ballPop .22s cubic-bezier(.34,1.56,.64,1) both}
@keyframes ballPop{from{transform:scale(.7)}to{transform:scale(1.12)}}
.ball.done{cursor:not-allowed;opacity:.45}
.ball.done:hover{transform:none;border-color:var(--border);color:#9099aa}

/* ── Superzahl ── */
.sz-grid{display:grid;grid-template-columns:repeat(10,1fr);gap:5px;margin-bottom:4px}
.sz-ball{width:100%;aspect-ratio:1;border-radius:50%;border:2px solid var(--border);background:radial-gradient(circle at 35% 35%,#1e1830,#100d20);display:flex;align-items:center;justify-content:center;font-size:.85em;font-weight:700;cursor:pointer;transition:all .18s;color:#9099aa}
.sz-ball:hover{border-color:rgba(180,100,255,.5);color:#ccc;transform:scale(1.08)}
.sz-ball.sel{background:radial-gradient(circle at 35% 35%,#cc88ff,#8800cc);border-color:#cc88ff;color:#fff;box-shadow:0 0 12px rgba(180,100,255,.6),inset 0 1px 0 rgba(255,255,255,.25);transform:scale(1.12);animation:ballPop .22s cubic-bezier(.34,1.56,.64,1) both}

/* ── Status bar ── */
.status{background:#0d1020;border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin:16px 0;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.status-item{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;min-width:80px}
.status-label{font-size:.65em;color:var(--sub);letter-spacing:1px;text-transform:uppercase}
.status-val{font-size:1.05em;font-weight:700;color:var(--gold);font-family:monospace;min-height:1.4em;transition:all .2s}
.status-val.ok{color:#3fb950}
.status-divider{width:1px;height:36px;background:var(--border);flex-shrink:0}

/* ── Selected chips ── */
.chips{min-height:32px;display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px;align-items:center}
.chip{background:radial-gradient(circle at 35% 35%,#ffe066,#e6a000);color:#3a2000;font-weight:700;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:.75em;box-shadow:0 0 8px rgba(255,215,0,.4);animation:chipIn .25s cubic-bezier(.34,1.56,.64,1)}
@keyframes chipIn{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}
.chip-sz{background:radial-gradient(circle at 35% 35%,#cc88ff,#8800cc);color:#fff;box-shadow:0 0 8px rgba(180,100,255,.4)}
.chip-placeholder{color:#3a4050;font-size:.75em;font-style:italic}

/* ── Ticket price strip ── */
.ticket-strip{background:linear-gradient(135deg,#1a1000,#1e1500);border:1px dashed rgba(255,215,0,.3);border-radius:10px;padding:10px 16px;margin-bottom:18px;display:flex;align-items:center;gap:10px}
.ticket-strip .ts-icon{font-size:1.4em}
.ticket-strip .ts-text{font-size:.8em;color:var(--sub);line-height:1.5}
.ticket-strip .ts-text strong{color:var(--gold)}

/* ── Submit button ── */
.submit-btn{width:100%;padding:16px;background:linear-gradient(135deg,var(--gold3),var(--gold2));color:#1a0a00;border:none;border-radius:12px;font-size:1.05em;font-weight:800;letter-spacing:1px;cursor:pointer;transition:all .2s;box-shadow:0 4px 20px rgba(255,165,0,.35);position:relative;overflow:hidden}
.submit-btn::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.15),transparent);pointer-events:none}
.submit-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 28px rgba(255,165,0,.5)}
.submit-btn:disabled{background:linear-gradient(135deg,#2a2d35,#1e2028);color:#4a5060;cursor:not-allowed;box-shadow:none;transform:none}
.submit-btn.loading{pointer-events:none}

/* ── Result screen ── */
.result{display:none;text-align:center;padding:20px 0 10px;border-top:1px solid var(--border);margin-top:20px}
.result.show{display:block;animation:fadeUp .4s ease}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.result-icon{font-size:3.5em;margin-bottom:12px;display:block}
.result h2{color:var(--gold);font-size:1.2em;margin-bottom:10px;font-weight:800}
.result-ticket{background:#0d1020;border:1px solid var(--border);border-radius:12px;padding:16px;margin:14px 0;text-align:left}
.result-ticket .rt-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:.88em}
.result-ticket .rt-label{color:var(--sub)}
.result-ticket .rt-val{font-weight:700;color:var(--gold);font-family:monospace}
.result-ticket .rt-val.sz{color:#cc88ff}
.result p{color:var(--sub);font-size:.85em;line-height:1.65;margin-top:6px}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(0,0,0,.2);border-top-color:#1a0a00;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Confetti particle ── */
.confetti{position:fixed;pointer-events:none;z-index:9999;border-radius:2px}

.expire{color:#3a4050;font-size:.7em;text-align:center;margin-top:20px}
@media(max-width:400px){.ball,.sz-ball{font-size:.65em}.hdr h1{font-size:1.1em}}
</style></head><body>

<div class="hdr">
  <div class="hdr-logo">🎰</div>
  <h1>Paradise City Lotto</h1>
  <p>Wähle deine Glückszahlen und gib deinen Schein ab!</p>
</div>

<div class="card">
  <div class="ticket-strip">
    <span class="ts-icon">🎟️</span>
    <div class="ts-text"><strong>Lottoschein</strong> wird für diese Teilnahme eingelöst.<br>Ziehung täglich um <strong>12:00 Uhr</strong> · Gewinner per DM</div>
  </div>

  <div class="sec">🎯 Wähle 6 Zahlen (1–100)</div>
  <div class="nums-grid" id="numGrid"></div>

  <div class="status" id="statusBar">
    <div class="status-item">
      <span class="status-label">Zahlen</span>
      <span class="status-val" id="stNums">0 / 6</span>
    </div>
    <div class="status-divider"></div>
    <div class="status-item">
      <span class="status-label">Superzahl</span>
      <span class="status-val" id="stSz">–</span>
    </div>
    <div class="status-divider"></div>
    <div class="status-item">
      <span class="status-label">Jackpot</span>
      <span class="status-val" style="color:#cc88ff">3.000.000 $</span>
    </div>
  </div>

  <div class="chips" id="selChips"><span class="chip-placeholder">Noch keine Zahlen gewählt…</span></div>

  <div class="sec" style="margin-top:4px">🌟 Superzahl (1–10)</div>
  <div class="sz-grid" id="szGrid"></div>

  <div style="margin-top:20px">
    <button class="submit-btn" id="submitBtn" disabled onclick="submitTicket()">
      🎟️ Lottoschein abgeben
    </button>
  </div>

  <div class="result" id="result"></div>
  <p class="expire">⏰ Dieser Link ist 30 Minuten gültig &bull; Einmalig verwendbar</p>
</div>

<script>
const TOKEN = '${token}';
const selected = new Set();
let superzahl = null;
let submitted = false;

// Build number grid 1-100
const numGrid = document.getElementById('numGrid');
for (let n = 1; n <= 100; n++) {
  const b = document.createElement('div');
  b.className = 'ball'; b.textContent = n; b.dataset.n = n;
  b.addEventListener('click', () => toggleNum(n, b));
  numGrid.appendChild(b);
}

// Build superzahl grid 1-10
const szGrid = document.getElementById('szGrid');
for (let n = 1; n <= 10; n++) {
  const b = document.createElement('div');
  b.className = 'sz-ball'; b.textContent = n; b.dataset.n = n;
  b.addEventListener('click', () => toggleSz(n, b));
  szGrid.appendChild(b);
}

function toggleNum(n, el) {
  if (submitted) return;
  if (selected.has(n)) {
    selected.delete(n);
    el.classList.remove('sel');
  } else {
    if (selected.size >= 6) {
      // Shake animation
      el.style.animation = 'none'; requestAnimationFrame(() => { el.style.animation = ''; });
      return;
    }
    selected.add(n);
    el.classList.add('sel');
    spawnGoldParticle(el);
  }
  // Disable unselected if 6 chosen
  document.querySelectorAll('.ball').forEach(b => {
    const bn = Number(b.dataset.n);
    if (!selected.has(bn)) b.classList.toggle('done', selected.size >= 6);
  });
  updateStatus();
}

function toggleSz(n, el) {
  if (submitted) return;
  document.querySelectorAll('.sz-ball').forEach(b => b.classList.remove('sel'));
  if (superzahl === n) { superzahl = null; }
  else { superzahl = n; el.classList.add('sel'); spawnGoldParticle(el); }
  updateStatus();
}

function updateStatus() {
  const sn = document.getElementById('stNums');
  const sz = document.getElementById('stSz');
  sn.textContent = selected.size + ' / 6';
  sn.className = 'status-val' + (selected.size === 6 ? ' ok' : '');
  sz.textContent = superzahl !== null ? superzahl : '–';
  sz.className = 'status-val' + (superzahl !== null ? ' ok' : '');

  // Chips
  const chips = document.getElementById('selChips');
  const sorted = [...selected].sort((a,b)=>a-b);
  let html = sorted.map(n => '<span class="chip">'+n+'</span>').join('');
  if (superzahl !== null) html += '<span class="chip chip-sz">'+superzahl+'</span>';
  if (!html) html = '<span class="chip-placeholder">Noch keine Zahlen gewählt…</span>';
  chips.innerHTML = html;

  document.getElementById('submitBtn').disabled = !(selected.size === 6 && superzahl !== null);
}

function spawnGoldParticle(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width/2; const cy = rect.top + rect.height/2;
  const colors = ['#FFD700','#FFA500','#FFE066','#cc88ff','#fff'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'confetti';
    const size = 4 + Math.random()*5;
    p.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+cx+'px;top:'+cy+'px;background:'+colors[Math.floor(Math.random()*colors.length)]+';border-radius:'+(Math.random()>.5?'50%':'2px');
    document.body.appendChild(p);
    const angle = Math.random()*Math.PI*2;
    const speed = 3 + Math.random()*5;
    let vx = Math.cos(angle)*speed, vy = Math.sin(angle)*speed - 3;
    let life = 1; let x = 0, y = 0;
    const tick = () => {
      life -= .055; if (life <= 0) { p.remove(); return; }
      vy += .2; x += vx; y += vy;
      p.style.transform = 'translate('+x+'px,'+y+'px)';
      p.style.opacity = life;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
}

function spawnWinConfetti() {
  for (let i = 0; i < 80; i++) {
    setTimeout(() => {
      const p = document.createElement('div');
      p.className = 'confetti';
      const size = 5+Math.random()*8;
      const colors = ['#FFD700','#FFA500','#cc88ff','#3fb950','#fff','#ff6b6b'];
      p.style.cssText = 'width:'+size+'px;height:'+size+'px;left:'+Math.random()*window.innerWidth+'px;top:-10px;background:'+colors[Math.floor(Math.random()*colors.length)]+';border-radius:'+(Math.random()>.5?'50%':'2px');
      document.body.appendChild(p);
      let vy = 2+Math.random()*4, vx=(Math.random()-.5)*3, y=0;
      const tick=()=>{y+=vy;vx*=.99;p.style.transform='translate('+vx*10+'px,'+y+'px) rotate('+(y*2)+'deg)';if(y>window.innerHeight+50){p.remove();return;}requestAnimationFrame(tick);};
      requestAnimationFrame(tick);
    }, i*30);
  }
}

async function submitTicket() {
  if (submitted) return;
  submitted = true;
  const btn = document.getElementById('submitBtn');
  btn.classList.add('loading');
  btn.innerHTML = '<span class="spinner"></span>Wird eingereicht…';
  try {
    const r = await fetch('/api/lotto/submit', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ token: TOKEN, zahlen: [...selected].sort((a,b)=>a-b), superzahl })
    });
    const d = await r.json();
    const res = document.getElementById('result');
    res.classList.add('show');
    btn.style.display = 'none';
    if (d.ok) {
      spawnWinConfetti();
      const zStr = d.zahlen.map(n => '<span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffe066,#e6a000);color:#3a2000;font-weight:700;font-size:.8em;margin:0 2px">' + n + '</span>').join('');
      res.innerHTML = '<span class="result-icon">🎟️</span><h2>Lottoschein eingereicht!</h2>' +
        '<div class="result-ticket">' +
        '<div class="rt-row"><span class="rt-label">Deine Zahlen</span><span style="display:flex;flex-wrap:wrap;gap:3px;justify-content:flex-end">' + zStr + '</span></div>' +
        '<div class="rt-row"><span class="rt-label">Superzahl</span><span class="rt-val sz">' + d.superzahl + '</span></div>' +
        '</div>' +
        '<p>🕛 Ziehung täglich um <strong style="color:var(--gold)">12:00 Uhr</strong><br>📩 Gewinner werden per <strong style="color:var(--gold)">DM</strong> benachrichtigt<br><br>Viel Glück! 🍀</p>' +
        '<p style="color:#3a4050;font-size:.72em;margin-top:14px">Du kannst dieses Fenster schließen.</p>';
    } else {
      submitted = false; btn.style.display=''; btn.classList.remove('loading');
      btn.innerHTML = '🎟️ Lottoschein abgeben'; btn.disabled = false;
      res.innerHTML = '<span class="result-icon">❌</span><h2>Fehler</h2><p>' + (d.error||'Unbekannter Fehler') + '</p>';
    }
  } catch(e) {
    submitted = false;
    const btn2 = document.getElementById('submitBtn');
    btn2.style.display=''; btn2.classList.remove('loading');
    btn2.innerHTML='🎟️ Lottoschein abgeben'; btn2.disabled=false;
    const res2=document.getElementById('result');
    res2.classList.add('show');
    res2.innerHTML='<span class="result-icon">⚠️</span><h2>Verbindungsfehler</h2><p>Bitte erneut versuchen.</p>';
  }
}
</script></body></html>`;
}

function buildInvalidLottoPage(msg) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lotto — Paradise City</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0c10;color:#e8e8e8;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.box{background:#111318;border:1.5px solid #2a2d35;border-radius:20px;padding:40px 28px;max-width:400px;width:100%;text-align:center}
.ico{font-size:3em;margin-bottom:16px}.h{color:#FFD700;font-size:1.2em;font-weight:700;margin-bottom:10px}.p{color:#8b949e;font-size:.88em;line-height:1.65}</style></head>
<body><div class="box"><div class="ico">⛔</div><div class="h">Link ungültig oder abgelaufen</div><div class="p">${msg}</div></div></body></html>`;
}

module.exports = function startWebServer(client, DATA_DIR, lapdTokens = new Map()) {
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
    cookie: {
      maxAge: 60 * 60 * 1000,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_PUBLIC_DOMAIN
    }
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


    // ─── LOTTO ROUTES ────────────────────────────────────────────────────────────

    // GET /lotto?token=XXX — serves the lotto number picker page
    app.get('/lotto', (req, res) => {
      const token = req.query.token || '';
      const entry = lottoTokens.get(token);
      if (!entry || entry.expiresAt < Date.now()) {
        return res.send(buildInvalidLottoPage('Bitte löse einen neuen Lottoschein über Discord ein.'));
      }
      if (entry.submitted) {
        return res.send(buildInvalidLottoPage('Dieser Lottoschein wurde bereits eingereicht.'));
      }
      res.send(buildLottoPage(token));
    });

    // POST /api/lotto/submit — validate token, deduct ticket, save numbers
    app.post('/api/lotto/submit', express.json(), (req, res) => {
      const token     = (req.body || {}).token || '';
      const zahlen    = (req.body || {}).zahlen;
      const superzahl = (req.body || {}).superzahl;
      const entry = lottoTokens.get(token);
      if (!entry || entry.submitted || entry.expiresAt < Date.now()) {
        return res.json({ ok: false, error: 'Token ungültig oder bereits verwendet.' });
      }
      // Validate zahlen
      if (!Array.isArray(zahlen) || zahlen.length !== 6) {
        return res.json({ ok: false, error: 'Bitte genau 6 Zahlen auswählen.' });
      }
      if (zahlen.some(n => typeof n !== 'number' || n < 1 || n > 100 || !Number.isInteger(n))) {
        return res.json({ ok: false, error: 'Zahlen müssen ganze Zahlen zwischen 1 und 100 sein.' });
      }
      if (new Set(zahlen).size !== 6) {
        return res.json({ ok: false, error: 'Alle 6 Zahlen müssen unterschiedlich sein.' });
      }
      if (typeof superzahl !== 'number' || superzahl < 1 || superzahl > 10 || !Number.isInteger(superzahl)) {
        return res.json({ ok: false, error: 'Superzahl muss eine ganze Zahl zwischen 1 und 10 sein.' });
      }
      const uid = entry.uid;
      // Deduct Lottoschein from inventory
      const inv = app._rInv(uid);
      const lottoKey = Object.keys(inv).find(k => k.toLowerCase().includes('lottoschein'));
      if (!lottoKey || inv[lottoKey] < 1) {
        return res.json({ ok: false, error: 'Kein Lottoschein im Inventar gefunden.' });
      }
      inv[lottoKey] -= 1;
      if (inv[lottoKey] <= 0) delete inv[lottoKey];
      app._wInv(uid, inv);
      // Save ticket
      const LOTTO_TICKETS_FILE = path.join(DATA_DIR, 'lotto_tickets.json');
      let tickets = {};
      try { tickets = JSON.parse(fs.readFileSync(LOTTO_TICKETS_FILE, 'utf8')); } catch {}
      if (!tickets[uid]) tickets[uid] = [];
      const drawKey = new Date().toISOString().split('T')[0];
      const sortedZahlen = [...zahlen].sort((a, b) => a - b);
      tickets[uid].push({ zahlen: sortedZahlen, superzahl, ts: Date.now(), drawKey, tag: entry.userTag });
      fs.writeFileSync(LOTTO_TICKETS_FILE, JSON.stringify(tickets, null, 2), 'utf8');
      // Mark token as used
      entry.submitted = true;
      return res.json({ ok: true, zahlen: sortedZahlen, superzahl });
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
      if (!entry || entry.expiresAt < Date.now()) {
        return res.send(buildInvalidPage('Link ungültig oder abgelaufen', 'Bitte löse das Rubbellos erneut über Discord ein.'));
      }
      if (!entry.scratchedCells) entry.scratchedCells = new Array(9).fill(0);
      if (entry.usedAt) {
        return res.send(buildClaimedPage(entry));
      }
      res.send(buildScratchPage(req.query.token, entry, entry.scratchedCells));
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

    // POST /api/rubbellos/progress  — saves scratch progress server-side
    app.post('/api/rubbellos/progress', express.json(), (req, res) => {
      const token = (req.body||{}).token||'';
      const cells = (req.body||{}).cells;
      const entry = rubbellosTokens.get(token);
      if (!entry || entry.usedAt || entry.expiresAt < Date.now()) return res.json({ok:false});
      if (Array.isArray(cells) && cells.length === 9) {
        entry.scratchedCells = cells.map(v => Math.min(100, Math.max(0, Number(v)||0)));
      }
      res.json({ok:true});
    });


    // ── SPIELE ────────────────────────────────────────────────────────────────
    app.get('/snake', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send("<!DOCTYPE html>\n<html lang=\"de\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\">\n<title>🐍 Snake – Paradise City</title>\n<style>\n  *{box-sizing:border-box;margin:0;padding:0}\n  body{background:#0d0d0d;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;user-select:none}\n  h1{font-size:1.6rem;margin-bottom:8px;color:#4ade80;text-shadow:0 0 18px #22c55e88;letter-spacing:2px}\n  #scoreboard{display:flex;gap:30px;margin-bottom:14px;font-size:.95rem;color:#aaa}\n  #scoreboard span{color:#4ade80;font-weight:700;font-size:1.1rem}\n  #canvas{border:2px solid #22c55e44;border-radius:8px;background:#111;box-shadow:0 0 30px #22c55e22;touch-action:none}\n  #overlay{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#000000cc;border-radius:10px;padding:30px 40px}\n  #overlay h2{font-size:1.5rem;color:#f87171}\n  #overlay p{color:#aaa;font-size:.9rem}\n  #overlay .score-final{font-size:2rem;font-weight:700;color:#4ade80}\n  #overlay button{background:#22c55e;color:#000;border:none;padding:10px 28px;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;margin-top:4px;transition:.2s}\n  #overlay button:hover{background:#4ade80;transform:scale(1.05)}\n  #wrap{position:relative;display:inline-block}\n  #controls{margin-top:14px;color:#555;font-size:.8rem;text-align:center}\n  .hidden{display:none!important}\n  /* Mobile pad */\n  #dpad{display:none;grid-template-columns:repeat(3,52px);grid-template-rows:repeat(3,52px);gap:4px;margin-top:18px}\n  #dpad button{background:#1a1a1a;border:1px solid #333;color:#fff;font-size:1.3rem;border-radius:8px;cursor:pointer;width:52px;height:52px;display:flex;align-items:center;justify-content:center;touch-action:manipulation}\n  #dpad button:active{background:#22c55e22}\n  @media(max-width:500px){#canvas{width:320px;height:320px}#dpad{display:grid}}\n</style>\n</head>\n<body>\n<h1>🐍 Snake</h1>\n<div id=\"scoreboard\">Punkte: <span id=\"sc\">0</span>&nbsp;&nbsp;Highscore: <span id=\"hi\">0</span></div>\n<div id=\"wrap\">\n  <canvas id=\"canvas\" width=\"400\" height=\"400\"></canvas>\n  <div id=\"overlay\">\n    <h2 id=\"oTitle\">Paradise City Snake</h2>\n    <p id=\"oMsg\">Steuere die Schlange und sammle Futter</p>\n    <div class=\"score-final hidden\" id=\"oScore\"></div>\n    <button id=\"oBtn\">▶ Spielen</button>\n  </div>\n</div>\n<div id=\"dpad\">\n  <div></div><button data-d=\"up\">▲</button><div></div>\n  <button data-d=\"left\">◀</button><div></div><button data-d=\"right\">▶</button>\n  <div></div><button data-d=\"down\">▼</button><div></div>\n</div>\n<div id=\"controls\">WASD / Pfeiltasten · Handy: Wischen oder Steuerkreuz</div>\n<script>\nconst C=document.getElementById('canvas');\nconst ctx=C.getContext('2d');\nconst TILE=20, COLS=20, ROWS=20;\nlet snake,dir,nextDir,food,score,hiScore=0,running=false,loop;\n\nfunction rnd(max){return Math.floor(Math.random()*max);}\nfunction spawnFood(){\n  let f;\n  do{ f={x:rnd(COLS),y:rnd(ROWS)}; }\n  while(snake.some(s=>s.x===f.x&&s.y===f.y));\n  return f;\n}\nfunction init(){\n  snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];\n  dir={x:1,y:0}; nextDir={x:1,y:0};\n  food=spawnFood(); score=0; draw();\n}\nfunction draw(){\n  // bg\n  ctx.fillStyle='#111'; ctx.fillRect(0,0,400,400);\n  // grid dots\n  ctx.fillStyle='#1a1a1a';\n  for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) ctx.fillRect(x*TILE+9,y*TILE+9,2,2);\n  // food\n  const fx=food.x*TILE, fy=food.y*TILE;\n  ctx.shadowColor='#ef4444'; ctx.shadowBlur=12;\n  ctx.fillStyle='#ef4444'; ctx.beginPath();\n  ctx.arc(fx+TILE/2,fy+TILE/2,TILE/2-2,0,Math.PI*2); ctx.fill();\n  ctx.shadowBlur=0;\n  // snake\n  snake.forEach((s,i)=>{\n    const grad=ctx.createLinearGradient(s.x*TILE,s.y*TILE,s.x*TILE+TILE,s.y*TILE+TILE);\n    grad.addColorStop(0, i===0?'#4ade80':'#22c55e');\n    grad.addColorStop(1, i===0?'#22c55e':'#16a34a');\n    ctx.fillStyle=grad;\n    ctx.shadowColor='#22c55e'; ctx.shadowBlur=i===0?14:4;\n    const r=i===0?5:4;\n    const px=s.x*TILE+1, py=s.y*TILE+1, pw=TILE-2, ph=TILE-2;\n    ctx.beginPath(); ctx.roundRect(px,py,pw,ph,r); ctx.fill();\n  });\n  ctx.shadowBlur=0;\n  document.getElementById('sc').textContent=score;\n}\nfunction step(){\n  dir={...nextDir};\n  const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};\n  // wall wrap\n  head.x=(head.x+COLS)%COLS; head.y=(head.y+ROWS)%ROWS;\n  // self collision\n  if(snake.some(s=>s.x===head.x&&s.y===head.y)){gameOver();return;}\n  snake.unshift(head);\n  if(head.x===food.x&&head.y===food.y){\n    score+=10; if(score>hiScore)hiScore=score;\n    food=spawnFood();\n    document.getElementById('hi').textContent=hiScore;\n  } else { snake.pop(); }\n  draw();\n}\nfunction gameOver(){\n  clearInterval(loop); running=false;\n  document.getElementById('oTitle').textContent='Game Over!';\n  document.getElementById('oMsg').textContent='Dein Ergebnis:';\n  const os=document.getElementById('oScore');\n  os.textContent=score+' Punkte'; os.classList.remove('hidden');\n  document.getElementById('oBtn').textContent='🔄 Nochmal';\n  document.getElementById('overlay').classList.remove('hidden');\n}\nfunction startGame(){\n  document.getElementById('overlay').classList.add('hidden');\n  document.getElementById('oScore').classList.add('hidden');\n  init(); running=true;\n  const speed=Math.max(80, 150-Math.floor(score/50)*10);\n  clearInterval(loop);\n  loop=setInterval(()=>{ step(); },200);\n}\ndocument.getElementById('oBtn').addEventListener('click',startGame);\n// Keys\ndocument.addEventListener('keydown',e=>{\n  const k=e.key;\n  if((k==='ArrowUp'||k==='w'||k==='W')&&dir.y!==1)nextDir={x:0,y:-1};\n  else if((k==='ArrowDown'||k==='s'||k==='S')&&dir.y!==-1)nextDir={x:0,y:1};\n  else if((k==='ArrowLeft'||k==='a'||k==='A')&&dir.x!==1)nextDir={x:-1,y:0};\n  else if((k==='ArrowRight'||k==='d'||k==='D')&&dir.x!==-1)nextDir={x:1,y:0};\n  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();\n});\n// D-Pad\ndocument.querySelectorAll('#dpad button').forEach(b=>{\n  b.addEventListener('click',()=>{\n    const d=b.dataset.d;\n    if(d==='up'&&dir.y!==1)nextDir={x:0,y:-1};\n    else if(d==='down'&&dir.y!==-1)nextDir={x:0,y:1};\n    else if(d==='left'&&dir.x!==1)nextDir={x:-1,y:0};\n    else if(d==='right'&&dir.x!==-1)nextDir={x:1,y:0};\n  });\n});\n// Touch swipe\nlet tx,ty;\nC.addEventListener('touchstart',e=>{tx=e.touches[0].clientX;ty=e.touches[0].clientY;},{passive:true});\nC.addEventListener('touchend',e=>{\n  const dx=e.changedTouches[0].clientX-tx, dy=e.changedTouches[0].clientY-ty;\n  if(Math.abs(dx)>Math.abs(dy)){if(dx>20&&dir.x!==-1)nextDir={x:1,y:0};else if(dx<-20&&dir.x!==1)nextDir={x:-1,y:0};}\n  else{if(dy>20&&dir.y!==-1)nextDir={x:0,y:1};else if(dy<-20&&dir.y!==1)nextDir={x:0,y:-1};}\n},{passive:true});\ninit();\n</script>\n</body>\n</html>");
    });
    app.get('/tetris', (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send("<!DOCTYPE html>\n<html lang=\"de\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no\">\n<title>🟦 Tetris – Paradise City</title>\n<style>\n  *{box-sizing:border-box;margin:0;padding:0}\n  body{background:#0d0d0d;color:#fff;font-family:'Segoe UI',sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;user-select:none;padding:10px}\n  h1{font-size:1.6rem;margin-bottom:10px;color:#818cf8;text-shadow:0 0 18px #6366f188;letter-spacing:2px}\n  #main{display:flex;gap:18px;align-items:flex-start}\n  canvas{border:2px solid #6366f144;border-radius:8px;background:#111;box-shadow:0 0 30px #6366f122}\n  #side{display:flex;flex-direction:column;gap:14px;min-width:110px}\n  .panel{background:#161616;border:1px solid #2a2a2a;border-radius:8px;padding:12px;text-align:center}\n  .panel label{font-size:.7rem;color:#666;text-transform:uppercase;letter-spacing:1px;display:block;margin-bottom:4px}\n  .panel span{font-size:1.5rem;font-weight:700;color:#818cf8}\n  #nextCanvas{background:#111;border-radius:6px;display:block;margin:0 auto}\n  #overlay{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:#000000cc;border-radius:10px;padding:30px 40px}\n  #overlay h2{font-size:1.5rem;color:#f87171}\n  #overlay .sub{color:#aaa;font-size:.9rem}\n  #overlay .score-final{font-size:2rem;font-weight:700;color:#818cf8}\n  #overlay button{background:#6366f1;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;transition:.2s}\n  #overlay button:hover{background:#818cf8;transform:scale(1.05)}\n  #wrap{position:relative;display:inline-block}\n  #controls{margin-top:12px;color:#444;font-size:.75rem;text-align:center;line-height:1.7}\n  .hidden{display:none!important}\n  #dpad{display:none;grid-template-columns:repeat(3,52px);grid-template-rows:52px 52px;gap:4px;margin-top:12px}\n  #dpad button{background:#1a1a1a;border:1px solid #333;color:#fff;font-size:1.2rem;border-radius:8px;cursor:pointer;width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-family:monospace;touch-action:manipulation}\n  #dpad button:active{background:#6366f144}\n  @media(max-width:560px){#dpad{display:grid}#main{gap:10px}}\n</style>\n</head>\n<body>\n<h1>🟦 Tetris</h1>\n<div id=\"main\">\n  <div id=\"wrap\">\n    <canvas id=\"board\" width=\"200\" height=\"400\"></canvas>\n    <div id=\"overlay\">\n      <h2 id=\"oTitle\">Paradise City Tetris</h2>\n      <p class=\"sub\" id=\"oSub\">Baue Reihen und sammle Punkte!</p>\n      <div class=\"score-final hidden\" id=\"oScore\"></div>\n      <button id=\"oBtn\">▶ Spielen</button>\n    </div>\n  </div>\n  <div id=\"side\">\n    <div class=\"panel\">\n      <label>Punkte</label>\n      <span id=\"sc\">0</span>\n    </div>\n    <div class=\"panel\">\n      <label>Level</label>\n      <span id=\"lv\">1</span>\n    </div>\n    <div class=\"panel\">\n      <label>Reihen</label>\n      <span id=\"ln\">0</span>\n    </div>\n    <div class=\"panel\">\n      <label>Nächstes</label>\n      <canvas id=\"nextCanvas\" width=\"80\" height=\"80\"></canvas>\n    </div>\n  </div>\n</div>\n<div id=\"dpad\">\n  <div></div><button data-a=\"rot\">↻</button><div></div>\n  <button data-a=\"left\">◀</button><button data-a=\"down\">▼</button><button data-a=\"right\">▶</button>\n</div>\n<div id=\"controls\">← → Bewegen · ↑ Drehen · ↓ Schneller · Leertaste: Fallen lassen</div>\n<script>\nconst B=document.getElementById('board'), ctx=B.getContext('2d');\nconst NC=document.getElementById('nextCanvas'), nctx=NC.getContext('2d');\nconst TW=20, TH=20, COLS=10, ROWS=20;\nconst COLORS=['','#f87171','#fb923c','#facc15','#4ade80','#38bdf8','#818cf8','#f472b6'];\nconst PIECES=[\n  [],\n  [[1,1,1,1]],                          // I - red\n  [[2,0,0],[2,2,2]],                    // J - orange\n  [[0,0,3],[3,3,3]],                    // L - yellow\n  [[4,4],[4,4]],                        // O - green\n  [[0,5,5],[5,5,0]],                    // S - blue\n  [[0,6,0],[6,6,6]],                    // T - indigo\n  [[7,7,0],[0,7,7]],                    // Z - pink\n];\nlet board,piece,piecePos,nextPiece,score,level,lines,running,loop,dropCounter,lastTime;\n\nfunction rndPiece(){return Math.floor(Math.random()*7)+1;}\nfunction newPiece(t){\n  piece=PIECES[t].map(r=>[...r]);\n  piecePos={x:Math.floor(COLS/2)-Math.ceil(piece[0].length/2),y:0};\n}\nfunction rotate(m){\n  const R=m.length,C2=m[0].length,out=Array.from({length:C2},()=>Array(R).fill(0));\n  for(let r=0;r<R;r++) for(let c=0;c<C2;c++) out[c][R-1-r]=m[r][c];\n  return out;\n}\nfunction valid(p,pos){\n  return p.every((row,r)=>row.every((v,c)=>{\n    if(!v)return true;\n    const bx=pos.x+c,by=pos.y+r;\n    return bx>=0&&bx<COLS&&by<ROWS&&(by<0||!board[by][bx]);\n  }));\n}\nfunction merge(){\n  piece.forEach((row,r)=>row.forEach((v,c)=>{if(v)board[piecePos.y+r][piecePos.x+c]=v;}));\n}\nfunction clearLines(){\n  let cleared=0;\n  for(let r=ROWS-1;r>=0;r--){\n    if(board[r].every(v=>v)){board.splice(r,1);board.unshift(Array(COLS).fill(0));cleared++;r++;}\n  }\n  if(cleared){\n    const pts=[0,100,300,500,800];\n    score+=(pts[cleared]||800)*level;\n    lines+=cleared;\n    level=Math.floor(lines/10)+1;\n    document.getElementById('sc').textContent=score;\n    document.getElementById('lv').textContent=level;\n    document.getElementById('ln').textContent=lines;\n  }\n}\nfunction drawBlock(c,x,y,size,ctx2){\n  if(!c)return;\n  const col=COLORS[c];\n  ctx2.fillStyle=col;\n  ctx2.shadowColor=col; ctx2.shadowBlur=6;\n  ctx2.fillRect(x+1,y+1,size-2,size-2);\n  ctx2.shadowBlur=0;\n  ctx2.fillStyle='rgba(255,255,255,0.15)';\n  ctx2.fillRect(x+1,y+1,size-2,4);\n}\nfunction drawBoard(){\n  ctx.fillStyle='#111'; ctx.fillRect(0,0,COLS*TW,ROWS*TH);\n  // grid\n  ctx.strokeStyle='#1c1c1c'; ctx.lineWidth=0.5;\n  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*TW,0);ctx.lineTo(x*TW,ROWS*TH);ctx.stroke();}\n  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*TH);ctx.lineTo(COLS*TW,y*TH);ctx.stroke();}\n  // board cells\n  board.forEach((row,r)=>row.forEach((v,c)=>drawBlock(v,c*TW,r*TH,TW,ctx)));\n  // ghost piece\n  let ghostY=piecePos.y;\n  while(valid(piece,{x:piecePos.x,y:ghostY+1}))ghostY++;\n  if(ghostY!==piecePos.y){\n    piece.forEach((row,r)=>row.forEach((v,c)=>{\n      if(!v)return;\n      ctx.fillStyle='rgba(255,255,255,0.08)';\n      ctx.fillRect((piecePos.x+c)*TW+1,(ghostY+r)*TH+1,TW-2,TH-2);\n    }));\n  }\n  // active piece\n  piece.forEach((row,r)=>row.forEach((v,c)=>drawBlock(v,(piecePos.x+c)*TW,(piecePos.y+r)*TH,TW,ctx)));\n}\nfunction drawNext(){\n  nctx.fillStyle='#111'; nctx.fillRect(0,0,80,80);\n  const p=PIECES[nextPiece];\n  const ox=Math.floor((4-p[0].length)/2)*16+8;\n  const oy=Math.floor((4-p.length)/2)*16+8;\n  p.forEach((row,r)=>row.forEach((v,c)=>drawBlock(v,ox+c*16,oy+r*16,16,nctx)));\n}\nfunction drop(){\n  piecePos.y++;\n  if(!valid(piece,piecePos)){\n    piecePos.y--;\n    merge();\n    clearLines();\n    const nt=nextPiece; nextPiece=rndPiece();\n    newPiece(nt);\n    drawNext();\n    if(!valid(piece,piecePos)){gameOver();return;}\n  }\n}\nfunction hardDrop(){\n  while(valid(piece,{x:piecePos.x,y:piecePos.y+1}))piecePos.y++;\n  drop();\n}\nfunction gameOver(){\n  clearInterval(loop); running=false;\n  document.getElementById('oTitle').textContent='Game Over!';\n  document.getElementById('oSub').textContent='Dein Ergebnis:';\n  const os=document.getElementById('oScore');\n  os.textContent=score+' Punkte'; os.classList.remove('hidden');\n  document.getElementById('oBtn').textContent='🔄 Nochmal';\n  document.getElementById('overlay').classList.remove('hidden');\n}\nfunction startGame(){\n  document.getElementById('overlay').classList.add('hidden');\n  document.getElementById('oScore').classList.add('hidden');\n  board=Array.from({length:ROWS},()=>Array(COLS).fill(0));\n  score=0;level=1;lines=0;\n  ['sc','lv','ln'].forEach(id=>document.getElementById(id).textContent=id==='sc'||id==='ln'?0:1);\n  nextPiece=rndPiece(); newPiece(rndPiece()); drawNext(); running=true;\n  clearInterval(loop);\n  loop=setInterval(()=>{drop();drawBoard();},Math.max(200,800-level*40));\n}\ndocument.getElementById('oBtn').addEventListener('click',startGame);\ndocument.addEventListener('keydown',e=>{\n  if(!running)return;\n  if(e.key==='ArrowLeft'){const np={x:piecePos.x-1,y:piecePos.y};if(valid(piece,np))piecePos=np;}\n  else if(e.key==='ArrowRight'){const np={x:piecePos.x+1,y:piecePos.y};if(valid(piece,np))piecePos=np;}\n  else if(e.key==='ArrowDown'){drop();}\n  else if(e.key==='ArrowUp'){const r=rotate(piece);if(valid(r,piecePos))piece=r;}\n  else if(e.key===' '){hardDrop();}\n  else return;\n  e.preventDefault();\n  drawBoard();\n});\ndocument.querySelectorAll('#dpad button').forEach(b=>{\n  b.addEventListener('click',()=>{\n    if(!running)return;\n    const a=b.dataset.a;\n    if(a==='left'){const np={x:piecePos.x-1,y:piecePos.y};if(valid(piece,np)){piecePos=np;drawBoard();}}\n    else if(a==='right'){const np={x:piecePos.x+1,y:piecePos.y};if(valid(piece,np)){piecePos=np;drawBoard();}}\n    else if(a==='down'){drop();drawBoard();}\n    else if(a==='rot'){const r=rotate(piece);if(valid(r,piecePos)){piece=r;drawBoard();}}\n  });\n});\n// initial draw\nboard=Array.from({length:ROWS},()=>Array(COLS).fill(0));\npiece=[[0]]; piecePos={x:0,y:0};\nctx.fillStyle='#111'; ctx.fillRect(0,0,COLS*TW,ROWS*TH);\n</script>\n</body>\n</html>");
    });

  

  // ── LAPD DASHBOARD ──────────────────────────────────────────────────────────

  const LAPD_GUILD_ID = '1498482541751963698';
  const LAPD_RANKS = [
    { id:'1498483674667028543', name:'Chief of Police',  ebene:'leitung'   },
    { id:'1498483758532395008', name:'Deputy Chief',     ebene:'leitung'   },
    { id:'1498483802740363357', name:'Captain',          ebene:'befehl'    },
    { id:'1498484140935217172', name:'Lieutenant',       ebene:'befehl'    },
    { id:'1498484185491312690', name:'Staff Sergeant',   ebene:'befehl'    },
    { id:'1498484299329179658', name:'Sergeant',         ebene:'befehl'    },
    { id:'1498484388428779550', name:'Detective III',    ebene:'detective' },
    { id:'1498484584017559773', name:'Detective II',     ebene:'detective' },
    { id:'1498484636211482685', name:'Detective I',      ebene:'detective' },
    { id:'1498484724824408214', name:'Senior Officer',   ebene:'officer'   },
    { id:'1498484934720098365', name:'Officer',          ebene:'officer'   },
    { id:'1498485048565960754', name:'Officer Trainee',  ebene:'officer'   },
    { id:'1498485086071554169', name:'Rookie',           ebene:'officer'   },
  ];
  const LAPD_DUTY_CHANNEL = '1492939533895860504';
  const LAPD_PW    = { leitung:'LAPD_Chief_2025', befehl:'LAPD_Command_2025', detective:'LAPD_Detective_2025', officer:'LAPD_Officer_2025' };
  const LAPD_EBENE = {
    leitung:   { label:'Command Staff',      color:'#ffd700' },
    befehl:    { label:'Supervisory Staff',  color:'#42a5f5' },
    detective: { label:'Detective Division', color:'#ab47bc' },
    officer:   { label:'Officer Division',   color:'#66bb6a' },
  };
  const LAPD_ERANK      = { leitung:3, befehl:2, detective:1, officer:0 };
  const LAPD_VAC_NOTIFY = ['1498483674667028543','1498483758532395008','1498483802740363357'];

  const LAPD_DUTY_FILE  = path.join(DATA_DIR, 'lapd_duty.json');
  const LAPD_EMBED_FILE = path.join(DATA_DIR, 'lapd_duty_embed.json');
  const LAPD_ANN_FILE   = path.join(DATA_DIR, 'lapd_announcements.json');
  const LAPD_VAC_FILE   = path.join(DATA_DIR, 'lapd_vacations.json');
  const LAPD_WARN_FILE  = path.join(DATA_DIR, 'lapd_warnings.json');

  function lj(f,d){ try{ return JSON.parse(fs.readFileSync(f,'utf8')); }catch{ return d; } }
  function sj(f,d){ try{ fs.writeFileSync(f,JSON.stringify(d,null,2),'utf8'); }catch(e){ console.error('sj',e.message); } }
  function loadDuty(){ return lj(LAPD_DUTY_FILE,{}); }
  function saveDuty(d){ sj(LAPD_DUTY_FILE,d); }
  function loadAnn(){ return lj(LAPD_ANN_FILE,[]); }
  function saveAnn(d){ sj(LAPD_ANN_FILE,d); }
  function loadVac(){ return lj(LAPD_VAC_FILE,[]); }
  function saveVac(d){ sj(LAPD_VAC_FILE,d); }
  function loadWarn(){ return lj(LAPD_WARN_FILE,[]); }
  function saveWarn(d){ sj(LAPD_WARN_FILE,d); }
  function isLapdAuth(req){ return !!(req.session && req.session.lapd && req.session.lapd.userId); }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function genId(){ return require('crypto').randomBytes(10).toString('hex'); }

  // ── Duty Embed ───────────────────────────────────────────────────────────
  const { EmbedBuilder: _DEB } = require('discord.js');
  async function updateDutyEmbed(){
    try {
      const duty = loadDuty();
      const list = Object.values(duty).filter(d=>d.onDuty)
        .sort((a,b)=>(LAPD_ERANK[b.ebene]||0)-(LAPD_ERANK[a.ebene]||0));
      const emojis = { leitung:'🟡', befehl:'🔵', detective:'🟣', officer:'🟢' };
      const embed = new _DEB()
        .setColor(0x1565c0)
        .setTitle('🛡️ LAPD — Officers On Duty')
        .setDescription(list.length===0
          ? '⚫  **No officers currently on duty.**'
          : list.map(d=>(emojis[d.ebene]||'🟢')+' **'+d.displayName+'** — '+d.rankName).join('\n'))
        .setTimestamp()
        .setFooter({ text:'Los Angeles Police Department • Paradise City Roleplay' });
      const stored = lj(LAPD_EMBED_FILE,{});
      const ch = await client.channels.fetch(LAPD_DUTY_CHANNEL).catch(()=>null);
      if (!ch) return;
      if (stored.messageId) {
        const msg = await ch.messages.fetch(stored.messageId).catch(()=>null);
        if (msg){ await msg.edit({ embeds:[embed] }); return; }
      }
      const m = await ch.send({ embeds:[embed] });
      sj(LAPD_EMBED_FILE, { messageId:m.id });
    } catch(e){ console.error('updateDutyEmbed:',e.message); }
  }
  setTimeout(()=>updateDutyEmbed(), 7000);
  module.exports.updateLapdDutyEmbed = updateDutyEmbed;

  // ── Login CSS / helpers ──────────────────────────────────────────────────
  const LCSS = '*{box-sizing:border-box;margin:0;padding:0}body{background:#080d1a;color:#e0e0e0;font-family:"Segoe UI",sans-serif;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}.card{background:#0d1b2e;border:1px solid #1a3a6b;border-radius:14px;padding:36px 32px;width:100%;max-width:420px;box-shadow:0 0 50px rgba(21,101,192,.25)}.badge{text-align:center;margin-bottom:24px}.badge .ico{font-size:4rem}.badge h1{font-size:1.5rem;font-weight:800;color:#ffd700;letter-spacing:3px;margin-top:8px}.badge .sub{font-size:.75rem;color:#90caf9;letter-spacing:1px;margin-top:3px}hr{border:none;border-top:1px solid #1a3a6b;margin:20px 0}.err{background:rgba(183,28,28,.15);border:1px solid #b71c1c;border-radius:8px;padding:11px 14px;margin-bottom:16px;color:#ef9a9a;font-size:.88rem}.info{background:rgba(21,101,192,.15);border:1px solid #1565c0;border-radius:8px;padding:14px;margin-bottom:16px;color:#90caf9;font-size:.88rem;line-height:1.6}.u-hint{color:#90caf9;font-size:.85rem;margin-bottom:14px}.fg{margin-bottom:15px}.fg label{display:block;font-size:.75rem;color:#90caf9;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}.fg input,.fg select{width:100%;background:#060c1a;border:1px solid #1a3a6b;color:#e0e0e0;padding:11px 14px;border-radius:8px;font-size:.95rem;outline:none;transition:.2s}.fg input:focus,.fg select:focus{border-color:#1565c0;box-shadow:0 0 0 2px rgba(21,101,192,.3)}.fg select option{background:#060c1a}.btn{width:100%;background:#1565c0;color:#fff;border:none;padding:13px;border-radius:8px;font-size:1rem;font-weight:700;cursor:pointer;transition:.2s;margin-top:4px;touch-action:manipulation}.btn:hover{background:#1976d2}.foot{margin-top:28px;color:#1a3a6b;font-size:.7rem;letter-spacing:1px;text-align:center}';
  const LHEAD  = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>LAPD</title><style>'+LCSS+'</style></head><body>';
  const LBADGE = '<div class="badge"><div class="ico">🛡️</div><h1>LAPD</h1><div class="sub">LOS ANGELES POLICE DEPARTMENT</div><div class="sub">Paradise City Roleplay</div></div><hr>';
  const LFOOT  = '<div class="foot">LAPD INTERNES SYSTEM • UNBEFUGTER ZUGRIFF VERBOTEN</div></body></html>';

  // ── GET /lapd ────────────────────────────────────────────────────────────
  app.get('/lapd', (req,res)=>{
    if (isLapdAuth(req)) return res.redirect('/lapd/dashboard');
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(LHEAD+'<div class="card">'+LBADGE+'<div class="info">📱 Nutze den <strong>🛡️ Dashboard öffnen</strong>-Button in Discord.<br>Der Bot schickt dir einen persönlichen Link — kein Benutzername erforderlich.</div></div>'+LFOOT);
  });

  // ── GET /lapd/auth/:token ────────────────────────────────────────────────
  app.get('/lapd/auth/:token', (req,res)=>{
    if (isLapdAuth(req)) return res.redirect('/lapd/dashboard');
    const entry = lapdTokens.get(req.params.token);
    if (!entry || Date.now()>entry.expires) {
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.send(LHEAD+'<div class="card">'+LBADGE+'<div class="err">⚠️ Dieser Link ist abgelaufen. Bitte klicke erneut auf den Button in Discord.</div></div>'+LFOOT);
    }
    const errHtml = req.query.err==='pw' ? '<div class="err">⚠️ Falsches Passwort. Bitte versuche es erneut.</div>' : '';
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if (entry.ranks.length === 1) {
      // Nur ein Rang → kein Dropdown, direkt Passwort
      res.send(LHEAD+'<div class="card">'+LBADGE+errHtml+
        '<p class="u-hint">👤 <strong>'+esc(entry.uname)+'</strong> &mdash; <span style="color:'+LAPD_EBENE[entry.ranks[0].ebene].color+'">'+esc(entry.ranks[0].name)+'</span></p>'+
        '<form method="POST" action="/lapd/auth/'+req.params.token+'">'+
        '<input type="hidden" name="rankIdx" value="0">'+
        '<div class="fg"><label>Passwort</label><input type="password" name="password" placeholder="••••••••" required autocomplete="current-password" autofocus></div>'+
        '<button class="btn" type="submit">🔓 Einloggen</button></form></div>'+LFOOT);
    } else {
      const opts = entry.ranks.map((r,i)=>
        '<option value="'+i+'">'+esc(r.name)+' — '+LAPD_EBENE[r.ebene].label+'</option>'
      ).join('');
      res.send(LHEAD+'<div class="card">'+LBADGE+errHtml+
        '<p class="u-hint">👤 <strong>'+esc(entry.uname)+'</strong></p>'+
        '<form method="POST" action="/lapd/auth/'+req.params.token+'">'+
        '<div class="fg"><label>Rang auswählen</label><select name="rankIdx" required>'+opts+'</select></div>'+
        '<div class="fg"><label>Passwort</label><input type="password" name="password" placeholder="••••••••" required autocomplete="current-password"></div>'+
        '<button class="btn" type="submit">🔓 Einloggen</button></form></div>'+LFOOT);
    }
  });

  // ── POST /lapd/auth/:token ───────────────────────────────────────────────
  app.post('/lapd/auth/:token', async (req,res)=>{
    const entry = lapdTokens.get(req.params.token);
    if (!entry || Date.now()>entry.expires) { req.session.lapdError='expired'; return res.redirect('/lapd'); }
    const idx  = parseInt(req.body.rankIdx,10);
    const rank = entry.ranks[isNaN(idx)?-1:idx];
    if (!rank) return res.redirect('/lapd/auth/'+req.params.token);
    if ((req.body.password||'').trim() !== LAPD_PW[rank.ebene])
      return res.redirect('/lapd/auth/'+req.params.token+'?err=pw');
    try {
      let guild = client.guilds.cache.get(LAPD_GUILD_ID);
      if (!guild) guild = await client.guilds.fetch(LAPD_GUILD_ID).catch(()=>null);
      const member = guild ? await guild.members.fetch(entry.memberId).catch(()=>null) : null;
      if (!member||!member.roles.cache.has(rank.id)) { req.session.lapdError='role'; return res.redirect('/lapd'); }
      req.session.lapd = { userId:entry.memberId, username:member.user.username, displayName:member.displayName,
        rankId:rank.id, rankName:rank.name, ebene:rank.ebene, loginTime:Date.now() };
      lapdTokens.delete(req.params.token);
      return res.redirect('/lapd/dashboard');
    } catch { req.session.lapdError='fail'; return res.redirect('/lapd'); }
  });

  app.get('/lapd/lookup',(req,res)=>res.redirect('/lapd'));
  app.get('/lapd/login', (req,res)=>res.redirect('/lapd'));
  app.get('/lapd/reset', (req,res)=>res.redirect('/lapd'));
  app.post('/lapd/lookup',(req,res)=>res.redirect('/lapd'));
  app.post('/lapd/login', (req,res)=>res.redirect('/lapd'));

  // ── POST /lapd/logout ────────────────────────────────────────────────────
  app.post('/lapd/logout',(req,res)=>{ req.session.lapd=null; res.redirect('/lapd'); });

  // ── POST /lapd/api/duty/toggle ───────────────────────────────────────────
  app.post('/lapd/api/duty/toggle', async (req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    const duty = loadDuty();
    const cur = !!(duty[s.userId] && duty[s.userId].onDuty);
    if (cur) { if (duty[s.userId]) duty[s.userId].onDuty=false; }
    else duty[s.userId] = { onDuty:true, userId:s.userId, displayName:s.displayName, rankName:s.rankName, ebene:s.ebene, since:Date.now() };
    saveDuty(duty);
    updateDutyEmbed().catch(()=>{});
    res.json({ ok:true, onDuty:!cur });
  });

  // ── GET /lapd/api/duty ───────────────────────────────────────────────────
  app.get('/lapd/api/duty',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const duty = loadDuty();
    const s = req.session.lapd;
    const list = Object.values(duty).filter(d=>d.onDuty)
      .sort((a,b)=>(LAPD_ERANK[b.ebene]||0)-(LAPD_ERANK[a.ebene]||0));
    res.json({ ok:true, list, onDuty:!!(duty[s.userId]&&duty[s.userId].onDuty) });
  });

  // ── GET/POST/DELETE /lapd/api/announcements ──────────────────────────────
  app.get('/lapd/api/announcements',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const ann = loadAnn().sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.ts-a.ts);
    res.json({ ok:true, items:ann });
  });
  app.post('/lapd/api/announcements',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    if (s.ebene!=='leitung') return res.status(403).json({ ok:false, msg:'Command Staff only' });
    const { title, content } = req.body;
    if (!title||!content) return res.json({ ok:false, msg:'Title and content required' });
    const ann = loadAnn();
    ann.push({ id:genId(), title:String(title).slice(0,100), content:String(content).slice(0,2000),
      authorId:s.userId, authorName:s.displayName, rankName:s.rankName, ts:Date.now(), pinned:false });
    saveAnn(ann);
    res.json({ ok:true });
  });
  app.post('/lapd/api/announcements/:id/pin',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    if (req.session.lapd.ebene!=='leitung') return res.status(403).json({ ok:false });
    const ann = loadAnn();
    const item = ann.find(a=>a.id===req.params.id);
    if (!item) return res.json({ ok:false });
    item.pinned=!item.pinned; saveAnn(ann);
    res.json({ ok:true, pinned:item.pinned });
  });
  app.delete('/lapd/api/announcements/:id',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    if (req.session.lapd.ebene!=='leitung') return res.status(403).json({ ok:false });
    saveAnn(loadAnn().filter(a=>a.id!==req.params.id));
    res.json({ ok:true });
  });

  // ── GET/POST /lapd/api/vacations ─────────────────────────────────────────
  app.get('/lapd/api/vacations',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const mine = loadVac().filter(v=>v.userId===req.session.lapd.userId).sort((a,b)=>b.ts-a.ts);
    res.json({ ok:true, items:mine });
  });
  app.post('/lapd/api/vacations', async (req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    const { from, to, note } = req.body;
    if (!from||!to) return res.json({ ok:false, msg:'From and to dates required' });
    if (new Date(to)<new Date(from)) return res.json({ ok:false, msg:'End date must be after start date' });
    const id = genId();
    const vac = loadVac();
    vac.push({ id, userId:s.userId, displayName:s.displayName, rankName:s.rankName, ebene:s.ebene,
      from, to, note:String(note||'').slice(0,500), status:'pending', ts:Date.now() });
    saveVac(vac);
    try {
      let guild = client.guilds.cache.get(LAPD_GUILD_ID);
      if (!guild) guild = await client.guilds.fetch(LAPD_GUILD_ID).catch(()=>null);
      if (guild) {
        await guild.members.fetch().catch(()=>{});
        const notifyMembers = new Set();
        for (const roleId of LAPD_VAC_NOTIFY)
          guild.members.cache.filter(m=>m.roles.cache.has(roleId)).forEach(m=>notifyMembers.add(m));
        const { EmbedBuilder:_VEB, ActionRowBuilder:_VARB, ButtonBuilder:_VBB, ButtonStyle:_VBS } = require('discord.js');
        const vEmbed = new _VEB()
          .setColor(0xffd700).setTitle('✈️ Vacation Request — LAPD')
          .addFields(
            { name:'Officer', value:s.displayName+' ('+s.rankName+')', inline:true },
            { name:'Division', value:LAPD_EBENE[s.ebene].label, inline:true },
            { name:'From', value:from, inline:true },
            { name:'To', value:to, inline:true },
            { name:'Note', value:String(note||'—').slice(0,300)||'—' }
          )
          .setTimestamp().setFooter({ text:'LAPD Internal • ID: '+id.slice(0,8) });
        const vRow = new _VARB().addComponents(
          new _VBB().setCustomId('lapd_vac_approve_'+id).setLabel('✅ Approve').setStyle(_VBS.Success),
          new _VBB().setCustomId('lapd_vac_reject_'+id).setLabel('❌ Reject').setStyle(_VBS.Danger),
        );
        for (const m of notifyMembers)
          if (m.id!==s.userId) m.send({ embeds:[vEmbed], components:[vRow] }).catch(()=>{});
      }
    } catch(e){ console.error('vac DM:',e.message); }
    res.json({ ok:true });
  });

  // ── GET/POST/DELETE /lapd/api/warnings ───────────────────────────────────
  app.get('/lapd/api/warnings',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd; const all = loadWarn();
    let items;
    if (s.ebene==='leitung') items=all;
    else if (s.ebene==='befehl') items=all.filter(w=>w.targetId===s.userId||w.authorId===s.userId||(LAPD_ERANK[w.targetEbene]||0)<2);
    else items=all.filter(w=>w.targetId===s.userId);
    res.json({ ok:true, items:items.sort((a,b)=>b.ts-a.ts) });
  });
  app.get('/lapd/api/members',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    if (s.ebene!=='leitung'&&s.ebene!=='befehl') return res.status(403).json({ ok:false });
    const guild = client.guilds.cache.get(LAPD_GUILD_ID);
    if (!guild) return res.json({ ok:true, items:[] });
    const seen = new Map();
    for (const rank of LAPD_RANKS) {
      if (s.ebene==='befehl' && rank.ebene==='leitung') continue;
      guild.members.cache.filter(m=>m.roles.cache.has(rank.id)).forEach(m=>{
        if (!seen.has(m.id)) seen.set(m.id,{ id:m.id, name:m.displayName||m.user.username, rankName:rank.name, ebene:rank.ebene });
      });
    }
    res.json({ ok:true, items:[...seen.values()] });
  });
  app.post('/lapd/api/warnings',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    if (s.ebene!=='leitung'&&s.ebene!=='befehl') return res.status(403).json({ ok:false, msg:'No permission' });
    const { targetId, targetName, targetRank, targetEbene, reason } = req.body;
    if (!targetId||!reason) return res.json({ ok:false, msg:'Target and reason required' });
    if (s.ebene==='befehl' && targetEbene==='leitung') return res.json({ ok:false, msg:'Supervisory Staff cannot warn Command Staff' });
    const warn = loadWarn();
    warn.push({ id:genId(), targetId, targetName:String(targetName), targetRank:String(targetRank), targetEbene:String(targetEbene),
      authorId:s.userId, authorName:s.displayName, authorRank:s.rankName, authorEbene:s.ebene,
      reason:String(reason).slice(0,1000), ts:Date.now() });
    saveWarn(warn);
    res.json({ ok:true });
  });
  app.delete('/lapd/api/warnings/:id',(req,res)=>{
    if (!isLapdAuth(req)) return res.status(401).json({ ok:false });
    const s = req.session.lapd;
    if (s.ebene!=='leitung'&&s.ebene!=='befehl') return res.status(403).json({ ok:false });
    const warn = loadWarn(); const item = warn.find(w=>w.id===req.params.id);
    if (!item) return res.json({ ok:false, msg:'Not found' });
    if (s.ebene==='befehl' && (item.targetEbene==='leitung'||item.targetEbene==='befehl') && item.authorId!==s.userId)
      return res.json({ ok:false, msg:'No permission to delete this warning' });
    saveWarn(warn.filter(w=>w.id!==req.params.id));
    res.json({ ok:true });
  });

  // ── GET /lapd/dashboard ─────────────────────────────────────────────────
  const LAPD_CSS = "*{box-sizing:border-box;margin:0;padding:0}body{background:#080d1a;color:#e0e0e0;font-family:\"Segoe UI\",sans-serif;min-height:100vh;display:flex;flex-direction:column}header{background:#0d1b2e;border-bottom:2px solid #1a3a6b;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}.hl{display:flex;align-items:center;gap:10px}.hl .ico{font-size:1.8rem}.hl h2{font-size:.95rem;font-weight:800;color:#ffd700;letter-spacing:2px}.hl p{font-size:.75rem;color:#90caf9}.hr{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.rbadge{padding:4px 12px;border-radius:20px;font-size:.75rem;font-weight:700;border:1px solid}.lbtn{background:transparent;border:1px solid #1a3a6b;color:#90caf9;padding:7px 13px;border-radius:7px;font-size:.78rem;cursor:pointer;transition:.2s}.lbtn:hover{border-color:#42a5f5;color:#42a5f5}nav{background:#0a1525;border-bottom:1px solid #1a3a6b;display:flex;overflow-x:auto}.nb{background:transparent;border:none;color:#6b7280;padding:13px 18px;font-size:.82rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:.15s}.nb:hover{color:#90caf9}.nb.act{color:#1e90ff;border-bottom-color:#1e90ff}main{flex:1;padding:20px;max-width:1000px;width:100%;margin:0 auto}.sec{background:#0d1b2e;border:1px solid #1a3a6b;border-radius:10px;margin-bottom:16px;overflow:hidden}.sh{padding:12px 18px;border-bottom:1px solid #1a3a6b;display:flex;align-items:center;justify-content:space-between;gap:8px}.sh h3{font-size:.84rem;font-weight:700;text-transform:uppercase;letter-spacing:1px}.sb{padding:16px 18px}table{width:100%;border-collapse:collapse;font-size:.84rem}th{color:#6b7280;font-size:.68rem;text-transform:uppercase;letter-spacing:1px;padding:8px 10px;text-align:left;border-bottom:1px solid #1a3a6b}td{padding:8px 10px;border-bottom:1px solid #0a0f1e}tr:last-child td{border-bottom:none}tr:hover td{background:#060c1a}.muted{color:#374151;font-size:.84rem;padding:8px 0}.fg{margin-bottom:12px}.fg label{display:block;font-size:.72rem;color:#90caf9;text-transform:uppercase;letter-spacing:1px;margin-bottom:5px}.fg input,.fg select,.fg textarea{width:100%;background:#060c1a;border:1px solid #1a3a6b;color:#e0e0e0;padding:9px 12px;border-radius:7px;font-size:.88rem;outline:none;transition:.2s;font-family:inherit}.fg input:focus,.fg select:focus,.fg textarea:focus{border-color:#1565c0}.fg select option{background:#060c1a}.fg textarea{resize:vertical;min-height:80px}.row{display:flex;gap:10px;flex-wrap:wrap}.row .fg{flex:1;min-width:140px}.btn{background:#1565c0;color:#fff;border:none;padding:9px 18px;border-radius:7px;font-size:.84rem;font-weight:700;cursor:pointer;transition:.2s}.btn:hover{background:#1976d2}.btn.red{background:#7f1d1d}.btn.red:hover{background:#991b1b}.btn.grn{background:#14532d}.btn.grn:hover{background:#166534}.btn.sm{padding:5px 11px;font-size:.75rem}.btn.ghost{background:transparent;border:1px solid #1a3a6b;color:#90caf9}.btn.ghost:hover{border-color:#42a5f5;color:#42a5f5}.pin-badge{color:#ffd700;font-size:.7rem;font-weight:700;margin-left:6px}.ann-card{border:1px solid #1a3a6b;border-radius:8px;padding:14px;margin-bottom:10px;background:#060c1a}.ann-card.pinned{border-color:#ffd700}.ann-card h4{font-size:.9rem;font-weight:700;margin-bottom:6px}.ann-card .meta{font-size:.72rem;color:#6b7280;margin-bottom:8px}.ann-card .body{font-size:.85rem;line-height:1.5;white-space:pre-wrap;word-break:break-word}.ann-acts{display:flex;gap:6px;margin-top:10px}.vac-badge{padding:3px 10px;border-radius:10px;font-size:.7rem;font-weight:700}.vac-badge.pending{background:rgba(255,193,7,.15);color:#ffc107;border:1px solid #ffc107}.vac-badge.approved{background:rgba(76,175,80,.15);color:#66bb6a;border:1px solid #66bb6a}.vac-badge.rejected{background:rgba(183,28,28,.15);color:#ef9a9a;border:1px solid #b71c1c}.flash{padding:10px 14px;border-radius:7px;margin-bottom:12px;font-size:.84rem}.flash.ok{background:rgba(76,175,80,.15);border:1px solid #388e3c;color:#a5d6a7}.flash.err{background:rgba(183,28,28,.15);border:1px solid #b71c1c;color:#ef9a9a}@media(max-width:600px){header{padding:10px 14px}main{padding:12px}}";

  app.get('/lapd/dashboard', (req,res)=>{
    if (!isLapdAuth(req)) return res.redirect('/lapd');
    const s       = req.session.lapd;
    const eInfo   = LAPD_EBENE[s.ebene];
    const canPost  = s.ebene==='leitung';
    const canWarn  = s.ebene==='leitung'||s.ebene==='befehl';
    const clientJs = (function buildClientJs(userId, ebene, displayName, rankName, canPost, canWarn) {
  return `
const ME={userId:${JSON.stringify(userId)},ebene:${JSON.stringify(ebene)},displayName:${JSON.stringify(displayName)},rankName:${JSON.stringify(rankName)},canPost:${canPost},canWarn:${canWarn}};
const ECOLOR={leitung:"#ffd700",befehl:"#42a5f5",detective:"#ab47bc",officer:"#66bb6a"};
const ELABEL={leitung:"Command Staff",befehl:"Supervisory Staff",detective:"Detective Division",officer:"Officer Division"};

function showTab(t){
  document.querySelectorAll(".nb").forEach(b=>b.classList.toggle("act",b.dataset.t===t));
  document.querySelectorAll(".tsec").forEach(s=>s.style.display="none");
  const el=document.getElementById("t-"+t);
  if(el){el.style.display="";loadTab(t);}
}
function loadTab(t){
  if(t==="board")loadBoard();
  else if(t==="duty")loadDuty();
  else if(t==="vacation")loadVacation();
  else if(t==="warnings")loadWarnings();
}
function flash(el,msg,ok){
  el.innerHTML='<div class="flash '+(ok?"ok":"err")+'">'+escH(msg)+'</div>';
  setTimeout(()=>{el.innerHTML="";},4000);
}
function escH(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function fdate(ts){return new Date(ts).toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});}
function ftime(ts){const d=new Date(ts);return d.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit"});}

// ── BOARD ──────────────────────────────────────────────────────────────────
async function loadBoard(){
  const el=document.getElementById("board-content");
  el.innerHTML='<p class="muted">Lädt...</p>';
  const r=await fetch("/lapd/api/announcements").then(x=>x.json()).catch(()=>({ok:false}));
  if(!r.ok){el.innerHTML='<p class="muted">Laden fehlgeschlagen.</p>';return;}
  if(!r.items.length){el.innerHTML='<p class="muted">Noch keine Ankündigungen.</p>';return;}
  el.innerHTML=r.items.map(a=>{
    const cls="ann-card"+(a.pinned?" pinned":"");
    const pinLabel=a.pinned?"Anpinnen aufheben":"📌 Anpinnen";
    const acts=ME.canPost?('<div class="ann-acts"><button class="btn sm ghost pin-btn">'+pinLabel+'</button><button class="btn sm red del-btn">🗑️ Löschen</button></div>'):"";
    const pinBadge=a.pinned?'<span class="pin-badge">📌 ANGEPINNT</span>':"";
    return '<div class="'+cls+'" data-id="'+a.id+'"><h4>'+escH(a.title)+pinBadge+'</h4><div class="meta">'+escH(a.authorName)+' ('+escH(a.rankName)+') &bull; '+fdate(a.ts)+'</div><div class="body">'+escH(a.content)+'</div>'+acts+'</div>';
  }).join("");
  el.querySelectorAll(".pin-btn").forEach(b=>b.addEventListener("click",()=>togglePin(b.closest(".ann-card").dataset.id)));
  el.querySelectorAll(".del-btn").forEach(b=>b.addEventListener("click",()=>delAnn(b.closest(".ann-card").dataset.id)));
}
async function postAnn(e){
  e.preventDefault();
  const fd=new FormData(e.target);
  const r=await fetch("/lapd/api/announcements",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:fd.get("title"),content:fd.get("content")})}).then(x=>x.json()).catch(()=>({ok:false}));
  flash(document.getElementById("ann-flash"),r.ok?"Ankündigung gepostet!":r.msg||"Fehler",r.ok);
  if(r.ok){e.target.reset();loadBoard();}
}
async function togglePin(id){
  await fetch("/lapd/api/announcements/"+id+"/pin",{method:"POST"}).catch(()=>{});
  loadBoard();
}
async function delAnn(id){
  if(!confirm("Ankündigung wirklich löschen?"))return;
  await fetch("/lapd/api/announcements/"+id,{method:"DELETE"}).catch(()=>{});
  loadBoard();
}

// ── DUTY ───────────────────────────────────────────────────────────────────
async function loadDuty(){
  const el=document.getElementById("duty-content");
  el.innerHTML='<p class="muted">Lädt...</p>';
  const r=await fetch("/lapd/api/duty").then(x=>x.json()).catch(()=>({ok:false}));
  if(!r.ok){el.innerHTML='<p class="muted">Laden fehlgeschlagen.</p>';return;}
  const btn=document.getElementById("duty-btn");
  if(btn){
    btn.textContent=r.onDuty?"🔴 Dienst beenden":"🟢 Dienst antreten";
    btn.className="btn "+(r.onDuty?"red":"grn");
  }
  if(!r.list.length){el.innerHTML='<p class="muted">Derzeit kein Officer im Dienst.</p>';return;}
  el.innerHTML='<table><thead><tr><th>Name</th><th>Rang</th><th>Abteilung</th><th>Seit</th></tr></thead><tbody>'+
    r.list.map(d=>'<tr><td>'+escH(d.displayName)+'</td><td>'+escH(d.rankName)+'</td>'+
      '<td style="color:'+(ECOLOR[d.ebene]||"#e0e0e0")+'">'+(ELABEL[d.ebene]||d.ebene)+'</td>'+
      '<td>'+ftime(d.since)+'</td></tr>').join("")+
    '</tbody></table>';
}
async function toggleDuty(){
  const btn=document.getElementById("duty-btn");
  btn.disabled=true;
  const r=await fetch("/lapd/api/duty/toggle",{method:"POST"}).then(x=>x.json()).catch(()=>({ok:false}));
  btn.disabled=false;
  if(r.ok)loadDuty();
}

// ── VACATION ───────────────────────────────────────────────────────────────
async function loadVacation(){
  const el=document.getElementById("vac-list");
  el.innerHTML='<p class="muted">Lädt...</p>';
  const r=await fetch("/lapd/api/vacations").then(x=>x.json()).catch(()=>({ok:false}));
  if(!r.ok){el.innerHTML='<p class="muted">Laden fehlgeschlagen.</p>';return;}
  if(!r.items.length){el.innerHTML='<p class="muted">Noch keine Urlaubsanträge.</p>';return;}
  el.innerHTML='<table><thead><tr><th>Von</th><th>Bis</th><th>Notiz</th><th>Status</th></tr></thead><tbody>'+
    r.items.map(v=>{
      const statusDE={pending:"AUSSTEHEND",approved:"GENEHMIGT",rejected:"ABGELEHNT"};
      const badge='<span class="vac-badge '+v.status+'">'+(statusDE[v.status]||v.status.toUpperCase())+'</span>';
      const rej=v.rejectReason?('<br><small style="color:#ef9a9a">'+escH(v.rejectReason)+'</small>'):"";
      return '<tr><td>'+escH(v.from)+'</td><td>'+escH(v.to)+'</td><td>'+escH(v.note||"—")+'</td><td>'+badge+rej+'</td></tr>';
    }).join("")+
    '</tbody></table>';
}
async function submitVac(e){
  e.preventDefault();
  const fd=new FormData(e.target);
  const r=await fetch("/lapd/api/vacations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from:fd.get("from"),to:fd.get("to"),note:fd.get("note")})}).then(x=>x.json()).catch(()=>({ok:false}));
  flash(document.getElementById("vac-flash"),r.ok?"Antrag gestellt! Command Staff wird ihn prüfen.":r.msg||"Fehler",r.ok);
  if(r.ok){e.target.reset();loadVacation();}
}

// ── WARNINGS ───────────────────────────────────────────────────────────────
let allMembers=[];
async function loadWarnings(){
  const el=document.getElementById("warn-content");
  el.innerHTML='<p class="muted">Lädt...</p>';
  const r=await fetch("/lapd/api/warnings").then(x=>x.json()).catch(()=>({ok:false}));
  if(!r.ok){el.innerHTML='<p class="muted">Laden fehlgeschlagen.</p>';return;}
  if(!r.items.length){el.innerHTML='<p class="muted">Keine Verwarnungen vorhanden.</p>';return;}
  const canWarn=ME.canWarn;
  el.innerHTML='<table><thead><tr><th>Datum</th><th>Officer</th><th>Grund</th><th>Ausgestellt von</th>'+(canWarn?'<th></th>':'')+
    '</tr></thead><tbody>'+
    r.items.map(w=>{
      const delBtn=canWarn?('<td><button class="btn sm red dw-btn">🗑️</button></td>'):"";
      return '<tr data-id="'+w.id+'"><td>'+fdate(w.ts)+'</td>'+
        '<td><strong>'+escH(w.targetName)+'</strong><br><small style="color:#6b7280">'+escH(w.targetRank)+'</small></td>'+
        '<td style="white-space:pre-wrap">'+escH(w.reason)+'</td>'+
        '<td>'+escH(w.authorName)+'<br><small style="color:#6b7280">'+escH(w.authorRank)+'</small></td>'+delBtn+'</tr>';
    }).join("")+
    '</tbody></table>';
  el.querySelectorAll(".dw-btn").forEach(b=>b.addEventListener("click",()=>delWarn(b.closest("tr").dataset.id)));
}
async function loadMembersForWarn(){
  if(allMembers.length)return;
  const r=await fetch("/lapd/api/members").then(x=>x.json()).catch(()=>({ok:false,items:[]}));
  allMembers=r.items||[];
  const sel=document.getElementById("warn-target");
  if(sel){
    sel.innerHTML='<option value="">— Officer auswählen —</option>'+
      allMembers.map(m=>{
        const val=m.id+"||"+m.name+"||"+m.rankName+"||"+m.ebene;
        return '<option value="'+escH(val)+'">'+escH(m.name)+' — '+escH(m.rankName)+'</option>';
      }).join("");
  }
}
async function submitWarn(e){
  e.preventDefault();
  const fd=new FormData(e.target);
  const tv=fd.get("target")||"";
  const parts=tv.split("||");
  if(parts.length<4){flash(document.getElementById("warn-flash"),"Bitte einen Officer auswählen",false);return;}
  const r=await fetch("/lapd/api/warnings",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetId:parts[0],targetName:parts[1],targetRank:parts[2],targetEbene:parts[3],reason:fd.get("reason")})}).then(x=>x.json()).catch(()=>({ok:false}));
  flash(document.getElementById("warn-flash"),r.ok?"Verwarnung ausgestellt.":r.msg||"Fehler",r.ok);
  if(r.ok){e.target.reset();loadWarnings();}
}
async function delWarn(id){
  if(!confirm("Verwarnung wirklich löschen?"))return;
  const r=await fetch("/lapd/api/warnings/"+id,{method:"DELETE"}).then(x=>x.json()).catch(()=>({ok:false}));
  flash(document.getElementById("warn-flash"),r.ok?"Verwarnung gelöscht.":r.msg||"Fehler",r.ok);
  if(r.ok)loadWarnings();
}

document.addEventListener("DOMContentLoaded",()=>showTab("board"));
`.trim();
})(s.userId, s.ebene, s.displayName, s.rankName, canPost, canWarn);

    const postForm = canPost ?
      '<div class="sec"><div class="sh" style="border-left:3px solid #ffd700"><h3 style="color:#ffd700">📝 Neue Ankündigung</h3></div>'+
      '<div class="sb"><div id="ann-flash"></div>'+
      '<form onsubmit="postAnn(event)">'+
      '<div class="fg"><label>Titel</label><input type="text" name="title" maxlength="100" required placeholder="Titel der Ankündigung"></div>'+
      '<div class="fg"><label>Inhalt</label><textarea name="content" maxlength="2000" required placeholder="Ankündigung verfassen..."></textarea></div>'+
      '<button class="btn" type="submit">📌 Ankündigung posten</button></form></div></div>' : '';

    const warnForm = canWarn ?
      '<div class="sec" style="margin-top:16px"><div class="sh" style="border-left:3px solid #ef9a9a"><h3 style="color:#ef9a9a">⚠️ Verwarnung ausstellen</h3></div>'+
      '<div class="sb"><div id="warn-flash"></div>'+
      '<form onsubmit="submitWarn(event)">'+
      '<div class="fg"><label>Officer</label><select id="warn-target" name="target" required onclick="loadMembersForWarn()"><option value="">— Officer auswählen —</option></select></div>'+
      '<div class="fg"><label>Grund</label><textarea name="reason" maxlength="1000" required placeholder="Grund der Verwarnung..."></textarea></div>'+
      '<button class="btn red" type="submit">⚠️ Verwarnung ausstellen</button></form></div></div>' : '';

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(
      '<!DOCTYPE html><html lang="en"><head>'+
      '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">'+
      '<title>LAPD Dashboard</title><style>'+LAPD_CSS+'</style></head><body>'+
      '<header>'+
      '<div class="hl"><div class="ico">🛡️</div><div>'+
      '<h2>LAPD DASHBOARD</h2><p>'+esc(s.displayName)+' &mdash; <span style="color:'+eInfo.color+'">'+esc(s.rankName)+'</span></p>'+
      '</div></div>'+
      '<div class="hr">'+
      '<span class="rbadge" style="border-color:'+eInfo.color+';color:'+eInfo.color+'">'+esc(eInfo.label)+'</span>'+
      '<form method="POST" action="/lapd/logout" style="display:inline"><button class="lbtn" type="submit">Logout</button></form>'+
      '</div></header>'+
      '<nav>'+
      '<button class="nb act" data-t="board" onclick="showTab(\'board\')">📋 Schwarzes Brett</button>'+
      '<button class="nb" data-t="duty" onclick="showTab(\'duty\')">🕐 Dienst</button>'+
      '<button class="nb" data-t="vacation" onclick="showTab(\'vacation\')">✈️ Urlaub</button>'+
      '<button class="nb" data-t="warnings" onclick="showTab(\'warnings\')">⚠️ Verwarnungen</button>'+
      '</nav>'+
      '<main>'+
      '<div class="tsec" id="t-board">'+postForm+
      '<div class="sec"><div class="sh" style="border-left:3px solid #1e90ff"><h3 style="color:#1e90ff">📋 Ankündigungen</h3></div>'+
      '<div class="sb"><div id="board-content"><p class="muted">Lädt...</p></div></div></div>'+
      '</div>'+
      '<div class="tsec" id="t-duty" style="display:none">'+
      '<div class="sec"><div class="sh" style="border-left:3px solid #66bb6a"><h3 style="color:#66bb6a">🕐 Dienststatus</h3>'+
      '<button id="duty-btn" class="btn grn" onclick="toggleDuty()">🟢 Dienst antreten</button></div>'+
      '<div class="sb"><div id="duty-content"><p class="muted">Lädt...</p></div></div></div>'+
      '</div>'+
      '<div class="tsec" id="t-vacation" style="display:none">'+
      '<div class="sec"><div class="sh" style="border-left:3px solid #ffd700"><h3 style="color:#ffd700">✈️ Urlaub beantragen</h3></div>'+
      '<div class="sb"><div id="vac-flash"></div>'+
      '<form onsubmit="submitVac(event)">'+
      '<div class="row"><div class="fg"><label>Von</label><input type="date" name="from" required></div>'+
      '<div class="fg"><label>Bis</label><input type="date" name="to" required></div></div>'+
      '<div class="fg"><label>Notiz (optional)</label><input type="text" name="note" maxlength="500" placeholder="Grund oder Anmerkung..."></div>'+
      '<button class="btn" type="submit">📨 Antrag stellen</button></form></div></div>'+
      '<div class="sec" style="margin-top:16px"><div class="sh" style="border-left:3px solid #ffd700"><h3 style="color:#ffd700">📄 Meine Urlaubsanträge</h3></div>'+
      '<div class="sb"><div id="vac-list"></div></div></div>'+
      '</div>'+
      '<div class="tsec" id="t-warnings" style="display:none">'+warnForm+
      '<div class="sec" style="margin-top:16px"><div class="sh" style="border-left:3px solid #ef9a9a"><h3 style="color:#ef9a9a">⚠️ Verwarnungen</h3></div>'+
      '<div class="sb"><div id="warn-content"></div></div></div>'+
      '</div>'+
      '</main><script>'+clientJs+'</script></body></html>'
    );
  });

  // ── Start ────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, '0.0.0.0', () => console.log('Web-Server running on port '+PORT));

};
module.exports.tokens      = rubbellosTokens;
module.exports.lottoTokens = lottoTokens;


