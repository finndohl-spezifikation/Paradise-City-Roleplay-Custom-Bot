const express = require('express');
const multer  = require('multer');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

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
  return `<p class="warning-text">⚠️ Bitte gebe hier korrekte Daten zu deinem Charakter an.<br>Änderungen sind nur durch den RP Tod möglich.</p>`;
}

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
<style>${CSS}</style></head><body>
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
      <input type="text" id="${prefix}geburtsdatum_${idx}" name="${prefix}geburtsdatum_${idx}" placeholder="TT.MM.JJJJ" required>
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
  <div class="form-row one">
    <div class="form-group">
      <label for="${prefix}psn_${idx}">PSN Name <span class="req">*</span></label>
      <input type="text" id="${prefix}psn_${idx}" name="${prefix}psn_${idx}" value="${escHtml(vals && vals[prefix+'psn_'+idx] || '')}" required placeholder="dein_psn_name">
    </div>
  </div>`;
}

module.exports = function startWebServer(client, DATA_DIR) {
  const app        = express();
  const CODES_FILE   = path.join(DATA_DIR, 'einreise_codes.json');
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
    if (!member.roles.cache.has(ROLE_REMOVE)) return { ok: false, reason: `Discord ID \`${userId}\` hat noch nicht die Rolle für Neubürger. Trete dem Server bei und warte auf die Rolle.` };
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
  app.get('/einreise/legal', (req, res) => {
    const error = req.session.legalError || '';
    delete req.session.legalError;
    const legalForm = req.session.legalFormData || {}; delete req.session.legalFormData;
    res.send(page('Legale Einreise', `
      ${header('Legale Einreise — Ausweis Erstellung')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/einreise/legal" enctype="multipart/form-data" id="legalForm">

          
          <p class="section-title">📋 IC Charakter Daten</p>
          ${charFields('', 0, legalForm)}

          <hr class="divider">
          <p class="section-title">📷 Passbild</p>
          <div class="form-row one">
            <div class="form-group">
              <label>PSN Name <span class="req">*</span></label>
              <input type="text" name="psn" required placeholder="dein_psn_name">
            </div>
          </div>
          <div class="form-row one">
            <div class="form-group">
              <label>Passbild Hinzufügen <span class="req">*</span></label>
              <div class="file-box">
                <input type="file" name="foto" accept="image/*" required id="fotoInput">
                <div class="file-label"><span>📷</span>Passbild Hinzufügen<br><small style="color:#555">JPG / PNG — max. 8 MB</small></div>
                <div class="file-name"></div>
              </div>
            </div>
          </div>

            <hr class="divider">
            <p class="section-title">👤 Discord Mitglied</p>
            <div class="form-row one">
              ${memberPicker('discord_id', 'Dein Discord-Account')}
            </div>

            <button type="submit" class="btn">✅ Einreise Bestätigen</button>
          ${warning()}
        </form>
      </div>
    `));
  });

  // ── POST /einreise/legal ──────────────────────────────────────────────────
  app.post('/einreise/legal', upload.single('foto'), async (req, res) => {
    const { vorname_0, nachname_0, geburtsdatum_0, geburtsort_0, nationalitaet_0, geschlecht_0, psn_0, discord_id } = req.body;

    if (!req.file) { req.session.legalError = 'Kein Passbild hochgeladen. Bitte füge ein Bild hinzu.'; req.session.legalFormData = Object.assign({},req.body); return res.redirect('/einreise/legal'); }
    if (!vorname_0 || !nachname_0 || !geburtsdatum_0 || !geburtsort_0 || !nationalitaet_0) {
      req.session.legalError = 'Bitte alle Pflichtfelder ausfüllen.'; req.session.legalFormData = Object.assign({},req.body); return res.redirect('/einreise/legal');
    }
    const discordId = (discord_id || '').trim();
    if (!discordId || !/^\d{17,20}$/.test(discordId)) {
      req.session.legalError = 'Bitte gib eine gültige Discord-ID ein.';
      req.session.legalFormData = Object.assign({},req.body); return res.redirect('/einreise/legal');
    }
    // Duplikat-Prüfung: Ausweis bereits vorhanden?
      const _existAusweis = loadAusweis();
      if (_existAusweis[discordId]) {
        req.session.legalError = 'Diese Discord-ID hat bereits einen Ausweis. Eine neue Einreise ist nur über /ausweis-create durch das Team möglich.';
        req.session.legalFormData = Object.assign({},req.body); return res.redirect('/einreise/legal');
    const geschlecht_0 = (req.body.geschlecht_0 || '').trim();
    if (!geschlecht_0 || !['Männlich','Weiblich'].includes(geschlecht_0)) {
      req.session.legalError = 'Bitte wähle ein Geschlecht aus.';
      req.session.legalFormData = Object.assign({},req.body); return res.redirect('/einreise/legal');
    }
      }
    // Charakter-Rollen-Prüfung
      // Passbild als Buffer speichern (multer memory)
    try {
      const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('webp') ? 'webp' : 'jpg';
      fs.writeFileSync(path.join(DATA_DIR, 'uploads', discordId + '.' + ext), req.file.buffer);
    } catch {}
    // Ausweis speichern
    const ausweis = loadAusweis();
    ausweis[discordId] = { vorname: vorname_0, nachname: nachname_0, geburtsdatum: geburtsdatum_0, geburtsort: geburtsort_0, nationalitaet: nationalitaet_0, psn: psn_0, geschlecht: geschlecht_0 || '', createdAt: new Date().toISOString() };
    saveAusweis(ausweis);
    // Startgeld automatisch vergeben (einmalig)
    try {
      const _kf = require('path').join(DATA_DIR, 'konto.json');
      const _tf = require('path').join(DATA_DIR, 'transaktionen.json');
      let _k = {}; try { _k = JSON.parse(fs.readFileSync(_kf, 'utf8')); } catch {}
      if (!_k[discordId]) _k[discordId] = { konto: 0, schwarz: 0 };
      if (!_k[discordId]._startgeld) {
        _k[discordId].konto += 5000;
        _k[discordId]._startgeld = true;
        fs.writeFileSync(_kf, JSON.stringify(_k, null, 2));
        let _t = {}; try { _t = JSON.parse(fs.readFileSync(_tf, 'utf8')); } catch {}
        if (!_t[discordId]) _t[discordId] = [];
        _t[discordId].unshift({ ts: Date.now(), text: '+5.000 $ Startgeld (Legale Einreise)', betrag: 5000 });
        fs.writeFileSync(_tf, JSON.stringify(_t, null, 2));
      }
    } catch {}
    // Rollen vergeben
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(discordId).catch(() => null) : null;
      if (member) {
        await member.roles.remove(ROLE_REMOVE).catch(() => {});
        for (const r of [...ROLES_ALL, ...ROLES_LEGAL]) await member.roles.add(r).catch(() => {});
        await member.setNickname(`${vorname_0} ${nachname_0} | ${psn_0 || ''}`).catch(e => console.error('[Nickname] legal einzel:', e.message));
      }
    } catch (e) { console.error('Rollen Fehler legal:', e.message); }

    res.send(page('Einreise Erfolgreich', `
      ${header('Einreise Bestätigt')}
      <div class="card">
        <div class="success-wrap">
          <div class="icon">✅</div>
          <h2>Legale Einreise Bestätigt!</h2>
          <p>Willkommen in Paradise City, <strong>${vorname_0} ${nachname_0}</strong>!<br>
          Dein Charakter wurde offiziell registriert.<br>Du hast nun Zugriff auf alle legalen Aktivitäten.</p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div>
      </div>
    `));
  });

  // ── GET /einreise/illegal ─────────────────────────────────────────────────
  app.get('/einreise/illegal', (req, res) => {
    const error = req.session.illegalError || '';
    delete req.session.illegalError;
    const illForm = req.session.illegalFormData || {}; delete req.session.illegalFormData;
    res.send(page('Illegale Einreise', `
      ${header('Illegale Einreise')}
      <div class="card">
        ${error ? `<div class="error-box">⚠️ ${error}</div>` : ''}
        <form method="POST" action="/einreise/illegal" id="illegalForm">


            <p class="section-title">👤 Discord Mitglied</p>
            <div class="form-row one">
              ${memberPicker('discord_id', 'Dein Discord-Account', illForm.discord_id || '')}
            </div>
            <p class="section-title" style="margin-top:18px">🎭 Charakter Name</p>
              <div class="form-row two">
                <div class="form-group">
                  <label>Vorname <span class="req">*</span></label>
                  <input type="text" name="vorname" value="${escHtml(illForm.vorname||'')}" placeholder="Vorname" required>
                </div>
                <div class="form-group">
                  <label>Nachname <span class="req">*</span></label>
                  <input type="text" name="nachname" value="${escHtml(illForm.nachname||'')}" placeholder="Nachname" required>
                </div>
              </div>
              <div class="form-row one">
                <div class="form-group">
                  <label>PSN Name <span class="req">*</span></label>
                  <input type="text" name="psn" value="${escHtml(illForm.psn||'')}" placeholder="dein_psn_name" required>
                </div>
              </div>
              <div class="form-row one">
                <div class="form-group">
                  <label for="geschlecht_ill">Geschlecht <span class="req">*</span></label>
                  <select id="geschlecht_ill" name="geschlecht" required>
                    <option value="" disabled selected>Bitte wählen</option>
                    <option value="Männlich">Männlich</option>
                    <option value="Weiblich">Weiblich</option>
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
  app.post('/einreise/illegal', async (req, res) => {
    const { confirm, discord_id, vorname: ill_vor, nachname: ill_nach, psn: ill_psn, geschlecht: ill_geschlecht } = req.body;

    if (!confirm) { req.session.illegalError = 'Du musst die Konsequenzen bestätigen.'; req.session.illegalFormData = Object.assign({},req.body); return res.redirect('/einreise/illegal'); }

    const discordId = (discord_id || '').trim();
    if (!discordId || !/^\d{17,20}$/.test(discordId)) {
      req.session.illegalError = 'Bitte gib eine gültige Discord-ID ein.';
      req.session.illegalFormData = Object.assign({},req.body); return res.redirect('/einreise/illegal');
    }
    const illVor  = (ill_vor  || '').trim();
    const illNach = (ill_nach || '').trim();
    if (!illVor || !illNach) { req.session.illegalError = 'Bitte gib deinen Charakter Vor- und Nachnamen an.'; req.session.illegalFormData = Object.assign({},req.body); return res.redirect('/einreise/illegal'); }
    const illPsn  = (ill_psn  || '').trim();
    if (!illPsn) { req.session.illegalError = 'Bitte gib deinen PSN Namen an.'; req.session.illegalFormData = Object.assign({},req.body); return res.redirect('/einreise/illegal'); }
    // Duplikat-Prüfung
    const _existAusweisIll = loadAusweis();
    if (_existAusweisIll[discordId]) {
      req.session.illegalError = 'Diese Discord-ID hat bereits einen Ausweis. Neue Einreise nur über /ausweis-create durch das Team.';
      req.session.illegalFormData = Object.assign({},req.body); return res.redirect('/einreise/illegal');
    }
    // Charakter-Rollen-Prüfung: Spieler darf keine Charakter-Rolle mehr haben
    // Ausweis speichern
    const illAusweis = loadAusweis();
    illAusweis[discordId] = { vorname: illVor, nachname: illNach, psn: illPsn, geschlecht: illGeschlecht, typ: 'illegal', createdAt: new Date().toISOString() };
    saveAusweis(illAusweis);
    // Startgeld automatisch vergeben (einmalig, Schwarzgeld)
    try {
      const _kf = require('path').join(DATA_DIR, 'konto.json');
      const _tf = require('path').join(DATA_DIR, 'transaktionen.json');
      let _k = {}; try { _k = JSON.parse(fs.readFileSync(_kf, 'utf8')); } catch {}
      if (!_k[discordId]) _k[discordId] = { konto: 0, schwarz: 0 };
      if (!_k[discordId]._startgeld) {
        _k[discordId].schwarz += 5000;
        _k[discordId]._startgeld = true;
        fs.writeFileSync(_kf, JSON.stringify(_k, null, 2));
        let _t = {}; try { _t = JSON.parse(fs.readFileSync(_tf, 'utf8')); } catch {}
        if (!_t[discordId]) _t[discordId] = [];
        _t[discordId].unshift({ ts: Date.now(), text: '+5.000 $ Startgeld (Illegale Einreise)', betrag: 5000 });
        fs.writeFileSync(_tf, JSON.stringify(_t, null, 2));
      }
    } catch {}
    // Rollen vergeben
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(discordId).catch(() => null) : null;
      if (member) {
        await member.roles.remove(ROLE_REMOVE).catch(() => {});
        for (const r of [...ROLES_ALL, ...ROLES_ILLEGAL]) await member.roles.add(r).catch(() => {});
        await member.setNickname(`${illVor} ${illNach} | ${illPsn}`).catch(e => console.error('[Nickname] illegal einzel:', e.message));
      }
    } catch (e) { console.error('Rollen Fehler illegal:', e.message); }

    res.send(page('Einreise Erfolgreich', `
      ${header('Einreise Bestätigt')}
      <div class="card">
        <div class="success-wrap">
          <div class="icon">⚠️</div>
          <h2 style="color:#f85149">Illegale Einreise Bestätigt</h2>
          <p>Du bist nun illegal in Paradise City.<br>Bleib unter dem Radar — und pass auf dich auf.</p>
          <p style="margin-top:14px;color:#555;font-size:.8em">Du kannst dieses Fenster schließen.</p>
        </div>
      </div>
    `));
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
            ${memberPicker(`discord_id_${i}`, i === 0 ? 'Dein Mitglied (Person 1)' : `Person ${i + 1}`)}
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

    for (let i = 0; i < 4; i++) {
      const uid = (req.body[`discord_id_${i}`] || '').trim();
      if (!uid) { errors.push(`Person ${i + 1}: Discord ID fehlt.`); continue; }
      if (ids.includes(uid)) { errors.push(`Person ${i + 1}: Discord ID ${uid} doppelt.`); continue; }
      ids.push(uid);
      const _existG = loadAusweis();
      if (_existG[uid]) { errors.push(`Person ${i + 1}: Discord ID ${uid} hat bereits einen Ausweis. Neue Einreise nur über /ausweis-create.`); continue; }
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

  // ── Start ────────────────────────────────────────────────────────────────
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, '0.0.0.0', () => console.log(`🌐 Web-Server läuft auf Port ${PORT}`));
};
