// ─────────────────────────────────────────────────────────────────────────────
//  ADMIN DASHBOARD PANEL  –  Paradise City Roleplay
//  Wird in den Bot eingebunden (wie fuehrerschein.js):
//      require('./admin_panel')(app, DATA_DIR, client, express)
//  Läuft mit dem Bot zusammen auf demselben Web-Server (Railway).
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path');
const fs   = require('fs');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = function initAdminPanel(app, DATA_DIR, client, express) {

  // ─── Konstanten ────────────────────────────────────────────────────────────
  const GUILD_ID       = '1498482541751963698';
  const ADMIN_ROLE     = '1490855702225485936'; // Diese Rolle wird zum Einloggen benötigt
  const INV_ROLE       = '1490855722534310003'; // Spieler mit dieser Rolle erscheinen in Inventar & Bank
  const VERIFY_ROLE    = '1490855725516460234'; // Verifizierungs-Rolle (Einreise)

  const LOGS = {
    server:  { id: '1490878131240829028', label: 'Server Log' },
    mod:     { id: '1490878132230819840', label: 'Mod Log' },
    player:  { id: '1490878134847930368', label: 'Spieler Log' },
    message: { id: '1490878135837917234', label: 'Nachrichten Log' },
    role:    { id: '1490878137385619598', label: 'Rollen Log' },
    money:   { id: '1490878138429997087', label: 'Geld Log' },
    ticket:  { id: '1490878139306606743', label: 'Ticket Log' },
  };
  const MOD_LOG_CH  = '1490878132230819840';
  const INVITE_LOG  = '1490878153391083683';
  const SERVER_LOG  = '1490878131240829028';

  const SHOP_LABELS = {
    kwik:     'Kwik-E-Markt',
    baumarkt: 'Baumarkt',
    angler:   'Angler Shop',
    schwarz:  'Schwarzmarkt',
    team:     'Team-Shop',
  };

  // ─── Datei-Helfer (lesen/schreiben – immer frisch, damit der Bot mitbekommt) ─
  const f = (name) => path.join(DATA_DIR, name);
  const loadJSON = (name, fallback) => { try { return JSON.parse(fs.readFileSync(f(name), 'utf8')); } catch { return fallback; } };
  const saveJSON = (name, data) => { try { fs.writeFileSync(f(name), JSON.stringify(data, null, 2), 'utf8'); } catch (e) { console.error('[ADMIN] save ' + name, e.message); } };

  const loadInventar = () => loadJSON('inventar.json', {});
  const saveInventar = (d) => saveJSON('inventar.json', d);
  const loadBargeld  = () => loadJSON('bargeld.json', {});
  const saveBargeld  = (d) => saveJSON('bargeld.json', d);
  const loadKonto    = () => loadJSON('konto.json', {});
  const saveKonto    = (d) => saveJSON('konto.json', d);
  const loadKrypto   = () => loadJSON('krypto.json', {});
  const saveKrypto   = (d) => saveJSON('krypto.json', d);
  const loadShops    = () => loadJSON('shops.json', { kwik: [], baumarkt: [], angler: [], schwarz: [], team: [] });
  const saveShops    = (d) => saveJSON('shops.json', d);
  const loadShopItems= () => loadJSON('shop_items.json', []);
  const loadAusweis  = () => loadJSON('ausweis.json', {});
  const loadTickets  = () => loadJSON('tickets.json', {});
  const loadRaub     = () => loadJSON('raub_notrufe.json', []);
  const saveRaub     = (d) => saveJSON('raub_notrufe.json', d);
  const loadBans     = () => loadJSON('admin_bans.json', {});
  const saveBans     = (d) => saveJSON('admin_bans.json', d);
  const loadEvents   = () => loadJSON('admin_events.json', []);
  const saveEvents   = (d) => saveJSON('admin_events.json', d);

  // ─── Discord-Helfer ──────────────────────────────────────────────────────────
  function getGuild() {
    return client.guilds.cache.get(GUILD_ID) || null;
  }
  async function fetchGuild() {
    let g = client.guilds.cache.get(GUILD_ID);
    if (!g) g = await client.guilds.fetch(GUILD_ID).catch(() => null);
    return g;
  }

  let _memberCache = null;
  let _memberCacheTs = 0;
  async function allMembers() {
    if (_memberCache && Date.now() - _memberCacheTs < 30000) return _memberCache;
    const g = await fetchGuild();
    if (!g) return new Map();
    try {
      const members = await g.members.fetch();
      _memberCache = members;
      _memberCacheTs = Date.now();
      return members;
    } catch (e) {
      console.error('[ADMIN] members.fetch', e.message);
      return g.members.cache;
    }
  }
  async function getMember(userId) {
    const g = await fetchGuild();
    if (!g) return null;
    try { return await g.members.fetch(userId); } catch { return null; }
  }
  function serverName(member) {
    return member.nickname || member.user.globalName || member.user.username;
  }
  function roleNames(member) {
    return member.roles.cache.filter(r => r.id !== member.guild.id).sort((a, b) => b.position - a.position).map(r => r.name);
  }
  async function dmUser(userId, embed) {
    try {
      const u = await client.users.fetch(userId);
      const dm = await u.createDM();
      await dm.send({ embeds: [embed] });
      return true;
    } catch { return false; }
  }
  async function logTo(channelId, embed) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch && ch.send) await ch.send({ embeds: [embed] });
    } catch (e) { /* ignore */ }
  }

  // ─── Join/Leave-Tracking + Timed-Ban-Check (nur einmal registrieren) ─────────
  if (!client.__pcAdminInit) {
    client.__pcAdminInit = true;
    const pushEvent = (type, m) => {
      try {
        const g = m.guild || m.member?.guild;
        if (g && g.id !== GUILD_ID) return;
        const ev = loadEvents();
        ev.push({ t: Date.now(), type, uid: (m.user ? m.user.id : m.id), name: (m.user ? m.user.username : '') });
        // nur die letzten 30 Tage behalten
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        saveEvents(ev.filter(e => e.t >= cutoff));
      } catch (e) { console.error('[ADMIN] event', e.message); }
    };
    client.on('guildMemberAdd', (m) => pushEvent('join', m));
    client.on('guildMemberRemove', (m) => pushEvent('leave', m));

    // Abgelaufene befristete Banns automatisch aufheben
    setInterval(async () => {
      try {
        const bans = loadBans();
        const now = Date.now();
        let changed = false;
        for (const [uid, b] of Object.entries(bans)) {
          if (b.until && b.until <= now) {
            const g = await fetchGuild();
            if (g) await g.bans.remove(uid, 'Befristeter Bann abgelaufen').catch(() => {});
            delete bans[uid];
            changed = true;
          }
        }
        if (changed) saveBans(bans);
      } catch (e) { console.error('[ADMIN] ban-check', e.message); }
    }, 60000);

    // ─── Embed nach Bot-Login senden (ready-Event abwarten) ──────────────────
    client.once('ready', async () => {
      try {
        const domain = process.env.RAILWAY_PUBLIC_DOMAIN
          || 'paradise-city-roleplay-custom-bot-production.up.railway.app';
        const url = `https://${domain}/admin-panel`;
        const ch = await client.channels.fetch('1516408912172286074');
        if (!ch || !ch.send) { console.error('[ADMIN-PANEL] Channel nicht gefunden.'); return; }
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Admin-Panel öffnen')
            .setURL(url)
            .setStyle(ButtonStyle.Link)
            .setEmoji('🛠️')
        );
        await ch.send({ embeds: [new EmbedBuilder().setColor(0xe65100)], components: [row] });
        console.log('[ADMIN-PANEL] Embed gesendet in', ch.name);
      } catch (e) { console.error('[ADMIN-PANEL] Embed-Fehler:', e.message); }
    });
  }

  // ─── Auth-Middleware ─────────────────────────────────────────────────────────
  // Prüft, ob der Ziel-Spieler die Inventar-/Bank-Rolle besitzt (nur diese dürfen verwaltet werden)
  async function targetHasInvRole(userId) {
    const m = await getMember(userId);
    return !!(m && m.roles && m.roles.cache && m.roles.cache.has(INV_ROLE));
  }

  // ─── Hilfsfunktion: Item-Registry (nur Items aus den Shops) ──────────────────
  function itemRegistry() {
    const set = new Set();
    const shops = loadShops();
    for (const arr of Object.values(shops)) {
      if (Array.isArray(arr)) for (const it of arr) if (it && it.name) set.add(it.name);
    }
    for (const it of loadShopItems()) { if (typeof it === 'string') set.add(it); else if (it && it.name) set.add(it.name); }
    return [...set].sort((a, b) => a.localeCompare(b, 'de'));
  }

  app.get('/admin-panel/api/me', (req, res) => res.json({ name: 'Admin', username: 'admin' }));

  // ═════════════════════════════════════════════════════════════════════════════
  //  ÜBERSICHT / SERVER STATS
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/overview', async (req, res) => {
    try {
      const members = await allMembers();
      let verified = 0, invPlayers = 0;
      for (const m of members.values()) {
        if (m.roles.cache.has(VERIFY_ROLE)) verified++;
        if (m.roles.cache.has(INV_ROLE)) invPlayers++;
      }
      const raids = loadRaub().filter(r => r.status === 'offen').length;
      const bans = Object.keys(loadBans()).length;
      const tickets = Object.keys(loadTickets()).length;
      res.json({
        verified, invPlayers, raids, bans, tickets,
        memberCount: members.size,
        shops: Object.keys(loadShops()).length,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/admin-panel/api/stats', async (req, res) => {
    try {
      const ev = loadEvents();
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const joins = ev.filter(e => e.type === 'join' && e.t >= dayAgo).length;
      const leaves = ev.filter(e => e.type === 'leave' && e.t >= dayAgo).length;
      const tickets = loadTickets();
      const ticketCount = Object.keys(tickets).length;
      const g = await fetchGuild();
      const memberCount = g ? g.memberCount : 0;
      const uptimeS = Math.floor((client.uptime || 0) / 1000);
      res.json({
        joins24h: joins,
        leaves24h: leaves,
        ticketCount,
        botPing: Math.round(client.ws.ping),
        uptimeS,
        memberCount,
        botStatus: client.ws.status === 0 ? 'Online' : 'Verbindung...',
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  VERIFIZIERTE SPIELER
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/verified', async (req, res) => {
    try {
      const members = await allMembers();
      const ausweis = loadAusweis();
      const list = [];
      for (const m of members.values()) {
        if (!m.roles.cache.has(VERIFY_ROLE)) continue;
        const a = ausweis[m.id];
        list.push({
          id: m.id,
          username: m.user.username,
          name: serverName(m),
          avatar: m.user.displayAvatarURL({ size: 64 }),
          roles: roleNames(m),
          verified: true,
          character: a ? { vorname: a.vorname, nachname: a.nachname, geburtsdatum: a.geburtsdatum } : null,
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/admin-panel/api/player/:id', async (req, res) => {
    try {
      const m = await getMember(req.params.id);
      if (!m) return res.status(404).json({ error: 'Spieler nicht auf dem Server.' });
      const ausweis = loadAusweis()[m.id] || null;
      res.json({
        id: m.id,
        username: m.user.username,
        name: serverName(m),
        avatar: m.user.displayAvatarURL({ size: 128 }),
        roles: roleNames(m),
        verified: m.roles.cache.has(VERIFY_ROLE),
        joinedAt: m.joinedTimestamp,
        isTimedOut: m.communicationDisabledUntilTimestamp && m.communicationDisabledUntilTimestamp > Date.now(),
        timeoutUntil: m.communicationDisabledUntilTimestamp || null,
        character: ausweis ? { vorname: ausweis.vorname, nachname: ausweis.nachname, geburtsdatum: ausweis.geburtsdatum } : null,
      });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ─── BANNEN ──────────────────────────────────────────────────────────────────
  app.post('/admin-panel/api/ban', async (req, res) => {
    try {
      const { userId, durationMs, reason } = req.body;
      const grund = (reason || '').trim();
      if (!userId) return res.status(400).json({ error: 'Kein Spieler ausgewählt.' });
      if (!grund) return res.status(400).json({ error: 'Bitte einen Bann-Grund angeben.' });
      const g = await fetchGuild();
      if (!g) return res.status(500).json({ error: 'Server nicht erreichbar.' });

      const dur = Number(durationMs) || 0; // 0 = permanent
      const until = dur > 0 ? Date.now() + dur : null;
      const durLabel = dur > 0 ? humanDur(dur) : 'Permanent';

      // DM VOR dem Bann senden (danach nicht mehr möglich)
      await dmUser(userId, new EmbedBuilder()
        .setColor(0xc0392b)
        .setTitle('🔨 Du wurdest gebannt')
        .setDescription('Du wurdest von **Paradise City Roleplay** gebannt.')
        .addFields(
          { name: 'Grund', value: grund },
          { name: 'Dauer', value: durLabel, inline: true },
        )
        .setTimestamp());

      await g.bans.create(userId, { reason: grund }).catch(async () => {
        const m = await getMember(userId);
        if (m) await m.ban({ reason: grund });
      });

      const bans = loadBans();
      bans[userId] = { reason: grund, until, by: 'admin', at: Date.now() };
      saveBans(bans);

      await logTo(MOD_LOG_CH, new EmbedBuilder()
        .setColor(0xc0392b).setTitle('🔨 Spieler gebannt (Dashboard)')
        .addFields(
          { name: 'Spieler', value: `<@${userId}>`, inline: true },
          { name: 'Dauer', value: durLabel, inline: true },
          { name: 'Grund', value: grund },
          { name: 'Von', value: 'Dashboard-Admin' },
        ).setTimestamp());

      res.json({ ok: true });
    } catch (e) {
      console.error('[ADMIN] ban', e.message);
      res.status(500).json({ error: 'Bann fehlgeschlagen: ' + e.message });
    }
  });

  // ─── TIMEOUT ──────────────────────────────────────────────────────────────────
  app.post('/admin-panel/api/timeout', async (req, res) => {
    try {
      const { userId, durationMs, reason } = req.body;
      const grund = (reason || '').trim();
      if (!userId) return res.status(400).json({ error: 'Kein Spieler ausgewählt.' });
      if (!grund) return res.status(400).json({ error: 'Bitte einen Grund angeben.' });
      const dur = Number(durationMs) || 0;
      if (dur <= 0) return res.status(400).json({ error: 'Bitte eine Dauer auswählen.' });
      const maxMs = 28 * 24 * 60 * 60 * 1000;
      const ms = Math.min(dur, maxMs);

      const m = await getMember(userId);
      if (!m) return res.status(404).json({ error: 'Spieler nicht auf dem Server.' });
      await m.timeout(ms, grund);

      await dmUser(userId, new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle('🔇 Du hast einen Timeout erhalten')
        .setDescription('Du wurdest auf **Paradise City Roleplay** stummgeschaltet.')
        .addFields(
          { name: 'Grund', value: grund },
          { name: 'Dauer', value: humanDur(ms), inline: true },
        ).setTimestamp());

      await logTo(MOD_LOG_CH, new EmbedBuilder()
        .setColor(0xe67e22).setTitle('🔇 Timeout vergeben (Dashboard)')
        .addFields(
          { name: 'Spieler', value: `<@${userId}>`, inline: true },
          { name: 'Dauer', value: humanDur(ms), inline: true },
          { name: 'Grund', value: grund },
          { name: 'Von', value: 'Dashboard-Admin' },
        ).setTimestamp());

      res.json({ ok: true });
    } catch (e) {
      console.error('[ADMIN] timeout', e.message);
      const msg = e.code === 50013
        ? 'Timeout fehlgeschlagen: Dem Bot fehlt die Berechtigung "Mitglieder im Timeout" oder die Bot-Rolle steht zu niedrig.'
        : 'Timeout fehlgeschlagen: ' + e.message;
      res.status(500).json({ error: msg });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  GEBANNTE SPIELER
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/bans', async (req, res) => {
    try {
      const g = await fetchGuild();
      const stored = loadBans();
      const list = [];
      if (g) {
        const bans = await g.bans.fetch().catch(() => null);
        if (bans) {
          for (const b of bans.values()) {
            const s = stored[b.user.id] || {};
            list.push({
              id: b.user.id,
              username: b.user.username,
              avatar: b.user.displayAvatarURL ? b.user.displayAvatarURL({ size: 64 }) : null,
              reason: s.reason || b.reason || 'Kein Grund angegeben',
              until: s.until || null,
              by: s.by || null,
              at: s.at || null,
            });
          }
        }
      }
      list.sort((a, b) => (b.at || 0) - (a.at || 0));
      res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/admin-panel/api/unban', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: 'Kein Spieler ausgewählt.' });
      const g = await fetchGuild();
      if (!g) return res.status(500).json({ error: 'Server nicht erreichbar.' });
      await g.bans.remove(userId, 'Entbannt über Dashboard');
      const bans = loadBans(); delete bans[userId]; saveBans(bans);
      await dmUser(userId, new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Du wurdest entbannt')
        .setDescription('Du wurdest auf **Paradise City Roleplay** wieder entbannt und kannst dem Server erneut beitreten.').setTimestamp());
      await logTo(MOD_LOG_CH, new EmbedBuilder().setColor(0x2ecc71).setTitle('✅ Spieler entbannt (Dashboard)')
        .addFields({ name: 'Spieler', value: `<@${userId}>`, inline: true }, { name: 'Von', value: 'Dashboard-Admin' }).setTimestamp());
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Entbannen fehlgeschlagen: ' + e.message });
    }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  INVENTAR & BANK
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/economy', async (req, res) => {
    try {
      const members = await allMembers();
      const bargeld = loadBargeld(), konto = loadKonto(), krypto = loadKrypto(), inv = loadInventar();
      const list = [];
      for (const m of members.values()) {
        if (!m.roles.cache.has(INV_ROLE)) continue;
        const k = konto[m.id] || { konto: 0, schwarz: 0 };
        list.push({
          id: m.id,
          username: m.user.username,
          name: serverName(m),
          avatar: m.user.displayAvatarURL({ size: 64 }),
          bargeld: bargeld[m.id] || 0,
          konto: k.konto || 0,
          schwarz: k.schwarz || 0,
          coins: (krypto[m.id] && krypto[m.id].dc) || 0,
          items: inv[m.id] || {},
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
      res.json(list);
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/admin-panel/api/items', (req, res) => res.json(itemRegistry()));

  app.post('/admin-panel/api/money', async (req, res) => {
    try {
      const { userId, type, action, amount } = req.body;
      const amt = Math.abs(Math.floor(Number(amount) || 0));
      if (!userId || !amt) return res.status(400).json({ error: 'Ungültige Angaben.' });
      if (!(await targetHasInvRole(userId))) return res.status(403).json({ error: 'Dieser Spieler hat keine Inventar-/Bank-Berechtigung.' });
      const sign = action === 'remove' ? -1 : 1;

      if (type === 'bargeld') {
        const d = loadBargeld(); d[userId] = Math.max(0, (d[userId] || 0) + sign * amt); saveBargeld(d);
      } else if (type === 'coins') {
        const d = loadKrypto(); const w = d[userId] || { dc: 0 }; w.dc = Math.max(0, (w.dc || 0) + sign * amt); d[userId] = w; saveKrypto(d);
      } else if (type === 'konto' || type === 'schwarz') {
        const d = loadKonto(); const k = d[userId] || { konto: 0, schwarz: 0 };
        k[type] = Math.max(0, (k[type] || 0) + sign * amt); d[userId] = k; saveKonto(d);
      } else {
        return res.status(400).json({ error: 'Unbekannter Geld-Typ.' });
      }

      const typLabel = { bargeld: 'Bargeld', konto: 'Kontogeld', schwarz: 'Schwarzgeld', coins: 'PC-Coins' }[type];
      await logTo(LOGS.money.id, new EmbedBuilder().setColor(0xE65100)
        .setTitle(sign > 0 ? '💰 Geld hinzugefügt (Dashboard)' : '💸 Geld abgezogen (Dashboard)')
        .addFields(
          { name: 'Spieler', value: `<@${userId}>`, inline: true },
          { name: 'Typ', value: typLabel, inline: true },
          { name: 'Betrag', value: (sign > 0 ? '+' : '-') + amt.toLocaleString('de-CH'), inline: true },
          { name: 'Von', value: 'Dashboard-Admin' },
        ).setTimestamp());
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/admin-panel/api/item', async (req, res) => {
    try {
      const { userId, action, item, amount } = req.body;
      const amt = Math.abs(Math.floor(Number(amount) || 1)) || 1;
      const name = (item || '').trim();
      if (!userId || !name) return res.status(400).json({ error: 'Ungültige Angaben.' });
      if (!(await targetHasInvRole(userId))) return res.status(403).json({ error: 'Dieser Spieler hat keine Inventar-/Bank-Berechtigung.' });
      if (action === 'add' && !itemRegistry().includes(name)) {
        return res.status(400).json({ error: 'Dieses Item existiert in keinem Shop. Nur Shop-Items erlaubt.' });
      }
      const inv = loadInventar();
      const u = inv[userId] || {};
      if (action === 'remove') {
        u[name] = Math.max(0, (u[name] || 0) - amt);
        if (u[name] <= 0) delete u[name];
      } else {
        u[name] = (u[name] || 0) + amt;
      }
      inv[userId] = u; saveInventar(inv);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  SHOPS
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/shops', (req, res) => {
    const shops = loadShops();
    const out = {};
    for (const [id, items] of Object.entries(shops)) {
      out[id] = { label: SHOP_LABELS[id] || id, items: Array.isArray(items) ? items : [] };
    }
    res.json(out);
  });

  app.post('/admin-panel/api/shop/item/add', (req, res) => {
    try {
      const { shop, name, preis } = req.body;
      const n = (name || '').trim();
      const p = Math.max(0, Math.floor(Number(preis) || 0));
      if (!shop || !n) return res.status(400).json({ error: 'Name erforderlich.' });
      const shops = loadShops();
      if (!shops[shop]) return res.status(400).json({ error: 'Shop existiert nicht.' });
      shops[shop].push({ name: n, preis: p });
      saveShops(shops);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/admin-panel/api/shop/item/edit', (req, res) => {
    try {
      const { shop, index, name, preis, moveTo } = req.body;
      const shops = loadShops();
      if (!shops[shop] || !shops[shop][index]) return res.status(400).json({ error: 'Item nicht gefunden.' });
      const n = (name || '').trim();
      const p = Math.max(0, Math.floor(Number(preis) || 0));
      const updated = { name: n || shops[shop][index].name, preis: p };
      if (moveTo && moveTo !== shop) {
        if (!shops[moveTo]) return res.status(400).json({ error: 'Ziel-Shop existiert nicht.' });
        shops[shop].splice(index, 1);
        shops[moveTo].push(updated);
      } else {
        shops[shop][index] = updated;
      }
      saveShops(shops);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/admin-panel/api/shop/item/delete', (req, res) => {
    try {
      const { shop, index } = req.body;
      const shops = loadShops();
      if (!shops[shop] || !shops[shop][index]) return res.status(400).json({ error: 'Item nicht gefunden.' });
      shops[shop].splice(index, 1);
      saveShops(shops);
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  AKTUELLE RAUBÜBERFÄLLE
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/raids', (req, res) => {
    const raids = loadRaub().filter(r => r.status === 'offen').sort((a, b) => (b.ts || 0) - (a.ts || 0));
    res.json(raids);
  });

  app.post('/admin-panel/api/raids/fail', async (req, res) => {
    try {
      const { id } = req.body;
      const raids = loadRaub();
      const r = raids.find(x => String(x.id) === String(id) && x.status === 'offen');
      if (!r) return res.status(404).json({ error: 'Raubüberfall nicht gefunden oder bereits geschlossen.' });
      r.status = 'geschlossen';
      saveRaub(raids);
      if (r.userId) {
        await dmUser(r.userId, new EmbedBuilder().setColor(0xff4400)
          .setTitle('❌ Raubüberfall fehlgeschlagen')
          .setDescription(`Dein Raubüberfall (**${r.title || r.type}**) wurde als **fehlgeschlagen** gewertet.\nKein Cooldown – du kannst es erneut versuchen.`).setTimestamp());
      }
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  LOGS
  // ═════════════════════════════════════════════════════════════════════════════
  async function fetchChannelLog(channelId, limit = 30) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.messages) return [];
    const msgs = await ch.messages.fetch({ limit }).catch(() => null);
    if (!msgs) return [];
    return [...msgs.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).map(m => ({
      author: m.author ? m.author.username : 'System',
      content: m.content || '',
      ts: m.createdTimestamp,
      embeds: (m.embeds || []).map(e => ({
        title: e.title || '',
        description: e.description || '',
        color: e.color || 0,
        fields: (e.fields || []).map(fd => ({ name: fd.name, value: fd.value })),
      })),
    }));
  }

  app.get('/admin-panel/api/logs/:type', async (req, res) => {
    try {
      const cfg = LOGS[req.params.type];
      if (!cfg) return res.status(404).json({ error: 'Unbekannte Log-Kategorie.' });
      const entries = await fetchChannelLog(cfg.id, 40);
      res.json({ label: cfg.label, entries });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.get('/admin-panel/api/logs', (req, res) => {
    res.json(Object.entries(LOGS).map(([k, v]) => ({ key: k, label: v.label })));
  });

  // ═════════════════════════════════════════════════════════════════════════════
  //  MOD SYSTEM
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel/api/mod', async (req, res) => {
    try {
      const modLog = await fetchChannelLog(MOD_LOG_CH, 30);
      const inviteLog = await fetchChannelLog(INVITE_LOG, 20);
      res.json({ mod: modLog, invites: inviteLog });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/admin-panel/api/sanction', async (req, res) => {
    try {
      const { userId, action, durationMs, reason } = req.body;
      const grund = (reason || '').trim() || 'Verdächtiges Verhalten';
      if (!userId) return res.status(400).json({ error: 'Kein Spieler angegeben.' });
      const g = await fetchGuild();
      if (!g) return res.status(500).json({ error: 'Server nicht erreichbar.' });

      if (action === 'kick') {
        const m = await getMember(userId); if (!m) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
        await dmUser(userId, new EmbedBuilder().setColor(0xe67e22).setTitle('👢 Du wurdest gekickt').addFields({ name: 'Grund', value: grund }).setTimestamp());
        await m.kick(grund);
      } else if (action === 'ban') {
        await dmUser(userId, new EmbedBuilder().setColor(0xc0392b).setTitle('🔨 Du wurdest gebannt').addFields({ name: 'Grund', value: grund }).setTimestamp());
        await g.bans.create(userId, { reason: grund });
        const bans = loadBans(); bans[userId] = { reason: grund, until: null, by: 'admin', at: Date.now() }; saveBans(bans);
      } else { // timeout
        const ms = Math.min(Number(durationMs) || 3600000, 28 * 24 * 60 * 60 * 1000);
        const m = await getMember(userId); if (!m) return res.status(404).json({ error: 'Spieler nicht gefunden.' });
        await m.timeout(ms, grund);
        await dmUser(userId, new EmbedBuilder().setColor(0xe67e22).setTitle('🔇 Timeout erhalten').addFields({ name: 'Grund', value: grund }, { name: 'Dauer', value: humanDur(ms), inline: true }).setTimestamp());
      }
      await logTo(MOD_LOG_CH, new EmbedBuilder().setColor(0x8e44ad).setTitle('🛡️ Sanktion (Mod-System)')
        .addFields({ name: 'Spieler', value: `<@${userId}>`, inline: true }, { name: 'Aktion', value: action, inline: true }, { name: 'Grund', value: grund }, { name: 'Von', value: 'Dashboard-Admin' }).setTimestamp());
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Sanktion fehlgeschlagen: ' + e.message }); }
  });

  // ─── Dauer-Formatierung ──────────────────────────────────────────────────────
  function humanDur(ms) {
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    const parts = [];
    if (d) parts.push(d + ' Tag' + (d > 1 ? 'e' : ''));
    if (h) parts.push(h + ' Std');
    if (m) parts.push(m + ' Min');
    return parts.join(' ') || 'wenige Sekunden';
  }

  // ═════════════════════════════════════════════════════════════════════════════
  //  FRONTEND (HTML)
  // ═════════════════════════════════════════════════════════════════════════════
  app.get('/admin-panel', (req, res) => {
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(DASH_HTML);
  });

  console.log('[ADMIN-PANEL] Admin-Dashboard bereit unter /admin-panel');
};

// ═════════════════════════════════════════════════════════════════════════════
//  HTML: LOGIN
// ═════════════════════════════════════════════════════════════════════════════
const LOGIN_HTML = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Dashboard — Paradise City Roleplay</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:radial-gradient(circle at 50% 0%,#1a1208,#0d1117 60%);color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.box{background:#161b22;border:1px solid #30363d;border-radius:18px;max-width:420px;width:100%;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.head{background:linear-gradient(135deg,#bf360c,#e65100);padding:30px 24px;text-align:center}
.head .seal{font-size:2.6em}
.head h1{color:#fff;font-size:1.05em;letter-spacing:3px;text-transform:uppercase;margin-top:8px}
.head h2{color:#ffd180;font-size:.78em;letter-spacing:1px;margin-top:6px;font-weight:400}
.body{padding:30px 26px}
label{display:block;color:#ffd180;font-size:.78em;font-weight:600;letter-spacing:.5px;margin-bottom:6px;text-transform:uppercase}
input{width:100%;padding:12px 14px;background:#0d1117;border:1px solid #30363d;border-radius:9px;color:#e0e0e0;font-size:.95em;outline:none;margin-bottom:18px;transition:border .15s}
input:focus{border-color:#e65100}
.btn{width:100%;padding:14px;background:#e65100;color:#fff;border:none;border-radius:9px;font-size:1em;font-weight:700;letter-spacing:1px;cursor:pointer;transition:background .15s}
.btn:hover{background:#bf360c}
.err{background:#1c0a0a;border:1px solid #f85149;color:#f85149;padding:11px 14px;border-radius:8px;margin-bottom:16px;font-size:.85em;display:none}
.hint{color:#8b949e;font-size:.74em;text-align:center;margin-top:18px;line-height:1.6}
</style></head><body>
<div class="box">
  <div class="head"><div class="seal">🛡️</div><h1>Admin Dashboard</h1><h2>Paradise City Roleplay</h2></div>
  <div class="body">
    <div class="err" id="err"></div>
    <form id="f">
      <label>Discord ID</label>
      <input type="text" id="discordId" placeholder="z.B. 123456789012345678" autocomplete="off" inputmode="numeric" pattern="\d{17,20}" required>
      <label>Passwort</label>
      <input type="password" id="password" placeholder="••••••••" autocomplete="current-password" required>
      <button class="btn" type="submit">Anmelden</button>
    </form>
    <div class="hint">Nur autorisierte Teammitglieder mit der erforderlichen Rolle erhalten Zugriff.</div>
  </div>
</div>
<script>
document.getElementById('f').addEventListener('submit', async function(e){
  e.preventDefault();
  var err = document.getElementById('err');
  err.style.display='none';
  var btn = document.querySelector('.btn'); btn.textContent='Anmelden...'; btn.disabled=true;
  try{
    var r = await fetch('/admin-panel/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({discordId:document.getElementById('discordId').value.trim(),password:document.getElementById('password').value})});
    var d = await r.json();
    if(r.ok && d.ok){ location.href='/admin-panel'; return; }
    err.textContent = d.error || 'Anmeldung fehlgeschlagen.'; err.style.display='block';
  }catch(ex){ err.textContent='Verbindungsfehler.'; err.style.display='block'; }
  btn.textContent='Anmelden'; btn.disabled=false;
});
</script>
</body></html>`;

// ═════════════════════════════════════════════════════════════════════════════
//  HTML: DASHBOARD (Single-Page-App)
// ═════════════════════════════════════════════════════════════════════════════
const DASH_HTML = `<!DOCTYPE html><html lang="de"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin Dashboard — Paradise City Roleplay</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#0d1117;--panel:#161b22;--panel2:#1c2230;--border:#30363d;--accent:#e65100;--accent2:#bf360c;--gold:#ffd180;--txt:#e6edf3;--muted:#8b949e;--green:#2ea043;--red:#f85149;--blue:#388bfd}
body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;display:flex}
::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-thumb{background:#30363d;border-radius:8px}::-webkit-scrollbar-track{background:transparent}
a{color:inherit;text-decoration:none}
/* Sidebar */
.sidebar{width:248px;background:linear-gradient(180deg,#15110a,#0d1117);border-right:1px solid var(--border);min-height:100vh;position:fixed;top:0;left:0;display:flex;flex-direction:column;z-index:50}
.brand{padding:20px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:11px}
.brand .seal{font-size:1.7em}
.brand .t1{font-size:.86em;font-weight:700;letter-spacing:1px;color:#fff}
.brand .t2{font-size:.66em;color:var(--gold);letter-spacing:.5px}
.nav{flex:1;overflow-y:auto;padding:12px 10px}
.nav .cat{color:var(--muted);font-size:.64em;letter-spacing:1.5px;text-transform:uppercase;margin:16px 10px 6px}
.nav a{display:flex;align-items:center;gap:11px;padding:10px 12px;border-radius:9px;color:#c9d1d9;font-size:.9em;cursor:pointer;margin-bottom:2px;transition:.12s}
.nav a:hover{background:#21262d;color:#fff}
.nav a.active{background:linear-gradient(135deg,var(--accent2),var(--accent));color:#fff;font-weight:600}
.nav a .ic{width:20px;text-align:center;font-size:1.05em}
.nav .sub{margin-left:8px;border-left:1px solid var(--border);padding-left:6px;display:none}
.nav .sub.open{display:block}
.nav .sub a{font-size:.83em;padding:8px 12px}
.usr{padding:14px 16px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:8px}
.usr .nm{font-size:.82em;color:#fff;font-weight:600}.usr .rl{font-size:.66em;color:var(--gold)}
.usr button{background:#21262d;border:1px solid var(--border);color:#c9d1d9;border-radius:7px;padding:7px 10px;font-size:.72em;cursor:pointer}
.usr button:hover{background:#30363d;color:#fff}
/* Main */
.main{margin-left:248px;flex:1;padding:26px 30px 60px;width:calc(100% - 248px)}
.topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px}
.topbar h1{font-size:1.5em;color:#fff;display:flex;align-items:center;gap:10px}
.topbar .sub{color:var(--muted);font-size:.85em;margin-top:3px}
.refresh{background:#21262d;border:1px solid var(--border);color:#c9d1d9;border-radius:8px;padding:9px 14px;font-size:.82em;cursor:pointer}
.refresh:hover{background:#30363d;color:#fff}
/* Cards / grid */
.grid{display:grid;gap:16px}
.grid.c4{grid-template-columns:repeat(4,1fr)}
.grid.c3{grid-template-columns:repeat(3,1fr)}
.grid.c2{grid-template-columns:repeat(2,1fr)}
@media(max-width:1100px){.grid.c4{grid-template-columns:repeat(2,1fr)}.grid.c3{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.sidebar{transform:translateX(-100%)}.main{margin-left:0;width:100%}.grid.c4,.grid.c3,.grid.c2{grid-template-columns:1fr}}
.stat{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px 20px;position:relative;overflow:hidden}
.stat::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--accent)}
.stat .lab{color:var(--muted);font-size:.74em;text-transform:uppercase;letter-spacing:1px}
.stat .val{font-size:2em;font-weight:800;color:#fff;margin-top:6px}
.stat .ic{position:absolute;right:16px;top:16px;font-size:1.6em;opacity:.5}
.card{background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:18px}
.card h3{font-size:1em;color:#fff;margin-bottom:14px;display:flex;align-items:center;gap:9px}
.muted{color:var(--muted)}
.empty{text-align:center;padding:46px 20px;color:var(--muted)}
.empty .ic{font-size:2.6em;opacity:.4;margin-bottom:10px}
/* Tables */
table{width:100%;border-collapse:collapse;font-size:.86em}
th{text-align:left;color:var(--gold);font-size:.72em;text-transform:uppercase;letter-spacing:.8px;padding:10px 12px;border-bottom:1px solid var(--border)}
td{padding:11px 12px;border-bottom:1px solid #21262d;vertical-align:middle}
tr:hover td{background:#1a212c}
.av{width:30px;height:30px;border-radius:50%;vertical-align:middle;margin-right:9px}
.pill{display:inline-block;padding:3px 9px;border-radius:20px;font-size:.74em;font-weight:600}
.pill.g{background:#0d2e16;color:#3fb950;border:1px solid #238636}
.pill.r{background:#2d0d0d;color:#ff6b6b;border:1px solid #da3633}
.pill.o{background:#2d1d0a;color:#ffa657;border:1px solid #bb6502}
.pill.b{background:#0d2440;color:#79c0ff;border:1px solid #1f6feb}
.rolechip{display:inline-block;background:#21262d;border:1px solid var(--border);color:#c9d1d9;padding:2px 8px;border-radius:6px;font-size:.72em;margin:2px 3px 2px 0}
.btn{background:var(--accent);color:#fff;border:none;border-radius:8px;padding:9px 14px;font-size:.84em;font-weight:600;cursor:pointer;transition:.12s}
.btn:hover{background:var(--accent2)}
.btn.sm{padding:6px 11px;font-size:.78em}
.btn.gray{background:#21262d;border:1px solid var(--border);color:#c9d1d9}.btn.gray:hover{background:#30363d}
.btn.red{background:#7d1a1a}.btn.red:hover{background:#a52121}
.btn.green{background:#1a5a2a}.btn.green:hover{background:#218838}
.btn.blue{background:#1f4f8b}.btn.blue:hover{background:#2563b0}
input,select,textarea{width:100%;padding:10px 12px;background:#0d1117;border:1px solid var(--border);border-radius:8px;color:var(--txt);font-size:.88em;outline:none;font-family:inherit}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
.fld{margin-bottom:13px}
.fld label{display:block;color:var(--gold);font-size:.74em;font-weight:600;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
/* Modal */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:200;display:none;align-items:flex-start;justify-content:center;padding:40px 16px;overflow-y:auto}
.overlay.show{display:flex}
.modal{background:var(--panel);border:1px solid var(--border);border-radius:16px;max-width:560px;width:100%;animation:pop .25s ease}
@keyframes pop{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
.modal .mh{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.modal .mh h3{color:#fff;font-size:1.05em;display:flex;gap:10px;align-items:center}
.modal .mh .x{background:none;border:none;color:var(--muted);font-size:1.5em;cursor:pointer;line-height:1}
.modal .mb{padding:22px}
.tabs{display:flex;gap:6px;margin-bottom:16px;border-bottom:1px solid var(--border)}
.tabs button{background:none;border:none;color:var(--muted);padding:10px 14px;cursor:pointer;font-size:.86em;border-bottom:2px solid transparent}
.tabs button.active{color:#fff;border-bottom-color:var(--accent);font-weight:600}
.toast{position:fixed;bottom:24px;right:24px;background:var(--panel);border:1px solid var(--border);border-left:4px solid var(--green);border-radius:10px;padding:14px 20px;color:#fff;font-size:.88em;z-index:500;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;max-width:360px}
.toast.err{border-left-color:var(--red)}
.toast.show{display:block;animation:pop .25s ease}
.loading{text-align:center;padding:50px;color:var(--muted)}
.logentry{background:#0d1117;border:1px solid var(--border);border-radius:10px;padding:13px 15px;margin-bottom:10px;border-left:3px solid var(--accent)}
.logentry .lh{display:flex;justify-content:space-between;gap:10px;margin-bottom:6px}
.logentry .lt{color:#fff;font-weight:600;font-size:.9em}
.logentry .lts{color:var(--muted);font-size:.74em;white-space:nowrap}
.logentry .ld{color:#c9d1d9;font-size:.84em;line-height:1.5;white-space:pre-wrap}
.logentry .lf{color:var(--muted);font-size:.8em;margin-top:5px}
.logentry .lf b{color:var(--gold)}
.itemchip{display:inline-flex;align-items:center;gap:6px;background:#0d1117;border:1px solid var(--border);border-radius:8px;padding:5px 10px;margin:3px;font-size:.8em}
.itemchip .n{color:#fff}.itemchip .a{color:var(--accent);font-weight:700}
.search{max-width:320px;margin-bottom:14px}
</style></head><body>

<div class="sidebar">
  <div class="brand"><div class="seal">🛡️</div><div><div class="t1">ADMIN DASHBOARD</div><div class="t2">Paradise City Roleplay</div></div></div>
  <div class="nav" id="nav">
    <div class="cat">Allgemein</div>
    <a data-sec="overview" class="active"><span class="ic">🏠</span> Startseite</a>
    <a data-sec="stats"><span class="ic">📊</span> Server Stats</a>
    <div class="cat">Spieler</div>
    <a data-sec="verified"><span class="ic">✅</span> Verifizierte Spieler</a>
    <a data-sec="bans"><span class="ic">🚫</span> Gebannte Spieler</a>
    <div class="cat">Wirtschaft</div>
    <a data-sec="economy"><span class="ic">💰</span> Inventar &amp; Bank</a>
    <a data-sec="shops"><span class="ic">🏪</span> Shops</a>
    <div class="cat">Moderation</div>
    <a data-sec="raids"><span class="ic">🚨</span> Aktuelle Raubüberfälle</a>
    <a data-sec="mod"><span class="ic">🛡️</span> Mod System</a>
    <a id="logtoggle"><span class="ic">📋</span> Logs <span style="margin-left:auto;font-size:.8em" id="logarrow">▸</span></a>
    <div class="sub" id="logsub"></div>
  </div>
  <div class="usr"><div><div class="nm" id="uname">Admin</div><div class="rl">Administrator</div></div></div>
</div>

<div class="main">
  <div class="topbar">
    <div><h1 id="ptitle">🏠 Startseite</h1><div class="sub" id="psub">Übersicht des Admin Dashboards</div></div>
    <button class="refresh" onclick="reload()">↻ Aktualisieren</button>
  </div>
  <div id="content"><div class="loading">Lädt…</div></div>
</div>

<div class="overlay" id="overlay"><div class="modal" id="modal"></div></div>
<div class="toast" id="toast"></div>

<script>
var SHOP_LABELS = {kwik:'Kwik-E-Markt',baumarkt:'Baumarkt',angler:'Angler Shop',schwarz:'Schwarzmarkt',team:'Team-Shop'};
var BAN_DUR = [{l:'Permanent',ms:0},{l:'1 Tag',ms:86400000},{l:'3 Tage',ms:259200000},{l:'7 Tage',ms:604800000},{l:'14 Tage',ms:1209600000},{l:'30 Tage',ms:2592000000}];
var TO_DUR = [{l:'60 Sekunden',ms:60000},{l:'5 Minuten',ms:300000},{l:'10 Minuten',ms:600000},{l:'1 Stunde',ms:3600000},{l:'1 Tag',ms:86400000},{l:'1 Woche',ms:604800000},{l:'28 Tage',ms:2419200000}];
var SECTIONS = {
  overview:{t:'🏠 Startseite',s:'Übersicht des Admin Dashboards'},
  stats:{t:'📊 Server Stats',s:'Live-Statistiken des Servers'},
  verified:{t:'✅ Verifizierte Spieler',s:'Alle verifizierten Spieler verwalten'},
  bans:{t:'🚫 Gebannte Spieler',s:'Banns einsehen und aufheben'},
  economy:{t:'💰 Inventar & Bank',s:'Geld und Items der Spieler verwalten'},
  shops:{t:'🏪 Shops',s:'Shop-Items hinzufügen, bearbeiten und verschieben'},
  raids:{t:'🚨 Aktuelle Raubüberfälle',s:'Laufende Raubüberfälle einsehen und werten'},
  mod:{t:'🛡️ Mod System',s:'Verdächtiges Verhalten und Sanktionen'}
};
var LOG_TYPES = [];
var _eco = [], _items = [], _verified = [];

function esc(s){ if(s===null||s===undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtNum(n){ return (Number(n)||0).toLocaleString('de-CH'); }
function fmtTs(t){ if(!t) return '—'; var d=new Date(t); return d.toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function ago(t){ var s=Math.floor((Date.now()-t)/1000); if(s<60)return s+'s'; if(s<3600)return Math.floor(s/60)+'min'; if(s<86400)return Math.floor(s/3600)+'h'; return Math.floor(s/86400)+'d'; }

async function api(p,opts){ var r=await fetch('/admin-panel/api'+p,opts); var d=await r.json(); if(!r.ok) throw new Error(d.error||'Fehler'); return d; }
async function post(p,body){ return api(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); }
function toast(msg,isErr){ var t=document.getElementById('toast'); t.textContent=msg; t.className='toast show'+(isErr?' err':''); setTimeout(function(){t.className='toast'+(isErr?' err':'');},3200); }

function openModal(html){ document.getElementById('modal').innerHTML=html; document.getElementById('overlay').className='overlay show'; }
function closeModal(){ document.getElementById('overlay').className='overlay'; }
document.getElementById('overlay').addEventListener('click',function(e){ if(e.target.id==='overlay') closeModal(); });

var cur='overview';
function setActive(sec){
  var as=document.querySelectorAll('#nav a'); for(var i=0;i<as.length;i++) as[i].classList.remove('active');
  var el=document.querySelector('#nav a[data-sec="'+sec+'"]'); if(el) el.classList.add('active');
}
function nav(sec){ cur=sec; var meta=SECTIONS[sec]; if(meta){document.getElementById('ptitle').textContent=meta.t;document.getElementById('psub').textContent=meta.s;} setActive(sec); render(sec); }
function reload(){ if(cur.indexOf('log:')===0) renderLog(cur.slice(4)); else render(cur); }

document.querySelectorAll('#nav a[data-sec]').forEach(function(a){ a.addEventListener('click',function(){nav(a.getAttribute('data-sec'));}); });
document.getElementById('logtoggle').addEventListener('click',function(){ var s=document.getElementById('logsub'); s.classList.toggle('open'); document.getElementById('logarrow').textContent=s.classList.contains('open')?'▾':'▸'; });

function C(){ return document.getElementById('content'); }
function loading(){ C().innerHTML='<div class="loading">Lädt…</div>'; }
function err(e){ C().innerHTML='<div class="empty"><div class="ic">⚠️</div>'+esc(e.message||e)+'</div>'; }

async function render(sec){
  loading();
  try{
    if(sec==='overview') return renderOverview();
    if(sec==='stats') return renderStats();
    if(sec==='verified') return renderVerified();
    if(sec==='bans') return renderBans();
    if(sec==='economy') return renderEconomy();
    if(sec==='shops') return renderShops();
    if(sec==='raids') return renderRaids();
    if(sec==='mod') return renderMod();
  }catch(e){ err(e); }
}

/* ── ÜBERSICHT ── */
async function renderOverview(){
  var d=await api('/overview');
  var cards=[
    {l:'Verifizierte Spieler',v:d.verified,i:'✅'},
    {l:'Wirtschafts-Spieler',v:d.invPlayers,i:'💰'},
    {l:'Aktive Raubüberfälle',v:d.raids,i:'🚨'},
    {l:'Gebannte Spieler',v:d.bans,i:'🚫'},
    {l:'Offene Tickets',v:d.tickets,i:'🎫'},
    {l:'Mitglieder gesamt',v:d.memberCount,i:'👥'}
  ];
  var h='<div class="grid c3">';
  cards.forEach(function(c){ h+='<div class="stat"><div class="ic">'+c.i+'</div><div class="lab">'+c.l+'</div><div class="val">'+fmtNum(c.v)+'</div></div>'; });
  h+='</div>';
  h+='<div class="card" style="margin-top:18px"><h3>⚡ Schnellzugriff</h3><div class="grid c4">';
  var qs=[['verified','✅','Verifizierte Spieler'],['bans','🚫','Gebannte Spieler'],['economy','💰','Inventar & Bank'],['shops','🏪','Shops'],['raids','🚨','Raubüberfälle'],['mod','🛡️','Mod System'],['stats','📊','Server Stats'],['log:mod','📋','Mod Log']];
  qs.forEach(function(q){ h+='<a class="btn gray" style="display:block;text-align:center;padding:16px 10px" onclick="quick(\\''+q[0]+'\\')"><div style="font-size:1.6em">'+q[1]+'</div><div style="margin-top:6px;font-size:.86em">'+q[2]+'</div></a>'; });
  h+='</div></div>';
  C().innerHTML=h;
}
function quick(s){ if(s.indexOf('log:')===0){ document.getElementById('logsub').classList.add('open'); document.getElementById('logarrow').textContent='▾'; navLog(s.slice(4)); } else nav(s); }

/* ── SERVER STATS ── */
async function renderStats(){
  var d=await api('/stats');
  var up=d.uptimeS,upd=Math.floor(up/86400),uph=Math.floor((up%86400)/3600),upm=Math.floor((up%3600)/60);
  var upStr=(upd?upd+'d ':'')+(uph?uph+'h ':'')+upm+'min';
  var cards=[
    {l:'Beitritte (24h)',v:d.joins24h,i:'📈'},
    {l:'Austritte (24h)',v:d.leaves24h,i:'📉'},
    {l:'Offene Tickets',v:d.ticketCount,i:'🎫'},
    {l:'Mitglieder',v:d.memberCount,i:'👥'}
  ];
  var h='<div class="grid c4">';
  cards.forEach(function(c){ h+='<div class="stat"><div class="ic">'+c.i+'</div><div class="lab">'+c.l+'</div><div class="val">'+fmtNum(c.v)+'</div></div>'; });
  h+='</div>';
  h+='<div class="card" style="margin-top:18px"><h3>🤖 Bot-Auslastung</h3><div class="grid c3">';
  h+='<div class="stat"><div class="lab">Status</div><div class="val" style="font-size:1.3em;color:#3fb950">'+esc(d.botStatus)+'</div></div>';
  h+='<div class="stat"><div class="lab">Ping</div><div class="val" style="font-size:1.3em">'+d.botPing+' ms</div></div>';
  h+='<div class="stat"><div class="lab">Laufzeit</div><div class="val" style="font-size:1.3em">'+upStr+'</div></div>';
  h+='</div></div>';
  C().innerHTML=h;
}

/* ── VERIFIZIERTE SPIELER ── */
async function renderVerified(){
  _verified=await api('/verified');
  if(!_verified.length){ C().innerHTML='<div class="empty"><div class="ic">✅</div>Keine verifizierten Spieler gefunden.</div>'; return; }
  var h='<input class="search" placeholder="🔍 Suchen nach Name oder ID…" oninput="filterTable(this.value,\\'vtable\\')">';
  h+='<div class="card"><table id="vtable"><thead><tr><th>Spieler</th><th>Serverprofil</th><th>Charakter</th><th>Rollen</th><th>Discord-ID</th><th></th></tr></thead><tbody>';
  _verified.forEach(function(p){
    var ch=p.character?esc(p.character.vorname+' '+p.character.nachname):'<span class="muted">—</span>';
    var roles=p.roles.slice(0,4).map(function(r){return '<span class="rolechip">'+esc(r)+'</span>';}).join('')+(p.roles.length>4?'<span class="muted" style="font-size:.74em">+'+(p.roles.length-4)+'</span>':'');
    h+='<tr data-s="'+esc((p.name+' '+p.username+' '+p.id).toLowerCase())+'"><td><img class="av" src="'+esc(p.avatar)+'">'+esc(p.username)+'</td><td>'+esc(p.name)+'</td><td>'+ch+'</td><td>'+roles+'</td><td><span class="muted" style="font-size:.84em">'+esc(p.id)+'</span></td><td><button class="btn sm" onclick="openPlayer(\\''+p.id+'\\')">Verwalten</button></td></tr>';
  });
  h+='</tbody></table></div>';
  C().innerHTML=h;
}
function filterTable(q,id){ q=q.toLowerCase(); var rows=document.querySelectorAll('#'+id+' tbody tr'); rows.forEach(function(r){ r.style.display=(r.getAttribute('data-s')||'').indexOf(q)>=0?'':'none'; }); }

/* ── SPIELER-MODAL (Bannen / Timeout) ── */
async function openPlayer(id){
  openModal('<div class="mb loading">Lädt…</div>');
  try{
    var p=await api('/player/'+id);
    var ch=p.character?esc(p.character.vorname+' '+p.character.nachname+' · '+(p.character.geburtsdatum||'')):'<span class="muted">Kein Charakter</span>';
    var roles=p.roles.map(function(r){return '<span class="rolechip">'+esc(r)+'</span>';}).join('')||'<span class="muted">—</span>';
    var banOpts=BAN_DUR.map(function(d,i){return '<option value="'+d.ms+'">'+d.l+'</option>';}).join('');
    var toOpts=TO_DUR.map(function(d,i){return '<option value="'+d.ms+'"'+(d.ms===3600000?' selected':'')+'>'+d.l+'</option>';}).join('');
    var toStatus=p.isTimedOut?'<span class="pill o">Im Timeout bis '+fmtTs(p.timeoutUntil)+'</span>':'';
    var h='<div class="mh"><h3>👤 '+esc(p.name)+'</h3><button class="x" onclick="closeModal()">×</button></div><div class="mb">';
    h+='<div style="display:flex;gap:14px;align-items:center;margin-bottom:16px"><img class="av" style="width:54px;height:54px" src="'+esc(p.avatar)+'"><div><div style="color:#fff;font-weight:700">'+esc(p.username)+'</div><div class="muted" style="font-size:.82em">'+esc(p.id)+'</div><div style="margin-top:4px">'+ (p.verified?'<span class="pill g">Verifiziert</span>':'<span class="pill r">Nicht verifiziert</span>')+' '+toStatus+'</div></div></div>';
    h+='<div style="font-size:.84em;margin-bottom:6px"><b class="muted">Charakter:</b> '+ch+'</div>';
    h+='<div style="font-size:.84em;margin-bottom:16px"><b class="muted">Rollen:</b><br>'+roles+'</div>';
    h+='<div class="tabs"><button class="active" onclick="ptab(this,\\'ban\\')">🔨 Bannen</button><button onclick="ptab(this,\\'to\\')">🔇 Timeout</button></div>';
    h+='<div id="ptab-ban"><div class="fld"><label>Dauer</label><select id="banDur">'+banOpts+'</select></div><div class="fld"><label>Grund</label><textarea id="banReason" rows="3" placeholder="Grund für den Bann…"></textarea></div><button class="btn red" style="width:100%" onclick="doBan(\\''+p.id+'\\')">🔨 Spieler bannen</button></div>';
    h+='<div id="ptab-to" style="display:none"><div class="fld"><label>Dauer</label><select id="toDur">'+toOpts+'</select></div><div class="fld"><label>Grund</label><textarea id="toReason" rows="3" placeholder="Grund für den Timeout…"></textarea></div><button class="btn" style="width:100%;background:#bb6502" onclick="doTimeout(\\''+p.id+'\\')">🔇 Timeout vergeben</button></div>';
    h+='</div>';
    document.getElementById('modal').innerHTML=h;
  }catch(e){ document.getElementById('modal').innerHTML='<div class="mb empty"><div class="ic">⚠️</div>'+esc(e.message)+'</div>'; }
}
function ptab(btn,which){ var bs=btn.parentNode.querySelectorAll('button'); bs.forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); document.getElementById('ptab-ban').style.display=which==='ban'?'':'none'; document.getElementById('ptab-to').style.display=which==='to'?'':'none'; }
async function doBan(id){ var reason=document.getElementById('banReason').value.trim(); if(!reason){toast('Bitte einen Grund angeben.',true);return;} try{ await post('/ban',{userId:id,durationMs:Number(document.getElementById('banDur').value),reason:reason}); toast('Spieler wurde gebannt.'); closeModal(); if(cur==='verified')render('verified'); }catch(e){ toast(e.message,true);} }
async function doTimeout(id){ var reason=document.getElementById('toReason').value.trim(); if(!reason){toast('Bitte einen Grund angeben.',true);return;} try{ await post('/timeout',{userId:id,durationMs:Number(document.getElementById('toDur').value),reason:reason}); toast('Timeout vergeben.'); closeModal(); }catch(e){ toast(e.message,true);} }

/* ── GEBANNTE SPIELER ── */
async function renderBans(){
  var list=await api('/bans');
  if(!list.length){ C().innerHTML='<div class="empty"><div class="ic">🚫</div>Aktuell sind keine Spieler gebannt.</div>'; return; }
  var h='<div class="card"><table><thead><tr><th>Spieler</th><th>Grund</th><th>Dauer</th><th>Gebannt von</th><th></th></tr></thead><tbody>';
  list.forEach(function(b){
    var dur=b.until?('Bis '+fmtTs(b.until)):'<span class="pill r">Permanent</span>';
    h+='<tr><td>'+(b.avatar?'<img class="av" src="'+esc(b.avatar)+'">':'')+esc(b.username)+'<div class="muted" style="font-size:.76em">'+esc(b.id)+'</div></td><td>'+esc(b.reason)+'</td><td>'+dur+'</td><td>'+(b.by?esc(b.by):'<span class="muted">—</span>')+'</td><td><button class="btn green sm" onclick="doUnban(\\''+b.id+'\\')">Entbannen</button></td></tr>';
  });
  h+='</tbody></table></div>';
  C().innerHTML=h;
}
async function doUnban(id){ if(!confirm('Diesen Spieler wirklich entbannen?'))return; try{ await post('/unban',{userId:id}); toast('Spieler wurde entbannt.'); render('bans'); }catch(e){ toast(e.message,true);} }

/* ── INVENTAR & BANK ── */
async function renderEconomy(){
  _eco=await api('/economy');
  try{ _items=await api('/items'); }catch(e){ _items=[]; }
  if(!_eco.length){ C().innerHTML='<div class="empty"><div class="ic">💰</div>Keine Spieler mit der entsprechenden Rolle gefunden.</div>'; return; }
  var h='<input class="search" placeholder="🔍 Spieler suchen…" oninput="filterTable(this.value,\\'etable\\')">';
  h+='<div class="card"><table id="etable"><thead><tr><th>Spieler</th><th>Bargeld</th><th>Konto</th><th>Schwarzgeld</th><th>PC-Coins</th><th>Items</th><th></th></tr></thead><tbody>';
  _eco.forEach(function(p,idx){
    var itemCount=Object.keys(p.items||{}).length;
    h+='<tr data-s="'+esc((p.name+' '+p.username+' '+p.id).toLowerCase())+'"><td><img class="av" src="'+esc(p.avatar)+'">'+esc(p.name)+'<div class="muted" style="font-size:.74em">'+esc(p.id)+'</div></td><td>'+fmtNum(p.bargeld)+'</td><td>'+fmtNum(p.konto)+'</td><td>'+fmtNum(p.schwarz)+'</td><td>'+fmtNum(p.coins)+'</td><td>'+itemCount+'</td><td><button class="btn sm" onclick="openEco('+idx+')">Verwalten</button></td></tr>';
  });
  h+='</tbody></table></div>';
  C().innerHTML=h;
}
function openEco(idx){
  var p=_eco[idx];
  var moneyTypes=[['bargeld','Bargeld',p.bargeld],['konto','Konto',p.konto],['schwarz','Schwarzgeld',p.schwarz],['coins','PC-Coins',p.coins]];
  var mt=moneyTypes.map(function(m){return '<option value="'+m[0]+'">'+m[1]+' (aktuell: '+fmtNum(m[2])+')</option>';}).join('');
  var itemOpts=_items.map(function(it){return '<option value="'+esc(it)+'">'+esc(it)+'</option>';}).join('');
  var invChips=Object.keys(p.items||{}).map(function(k){return '<span class="itemchip"><span class="n">'+esc(k)+'</span><span class="a">×'+p.items[k]+'</span></span>';}).join('')||'<span class="muted">Inventar leer</span>';
  var h='<div class="mh"><h3>💰 '+esc(p.name)+'</h3><button class="x" onclick="closeModal()">×</button></div><div class="mb">';
  h+='<div class="grid c2" style="margin-bottom:16px"><div class="stat"><div class="lab">Bargeld</div><div class="val" style="font-size:1.2em">'+fmtNum(p.bargeld)+'</div></div><div class="stat"><div class="lab">Konto</div><div class="val" style="font-size:1.2em">'+fmtNum(p.konto)+'</div></div><div class="stat"><div class="lab">Schwarzgeld</div><div class="val" style="font-size:1.2em">'+fmtNum(p.schwarz)+'</div></div><div class="stat"><div class="lab">PC-Coins</div><div class="val" style="font-size:1.2em">'+fmtNum(p.coins)+'</div></div></div>';
  h+='<div class="tabs"><button class="active" onclick="etab(this,\\'money\\')">💵 Geld</button><button onclick="etab(this,\\'item\\')">📦 Items</button></div>';
  h+='<div id="etab-money"><div class="fld"><label>Geld-Typ</label><select id="mType">'+mt+'</select></div><div class="row2"><div class="fld"><label>Aktion</label><select id="mAction"><option value="add">Hinzufügen</option><option value="remove">Abziehen</option></select></div><div class="fld"><label>Betrag</label><input type="number" id="mAmount" min="1" placeholder="z.B. 5000"></div></div><button class="btn" style="width:100%" onclick="doMoney(\\''+p.id+'\\','+idx+')">Geld anpassen</button></div>';
  h+='<div id="etab-item" style="display:none"><div style="margin-bottom:12px">'+invChips+'</div><div class="fld"><label>Item (nur aus Shops)</label><select id="iName">'+itemOpts+'</select></div><div class="row2"><div class="fld"><label>Aktion</label><select id="iAction"><option value="add">Geben</option><option value="remove">Entfernen</option></select></div><div class="fld"><label>Menge</label><input type="number" id="iAmount" min="1" value="1"></div></div><button class="btn" style="width:100%" onclick="doItem(\\''+p.id+'\\','+idx+')">Item anpassen</button></div>';
  h+='</div>';
  openModal(h);
}
function etab(btn,which){ var bs=btn.parentNode.querySelectorAll('button'); bs.forEach(function(b){b.classList.remove('active');}); btn.classList.add('active'); document.getElementById('etab-money').style.display=which==='money'?'':'none'; document.getElementById('etab-item').style.display=which==='item'?'':'none'; }
async function doMoney(id,idx){ var amt=Number(document.getElementById('mAmount').value); if(!amt||amt<=0){toast('Bitte einen gültigen Betrag eingeben.',true);return;} try{ await post('/money',{userId:id,type:document.getElementById('mType').value,action:document.getElementById('mAction').value,amount:amt}); toast('Geld angepasst.'); closeModal(); render('economy'); }catch(e){ toast(e.message,true);} }
async function doItem(id,idx){ var amt=Number(document.getElementById('iAmount').value)||1; try{ await post('/item',{userId:id,action:document.getElementById('iAction').value,item:document.getElementById('iName').value,amount:amt}); toast('Inventar angepasst.'); closeModal(); render('economy'); }catch(e){ toast(e.message,true);} }

/* ── SHOPS ── */
async function renderShops(){
  var shops=await api('/shops');
  var h='';
  Object.keys(shops).forEach(function(sid){
    var s=shops[sid];
    h+='<div class="card"><h3>🏪 '+esc(s.label)+' <span class="muted" style="font-size:.8em;font-weight:400">('+s.items.length+' Items)</span> <button class="btn sm" style="margin-left:auto" onclick="addShopItem(\\''+sid+'\\')">+ Item</button></h3>';
    if(!s.items.length){ h+='<div class="muted" style="font-size:.86em">Keine Items in diesem Shop.</div>'; }
    else{
      h+='<table><thead><tr><th>Item</th><th>Preis</th><th></th></tr></thead><tbody>';
      s.items.forEach(function(it,i){ h+='<tr><td>'+esc(it.name)+'</td><td>'+fmtNum(it.preis)+'</td><td style="text-align:right"><button class="btn gray sm" onclick="editShopItem(\\''+sid+'\\','+i+',\\''+esc(it.name).replace(/\\\\/g,'').replace(/'/g,"\\\\'")+'\\','+it.preis+')">Bearbeiten</button> <button class="btn red sm" onclick="delShopItem(\\''+sid+'\\','+i+')">Löschen</button></td></tr>'; });
      h+='</tbody></table>';
    }
    h+='</div>';
  });
  C().innerHTML=h;
  window._shops=shops;
}
function addShopItem(sid){
  var h='<div class="mh"><h3>+ Item zu '+esc(SHOP_LABELS[sid]||sid)+'</h3><button class="x" onclick="closeModal()">×</button></div><div class="mb">';
  h+='<div class="fld"><label>Item-Name</label><input id="siName" placeholder="z.B. Wasserflasche"></div><div class="fld"><label>Preis</label><input type="number" id="siPreis" min="0" placeholder="z.B. 50"></div>';
  h+='<button class="btn" style="width:100%" onclick="doAddShopItem(\\''+sid+'\\')">Hinzufügen</button></div>';
  openModal(h);
}
async function doAddShopItem(sid){ var name=document.getElementById('siName').value.trim(); if(!name){toast('Name erforderlich.',true);return;} try{ await post('/shop/item/add',{shop:sid,name:name,preis:Number(document.getElementById('siPreis').value)||0}); toast('Item hinzugefügt.'); closeModal(); render('shops'); }catch(e){ toast(e.message,true);} }
function editShopItem(sid,i,name,preis){
  var shopOpts=Object.keys(SHOP_LABELS).map(function(k){return '<option value="'+k+'"'+(k===sid?' selected':'')+'>'+SHOP_LABELS[k]+'</option>';}).join('');
  var h='<div class="mh"><h3>✏️ Item bearbeiten</h3><button class="x" onclick="closeModal()">×</button></div><div class="mb">';
  h+='<div class="fld"><label>Item-Name</label><input id="eiName" value="'+esc(name)+'"></div><div class="fld"><label>Preis</label><input type="number" id="eiPreis" value="'+preis+'"></div>';
  h+='<div class="fld"><label>In Shop verschieben</label><select id="eiMove">'+shopOpts+'</select></div>';
  h+='<button class="btn" style="width:100%" onclick="doEditShopItem(\\''+sid+'\\','+i+')">Speichern</button></div>';
  openModal(h);
}
async function doEditShopItem(sid,i){ try{ await post('/shop/item/edit',{shop:sid,index:i,name:document.getElementById('eiName').value.trim(),preis:Number(document.getElementById('eiPreis').value)||0,moveTo:document.getElementById('eiMove').value}); toast('Item gespeichert.'); closeModal(); render('shops'); }catch(e){ toast(e.message,true);} }
async function delShopItem(sid,i){ if(!confirm('Dieses Item wirklich löschen?'))return; try{ await post('/shop/item/delete',{shop:sid,index:i}); toast('Item gelöscht.'); render('shops'); }catch(e){ toast(e.message,true);} }

/* ── RAUBÜBERFÄLLE ── */
async function renderRaids(){
  var list=await api('/raids');
  if(!list.length){ C().innerHTML='<div class="empty"><div class="ic">🚨</div>Aktuell laufen keine Raubüberfälle.</div>'; return; }
  var h='<div class="grid c2">';
  list.forEach(function(r){
    h+='<div class="card" style="margin-bottom:0"><h3>'+esc(r.title||r.type)+'</h3>';
    h+='<div style="font-size:.86em;line-height:1.8"><div><b class="muted">Spieler:</b> '+esc(r.caller||'—')+'</div><div><b class="muted">Ort:</b> '+esc(r.location||'—')+'</div><div><b class="muted">Gestartet:</b> '+(r.ts?fmtTs(r.ts)+' ('+ago(r.ts)+')':'—')+'</div></div>';
    h+='<div style="margin-top:8px;font-size:.84em;color:#c9d1d9">'+esc(r.description||'')+'</div>';
    h+='<button class="btn red" style="width:100%;margin-top:14px" onclick="failRaid(\\''+esc(String(r.id))+'\\')">❌ Als fehlgeschlagen werten</button></div>';
  });
  h+='</div>';
  C().innerHTML=h;
}
async function failRaid(id){ if(!confirm('Diesen Raubüberfall als fehlgeschlagen werten? Der Spieler erhält eine DM.'))return; try{ await post('/raids/fail',{id:id}); toast('Raubüberfall als fehlgeschlagen gewertet.'); render('raids'); }catch(e){ toast(e.message,true);} }

/* ── MOD SYSTEM ── */
async function renderMod(){
  var d=await api('/mod');
  var h='<div class="card"><h3>🛡️ Spieler sanktionieren</h3><div class="row2"><div class="fld"><label>Discord-ID des Spielers</label><input id="snId" placeholder="z.B. 123456789012345678"></div><div class="fld"><label>Aktion</label><select id="snAction" onchange="snToggle()"><option value="timeout">Timeout</option><option value="kick">Kick</option><option value="ban">Bann</option></select></div></div>';
  h+='<div class="fld" id="snDurWrap"><label>Timeout-Dauer</label><select id="snDur">'+TO_DUR.map(function(d){return '<option value="'+d.ms+'"'+(d.ms===3600000?' selected':'')+'>'+d.l+'</option>';}).join('')+'</select></div>';
  h+='<div class="fld"><label>Grund</label><input id="snReason" placeholder="Grund der Sanktion…"></div><button class="btn red" onclick="doSanction()">Sanktion ausführen</button></div>';
  h+='<div class="grid c2"><div class="card"><h3>🚩 Mod Log (verdächtiges Verhalten)</h3>'+renderLogEntries(d.mod)+'</div><div class="card"><h3>🔗 Einladungen / Invites</h3>'+renderLogEntries(d.invites)+'</div></div>';
  C().innerHTML=h;
}
function snToggle(){ var a=document.getElementById('snAction').value; document.getElementById('snDurWrap').style.display=a==='timeout'?'':'none'; }
async function doSanction(){ var id=document.getElementById('snId').value.trim(); if(!id){toast('Bitte Discord-ID eingeben.',true);return;} var a=document.getElementById('snAction').value; try{ await post('/sanction',{userId:id,action:a,durationMs:a==='timeout'?Number(document.getElementById('snDur').value):0,reason:document.getElementById('snReason').value.trim()}); toast('Sanktion ausgeführt.'); renderMod(); }catch(e){ toast(e.message,true);} }

/* ── LOGS ── */
function renderLogEntries(entries){
  if(!entries||!entries.length) return '<div class="muted" style="font-size:.86em">Keine Einträge vorhanden.</div>';
  var h='';
  entries.forEach(function(m){
    var emb=m.embeds&&m.embeds[0];
    var title=emb&&emb.title?emb.title:(m.content?'':'Eintrag');
    var desc=emb&&emb.description?emb.description:m.content;
    h+='<div class="logentry"><div class="lh"><div class="lt">'+esc(title||m.author)+'</div><div class="lts">'+fmtTs(m.ts)+'</div></div>';
    if(desc) h+='<div class="ld">'+esc(desc)+'</div>';
    if(emb&&emb.fields&&emb.fields.length){ h+='<div class="lf">'; emb.fields.forEach(function(f){ h+='<div><b>'+esc(f.name)+':</b> '+esc(f.value)+'</div>'; }); h+='</div>'; }
    h+='</div>';
  });
  return h;
}
function navLog(type){ cur='log:'+type; var lt=LOG_TYPES.find(function(x){return x.key===type;}); document.getElementById('ptitle').textContent='📋 '+(lt?lt.label:'Log'); document.getElementById('psub').textContent='Letzte Einträge aus dem Discord-Kanal'; document.querySelectorAll('#nav a').forEach(function(a){a.classList.remove('active');}); var el=document.querySelector('#logsub a[data-log="'+type+'"]'); if(el)el.classList.add('active'); renderLog(type); }
async function renderLog(type){ loading(); try{ var d=await api('/logs/'+type); C().innerHTML='<div class="card"><h3>📋 '+esc(d.label)+'</h3>'+renderLogEntries(d.entries)+'</div>'; }catch(e){ err(e); } }

/* ── INIT ── */
async function init(){
  try{ var me=await api('/me'); document.getElementById('uname').textContent=me.name||me.username; }catch(e){}
  try{
    LOG_TYPES=await api('/logs');
    var sub=document.getElementById('logsub');
    sub.innerHTML=LOG_TYPES.map(function(l){return '<a data-log="'+l.key+'" onclick="navLog(\\''+l.key+'\\')">'+esc(l.label)+'</a>';}).join('');
  }catch(e){}
  nav('overview');
}
init();
</script>
</body></html>`;
