/**
 * Führerschein-System — Los Angeles Driver License
 * Generates CA-style driver license images and handles web routes
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const FS_ROLE_ID = '1490855729635135489'; // Führerschein-Rolle — anpassen falls nötig
const FS_CHANNEL = '1490882590012604538'; // Kanal für /führerschein Command
const FS_CREATE_CH = '1490882590012604538'; // Wo neuer FS gepostet wird

module.exports = function initFuehrerschein(app, DATA_DIR, client, express) {
  const FS_DIR   = path.join(DATA_DIR, 'fuehrerschein');
  const FS_FILE  = path.join(FS_DIR, 'lizenzen.json');
  const FS_TOK   = path.join(FS_DIR, 'tokens.json');
  if (!fs.existsSync(FS_DIR)) fs.mkdirSync(FS_DIR, { recursive: true });

  function loadFS()  { try { return JSON.parse(fs.readFileSync(FS_FILE,'utf8')); } catch { return {}; } }
  function saveFS(d) { fs.writeFileSync(FS_FILE, JSON.stringify(d,null,2),'utf8'); }
  function loadTok() { try { return JSON.parse(fs.readFileSync(FS_TOK,'utf8')); } catch { return {}; } }
  function saveTok(d){ fs.writeFileSync(FS_TOK, JSON.stringify(d,null,2),'utf8'); }

  function genToken(userId, createdBy) {
    const tok = crypto.randomBytes(24).toString('hex');
    const toks = loadTok();
    for (const [k,v] of Object.entries(toks)) { if(v.userId===userId) delete toks[k]; }
    toks[tok] = { userId, createdBy, expiresAt: Date.now() + 48*60*60*1000 };
    saveTok(toks);
    return tok;
  }

  function validateToken(tok) {
    const toks = loadTok();
    const e = toks[tok];
    return (!e || e.expiresAt < Date.now()) ? null : e;
  }

  // ── Build license number (CA-style: 1 letter + 7 digits) ──────────────────
  function genLicenseNo() {
    const letter = 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random()*22)];
    const digits = Math.floor(1000000 + Math.random()*8999999);
    return letter + digits;
  }

  // ── Generate CA-style license image as PNG Buffer ─────────────────────────
  async function generateLicenseImage(data, photoPath) {
    const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
    // Load all available system fonts so text renders correctly on any host
    try { GlobalFonts.loadSystemFonts(); } catch {}
    const W = 856, H = 540;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // Background — CA dark blue
    ctx.fillStyle = '#003087';
    ctx.fillRect(0, 0, W, H);

    // Gold border
    ctx.strokeStyle = '#FDB913';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, W-8, H-8);
    ctx.lineWidth = 2;
    ctx.strokeRect(16, 16, W-32, H-32);

    // Font helper — works on servers with or without system fonts
    const F = (size, bold) => `${bold?'bold ':''} ${size}px Arial, DejaVu Sans, Liberation Sans, Helvetica, sans-serif`;

    // State name
    ctx.fillStyle = '#FDB913';
    ctx.font = F(28, true);
    ctx.textAlign = 'center';
    ctx.fillText('STATE OF CALIFORNIA', W/2, 55);

    ctx.fillStyle = '#ffffff';
    ctx.font = F(22, true);
    ctx.fillText('DEPARTMENT OF MOTOR VEHICLES', W/2, 82);

    // DL title
    ctx.fillStyle = '#FDB913';
    ctx.font = F(32, true);
    ctx.textAlign = 'left';
    ctx.fillText('DRIVER LICENSE', 200, 128);

    // License class badge
    ctx.fillStyle = '#FDB913';
    ctx.fillRect(W-130, 100, 110, 50);
    ctx.fillStyle = '#003087';
    ctx.font = F(14, true);
    ctx.textAlign = 'center';
    ctx.fillText('CLASS', W-75, 120);
    ctx.font = F(24, true);
    ctx.fillText(data.klasse || 'C', W-75, 142);

    // Photo box
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(22, 100, 160, 200);
    ctx.strokeStyle = '#FDB913';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 100, 160, 200);

    if (photoPath && fs.existsSync(photoPath)) {
      try {
        const photo = await loadImage(photoPath);
        ctx.drawImage(photo, 22, 100, 160, 200);
      } catch {}
    } else {
      ctx.fillStyle = '#aaaaaa';
      ctx.font = F(14, false);
      ctx.textAlign = 'center';
      ctx.fillText('PHOTO', 102, 205);
    }

    // Separator line
    ctx.strokeStyle = '#FDB913';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(200, 140); ctx.lineTo(W-20, 140); ctx.stroke();

    // Fields
    function field(label, value, x, y, maxW) {
      ctx.fillStyle = '#FDB913';
      ctx.font = F(11, true);
      ctx.textAlign = 'left';
      ctx.fillText(label.toUpperCase(), x, y);
      ctx.fillStyle = '#ffffff';
      ctx.font = F(16, false);
      let txt = String(value||'');
      if (maxW && ctx.measureText(txt).width > maxW) {
        while (txt.length > 0 && ctx.measureText(txt+'…').width > maxW) txt = txt.slice(0,-1);
        txt += '…';
      }
      ctx.fillText(txt, x, y+18);
    }

    ctx.textAlign = 'left';
    const lx = 200;
    field('LAST NAME', data.nachname, lx, 158, 300);
    field('FIRST NAME', data.vorname, lx, 196, 300);
    field('ADDRESS', data.adresse || 'Los Santos, CA', lx, 234, 430);
    field('CITY', data.city || 'Los Santos', lx, 272, 200);

    // Right side of fields
    const rx = W/2 + 60;
    field('DATE OF BIRTH', data.geburtsdatum, rx, 158, 180);
    field('SEX', data.geschlecht === 'Weiblich' ? 'F' : 'M', rx, 196, 80);
    field('HGT', data.koerpergroesse || '-', rx+80, 196, 80);
    field('EYE', data.augenfarbe || '-', rx, 234, 100);
    field('HAIR', data.haarfarbe || '-', rx+90, 234, 100);

    // License number + expiry
    ctx.strokeStyle = '#FDB913';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(22, 318); ctx.lineTo(W-22, 318); ctx.stroke();

    field('DL', data.lizenznummer, 22, 338, 200);
    field('EXP', data.ablaufdatum, 240, 338, 140);
    field('ISS', data.ausstellungsdatum, 400, 338, 140);
    field('RESTRICTIONS', data.einschraenkungen || 'NONE', 560, 338, 250);

    // PSN / Player tag
    ctx.strokeStyle = '#FDB913';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(22, 372); ctx.lineTo(W-22, 372); ctx.stroke();

    ctx.fillStyle = '#FDB913';
    ctx.font = F(11, true);
    ctx.fillText('PSN:', 22, 390);
    ctx.fillStyle = '#ffffff';
    ctx.font = F(14, false);
    ctx.fillText(data.psn || '-', 70, 390);

    // Bottom bar
    ctx.fillStyle = '#FDB913';
    ctx.fillRect(22, 410, W-44, 40);
    ctx.fillStyle = '#003087';
    ctx.font = F(13, true);
    ctx.textAlign = 'center';
    ctx.fillText('PARADISE CITY ROLEPLAY  •  CALIFORNIA DMV  •  NOT A REAL LICENSE', W/2, 436);

    // Watermark diagonal
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#ffffff';
    ctx.font = F(72, true);
    ctx.textAlign = 'center';
    ctx.translate(W/2, H/2);
    ctx.rotate(-Math.PI/6);
    ctx.fillText('CALIFORNIA', 0, 0);
    ctx.restore();

    return canvas.toBuffer('image/png');
  }

  // ── Route: GET /fuehrerschein/create/:token — Formular ────────────────────
  app.get('/fuehrerschein/create/:token', (req, res) => {
    const entry = validateToken(req.params.token);
    if (!entry) return res.send(buildErrPage('Link ungültig oder abgelaufen', 'Bitte einen neuen Link anfordern.'));
    const tok = req.params.token;
    const html = `<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Führerschein erstellen — Paradise City</title>
<style>
  :root{--bg:#0d1117;--card:#161b22;--border:#30363d;--orange:#e65100;--text:#e6edf3;--sub:#8b949e;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;padding:20px;}
  .card{background:var(--card);border:1px solid var(--border);border-radius:8px;max-width:720px;margin:20px auto;padding:32px;}
  h1{color:var(--orange);font-size:1.4em;margin-bottom:4px;display:flex;align-items:center;gap:10px;}
  .sub{color:var(--sub);font-size:.85em;margin-bottom:24px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .form-row.one{grid-template-columns:1fr;}
  .form-group{display:flex;flex-direction:column;gap:6px;}
  label{font-size:.8em;color:var(--sub);font-weight:600;text-transform:uppercase;letter-spacing:.05em;}
  .req{color:var(--orange);}
  input,select{background:#0d1117;border:1px solid var(--border);border-radius:6px;color:var(--text);padding:10px 12px;font-size:.95em;width:100%;}
  input:focus,select:focus{outline:none;border-color:var(--orange);}
  .btn{background:var(--orange);color:#fff;border:none;border-radius:6px;padding:12px 28px;font-size:1em;font-weight:700;cursor:pointer;margin-top:8px;width:100%;}
  .btn:hover{background:#bf360c;}
  .alert{background:#2d1b0e;border:1px solid var(--orange);border-radius:6px;padding:12px 16px;margin-bottom:16px;font-size:.85em;color:#ffb74d;}
  .section-title{color:var(--orange);font-size:.85em;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:20px 0 12px;border-bottom:1px solid var(--border);padding-bottom:6px;}
  @media(max-width:600px){.form-row{grid-template-columns:1fr;}}
</style></head><body>
<div class="card">
  <h1>🚗 Führerschein erstellen</h1>
  <p class="sub">Los Angeles, California — Paradise City Roleplay</p>
  ${req.query.err ? `<div class="alert">❌ ${req.query.err}</div>` : ''}
  <form method="POST" action="/fuehrerschein/create/${tok}" enctype="multipart/form-data">
    <div class="section-title">Persönliche Daten</div>
    <div class="form-row">
      <div class="form-group"><label>Vorname <span class="req">*</span></label><input name="vorname" required placeholder="John"></div>
      <div class="form-group"><label>Nachname <span class="req">*</span></label><input name="nachname" required placeholder="Smith"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Geburtsdatum <span class="req">*</span></label><input name="geburtsdatum" required placeholder="MM/DD/YYYY" inputmode="numeric" maxlength="10" oninput="autoDate(this)"></div>
      <div class="form-group"><label>Geschlecht <span class="req">*</span></label>
        <select name="geschlecht" required><option value="" disabled selected>Bitte wählen</option><option>Männlich</option><option>Weiblich</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>PSN-Name <span class="req">*</span></label><input name="psn" required placeholder="dein_psn_name"></div>
      <div class="form-group"><label>Körpergröße</label><input name="koerpergroesse" placeholder='5\'11"'></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Augenfarbe</label><input name="augenfarbe" placeholder="BRN"></div>
      <div class="form-group"><label>Haarfarbe</label><input name="haarfarbe" placeholder="BLK"></div>
    </div>

    <div class="section-title">Adresse (Los Angeles)</div>
    <div class="form-row one">
      <div class="form-group"><label>Straße <span class="req">*</span></label><input name="adresse" required placeholder="123 Vinewood Blvd"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Stadt</label><input name="city" placeholder="Los Santos" value="Los Santos"></div>
      <div class="form-group"><label>ZIP</label><input name="zip" placeholder="90001"></div>
    </div>

    <div class="section-title">Führerschein-Details</div>
    <div class="form-row">
      <div class="form-group"><label>Fahrzeugklasse <span class="req">*</span></label>
        <select name="klasse" required>
          <option value="" disabled selected>Bitte wählen</option>
          <option value="C">Class C — Standard (PKW)</option>
          <option value="A">Class A — Schwere LKW/Anhänger</option>
          <option value="B">Class B — Mittlere LKW</option>
          <option value="M">Class M — Motorrad</option>
        </select>
      </div>
      <div class="form-group"><label>Einschränkungen</label><input name="einschraenkungen" placeholder="NONE"></div>
    </div>

    <div class="section-title">Foto (optional)</div>
    <div class="form-row one">
      <div class="form-group"><label>Passfoto</label><input type="file" name="foto" accept="image/*"></div>
    </div>

    <button type="submit" class="btn">🚗 Führerschein erstellen</button>
  </form>
</div>
<script>
function autoDate(el){
  var v=el.value.replace(/[^0-9]/g,'');
  if(v.length>2) v=v.slice(0,2)+'/'+v.slice(2);
  if(v.length>5) v=v.slice(0,5)+'/'+v.slice(5,9);
  el.value=v;
}
</script>
</body></html>`;
    res.send(html);
  });

  // ── Route: POST /fuehrerschein/create/:token — Verarbeitung ───────────────
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5*1024*1024 } });

  app.post('/fuehrerschein/create/:token', upload.single('foto'), async (req, res) => {
    const entry = validateToken(req.params.token);
    if (!entry) return res.send(buildErrPage('Link ungültig', 'Bitte neuen Link anfordern.'));

    const { vorname, nachname, geburtsdatum, adresse, city, zip, geschlecht, klasse, einschraenkungen, psn, koerpergroesse, augenfarbe, haarfarbe } = req.body;
    const missingFields = [vorname, nachname, geburtsdatum, adresse, geschlecht, klasse, psn].some(f => !f?.trim());
    if (missingFields) return res.redirect(`/fuehrerschein/create/${req.params.token}?err=${encodeURIComponent('Bitte alle Pflichtfelder ausfüllen.')}`);

    // Save photo
    let photoPath = null;
    if (req.file) {
      const ext = req.file.mimetype.includes('png') ? 'png' : req.file.mimetype.includes('webp') ? 'webp' : 'jpg';
      photoPath = path.join(FS_DIR, entry.userId + '_foto.' + ext);
      try { fs.writeFileSync(photoPath, req.file.buffer); } catch {}
    } else {
      // Check if ausweis photo exists
      for (const ext of ['jpg','png','webp']) {
        const p = path.join(DATA_DIR, 'uploads', entry.userId + '.' + ext);
        if (fs.existsSync(p)) { photoPath = p; break; }
      }
    }

    const heute = new Date();
    const ablauf = new Date(heute.getFullYear()+5, heute.getMonth(), heute.getDate());
    const fmtDate = d => (d.getMonth()+1).toString().padStart(2,'0')+'/'+d.getDate().toString().padStart(2,'0')+'/'+d.getFullYear();

    const fsData = {
      userId:          entry.userId,
      createdBy:       entry.createdBy,
      vorname:         (vorname||'').trim(),
      nachname:        (nachname||'').trim(),
      geburtsdatum:    (geburtsdatum||'').trim(),
      adresse:         (adresse||'').trim(),
      city:            (city||'Los Santos').trim(),
      zip:             (zip||'90001').trim(),
      geschlecht:      (geschlecht||'').trim(),
      klasse:          (klasse||'C').trim(),
      einschraenkungen:(einschraenkungen||'NONE').trim(),
      psn:             (psn||'').trim(),
      koerpergroesse:  (koerpergroesse||'').trim(),
      augenfarbe:      (augenfarbe||'').trim(),
      haarfarbe:       (haarfarbe||'').trim(),
      lizenznummer:    genLicenseNo(),
      ausstellungsdatum: fmtDate(heute),
      ablaufdatum:     fmtDate(ablauf),
      createdAt:       new Date().toISOString(),
      entzogen:        false,
    };

    const all = loadFS();
    all[entry.userId] = fsData;
    saveFS(all);

    // Invalidate token
    const toks = loadTok();
    delete toks[req.params.token];
    saveTok(toks);

    // Kein Channel-Post, keine Rollenvergabe beim Erstellen

    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fertig</title><style>body{background:#0d1117;color:#e6edf3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}</style></head><body><div style="font-size:3em">🚗</div><h2 style="color:#e65100">Führerschein erfolgreich erstellt!</h2><p style="color:#8b949e">Du kannst dieses Fenster schließen.</p></body></html>`);
  });

  // ── Route: GET /fuehrerschein/image/:userId ────────────────────────────────
  app.get('/fuehrerschein/image/:userId', async (req, res) => {
    const all = loadFS();
    const d = all[req.params.userId];
    if (!d) return res.status(404).send('Not found');
    // Find photo
    let photoPath = null;
    for (const ext of ['jpg','png','webp']) {
      const p = path.join(FS_DIR, req.params.userId + '_foto.' + ext);
      if (fs.existsSync(p)) { photoPath = p; break; }
      const p2 = path.join(DATA_DIR, 'uploads', req.params.userId + '.' + ext);
      if (fs.existsSync(p2)) { photoPath = p2; break; }
    }
    try {
      const buf = await generateLicenseImage(d, photoPath);
      res.setHeader('Content-Type','image/png');
      res.setHeader('Cache-Control','public, max-age=3600');
      res.send(buf);
    } catch(e) {
      res.status(500).send('Image generation failed: ' + e.message);
    }
  });

  // ── Route: GET /fuehrerschein/view/:userId — HTML Ansicht ─────────────────
  app.get('/fuehrerschein/view/:userId', (req, res) => {
    const all = loadFS();
    const d = all[req.params.userId];
    if (!d) return res.status(404).send(buildErrPage('Nicht gefunden', 'Kein Führerschein für diesen Nutzer.'));
    const imgSrc = `/fuehrerschein/image/${req.params.userId}`;
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Führerschein</title><style>body{background:#0d1117;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}</style></head><body><img src="${imgSrc}" style="max-width:100%;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5)"></body></html>`);
  });

  // ── GET /api/fuehrerschein/list — für LAPD Dashboard ──────────────────────
  app.get('/api/fuehrerschein/list', (req, res) => {
    res.json(Object.values(loadFS()));
  });

  // ── POST /api/fuehrerschein/entziehen — Führerschein entziehen ───────────
  app.post('/api/fuehrerschein/entziehen', express.json(), async (req, res) => {
    const { userId, dauer, grund } = req.body;
    const all = loadFS();
    if (!all[userId]) return res.status(404).json({ error: 'Nicht gefunden' });
    const dauerMs = parseInt(dauer) || 0; // 0 = unbefristet
    all[userId].entzogen = true;
    all[userId].entzogenBis = dauerMs ? Date.now() + dauerMs : null;
    all[userId].entzogenGrund = grund || 'Kein Grund';
    all[userId].entzogenAt = Date.now();
    saveFS(all);
    // Remove role
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(userId).catch(()=>null) : null;
      if (member) await member.roles.remove(FS_ROLE_ID).catch(()=>{});
      // DM user
      const user = await client.users.fetch(userId).catch(()=>null);
      if (user) {
        const { EmbedBuilder } = require('discord.js');
        await user.send({ embeds: [new EmbedBuilder()
          .setColor(0xdc2626)
          .setTitle('🚫 Führerschein entzogen')
          .setDescription('Dein Führerschein wurde entzogen.')
          .addFields(
            { name: 'Grund', value: grund || 'Kein Grund', inline: false },
            { name: 'Dauer', value: dauerMs ? `${Math.round(dauerMs/86400000)} Tag(e)` : 'Unbefristet', inline: true },
            { name: 'Entzogen bis', value: dauerMs ? `<t:${Math.floor((Date.now()+dauerMs)/1000)}:F>` : 'Bis auf Weiteres', inline: true }
          )
          
        ] }).catch(()=>{});
      }
    } catch {}
    res.json({ ok: true });
  });

  // ── POST /api/fuehrerschein/zurueckgeben ──────────────────────────────────
  app.post('/api/fuehrerschein/zurueckgeben', express.json(), async (req, res) => {
    const { userId } = req.body;
    const all = loadFS();
    if (!all[userId]) return res.status(404).json({ error: 'Nicht gefunden' });
    all[userId].entzogen = false;
    all[userId].entzogenBis = null;
    all[userId].entzogenGrund = null;
    saveFS(all);
    // Re-assign role
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(userId).catch(()=>null) : null;
      if (member) await member.roles.add(FS_ROLE_ID).catch(()=>{});
      const user = await client.users.fetch(userId).catch(()=>null);
      if (user) {
        const { EmbedBuilder } = require('discord.js');
        await user.send({ embeds: [new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle('✅ Führerschein zurückgegeben')
          .setDescription('Dein Führerschein wurde zurückgegeben. Du darfst wieder Fahrzeuge führen.')
          
        ] }).catch(()=>{});
      }
    } catch {}
    res.json({ ok: true });
  });

  // ── POST /api/fuehrerschein/loeschen ─────────────────────────────────────
  app.post('/api/fuehrerschein/loeschen', express.json(), (req, res) => {
    const { userId } = req.body;
    const all = loadFS();
    if (!all[userId]) return res.status(404).json({ error: 'Nicht gefunden' });
    // Remove photo
    for (const ext of ['jpg','png','webp']) {
      try { fs.unlinkSync(path.join(FS_DIR, userId + '_foto.' + ext)); } catch {}
    }
    delete all[userId];
    saveFS(all);
    res.json({ ok: true });
  });

  // ── Token getter (for index.js) ────────────────────────────────────────────
  return { genToken, loadFS, FS_CHANNEL, FS_ROLE_ID };
};

function buildErrPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>body{background:#0d1117;color:#e6edf3;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:16px}</style></head><body><div style="font-size:3em">❌</div><h2 style="color:#f85149">${title}</h2><p style="color:#8b949e">${msg}</p></body></html>`;
}
