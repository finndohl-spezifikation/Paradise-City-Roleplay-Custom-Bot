/**
 * Darknet System v2
 * Schwarzmarkt, Chat, Konto, PC Coin Integration
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

module.exports = function initDarknet(app, DATA_DIR, client, darknetTokens) {

  const DARKNET_DIR = path.join(DATA_DIR, 'darknet');
  if (!fs.existsSync(DARKNET_DIR)) fs.mkdirSync(DARKNET_DIR, { recursive: true });

  const USERS_FILE        = path.join(DARKNET_DIR, 'users.json');
  const MARKET_FILE       = path.join(DARKNET_DIR, 'market.json');
  const CHATS_FILE        = path.join(DARKNET_DIR, 'chats.json');
  const TRANSACTIONS_FILE = path.join(DARKNET_DIR, 'transactions.json');

  function loadUsers()        { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8'));        } catch { return {}; } }
  function saveUsers(d)        { fs.writeFileSync(USERS_FILE,        JSON.stringify(d,null,2),'utf8'); }
  function loadMarket()        { try { return JSON.parse(fs.readFileSync(MARKET_FILE,'utf8'));       } catch { return []; } }
  function saveMarket(d)       { fs.writeFileSync(MARKET_FILE,       JSON.stringify(d,null,2),'utf8'); }
  function loadChats()         { try { return JSON.parse(fs.readFileSync(CHATS_FILE,'utf8'));        } catch { return []; } }
  function saveChats(d)        { fs.writeFileSync(CHATS_FILE,        JSON.stringify(d,null,2),'utf8'); }
  function loadTransactions()  { try { return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE,'utf8')); } catch { return []; } }
  function saveTransactions(d) { fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(d,null,2),'utf8'); }

  function getKrypto(uid) {
    const kf = path.join(DATA_DIR,'krypto.json');
    let d={}; try { d=JSON.parse(fs.readFileSync(kf,'utf8')); } catch {}
    return d[uid]||{dc:0};
  }
  function setKrypto(uid,obj) {
    const kf = path.join(DATA_DIR,'krypto.json');
    let d={}; try { d=JSON.parse(fs.readFileSync(kf,'utf8')); } catch {}
    d[uid]=obj; fs.writeFileSync(kf,JSON.stringify(d,null,2),'utf8');
  }

  const adminSecret = process.env.DARKNET_ADMIN_SECRET || 'darknet_admin_2025';

  function resolveUser(req) {
    // 1. Token-basiert (Discord-Button)
    const token = req.query.dc || req.body?.dc;
    if (token) {
      const entry = darknetTokens.get(token);
      if (entry && entry.expiresAt > Date.now()) return entry.discordUserId;
    }
    // 2. Session-basiert (direkter Seitenlink)
    if (req.session && req.session.darknetUid) return req.session.darknetUid;
    return null;
  }

  function getOrCreateUser(uid) {
    const users = loadUsers();
    if (!users[uid]) {
      users[uid] = { username: 'Alias_' + uid.slice(-6), createdAt: Date.now() };
      saveUsers(users);
    }
    return users[uid];
  }

  // ─── API ROUTES ──────────────────────────────────────────────────────────────

  app.get('/api/darknet/user/me', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const user = getOrCreateUser(uid);
    const wallet = getKrypto(uid);
    res.json({ ...user, discordUserId: uid, pcCoins: wallet.dc || 0 });
  });

  // ─── POST /darknet/login — Session-Login via Discord User ID ────────────────
  app.post('/darknet/login', express.urlencoded({ extended: false }), (req, res) => {
    const uid = (req.body.uid || '').trim().replace(/\D/g, '');
    const back = req.body.back || '/darknet';
    if (!uid || uid.length < 15 || uid.length > 20) {
      return res.redirect('/darknet?loginerror=1');
    }
    req.session.darknetUid = uid;
    req.session.save(() => res.redirect(back));
  });

  // ─── GET /darknet/logout ─────────────────────────────────────────────────────
  app.get('/darknet/logout', (req, res) => {
    if (req.session) req.session.darknetUid = null;
    res.redirect('/darknet');
  });

  const VERBOTENE_WOERTER = [
    'hurensohn','hure','nutte','wichser','wichsen','fick','ficken','arschloch','arsch','scheiße','scheisse',
    'scheiß','scheis','kacke','kackst','kacker','fotze','schwanz','penis','vagina','pussy','nigger','nigga',
    'neger','nazi','hitler','faggot','faggot','bitch','bastard','idiot','vollidiot','depp','trottel','spast',
    'spastiker','mongo','retard','behindert','pisser','pissen','pisst','kackwurst','schlampe','luder','miststück',
    'wichse','hass','kanake','türkensau','judensau','penner','loser','fucker','fuck','asshole','shit','cunt',
    'motherfucker','dickhead','cock','twat'
  ];
  function hatVulgaerWort(text) {
    const clean = text.toLowerCase().replace(/[^a-zäöüß0-9]/g,'');
    return VERBOTENE_WOERTER.some(w => clean.includes(w.replace(/[^a-zäöüß0-9]/g,'')));
  }

  app.post('/api/darknet/user/username', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { username } = req.body || {};
    if (!username || username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Ungültiger Nutzername' });
    if (hatVulgaerWort(username)) return res.status(400).json({ error: 'Dieser Nutzername ist nicht erlaubt' });
    if (!/^[a-zA-Z0-9äöüÄÖÜß_\-\.]+$/.test(username)) return res.status(400).json({ error: 'Nur Buchstaben, Zahlen, _, - und . erlaubt' });
    const users = loadUsers();
    const taken = Object.values(users).some(u => u.username === username);
    if (taken) return res.status(409).json({ error: 'Nutzername bereits vergeben' });
    users[uid] = { ...(users[uid]||{}), username, updatedAt: Date.now() };
    saveUsers(users);
    res.json({ ok: true, username });
  });

  app.get('/api/darknet/market', (req, res) => {
    const market = loadMarket();
    const category = req.query.category;
    const search   = req.query.search;
    let items = market.filter(m => m.status === 'active');
    if (category) items = items.filter(m => m.category === category);
    if (search)   items = items.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()));
    res.json(items);
  });

  app.post('/api/darknet/market', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, price, category, purchaseType } = req.body || {};
    if (!title||!description||!price||!category||!purchaseType) return res.status(400).json({ error: 'Fehlende Felder' });
    const market = loadMarket();
    const item = {
      id: 'dwm_' + crypto.randomBytes(8).toString('hex'),
      sellerId: uid, sellerUsername: getOrCreateUser(uid).username,
      title, description, price: parseInt(price), category, purchaseType,
      status: 'active', createdAt: Date.now(), offers: []
    };
    market.push(item);
    saveMarket(market);
    res.json({ ok: true, item });
  });

  app.post('/api/darknet/market/:id/offer', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const market = loadMarket();
    const item = market.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
    const { price } = req.body || {};
    if (!price || price <= 0) return res.status(400).json({ error: 'Ungültiges Angebot' });
    item.offers = item.offers || [];
    item.offers.push({ buyerId: uid, buyerUsername: getOrCreateUser(uid).username, price: parseInt(price), status: 'pending', createdAt: Date.now() });
    saveMarket(market);
    res.json({ ok: true });
  });

  app.post('/api/darknet/market/:id/buy', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const market = loadMarket();
    const item = market.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Nicht gefunden' });
    if (item.sellerId === uid) return res.status(400).json({ error: 'Eigener Artikel' });
    if (item.status !== 'active') return res.status(400).json({ error: 'Bereits verkauft' });
    const buyerWallet  = getKrypto(uid);
    const sellerWallet = getKrypto(item.sellerId);
    if (Number(buyerWallet.dc||0) < Number(item.price)) return res.status(400).json({ error: 'Nicht genug PC Coins' });

    buyerWallet.dc  -= item.price;
    sellerWallet.dc += item.price;
    setKrypto(uid, buyerWallet);
    setKrypto(item.sellerId, sellerWallet);

    item.status = 'sold'; item.buyerId = uid;
    item.buyerUsername = getOrCreateUser(uid).username;
    item.soldAt = Date.now();
    saveMarket(market);

    const transactions = loadTransactions();
    transactions.push({ id: 'dwt_'+crypto.randomBytes(8).toString('hex'), itemId: item.id, buyerId: uid, sellerId: item.sellerId, price: item.price, status: 'completed', createdAt: Date.now() });
    saveTransactions(transactions);

    const chats = loadChats();
    const chatId = 'chat_' + crypto.randomBytes(6).toString('hex');
    chats.push({
      id: chatId, type: 'dm', participants: [uid, item.sellerId],
      createdAt: Date.now(), updatedAt: Date.now(),
      messages: [{ id: 'msg_'+crypto.randomBytes(4).toString('hex'), senderId: item.sellerId, senderUsername: item.sellerUsername, text: 'Danke für deinen Einkauf! ' + item.title + ' — Preis: ' + item.price + ' PC Coins. Hier können wir alles Weitere besprechen.', createdAt: Date.now() }]
    });
    saveChats(chats);

    res.json({ ok: true, chatId });

    try {
      const WEBAPP = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://'+process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/,'');
      client.users.fetch(item.sellerId).then(u => {
        u.send('**Neuer Artikel im Darkweb verkauft!**\n**' + item.title + '**\nPreis: ' + item.price + ' PC Coins\nKäufer: ' + getOrCreateUser(uid).username + '\n' + WEBAPP + '/darknet/chats?dc=' + (req.query.dc||req.body?.dc||''));
      }).catch(()=>{});
    } catch {}
  });

  app.delete('/api/darknet/market/:id', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const market = loadMarket();
    const idx = market.findIndex(m => m.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Nicht gefunden' });
    if (market[idx].sellerId !== uid) return res.status(403).json({ error: 'Kein Zugriff' });
    if (market[idx].status === 'sold') return res.status(400).json({ error: 'Verkaufte Artikel können nicht gelöscht werden' });
    market.splice(idx, 1);
    saveMarket(market);
    res.json({ ok: true });
  });

  app.get('/api/darknet/chats', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chats = loadChats().filter(c => c.participants.includes(uid));
    res.json(chats.map(c => ({ id: c.id, type: c.type, participants: c.participants, updatedAt: c.updatedAt, lastMessage: c.messages[c.messages.length-1]||null })));
  });

  app.get('/api/darknet/chat/:id', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chat = loadChats().find(c => c.id === req.params.id);
    if (!chat || !chat.participants.includes(uid)) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(chat);
  });

  app.post('/api/darknet/chat', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { participants, type } = req.body || {};
    if (!participants || !Array.isArray(participants) || !participants.length) return res.status(400).json({ error: 'Fehlende Teilnehmer' });
    const chats = loadChats();
    const chatId = 'chat_' + crypto.randomBytes(6).toString('hex');
    chats.push({ id: chatId, type: type||'dm', participants: [uid, ...participants], createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
    saveChats(chats);
    res.json({ ok: true, chatId });
  });

  app.post('/api/darknet/chat/:id/message', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chats = loadChats();
    const chat = chats.find(c => c.id === req.params.id);
    if (!chat || !chat.participants.includes(uid)) return res.status(404).json({ error: 'Nicht gefunden' });
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Leere Nachricht' });
    const msg = { id: 'msg_'+crypto.randomBytes(4).toString('hex'), senderId: uid, senderUsername: getOrCreateUser(uid).username, text: text.trim(), createdAt: Date.now() };
    chat.messages.push(msg); chat.updatedAt = Date.now();
    saveChats(chats);
    res.json({ ok: true, message: msg });
  });

  app.get('/api/darknet/transactions', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    res.json(loadTransactions().filter(tx => tx.buyerId === uid || tx.sellerId === uid));
  });

  app.get('/api/darknet/status', (req, res) => {
    const market  = loadMarket();
    const chats   = loadChats();
    const users   = loadUsers();
    const active  = market.filter(m => m.status === 'active').length;
    const sold    = market.filter(m => m.status === 'sold').length;
    res.json({
      netzwerk: 'ONLINE', verschluesselung: 'AES-256-GCM', tunnel: 'TOR-EXIT-NODE #7B3F',
      latenz: Math.floor(Math.random()*30+10) + ' ms', uptime: '99.97%',
      verbindungen: Math.floor(Math.random()*300+800),
      aktiveAngebote: active, verkaufte: sold,
      aktiveChats: chats.length, nutzer: Object.keys(users).length,
      letzteAktualisierung: new Date().toLocaleString('de-DE')
    });
  });

  // ─── SHARED CSS ──────────────────────────────────────────────────────────────

  const DN_CSS = `
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=VT323&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{--grn:#00ff41;--grn2:#00cc33;--grn3:#009922;--bg:#050505;--bg2:#0a0f0a;--bg3:#0d150d;--card:#0f1a0f;--brd:#1a3a1a;--txt:#c8ffd4;--sub:#5a8a5a}
html,body{height:100%;overflow-x:hidden}
body{font-family:'Share Tech Mono',monospace;background:var(--bg);color:var(--txt);min-height:100vh;position:relative}
body::before{content:'';position:fixed;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,255,65,.015) 2px,rgba(0,255,65,.015) 4px);pointer-events:none;z-index:9999}
.matrix-rain{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;opacity:.06}
.matrix-rain canvas{display:block;width:100%;height:100%}
.dn-wrap{position:relative;z-index:1;max-width:960px;margin:0 auto;padding:12px 14px 80px}

/* ── Header ── */
.dn-hdr{position:sticky;top:0;z-index:100;background:rgba(5,5,5,.96);border-bottom:1px solid var(--brd);padding:10px 14px;backdrop-filter:blur(6px)}
.dn-hdr-inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.dn-logo{font-family:'VT323',monospace;font-size:1.5em;color:var(--grn);letter-spacing:3px;text-shadow:0 0 10px var(--grn);white-space:nowrap}
.dn-badge{background:var(--bg3);border:1px solid var(--grn3);border-radius:4px;padding:4px 10px;font-size:.75em;color:var(--grn2);animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.6}}
.dn-nav{display:flex;gap:4px;flex-wrap:wrap}
.dn-nav a{color:var(--sub);text-decoration:none;font-size:.8em;padding:6px 12px;border:1px solid transparent;border-radius:3px;transition:all .15s;font-family:'Share Tech Mono',monospace}
.dn-nav a:hover,.dn-nav a.active{color:var(--grn);border-color:var(--grn3);background:var(--bg3);text-shadow:0 0 6px var(--grn)}

/* ── Cards / Grid ── */
.dn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:16px}
.dn-card{background:var(--card);border:1px solid var(--brd);border-radius:4px;padding:18px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
.dn-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--grn),transparent);opacity:0;transition:.2s}
.dn-card:hover{border-color:var(--grn3);box-shadow:0 0 18px rgba(0,255,65,.12);transform:translateY(-1px)}
.dn-card:hover::before{opacity:1}
.dn-card .icon{font-size:1.6em;margin-bottom:10px}
.dn-card h3{font-size:.9em;color:var(--grn);letter-spacing:1px;margin-bottom:6px;text-transform:uppercase}
.dn-card p{font-size:.78em;color:var(--sub);line-height:1.6}
.dn-btn-link{display:inline-block;margin-top:10px;padding:6px 14px;border:1px solid var(--grn3);color:var(--grn2);font-size:.75em;text-decoration:none;border-radius:3px;transition:all .2s}
.dn-btn-link:hover{background:var(--grn);color:#000;box-shadow:0 0 10px var(--grn)}

/* ── Buttons ── */
.dn-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;background:var(--bg3);border:1px solid var(--grn3);color:var(--grn);font-size:.82em;font-family:'Share Tech Mono',monospace;cursor:pointer;border-radius:3px;transition:all .2s;text-decoration:none}
.dn-btn:hover{background:var(--grn);color:#000;box-shadow:0 0 12px rgba(0,255,65,.4)}
.dn-btn.red{border-color:#c0392b;color:#e74c3c}
.dn-btn.red:hover{background:#c0392b;color:#fff}

/* ── Sections ── */
.dn-section{background:var(--card);border:1px solid var(--brd);border-radius:4px;padding:18px;margin-top:14px;position:relative}
.dn-section h2{font-size:.85em;color:var(--grn);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.dn-section h2::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--grn3),transparent)}

/* ── Lists ── */
.dn-list{display:flex;flex-direction:column;gap:8px}
.dn-item{background:var(--bg2);border:1px solid var(--brd);border-radius:3px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;transition:all .15s}
.dn-item:hover{border-color:var(--grn3)}
.dn-item .meta{font-size:.75em;color:var(--sub);margin-top:4px}
.dn-item .price{color:var(--grn);font-weight:700;font-size:.95em;white-space:nowrap}

/* ── Forms ── */
.dn-form{display:flex;flex-direction:column;gap:10px}
.dn-form label{font-size:.75em;color:var(--sub);text-transform:uppercase;letter-spacing:1px}
.dn-form input,.dn-form textarea,.dn-form select{background:var(--bg);border:1px solid var(--brd);color:var(--txt);padding:9px 12px;border-radius:3px;font-size:.85em;font-family:'Share Tech Mono',monospace;outline:none;transition:border .15s;width:100%}
.dn-form input:focus,.dn-form textarea:focus,.dn-form select:focus{border-color:var(--grn);box-shadow:0 0 6px rgba(0,255,65,.2)}
.dn-form select option{background:var(--bg)}

/* ── Tabs ── */
.dn-tabs{display:flex;gap:4px;margin-bottom:14px;flex-wrap:wrap}
.dn-tab{padding:7px 14px;font-size:.78em;border:1px solid var(--brd);color:var(--sub);cursor:pointer;border-radius:3px;transition:all .15s;background:var(--bg2);font-family:'Share Tech Mono',monospace}
.dn-tab:hover,.dn-tab.active{color:var(--grn);border-color:var(--grn3);background:var(--bg3)}

/* ── Chat ── */
.dn-chat-box{display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;padding:10px;background:var(--bg);border:1px solid var(--brd);border-radius:3px;scroll-behavior:smooth}
.dn-msg{max-width:85%;font-size:.82em;line-height:1.5}
.dn-msg.me{align-self:flex-end;background:var(--bg3);border:1px solid var(--grn3);border-radius:3px 3px 0 3px;padding:8px 12px;color:var(--grn)}
.dn-msg.other{align-self:flex-start;background:var(--card);border:1px solid var(--brd);border-radius:3px 3px 3px 0;padding:8px 12px;color:var(--txt)}
.dn-msg .meta{font-size:.68em;color:var(--sub);margin-bottom:4px;display:block}
.dn-msg .typing-text::after{content:'█';animation:cursor 0.8s infinite}
@keyframes cursor{0%,100%{opacity:1}50%{opacity:0}}
.dn-chat-input{display:flex;gap:8px;margin-top:10px}
.dn-chat-input input{flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--grn);padding:10px 12px;font-family:'Share Tech Mono',monospace;font-size:.85em;outline:none;border-radius:3px}
.dn-chat-input input:focus{border-color:var(--grn);box-shadow:0 0 8px rgba(0,255,65,.2)}
.dn-chat-input input::placeholder{color:var(--sub)}

/* ── Tags ── */
.dn-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dn-tag{background:var(--bg);border:1px solid var(--brd);border-radius:3px;padding:3px 8px;font-size:.72em;color:var(--sub)}
.dn-tag.grn{border-color:var(--grn3);color:var(--grn2)}

/* ── Alerts ── */
.dn-alert{background:#1a0505;border:1px solid #c0392b;color:#e74c3c;padding:10px 14px;border-radius:3px;margin-bottom:12px;font-size:.8em}
.dn-ok{background:var(--bg3);border:1px solid var(--grn3);color:var(--grn2);padding:10px 14px;border-radius:3px;margin-bottom:12px;font-size:.8em}

/* ── Wallet badge ── */
.dn-wallet{position:fixed;bottom:14px;right:14px;z-index:200;background:var(--bg3);border:1px solid var(--grn3);border-radius:4px;padding:8px 14px;font-size:.8em;color:var(--grn);box-shadow:0 0 14px rgba(0,255,65,.2);display:flex;align-items:center;gap:6px}
.dn-dot{width:7px;height:7px;border-radius:50%;background:var(--grn);box-shadow:0 0 6px var(--grn);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

/* ── Status items ── */
.dn-stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--brd);font-size:.83em}
.dn-stat:last-child{border:none}
.dn-stat .key{color:var(--sub)}
.dn-stat .val{color:var(--grn);text-align:right}

/* ── Mobile ── */
@media(max-width:600px){
  .dn-grid{grid-template-columns:1fr}
  .dn-hdr-inner{gap:8px}
  .dn-logo{font-size:1.2em}
  .dn-nav{gap:2px}
  .dn-nav a{padding:5px 9px;font-size:.73em}
  .dn-wrap{padding:10px 10px 80px}
  .dn-chat-box{max-height:300px}
  .dn-wallet{bottom:10px;right:10px;font-size:.75em;padding:6px 10px}
  .dn-item{flex-direction:column;align-items:flex-start}
  .dn-section{padding:14px}
  .dn-card{padding:14px}
}
</style>`;

  const DN_SCRIPTS = `
<script>
const TOKEN = new URLSearchParams(location.search).get('dc') || '';
async function apiFetch(url, opts={}) {
  const sep = url.includes('?') ? '&' : '?';
  const r = await fetch(url + sep + 'dc=' + TOKEN, opts);
  if (!r.ok) { const e = await r.json().catch(()=>({error:r.statusText})); throw new Error(e.error||r.statusText); }
  return r.json();
}
function formatCoins(n) {
  return Number(n||0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
async function refreshWallet() {
  try {
    const d = await apiFetch('/api/darknet/user/me');
    const el = document.getElementById('wallet-dc');
    if (el) el.textContent = formatCoins(d.pcCoins) + ' 🪙';
  } catch {}
}
// Nav token replace
document.querySelectorAll('.dn-nav a').forEach(a => {
  a.href = a.href.replace('__TOKEN__', TOKEN);
});
// Matrix rain
(function(){
  const c = document.createElement('canvas');
  const container = document.querySelector('.matrix-rain');
  if (!container) return;
  container.appendChild(c);
  const ctx = c.getContext('2d');
  let w, h, cols, drops;
  function init() {
    w = c.width  = container.offsetWidth;
    h = c.height = container.offsetHeight;
    cols = Math.floor(w / 18);
    drops = Array(cols).fill(0);
  }
  function draw() {
    ctx.fillStyle = 'rgba(5,5,5,0.05)';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#00ff41';
    ctx.font = '14px monospace';
    const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ01';
    drops.forEach((y,i) => {
      ctx.fillText(chars[Math.floor(Math.random()*chars.length)], i*18, y*18);
      if (y*18 > h && Math.random() > 0.975) drops[i] = 0;
      else drops[i]++;
    });
  }
  init();
  window.addEventListener('resize', init);
  setInterval(draw, 60);
})();
// Typing effect for new messages
function typeText(el, text, speed=18) {
  el.textContent = '';
  let i = 0;
  el.classList.add('typing-text');
  const iv = setInterval(()=>{
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(iv); el.classList.remove('typing-text'); }
  }, speed);
}
</script>`;

  function dnHeader(active, token) {
    const tok = token || '__TOKEN__';
    return `<header class="dn-hdr">
<div class="dn-hdr-inner">
<span class="dn-logo">// DARKNET //</span>
<span class="dn-badge">● VERBUNDEN</span>
<nav class="dn-nav">
<a href="/darknet?dc=${tok}" class="${active==='home'?'active':''}">[ START ]</a>
<a href="/darknet/market?dc=${tok}" class="${active==='market'?'active':''}">[ MARKT ]</a>
<a href="/darknet/account?dc=${tok}" class="${active==='account'?'active':''}">[ KONTO ]</a>
<a href="/darknet/chats?dc=${tok}" class="${active==='chats'?'active':''}">[ CHATS ]</a>
<a href="/darknet/status?dc=${tok}" class="${active==='status'?'active':''}">[ STATUS ]</a>
</nav>
</div>
</header>`;
  }

  const DN_WALLET_BAR = `<div class="dn-wallet"><span class="dn-dot"></span><span id="wallet-dc">-- 🪙</span></div>`;

  function page(title, active, token, body) {
    return `<!DOCTYPE html>
<html lang="de"><head>
<meta charset="utf-8">
<title>${title} — DARKNET</title>
${DN_CSS}
</head><body>
${DN_SCRIPTS}
<div class="matrix-rain"></div>
${dnHeader(active, token)}
<div class="dn-wrap">
${body}
</div>
${DN_WALLET_BAR}
<script>if(TOKEN) refreshWallet();</script>
</body></html>`;
  }

  // ─── GET /darknet — Startseite ───────────────────────────────────────────────
  app.get('/darknet', (req, res) => {
    const token = req.query.dc || '';
    const uid = resolveUser(req);
    const loginError = req.query.loginerror === '1';

    // Kein Login → Login-Formular anzeigen
    if (!uid) {
      const loginBody = `
<div style="max-width:440px;margin:40px auto">
  <div class="dn-section">
    <h2>🔐 Identität verifizieren</h2>
    ${loginError ? '<div class="dn-alert" style="margin-bottom:12px">⚠ Ungültige Discord User ID — bitte prüfen.</div>' : ''}
    <p style="font-size:.8em;color:var(--sub);margin-bottom:16px;line-height:1.6">
      Gib deine Discord User ID ein um das Darknet zu betreten.<br>
      <span style="color:var(--grn3)">Einstellungen → Erweitert → Entwicklermodus an → Rechtsklick auf deinen Namen → ID kopieren</span>
    </p>
    <form method="POST" action="/darknet/login">
      <input type="hidden" name="back" value="/darknet">
      <div style="display:flex;gap:8px">
        <input name="uid" placeholder="z.B. 123456789012345678" maxlength="20"
          style="flex:1;background:var(--bg2);border:1px solid var(--brd);color:var(--txt);padding:10px 12px;border-radius:3px;font-family:inherit;font-size:.85em;outline:none">
        <button type="submit" class="dn-btn">▶ EINLOGGEN</button>
      </div>
    </form>
  </div>
</div>`;
      res.setHeader('Content-Type','text/html; charset=utf-8');
      return res.send(page('LOGIN', 'home', token, loginBody));
    }

    const body = `
<div class="dn-grid">
  <div class="dn-card" onclick="location.href='/darknet/market?dc=${token}'">
    <div class="icon">📦</div>
    <h3>Schwarzmarkt</h3>
    <p>Angebote erstellen, kaufen und handeln. Alles anonym, alles verschlüsselt.</p>
    <span class="dn-btn-link">→ Öffnen</span>
  </div>
  <div class="dn-card" onclick="location.href='/darknet/account?dc=${token}'">
    <div class="icon">🪙</div>
    <h3>PC Coin Wallet</h3>
    <p>Dein Krypto-Guthaben aus dem Discord-Server. Live-Balance, immer aktuell.</p>
    <span class="dn-btn-link">→ Öffnen</span>
  </div>
  <div class="dn-card" onclick="location.href='/darknet/chats?dc=${token}'">
    <div class="icon">💬</div>
    <h3>Verschlüsselte Chats</h3>
    <p>Direkt-Nachrichten und Gruppen. Ende-zu-Ende verschlüsselt. Keine Logs.</p>
    <span class="dn-btn-link">→ Öffnen</span>
  </div>
  <div class="dn-card" onclick="location.href='/darknet/account?dc=${token}'">
    <div class="icon">👤</div>
    <h3>Mein Konto</h3>
    <p>Alias verwalten, Käufe und Verkäufe einsehen. Dein Profil im Darknet.</p>
    <span class="dn-btn-link">→ Öffnen</span>
  </div>
  <div class="dn-card" onclick="location.href='/darknet/status?dc=${token}'">
    <div class="icon">📡</div>
    <h3>Netzwerk-Status</h3>
    <p>Live-Statistiken, Verbindungsstatus, Verschlüsselung und Netzwerk-Daten.</p>
    <span class="dn-btn-link">→ Öffnen</span>
  </div>
  <div class="dn-card">
    <div class="icon">🛡️</div>
    <h3>Sicher surfen</h3>
    <p>TOR-Exit-Node Routing. AES-256-GCM Verschlüsselung. Keine Spuren, keine Logs.</p>
    <div style="margin-top:10px;font-size:.72em;color:var(--grn3)">● AKTIV</div>
  </div>
</div>
<div style="text-align:right;margin-top:12px">
  <a href="/darknet/logout" style="font-size:.72em;color:var(--sub);text-decoration:none">[ Abmelden ]</a>
</div>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('START', 'home', token, body));
  });

  // ─── GET /darknet/status ─────────────────────────────────────────────────────
  app.get('/darknet/status', (req, res) => {
    const token = req.query.dc || '';
    const body = `
<div class="dn-section">
  <h2>📡 Netzwerk-Status</h2>
  <div id="status-list"><div style="color:var(--sub);font-size:.8em">Lade Daten...</div></div>
</div>
<div class="dn-section" style="margin-top:14px">
  <h2>📊 Markt-Statistiken</h2>
  <div id="market-stats"><div style="color:var(--sub);font-size:.8em">Lade Daten...</div></div>
</div>
<div class="dn-section" style="margin-top:14px">
  <h2>🔒 Verbindungs-Info</h2>
  <div class="dn-stat"><span class="key">Verschlüsselung</span><span class="val">AES-256-GCM</span></div>
  <div class="dn-stat"><span class="key">Protokoll</span><span class="val">TOR v3 HIDDEN SERVICE</span></div>
  <div class="dn-stat"><span class="key">Exit-Node</span><span class="val">7B3F::DE::ANONYMOUS</span></div>
  <div class="dn-stat"><span class="key">DNS-Leak-Schutz</span><span class="val">AKTIV ●</span></div>
  <div class="dn-stat"><span class="key">WebRTC-Block</span><span class="val">AKTIV ●</span></div>
  <div class="dn-stat"><span class="key">Fingerprint-Schutz</span><span class="val">AKTIV ●</span></div>
</div>
<script>
async function loadStatus() {
  try {
    const d = await apiFetch('/api/darknet/status');
    document.getElementById('status-list').innerHTML =
      '<div class="dn-stat"><span class="key">Netzwerk</span><span class="val" style="color:#00ff41">● ' + d.netzwerk + '</span></div>' +
      '<div class="dn-stat"><span class="key">Latenz</span><span class="val">' + d.latenz + '</span></div>' +
      '<div class="dn-stat"><span class="key">Uptime</span><span class="val">' + d.uptime + '</span></div>' +
      '<div class="dn-stat"><span class="key">Aktive Verbindungen</span><span class="val">' + d.verbindungen + '</span></div>' +
      '<div class="dn-stat"><span class="key">Registrierte Nutzer</span><span class="val">' + d.nutzer + '</span></div>' +
      '<div class="dn-stat"><span class="key">Letzte Aktualisierung</span><span class="val">' + d.letzteAktualisierung + '</span></div>';
    document.getElementById('market-stats').innerHTML =
      '<div class="dn-stat"><span class="key">Aktive Angebote</span><span class="val">' + d.aktiveAngebote + '</span></div>' +
      '<div class="dn-stat"><span class="key">Verkaufte Artikel</span><span class="val">' + d.verkaufte + '</span></div>' +
      '<div class="dn-stat"><span class="key">Aktive Chats</span><span class="val">' + d.aktiveChats + '</span></div>';
  } catch(e) {
    document.getElementById('status-list').innerHTML = '<div class="dn-alert">Fehler beim Laden: ' + e.message + '</div>';
  }
}
loadStatus();
setInterval(loadStatus, 5000);
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('NETZWERK-STATUS', 'status', token, body));
  });

  // ─── GET /darknet/market ─────────────────────────────────────────────────────
  app.get('/darknet/market', (req, res) => {
    const token = req.query.dc || '';
    const body = `
<div class="dn-tabs">
  <span class="dn-tab active" data-cat="all">Alle</span>
  <span class="dn-tab" data-cat="weapons">Waffen</span>
  <span class="dn-tab" data-cat="drugs">Drogen</span>
  <span class="dn-tab" data-cat="hacking">Hacking</span>
  <span class="dn-tab" data-cat="info">Informationen</span>
  <span class="dn-tab" data-cat="other">Sonstiges</span>
</div>
<div class="dn-row" style="margin-bottom:12px;gap:8px">
  <input type="text" id="search" placeholder="> suchen..." style="flex:1;background:var(--bg);border:1px solid var(--brd);color:var(--grn);padding:9px 12px;font-family:'Share Tech Mono',monospace;font-size:.82em;outline:none;border-radius:3px" oninput="render()">
  <button class="dn-btn" onclick="toggleCreate()">+ Angebot erstellen</button>
</div>
<div id="market-list" class="dn-list"></div>
<div id="create-form" class="dn-section" style="display:none;margin-top:14px">
  <h2>Neues Angebot</h2>
  <div class="dn-form">
    <div><label>Titel</label><input id="m-title" placeholder="Angebots-Titel..." maxlength="60"></div>
    <div><label>Beschreibung</label><textarea id="m-desc" placeholder="Beschreibe dein Angebot..." rows="3"></textarea></div>
    <div><label>Preis (PC Coins)</label><input id="m-price" type="number" placeholder="z.B. 500" min="1"></div>
    <div><label>Kategorie</label>
      <select id="m-cat">
        <option value="weapons">Waffen</option>
        <option value="drugs">Drogen</option>
        <option value="hacking">Hacking</option>
        <option value="info">Informationen</option>
        <option value="other">Sonstiges</option>
      </select>
    </div>
    <div><label>Kaufoption</label>
      <select id="m-type">
        <option value="direct">Direkt kaufen</option>
        <option value="meeting">Nur persönliches Treffen</option>
      </select>
    </div>
    <div class="dn-row">
      <button class="dn-btn" onclick="createItem()">✓ Erstellen</button>
      <button class="dn-btn red" onclick="toggleCreate()">✗ Abbrechen</button>
    </div>
  </div>
</div>
<script>
let allItems = [];
let curCat = 'all';
let myUserId = '';
document.querySelectorAll('.dn-tab').forEach(t => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.dn-tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    curCat = t.dataset.cat;
    render();
  });
});
function render() {
  const q = document.getElementById('search').value.toLowerCase();
  let f = allItems;
  if (curCat !== 'all') f = f.filter(i => i.category === curCat);
  if (q) f = f.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  const el = document.getElementById('market-list');
  const catNames = {weapons:'Waffen',drugs:'Drogen',hacking:'Hacking',info:'Informationen',other:'Sonstiges'};
  const typeNames = {direct:'Direkt kaufen',meeting:'Persönliches Treffen'};
  el.innerHTML = f.length ? f.map(i => {
    const isOwn = myUserId && i.sellerId === myUserId;
    const aktionen = isOwn
      ? \`<button class="dn-btn red" style="padding:5px 10px;font-size:.73em" onclick="loescheAngebot('\${i.id}')">🗑 Löschen</button>\`
      : \`<button class="dn-btn" style="padding:5px 10px;font-size:.73em" onclick="kaufen('\${i.id}',\${i.price})">Kaufen</button>
         <button class="dn-btn" style="padding:5px 10px;font-size:.73em;border-color:var(--sub);color:var(--sub)" onclick="preisvorschlag('\${i.id}')">Angebot</button>\`;
    return \`
    <div class="dn-item" style="flex-wrap:wrap\${isOwn?' border-color:var(--grn3)':''}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;color:var(--grn);font-size:.88em;margin-bottom:4px">\${i.title}\${isOwn?' <span style="font-size:.7em;color:var(--sub)">[dein Angebot]</span>':''}</div>
        <div class="meta">\${i.description.slice(0,90)}\${i.description.length>90?'...':''}</div>
        <div class="dn-row" style="margin-top:6px;gap:4px">
          <span class="dn-tag">\${catNames[i.category]||i.category}</span>
          <span class="dn-tag">\${typeNames[i.purchaseType]||i.purchaseType}</span>
          <span class="dn-tag">von: \${i.sellerUsername}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;margin-top:4px">
        <div class="price">\${Number(i.price).toLocaleString('de-DE')} 🪙</div>
        <div class="dn-row" style="gap:4px">\${aktionen}</div>
      </div>
    </div>\`;
  }).join('') : '<div style="text-align:center;color:var(--sub);padding:40px;font-size:.85em">> Keine Angebote gefunden.</div>';
}
async function load() {
  try {
    allItems = await apiFetch('/api/darknet/market');
    try { const u = await apiFetch('/api/darknet/user/me'); myUserId = u.discordUserId; } catch {}
    render();
  } catch(e) {
    document.getElementById('market-list').innerHTML =
      '<div class="dn-alert">⚠ Markt konnte nicht geladen werden: ' + e.message + '<br><br>Bitte klicke erneut auf den DARKNET-Button in Discord.</div>';
  }
}
function toggleCreate() {
  const f = document.getElementById('create-form');
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
}
function requireToken() {
  if (!TOKEN) { alert('Du musst dich zuerst einloggen — nutze den Discord-Button um das Darknet zu betreten.'); return false; }
  return true;
}
async function createItem() {
  if (!requireToken()) return;
  const title = document.getElementById('m-title').value.trim();
  const description = document.getElementById('m-desc').value.trim();
  const price = parseInt(document.getElementById('m-price').value);
  const category = document.getElementById('m-cat').value;
  const purchaseType = document.getElementById('m-type').value;
  if (!title||!description||!price) return alert('Bitte alle Felder ausfüllen.');
  try {
    await apiFetch('/api/darknet/market', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({dc:TOKEN,title,description,price,category,purchaseType}) });
    document.getElementById('create-form').style.display = 'none';
    document.getElementById('m-title').value=''; document.getElementById('m-desc').value=''; document.getElementById('m-price').value='';
    load();
  } catch(e) { alert('Fehler: ' + e.message); }
}
async function kaufen(id, preis) {
  if (!requireToken()) return;
  if (!confirm('Artikel für ' + Number(preis).toLocaleString('de-DE') + ' PC Coins kaufen?')) return;
  try {
    const r = await apiFetch('/api/darknet/market/'+id+'/buy', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dc:TOKEN}) });
    alert('Gekauft! Chat wurde geöffnet.');
    location.href = '/darknet/chat/' + r.chatId + '?dc=' + TOKEN;
  } catch(e) { alert('Fehler: ' + e.message); }
}
async function preisvorschlag(id) {
  if (!requireToken()) return;
  const p = prompt('Dein Preisvorschlag in PC Coins:');
  if (!p || isNaN(p)) return;
  try {
    await apiFetch('/api/darknet/market/'+id+'/offer', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dc:TOKEN,price:parseInt(p)}) });
    alert('Preisvorschlag gesendet!');
  } catch(e) { alert('Fehler: ' + e.message); }
}
async function loescheAngebot(id) {
  if (!confirm('Angebot wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
  try {
    await apiFetch('/api/darknet/market/'+id, { method:'DELETE' });
    alert('Angebot gelöscht.');
    load();
  } catch(e) { alert('Fehler: ' + e.message); }
}
// Markt IMMER laden — alle sollen Angebote sehen
load();
// Auto-Refresh alle 15 Sekunden, damit neue Angebote sofort erscheinen
setInterval(load, 15000);
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('SCHWARZMARKT', 'market', token, body));
  });

  // ─── GET /darknet/account ────────────────────────────────────────────────────
  app.get('/darknet/account', (req, res) => {
    const token = req.query.dc || '';
    const body = `
<div class="dn-section">
  <h2>👤 Profil</h2>
  <div class="dn-form">
    <div><label>Darknet-Alias</label>
    <div class="dn-row"><input id="username" placeholder="Alias eingeben..." maxlength="20" style="flex:1">
    <button class="dn-btn" onclick="saveUsername()">✓ Speichern</button></div></div>
  </div>
  <div id="profile-info" style="margin-top:14px"></div>
</div>
<div class="dn-section">
  <h2>🪙 PC Coin Wallet</h2>
  <div class="dn-stat"><span class="key">Aktuelles Guthaben</span><span class="val" id="acc-coins" style="font-size:1.1em">Lade...</span></div>
</div>
<div class="dn-section">
  <h2>📦 Meine Angebote</h2>
  <div id="my-listings" class="dn-list"></div>
</div>
<div class="dn-section">
  <h2>✅ Meine Verkäufe</h2>
  <div id="my-sales" class="dn-list"></div>
</div>
<div class="dn-section">
  <h2>🛒 Meine Einkäufe</h2>
  <div id="my-buys" class="dn-list"></div>
</div>
<script>
function zeigeSessionFehler(bereich) {
  const el = document.querySelector(bereich);
  if (el) el.innerHTML = '<div class="dn-alert" style="margin-top:20px">⚠ Sitzung abgelaufen oder ungültig.<br><br><strong>Bitte klicke erneut auf den DARKNET-Button in Discord</strong>, um eine neue Sitzung zu starten.</div>';
}
async function loadAccount() {
  try {
    const user = await apiFetch('/api/darknet/user/me');
    document.getElementById('username').value = user.username||'';
    document.getElementById('acc-coins').textContent = formatCoins(user.pcCoins) + ' 🪙';
    document.getElementById('profile-info').innerHTML =
      '<div class="dn-stat"><span class="key">Alias-ID</span><span class="val">' + user.discordUserId.slice(0,4) + '***' + user.discordUserId.slice(-4) + '</span></div>' +
      '<div class="dn-stat"><span class="key">Mitglied seit</span><span class="val">' + new Date(user.createdAt).toLocaleDateString('de-DE') + '</span></div>';
    try {
      const market = await apiFetch('/api/darknet/market');
      const listings = market.filter(i => i.sellerId === user.discordUserId);
      document.getElementById('my-listings').innerHTML = listings.length
        ? listings.map(i => '<div class="dn-item" style="flex-wrap:wrap"><div style="flex:1;min-width:0"><div style="color:var(--grn);font-size:.85em">' + i.title + '</div><div class="meta">' + Number(i.price).toLocaleString('de-DE') + ' 🪙 · ' + (i.status==='active'?'● Aktiv':'● Verkauft') + '</div></div>' +
          (i.status==='active' ? '<button class="dn-btn red" style="padding:4px 10px;font-size:.72em;margin-top:4px" onclick="loescheAngebot(\''+i.id+'\')">🗑 Löschen</button>' : '') + '</div>').join('')
        : '<div style="color:var(--sub);font-size:.8em">Keine aktiven Angebote.</div>';
      const sold = listings.filter(i=>i.status==='sold');
      document.getElementById('my-sales').innerHTML = sold.length
        ? sold.map(i => '<div class="dn-item"><div><div style="color:var(--grn);font-size:.85em">' + i.title + '</div><div class="meta">Verkauft für ' + Number(i.price).toLocaleString('de-DE') + ' 🪙 an ' + (i.buyerUsername||'---') + '</div></div></div>').join('')
        : '<div style="color:var(--sub);font-size:.8em">Noch keine Verkäufe.</div>';
      const bought = market.filter(i => i.buyerId === user.discordUserId);
      document.getElementById('my-buys').innerHTML = bought.length
        ? bought.map(i => '<div class="dn-item"><div><div style="color:var(--grn);font-size:.85em">' + i.title + '</div><div class="meta">Gekauft für ' + Number(i.price).toLocaleString('de-DE') + ' 🪙 von ' + (i.sellerUsername||'---') + '</div></div></div>').join('')
        : '<div style="color:var(--sub);font-size:.8em">Noch keine Einkäufe.</div>';
    } catch(e) {
      ['my-listings','my-sales','my-buys'].forEach(id => {
        document.getElementById(id).innerHTML = '<div style="color:var(--sub);font-size:.8em">Fehler: ' + e.message + '</div>';
      });
    }
  } catch(e) {
    zeigeSessionFehler('.dn-wrap');
  }
}
async function saveUsername() {
  if (!TOKEN) return zeigeSessionFehler('.dn-wrap');
  const username = document.getElementById('username').value.trim();
  if (!username || username.length < 3) return alert('Alias muss mindestens 3 Zeichen haben.');
  try {
    await apiFetch('/api/darknet/user/username', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dc:TOKEN,username}) });
    alert('Alias gespeichert: ' + username);
    loadAccount();
  } catch(e) { alert('Fehler: ' + e.message); }
}
async function loescheAngebot(id) {
  if (!confirm('Angebot wirklich löschen? Dies kann nicht rückgängig gemacht werden.')) return;
  try {
    await apiFetch('/api/darknet/market/'+id, { method:'DELETE' });
    alert('Angebot gelöscht.');
    loadAccount();
  } catch(e) { alert('Fehler: ' + e.message); }
}
if(TOKEN) loadAccount(); else zeigeSessionFehler('.dn-wrap');
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('KONTO', 'account', token, body));
  });

  // ─── GET /darknet/chats ──────────────────────────────────────────────────────
  app.get('/darknet/chats', (req, res) => {
    const token = req.query.dc || '';
    const body = `
<div class="dn-row" style="margin-bottom:12px">
  <button class="dn-btn" onclick="toggleNew()">+ Neue Konversation</button>
</div>
<div id="new-chat" class="dn-section" style="display:none;margin-bottom:14px">
  <h2>Neue Konversation</h2>
  <div class="dn-form">
    <div><label>Typ</label>
      <select id="c-type"><option value="dm">Einzelperson</option><option value="group">Gruppe</option></select>
    </div>
    <div><label>Nutzername(n) — kommagetrennt</label>
      <input id="c-users" placeholder="Alias1, Alias2...">
    </div>
    <div class="dn-row">
      <button class="dn-btn" onclick="startChat()">▶ Starten</button>
      <button class="dn-btn red" onclick="toggleNew()">✗ Abbrechen</button>
    </div>
  </div>
</div>
<div id="chat-list" class="dn-list"></div>
<script>
async function loadChats() {
  const chats = await apiFetch('/api/darknet/chats');
  const el = document.getElementById('chat-list');
  el.innerHTML = chats.length ? chats.map(c => {
    const last = c.lastMessage;
    const when = new Date(c.updatedAt).toLocaleString('de-DE',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'});
    return '<a href="/darknet/chat/'+c.id+'?dc='+TOKEN+'" style="text-decoration:none"><div class="dn-item"><div style="flex:1;min-width:0"><div style="color:var(--grn);font-size:.85em;margin-bottom:3px">' +
      (c.type==='group'?'👥 GRUPPE':'👤 DM') + ' · ' + c.participants.length + ' Teilnehmer</div>' +
      '<div class="meta">' + (last ? (last.senderUsername + ': ' + last.text.slice(0,50)) : '> Keine Nachrichten') + '</div></div>' +
      '<div style="font-size:.72em;color:var(--sub);white-space:nowrap">'+when+'</div></div></a>';
  }).join('') : '<div style="text-align:center;color:var(--sub);padding:40px;font-size:.85em">> Noch keine Chats.</div>';
}
function toggleNew() {
  const el = document.getElementById('new-chat');
  el.style.display = el.style.display==='none' ? 'block' : 'none';
}
async function startChat() {
  const type = document.getElementById('c-type').value;
  const rawNames = document.getElementById('c-users').value.split(',').map(s=>s.trim()).filter(Boolean);
  if (!rawNames.length) return alert('Bitte mindestens einen Nutzernamen eingeben.');
  const users = await apiFetch('/api/darknet/user/me');
  const market = await apiFetch('/api/darknet/market');
  const usersMap = {};
  market.forEach(i => { usersMap[i.sellerUsername] = i.sellerId; });
  const participants = rawNames.map(n => usersMap[n]).filter(Boolean);
  if (!participants.length) return alert('Kein Nutzer mit diesem Alias gefunden. Tipp: Der Nutzer muss mindestens ein Angebot erstellt haben.');
  const r = await apiFetch('/api/darknet/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dc:TOKEN,participants,type}) });
  location.href = '/darknet/chat/'+r.chatId+'?dc='+TOKEN;
}
if(TOKEN) loadChats(); else document.getElementById('chat-list').innerHTML='<div class="dn-alert">Anmeldung erforderlich — nutze den Discord-Button.</div>';
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('CHATS', 'chats', token, body));
  });

  // ─── GET /darknet/chat/:id ───────────────────────────────────────────────────
  app.get('/darknet/chat/:id', (req, res) => {
    const token  = req.query.dc || '';
    const chatId = req.params.id;
    const body = `
<div id="chat-header" style="margin-bottom:12px"></div>
<div id="chat-msgs" class="dn-chat-box"></div>
<div class="dn-chat-input">
  <input id="msg-in" placeholder="> Nachricht eingeben..." autocomplete="off" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMsg();}">
  <button class="dn-btn" onclick="sendMsg()">▶</button>
</div>
<script>
const CHAT_ID = '${chatId}';
let myId = '';
let lastCount = 0;
async function loadChat(initial) {
  const [chat, user] = await Promise.all([apiFetch('/api/darknet/chat/'+CHAT_ID), apiFetch('/api/darknet/user/me')]);
  myId = user.discordUserId;
  if (initial) {
    document.getElementById('chat-header').innerHTML =
      '<div class="dn-row"><span class="dn-tag grn">' + (chat.type==='group'?'GRUPPE':'DM') + '</span><span class="dn-tag">' + chat.participants.length + ' Teilnehmer</span><span class="dn-tag">ID: ' + CHAT_ID.slice(-8) + '</span></div>';
  }
  const box = document.getElementById('chat-msgs');
  if (chat.messages.length === lastCount && !initial) return;
  const newMsgs = chat.messages.slice(lastCount);
  lastCount = chat.messages.length;
  newMsgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'dn-msg ' + (m.senderId===myId?'me':'other');
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = m.senderUsername + ' · ' + new Date(m.createdAt).toLocaleString('de-DE',{hour:'2-digit',minute:'2-digit'});
    const txt = document.createElement('span');
    if (!initial && m.senderId!==myId) {
      typeText(txt, m.text, 16);
    } else {
      txt.textContent = m.text;
    }
    div.appendChild(meta);
    div.appendChild(txt);
    box.appendChild(div);
  });
  if (newMsgs.length || initial) box.scrollTop = box.scrollHeight;
}
async function sendMsg() {
  const input = document.getElementById('msg-in');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  await apiFetch('/api/darknet/chat/'+CHAT_ID+'/message', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({dc:TOKEN,text}) });
  loadChat(false);
}
if(TOKEN) { loadChat(true); setInterval(()=>loadChat(false), 2500); }
else document.querySelector('.dn-wrap').innerHTML='<div class="dn-alert">Anmeldung erforderlich.</div>';
</script>`;
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(page('CHAT', 'chats', token, body));
  });

};
