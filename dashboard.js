'use strict';
// ─── Inhaber Dashboard ────────────────────────────────────────────────────────

const DASHBOARD_GUILD = '1498482541751963698';
const dashboardTokens = new Map();

module.exports.dashboardTokens = dashboardTokens;

module.exports.init = function initDashboard(app, express, DATA_DIR, client) {
  const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || 'Sitten-Strolch';

  function requireAuth(req, res, next) {
    if (req.session && req.session.dashboardAuth) return next();
    res.redirect('/dashboard/login');
  }

  // ── Token login (von DM-Link) ───────────────────────────────────────────────
  app.get('/dashboard', (req, res) => {
    const token = req.query.token || '';
    if (token) {
      const entry = dashboardTokens.get(token);
      if (entry && entry.expiresAt > Date.now()) {
        dashboardTokens.delete(token);
        if (req.session) req.session.dashboardAuth = true;
        return res.redirect('/dashboard');
      }
    }
    if (!req.session || !req.session.dashboardAuth) return res.redirect('/dashboard/login');
    res.send(buildApp());
  });

  app.get('/dashboard/login', (req, res) => {
    if (req.session && req.session.dashboardAuth) return res.redirect('/dashboard');
    res.send(buildLogin(req.query.error === '1'));
  });

  app.post('/dashboard/login', express.urlencoded({ extended: false }), (req, res) => {
    if ((req.body.password || '').trim() !== DASHBOARD_PASSWORD)
      return res.redirect('/dashboard/login?error=1');
    if (req.session) req.session.dashboardAuth = true;
    res.redirect('/dashboard');
  });

  app.get('/dashboard/logout', (req, res) => {
    if (req.session) req.session.dashboardAuth = false;
    res.redirect('/dashboard/login');
  });

  // ── Stats API ───────────────────────────────────────────────────────────────
  app.get('/dashboard/api/stats', requireAuth, async (req, res) => {
    try {
      const guild = await client.guilds.fetch(DASHBOARD_GUILD);
      await guild.members.fetch();
      const members  = guild.members.cache;
      const total    = members.filter(m => !m.user.bot).size;
      const bots     = members.filter(m =>  m.user.bot).size;
      const bans     = await guild.bans.fetch().catch(() => ({ size: 0 }));
      const uptimeSec= Math.floor(process.uptime());
      res.json({
        ok: true,
        serverName:   guild.name,
        totalMembers: total,
        bots,
        bans:         bans.size,
        roles:        guild.roles.cache.size,
        channels:     guild.channels.cache.size,
        uptime:       Math.floor(uptimeSec/3600) + 'h ' + Math.floor((uptimeSec%3600)/60) + 'min',
        created:      new Date(guild.createdAt).toLocaleDateString('de-DE'),
      });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // ── Members API ─────────────────────────────────────────────────────────────
  app.get('/dashboard/api/members', requireAuth, async (req, res) => {
    try {
      const guild = await client.guilds.fetch(DASHBOARD_GUILD);
      await guild.members.fetch();
      const q = (req.query.q || '').toLowerCase();
      const list = guild.members.cache
        .filter(m => !m.user.bot)
        .filter(m => !q || m.user.username.toLowerCase().includes(q) || (m.nickname||'').toLowerCase().includes(q) || m.user.id.includes(q))
        .map(m => ({
          id:         m.user.id,
          username:   m.user.username,
          display:    m.displayName,
          avatar:     m.user.displayAvatarURL({ size: 64 }),
          topRole:    m.roles.cache.filter(r => r.id !== guild.id).sort((a,b) => b.position - a.position).first()?.name || 'Kein',
          joinedAt:   m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('de-DE') : '—',
          isTimedOut: !!(m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now()),
        }))
        .sort((a,b) => a.username.localeCompare(b.username));
      res.json({ ok: true, members: list });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // ── Bans API ────────────────────────────────────────────────────────────────
  app.get('/dashboard/api/bans', requireAuth, async (req, res) => {
    try {
      const guild = await client.guilds.fetch(DASHBOARD_GUILD);
      const bans  = await guild.bans.fetch();
      const list  = bans.map(b => ({
        id:       b.user.id,
        username: b.user.username,
        avatar:   b.user.displayAvatarURL({ size: 64 }),
        reason:   b.reason || '—',
      })).sort((a,b) => a.username.localeCompare(b.username));
      res.json({ ok: true, bans: list });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // ── Timeout ──────────────────────────────────────────────────────────────────
  app.post('/dashboard/api/timeout', express.json(), requireAuth, async (req, res) => {
    try {
      const { userId, minutes } = req.body || {};
      if (!userId || !minutes) return res.json({ ok: false, error: 'Fehlende Parameter' });
      const guild  = await client.guilds.fetch(DASHBOARD_GUILD);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) return res.json({ ok: false, error: 'Mitglied nicht gefunden' });
      const ms = Math.min(parseInt(minutes) * 60000, 28 * 24 * 3600000);
      await member.timeout(ms, 'Inhaber Dashboard');
      try {
        const dm = await member.user.createDM();
        await dm.send({ embeds: [{ color: 0xe65100, title: '⏱️ Du wurdest getimeouted', description: `Du wurdest auf **Paradise City Roleplay** für **${minutes} Minute(n)** getimeouted.\n\nBei Fragen wende dich an das Team.` }] });
      } catch {}
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // ── Ban ──────────────────────────────────────────────────────────────────────
  app.post('/dashboard/api/ban', express.json(), requireAuth, async (req, res) => {
    try {
      const { userId, reason } = req.body || {};
      if (!userId) return res.json({ ok: false, error: 'Fehlende Parameter' });
      const guild  = await client.guilds.fetch(DASHBOARD_GUILD);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        try {
          const dm = await member.user.createDM();
          await dm.send({ embeds: [{ color: 0xe74c3c, title: '🔨 Du wurdest gebannt', description: `Du wurdest von **Paradise City Roleplay** permanent gebannt.\n\n**Grund:** ${reason || 'Kein Grund angegeben'}` }] });
        } catch {}
      }
      await guild.members.ban(userId, { reason: reason || 'Kein Grund angegeben' });
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  // ── Unban ────────────────────────────────────────────────────────────────────
  app.post('/dashboard/api/unban', express.json(), requireAuth, async (req, res) => {
    try {
      const { userId } = req.body || {};
      if (!userId) return res.json({ ok: false, error: 'Fehlende Parameter' });
      const guild = await client.guilds.fetch(DASHBOARD_GUILD);
      await guild.members.unban(userId);
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
//  HTML PAGES
// ═══════════════════════════════════════════════════════════════════════════════

function buildLogin(error) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inhaber Dashboard — Login</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0805;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:'Segoe UI',system-ui,sans-serif}
.wrap{width:100%;max-width:400px;padding:20px}
.card{background:#180e07;border:1px solid #3a1f08;border-radius:18px;padding:44px 36px;box-shadow:0 24px 80px rgba(0,0,0,.6)}
.logo{text-align:center;margin-bottom:32px}
.logo .icon{font-size:2.8em;display:block;margin-bottom:10px}
.logo h1{font-size:1.2em;font-weight:700;color:#fff;letter-spacing:.5px}
.logo p{color:#8a6040;font-size:.82em;margin-top:5px;letter-spacing:1px;text-transform:uppercase}
label{display:block;color:#c4864a;font-size:.78em;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:7px}
input[type=password]{width:100%;padding:12px 16px;background:#100804;border:1.5px solid #3a1f08;border-radius:10px;color:#ffe0c0;font-size:.95em;outline:none;transition:border .2s;letter-spacing:.05em}
input[type=password]:focus{border-color:#e65100}
.btn{width:100%;padding:13px;margin-top:20px;background:linear-gradient(135deg,#e65100,#f59e0b);color:#fff;border:none;border-radius:10px;font-size:.95em;font-weight:700;cursor:pointer;letter-spacing:.5px;transition:opacity .15s}
.btn:hover{opacity:.88}
.err{background:#1a0a06;border:1px solid #7a2a0a;color:#e09070;border-radius:8px;padding:10px 14px;margin-bottom:18px;font-size:.82em;text-align:center}
.footer{text-align:center;color:#4a2a12;font-size:.72em;margin-top:20px}
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="logo">
      <span class="icon">🏙️</span>
      <h1>Inhaber Dashboard</h1>
      <p>Paradise City Roleplay</p>
    </div>
    ${error ? '<div class="err">❌ Falsches Passwort. Bitte erneut versuchen.</div>' : ''}
    <form method="POST" action="/dashboard/login">
      <label>Passwort</label>
      <input type="password" name="password" placeholder="••••••••••••" autofocus autocomplete="current-password">
      <button class="btn" type="submit">🔓 Einloggen</button>
    </form>
  </div>
  <div class="footer">Paradise City Roleplay &bull; Nur für autorisiertes Personal</div>
</div>
</body>
</html>`;
}

function buildApp() {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inhaber Dashboard — Paradise City Roleplay</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0d0805;--bg2:#180e07;--bg3:#1e1108;--bg4:#26160a;
  --border:#3a1f08;--border2:#5a2e0e;
  --accent:#e65100;--accent2:#f59e0b;
  --green:#22c55e;--red:#ef4444;--orange:#f59e0b;
  --text:#ffe8d6;--text2:#c4864a;--text3:#6a3a1a
}
body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;overflow-x:hidden}

/* ── SIDEBAR ─────────────────────────────────────── */
#overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:90;opacity:0;pointer-events:none;transition:opacity .3s}
#overlay.on{opacity:1;pointer-events:all}
#sidebar{position:fixed;left:-300px;top:0;bottom:0;width:280px;background:var(--bg2);border-right:1px solid var(--border);z-index:100;display:flex;flex-direction:column;transition:left .3s cubic-bezier(.25,.8,.25,1)}
#sidebar.open{left:0}
.sb-head{padding:24px 20px 16px;border-bottom:1px solid var(--border)}
.sb-head .sb-logo{font-size:1.5em;font-weight:800;color:#fff;letter-spacing:.5px}
.sb-head .sb-sub{color:var(--text2);font-size:.75em;margin-top:3px;letter-spacing:.5px}
.sb-nav{flex:1;padding:12px 8px;overflow-y:auto}
.sb-section{color:var(--text3);font-size:.68em;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:14px 14px 6px}
.sb-item{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;cursor:pointer;color:var(--text2);font-size:.9em;font-weight:500;transition:all .15s;margin-bottom:2px;user-select:none}
.sb-item:hover{background:var(--bg3);color:var(--text)}
.sb-item.active{background:linear-gradient(135deg,rgba(79,124,247,.2),rgba(124,60,247,.15));color:var(--accent);border:1px solid rgba(79,124,247,.25)}
.sb-item .icon{font-size:1.1em;width:20px;text-align:center}
.sb-foot{padding:14px 16px;border-top:1px solid var(--border)}
.sb-logout{display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:10px;color:#e07070;font-size:.85em;cursor:pointer;transition:background .15s;text-decoration:none}
.sb-logout:hover{background:rgba(239,68,68,.1)}

/* ── HEADER ─────────────────────────────────────── */
header{position:sticky;top:0;background:var(--bg2);border-bottom:1px solid var(--border);padding:0 24px;height:60px;display:flex;align-items:center;gap:16px;z-index:50}
.hamburger{background:none;border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:1.2em;width:38px;height:38px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;flex-shrink:0}
.hamburger:hover{border-color:var(--accent);color:var(--accent)}
.header-title{font-weight:700;font-size:1em;color:#fff;flex:1}
.header-badge{background:var(--bg3);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:.75em;color:var(--text2)}

/* ── MAIN ────────────────────────────────────────── */
#main{padding:28px 28px 48px;max-width:1200px;margin:0 auto}
.page{display:none}
.page.active{display:block}

/* ── HOME ──────────── */
.welcome{margin-bottom:28px}
.welcome h1{font-size:1.65em;font-weight:800;color:#fff;letter-spacing:.3px}
.welcome h1 span{background:linear-gradient(135deg,var(--accent),var(--accent2));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.welcome p{color:var(--text2);margin-top:6px;font-size:.9em}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:16px}
.stat-card{background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:20px;position:relative;overflow:hidden;transition:border-color .2s}
.stat-card:hover{border-color:var(--border2)}
.stat-card .glow{position:absolute;top:-20px;right:-20px;width:80px;height:80px;border-radius:50%;filter:blur(28px);opacity:.25}
.stat-card .label{color:var(--text2);font-size:.75em;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:8px}
.stat-card .value{font-size:2em;font-weight:800;color:#fff;letter-spacing:-.5px}
.stat-card .sub{color:var(--text2);font-size:.75em;margin-top:4px}
.stat-card .ico{font-size:1.4em;margin-bottom:8px}

/* ── SECTION HEADER ─── */
.section-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:12px}
.section-hd h2{font-size:1.2em;font-weight:700;color:#fff}
.search-box{background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:9px 14px;color:var(--text);font-size:.88em;outline:none;width:260px;transition:border .2s}
.search-box::placeholder{color:var(--text3)}
.search-box:focus{border-color:var(--accent)}

/* ── MEMBER LIST ─────── */
.member-grid{display:grid;gap:10px}
.member-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all .15s}
.member-card:hover{border-color:var(--border2);background:var(--bg3)}
.m-avatar{width:42px;height:42px;border-radius:50%;flex-shrink:0;background:var(--bg3);border:2px solid var(--border)}
.m-info{flex:1;min-width:0}
.m-name{font-weight:600;font-size:.92em;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m-meta{color:var(--text2);font-size:.75em;margin-top:2px}
.m-role{background:var(--bg4);border-radius:6px;padding:2px 8px;font-size:.7em;color:var(--text2);border:1px solid var(--border)}
.m-badges{display:flex;gap:6px;flex-shrink:0}
.badge-timeout{background:rgba(245,158,11,.15);color:var(--orange);border:1px solid rgba(245,158,11,.3);border-radius:8px;padding:3px 8px;font-size:.7em;font-weight:600}
.badge-ban{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:3px 8px;font-size:.7em;font-weight:600}
.ban-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:14px}
.ban-reason{flex:1;color:var(--text2);font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.unban-btn{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:var(--green);border-radius:8px;padding:6px 14px;font-size:.78em;font-weight:700;cursor:pointer;flex-shrink:0;transition:all .15s}
.unban-btn:hover{background:rgba(34,197,94,.2)}
.empty{text-align:center;padding:50px 20px;color:var(--text3)}
.empty .e-icon{font-size:2.5em;margin-bottom:10px}
.loader{text-align:center;padding:48px;color:var(--text3);font-size:.9em}

/* ── MODAL ──────────── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:200;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:30px;width:92%;max-width:440px;animation:popIn .25s cubic-bezier(.34,1.56,.64,1)}
@keyframes popIn{from{opacity:0;transform:scale(.85) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
.modal h3{font-size:1.05em;font-weight:700;color:#fff;margin-bottom:18px;display:flex;align-items:center;gap:8px}
.modal .avatar-row{display:flex;align-items:center;gap:12px;background:var(--bg3);border-radius:10px;padding:12px;margin-bottom:18px}
.modal .avatar-row img{width:44px;height:44px;border-radius:50%;border:2px solid var(--border2)}
.modal .avatar-row .n{font-weight:700;font-size:.92em;color:#fff}
.modal .avatar-row .i{color:var(--text2);font-size:.75em;margin-top:2px}
.modal-label{color:var(--text2);font-size:.75em;font-weight:600;letter-spacing:.8px;text-transform:uppercase;margin-bottom:6px}
.modal input,.modal textarea,.modal select{width:100%;padding:10px 14px;background:var(--bg);border:1.5px solid var(--border);border-radius:9px;color:var(--text);font-size:.88em;outline:none;margin-bottom:14px;transition:border .2s;font-family:inherit;resize:vertical}
.modal input:focus,.modal textarea:focus,.modal select:focus{border-color:var(--accent)}
.modal-btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px}
.mbtn{padding:11px;border:none;border-radius:9px;font-size:.85em;font-weight:700;cursor:pointer;transition:all .15s;letter-spacing:.3px}
.mbtn-cancel{background:var(--bg3);color:var(--text2);border:1px solid var(--border)}
.mbtn-cancel:hover{background:var(--bg4)}
.mbtn-timeout{background:rgba(245,158,11,.15);color:var(--orange);border:1px solid rgba(245,158,11,.35)}
.mbtn-timeout:hover{background:rgba(245,158,11,.25)}
.mbtn-ban{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.35)}
.mbtn-ban:hover{background:rgba(239,68,68,.25)}
.mbtn-confirm{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff}
.mbtn-confirm:hover{opacity:.88}
.modal-err{background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);color:#e07070;border-radius:7px;padding:8px 12px;font-size:.8em;margin-bottom:12px;display:none}
.modal-ok{background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:var(--green);border-radius:7px;padding:8px 12px;font-size:.8em;margin-bottom:12px;display:none}

@media(max-width:600px){
  #main{padding:16px 14px 48px}
  .stats-grid{grid-template-columns:repeat(2,1fr)}
  .search-box{width:100%}
  .section-hd{flex-direction:column;align-items:flex-start}
  header{padding:0 14px}
}
</style>
</head>
<body>

<!-- Sidebar Overlay -->
<div id="overlay" onclick="closeSidebar()"></div>

<!-- Sidebar -->
<nav id="sidebar">
  <div class="sb-head">
    <div class="sb-logo">🏙️ Paradise City</div>
    <div class="sb-sub">Inhaber Dashboard</div>
  </div>
  <div class="sb-nav">
    <div class="sb-section">Navigation</div>
    <div class="sb-item active" id="nav-home" onclick="navigate('home')">
      <span class="icon">🏠</span> Dashboard
    </div>
    <div class="sb-section">Verwaltung</div>
    <div class="sb-item" id="nav-members" onclick="navigate('members')">
      <span class="icon">👥</span> Mitglieder
    </div>
    <div class="sb-item" id="nav-bans" onclick="navigate('bans')">
      <span class="icon">🔨</span> Gebannte Mitglieder
    </div>
  </div>
  <div class="sb-foot">
    <a class="sb-logout" href="/dashboard/logout">
      <span>🚪</span> Abmelden
    </a>
  </div>
</nav>

<!-- Header -->
<header>
  <button class="hamburger" onclick="toggleSidebar()" title="Menü öffnen">&#9776;</button>
  <div class="header-title">Inhaber Dashboard</div>
</header>

<!-- Main -->
<div id="main">

  <!-- HOME -->
  <div class="page active" id="page-home">
    <div class="welcome">
      <h1>Willkommen im <span>Inhaber Dashboard</span></h1>
      <h1 style="font-size:.95em;font-weight:500;color:var(--text2);margin-top:4px">von Paradise City Roleplay</h1>
      <p style="margin-top:10px">Hier hast du den vollständigen Überblick über deinen Server.</p>
    </div>
    <div class="stats-grid" id="stats-grid">
      <div class="loader">Lade Statistiken…</div>
    </div>
  </div>

  <!-- MEMBERS -->
  <div class="page" id="page-members">
    <div class="section-hd">
      <h2>👥 Mitglieder</h2>
      <input class="search-box" type="text" id="member-search" placeholder="🔍  Name oder ID suchen…" oninput="searchMembers()">
    </div>
    <div id="member-count" style="color:var(--text2);font-size:.8em;margin-bottom:14px"></div>
    <div class="member-grid" id="member-list"><div class="loader">Lade Mitglieder…</div></div>
  </div>

  <!-- BANS -->
  <div class="page" id="page-bans">
    <div class="section-hd">
      <h2>🔨 Gebannte Mitglieder</h2>
    </div>
    <div id="ban-count" style="color:var(--text2);font-size:.8em;margin-bottom:14px"></div>
    <div class="member-grid" id="ban-list"><div class="loader">Lade Bans…</div></div>
  </div>

</div>

<!-- Member Action Modal -->
<div id="action-modal" style="display:none">
  <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
    <div class="modal">
      <h3 id="modal-title">⚡ Aktion ausführen</h3>
      <div class="avatar-row">
        <img id="modal-avatar" src="" alt="">
        <div>
          <div class="n" id="modal-name"></div>
          <div class="i" id="modal-id"></div>
        </div>
      </div>
      <div id="modal-err" class="modal-err"></div>
      <div id="modal-ok"  class="modal-ok"></div>

      <!-- Timeout view -->
      <div id="view-timeout" style="display:none">
        <div class="modal-label">Timeout Dauer (Minuten)</div>
        <input type="number" id="timeout-min" min="1" max="40320" placeholder="z.B. 60" value="60">
        <div class="modal-btns">
          <button class="mbtn mbtn-cancel" onclick="showDefault()">← Zurück</button>
          <button class="mbtn mbtn-timeout" onclick="doTimeout()">⏱️ Timeout setzen</button>
        </div>
      </div>

      <!-- Ban view -->
      <div id="view-ban" style="display:none">
        <div class="modal-label">Grund für den Bann</div>
        <textarea id="ban-reason" rows="3" placeholder="Grund eingeben…" style="resize:none"></textarea>
        <div class="modal-btns">
          <button class="mbtn mbtn-cancel" onclick="showDefault()">← Zurück</button>
          <button class="mbtn mbtn-ban" onclick="doBan()">🔨 Permanent bannen</button>
        </div>
      </div>

      <!-- Default view -->
      <div id="view-default">
        <div class="modal-btns">
          <button class="mbtn mbtn-cancel" onclick="closeModal()">Abbrechen</button>
          <button class="mbtn mbtn-timeout" onclick="showTimeout()">⏱️ Timeout</button>
        </div>
        <div style="height:10px"></div>
        <button class="mbtn mbtn-ban" style="width:100%" onclick="showBan()">🔨 Permanent bannen</button>
      </div>
    </div>
  </div>
</div>

<script>
let allMembers = [];
let currentModal = null;

// ── Sidebar ──────────────────────────────────────────────────────────────────
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  sb.classList.toggle('open');
  ov.classList.toggle('on');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('on');
}

// ── Navigation ────────────────────────────────────────────────────────────────
const PAGES = ['home','members','bans'];
function navigate(page) {
  PAGES.forEach(p => {
    document.getElementById('page-'+p).classList.toggle('active', p===page);
    document.getElementById('nav-'+p)?.classList.toggle('active', p===page);
  });
  closeSidebar();
  if (page==='home')    loadStats();
  if (page==='members') loadMembers();
  if (page==='bans')    loadBans();
}

// ── API ───────────────────────────────────────────────────────────────────────
async function apiFetch(url, opts={}) {
  const r = await fetch(url, opts);
  return r.json();
}

// ── STATS ────────────────────────────────────────────────────────────────────
async function loadStats() {
  const g = document.getElementById('stats-grid');
  g.innerHTML = '<div class="loader">Lade Statistiken…</div>';
  try {
    const d = await apiFetch('/dashboard/api/stats');
    if (!d.ok) { g.innerHTML = '<div class="loader">Fehler: ' + (d.error||'?') + '</div>'; return; }
    const stats = [
      { ico:'👥', label:'Mitglieder',  value: d.totalMembers, sub:'auf dem Server', color:'#e65100' },
      { ico:'🤖', label:'Bots',        value: d.bots,         sub:'aktive Bots', color:'#f59e0b' },
      { ico:'🔨', label:'Bans',        value: d.bans,         sub:'gesperrte User', color:'#ef4444' },
      { ico:'🎭', label:'Rollen',       value: d.roles,        sub:'Serverrollen', color:'#f59e0b' },
      { ico:'💬', label:'Kanäle',       value: d.channels,     sub:'alle Kanäle', color:'#22c55e' },
      { ico:'⏱️', label:'Uptime',       value: d.uptime,       sub:'Bot läuft seit', color:'#06b6d4' },
    ];
    g.innerHTML = stats.map(s => \`
      <div class="stat-card">
        <div class="glow" style="background:\${s.color}"></div>
        <div class="ico">\${s.ico}</div>
        <div class="label">\${s.label}</div>
        <div class="value">\${s.value}</div>
        <div class="sub">\${s.sub}</div>
      </div>\`).join('');
  } catch(e) { g.innerHTML = '<div class="loader">Fehler beim Laden.</div>'; }
}

// ── MEMBERS ───────────────────────────────────────────────────────────────────
async function loadMembers() {
  const el = document.getElementById('member-list');
  const ct = document.getElementById('member-count');
  el.innerHTML = '<div class="loader">Lade Mitglieder…</div>';
  ct.textContent = '';
  try {
    const d = await apiFetch('/dashboard/api/members');
    if (!d.ok) { el.innerHTML = '<div class="loader">Fehler: ' + (d.error||'?') + '</div>'; return; }
    allMembers = d.members;
    renderMembers(allMembers);
  } catch(e) { el.innerHTML = '<div class="loader">Fehler beim Laden.</div>'; }
}
function renderMembers(list) {
  const el = document.getElementById('member-list');
  const ct = document.getElementById('member-count');
  ct.textContent = list.length + ' Mitglied' + (list.length !== 1 ? 'er' : '') + ' gefunden';
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="e-icon">👤</div><div>Keine Mitglieder gefunden.</div></div>';
    return;
  }
  el.innerHTML = list.map(m => \`
    <div class="member-card" onclick="openModal(\${JSON.stringify(m).replace(/"/g,'&quot;')})">
      <img class="m-avatar" src="\${m.avatar}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
      <div class="m-info">
        <div class="m-name">\${esc(m.display)}</div>
        <div class="m-meta">@\${esc(m.username)} &bull; Beigetreten: \${m.joinedAt}</div>
      </div>
      <div class="m-badges">
        <span class="m-role">\${esc(m.topRole)}</span>
        \${m.isTimedOut ? '<span class="badge-timeout">Timeout</span>' : ''}
      </div>
    </div>\`).join('');
}
function searchMembers() {
  const q = document.getElementById('member-search').value.toLowerCase();
  const filtered = !q ? allMembers : allMembers.filter(m =>
    m.username.toLowerCase().includes(q) ||
    m.display.toLowerCase().includes(q) ||
    m.id.includes(q)
  );
  renderMembers(filtered);
}

// ── BANS ──────────────────────────────────────────────────────────────────────
async function loadBans() {
  const el = document.getElementById('ban-list');
  const ct = document.getElementById('ban-count');
  el.innerHTML = '<div class="loader">Lade Bans…</div>';
  ct.textContent = '';
  try {
    const d = await apiFetch('/dashboard/api/bans');
    if (!d.ok) { el.innerHTML = '<div class="loader">Fehler: ' + (d.error||'?') + '</div>'; return; }
    ct.textContent = d.bans.length + ' gebannte(r) User';
    if (!d.bans.length) {
      el.innerHTML = '<div class="empty"><div class="e-icon">✅</div><div>Keine gesperrten Mitglieder.</div></div>';
      return;
    }
    el.innerHTML = d.bans.map(b => \`
      <div class="ban-card">
        <img class="m-avatar" src="\${b.avatar}" alt="" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
        <div class="m-info">
          <div class="m-name">\${esc(b.username)}</div>
          <div class="m-meta">ID: \${b.id}</div>
        </div>
        <div class="ban-reason" title="\${esc(b.reason)}">📄 \${esc(b.reason)}</div>
        <button class="unban-btn" onclick="doUnban('\${b.id}','\${esc(b.username)}',this)">✅ Entbannen</button>
      </div>\`).join('');
  } catch(e) { el.innerHTML = '<div class="loader">Fehler beim Laden.</div>'; }
}

async function doUnban(userId, username, btn) {
  if (!confirm('Bann für ' + username + ' wirklich aufheben?')) return;
  btn.disabled = true; btn.textContent = '…';
  const d = await apiFetch('/dashboard/api/unban', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId }) });
  if (d.ok) { btn.closest('.ban-card').remove(); }
  else { alert('Fehler: ' + (d.error||'?')); btn.disabled = false; btn.textContent = '✅ Entbannen'; }
}

// ── MODAL ─────────────────────────────────────────────────────────────────────
function openModal(member) {
  currentModal = member;
  document.getElementById('modal-avatar').src = member.avatar;
  document.getElementById('modal-name').textContent  = member.display;
  document.getElementById('modal-id').textContent    = '@' + member.username + ' — ID: ' + member.id;
  document.getElementById('modal-title').textContent = '⚡ Aktion ausführen';
  clearModalMsg();
  showDefault();
  document.getElementById('action-modal').style.display = '';
}
function closeModal() {
  document.getElementById('action-modal').style.display = 'none';
  currentModal = null;
}
function showDefault()  { setView('default'); }
function showTimeout()  { setView('timeout'); }
function showBan()      { document.getElementById('ban-reason').value=''; setView('ban'); }
function setView(v) {
  ['default','timeout','ban'].forEach(x => document.getElementById('view-'+x).style.display = x===v?'':'none');
  clearModalMsg();
}
function clearModalMsg() {
  document.getElementById('modal-err').style.display = 'none';
  document.getElementById('modal-ok').style.display  = 'none';
}
function showErr(msg)  { const el=document.getElementById('modal-err'); el.textContent=msg; el.style.display=''; }
function showOk(msg)   { const el=document.getElementById('modal-ok');  el.textContent=msg; el.style.display=''; }

async function doTimeout() {
  const min = parseInt(document.getElementById('timeout-min').value);
  if (!min || min < 1) return showErr('Bitte eine gültige Dauer eingeben.');
  clearModalMsg();
  const d = await apiFetch('/dashboard/api/timeout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentModal.id, minutes: min }) });
  if (d.ok) { showOk('✅ Timeout für ' + min + ' Minute(n) gesetzt. User wurde per DM benachrichtigt.'); setTimeout(closeModal, 2000); }
  else showErr('❌ Fehler: ' + (d.error||'?'));
}

async function doBan() {
  const reason = document.getElementById('ban-reason').value.trim();
  if (!confirm('Sicher? ' + currentModal.display + ' wird permanent gebannt!')) return;
  clearModalMsg();
  const d = await apiFetch('/dashboard/api/ban', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentModal.id, reason }) });
  if (d.ok) {
    showOk('✅ ' + currentModal.display + ' wurde gebannt. Begründung per DM gesendet.');
    allMembers = allMembers.filter(m => m.id !== currentModal.id);
    renderMembers(allMembers);
    setTimeout(closeModal, 2000);
  } else showErr('❌ Fehler: ' + (d.error||'?'));
}

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Init ──────────────────────────────────────────────────────────────────────
loadStats();
</script>
</body>
</html>`;
}
