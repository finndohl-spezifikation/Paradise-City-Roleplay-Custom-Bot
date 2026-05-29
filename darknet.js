/**
 * Darknet System v2
 * Schwarzmarkt, Chat, Konto, PC Coin Integration
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function initDarknet(app, DATA_DIR, client, darknetTokens) {

  const DARKNET_DIR = path.join(DATA_DIR, 'darknet');
  if (!fs.existsSync(DARKNET_DIR)) fs.mkdirSync(DARKNET_DIR, { recursive: true });

  const USERS_FILE = path.join(DARKNET_DIR, 'users.json');
  const MARKET_FILE = path.join(DARKNET_DIR, 'market.json');
  const CHATS_FILE = path.join(DARKNET_DIR, 'chats.json');
  const TRANSACTIONS_FILE = path.join(DARKNET_DIR, 'transactions.json');

  function loadUsers()     { try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; } }
  function saveUsers(d)     { fs.writeFileSync(USERS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  function loadMarket()     { try { return JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8')); } catch { return []; } }
  function saveMarket(d)   { fs.writeFileSync(MARKET_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  function loadChats()      { try { return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf8')); } catch { return []; } }
  function saveChats(d)     { fs.writeFileSync(CHATS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  function loadTransactions() { try { return JSON.parse(fs.readFileSync(TRANSACTIONS_FILE, 'utf8')); } catch { return []; } }
  function saveTransactions(d) { fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(d, null, 2), 'utf8'); }

  // Konto helpers (aus konto.json)
  function getKonto(uid) {
    const kf = path.join(DATA_DIR, 'konto.json');
    let d = {}; try { d = JSON.parse(fs.readFileSync(kf, 'utf8')); } catch {}
    return d[uid] || { konto: 0, schwarz: 0 };
  }
  function setKonto(uid, obj) {
    const kf = path.join(DATA_DIR, 'konto.json');
    let d = {}; try { d = JSON.parse(fs.readFileSync(kf, 'utf8')); } catch {}
    d[uid] = obj; fs.writeFileSync(kf, JSON.stringify(d, null, 2), 'utf8');
  }

  // Krypto helpers (PC Coin)
  function getKrypto(uid) {
    const kf = path.join(DATA_DIR, 'krypto.json');
    let d = {}; try { d = JSON.parse(fs.readFileSync(kf, 'utf8')); } catch {}
    return d[uid] || { dc: 0 };
  }
  function setKrypto(uid, obj) {
    const kf = path.join(DATA_DIR, 'krypto.json');
    let d = {}; try { d = JSON.parse(fs.readFileSync(kf, 'utf8')); } catch {}
    d[uid] = obj; fs.writeFileSync(kf, JSON.stringify(d, null, 2), 'utf8');
  }

  const adminSecret = process.env.DARKNET_ADMIN_SECRET || 'darknet_admin_2025';

  function resolveUser(req) {
    const token = req.query.dc || req.body?.dc;
    if (!token) return null;
    const entry = darknetTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) return null;
    return entry.discordUserId;
  }

  function getOrCreateUser(uid) {
    const users = loadUsers();
    if (!users[uid]) {
      users[uid] = { username: 'Alias_' + uid.slice(-6), createdAt: Date.now() };
      saveUsers(users);
    }
    return users[uid];
  }

  // ─── API ROUTES ─────────────────────────────────────────────────────────────

  // GET /api/darknet/user/me
  app.get('/api/darknet/user/me', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const user = getOrCreateUser(uid);
    const wallet = getKrypto(uid);
    res.json({ ...user, discordUserId: uid, pcCoins: wallet.dc || 0 });
  });

  // POST /api/darknet/user/username
  app.post('/api/darknet/user/username', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { username } = req.body || {};
    if (!username || username.length < 3 || username.length > 20) return res.status(400).json({ error: 'Invalid username' });
    const users = loadUsers();
    const taken = Object.values(users).some(u => u.username === username && u.discordUserId !== uid);
    if (taken) return res.status(409).json({ error: 'Username taken' });
    users[uid] = { ...(users[uid] || {}), username, updatedAt: Date.now() };
    saveUsers(users);
    res.json({ ok: true, username });
  });

  // GET /api/darknet/market
  app.get('/api/darknet/market', (req, res) => {
    const market = loadMarket();
    const category = req.query.category;
    const search = req.query.search;
    let items = market.filter(m => m.status === 'active');
    if (category) items = items.filter(m => m.category === category);
    if (search) items = items.filter(m => m.title.toLowerCase().includes(search.toLowerCase()) || m.description.toLowerCase().includes(search.toLowerCase()));
    res.json(items);
  });

  // POST /api/darknet/market
  app.post('/api/darknet/market', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { title, description, price, category, purchaseType } = req.body || {};
    if (!title || !description || !price || !category || !purchaseType) return res.status(400).json({ error: 'Missing fields' });
    const market = loadMarket();
    const item = {
      id: 'dwm_' + crypto.randomBytes(8).toString('hex'),
      sellerId: uid,
      sellerUsername: getOrCreateUser(uid).username,
      title, description, price: parseInt(price), category, purchaseType,
      status: 'active', createdAt: Date.now(), offers: [], messages: []
    };
    market.push(item);
    saveMarket(market);
    res.json({ ok: true, item });
  });

  // POST /api/darknet/market/:id/offer
  app.post('/api/darknet/market/:id/offer', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const market = loadMarket();
    const item = market.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { price } = req.body || {};
    if (!price || price <= 0) return res.status(400).json({ error: 'Invalid offer' });
    item.offers = item.offers || [];
    item.offers.push({ buyerId: uid, buyerUsername: getOrCreateUser(uid).username, price: parseInt(price), status: 'pending', createdAt: Date.now() });
    saveMarket(market);
    res.json({ ok: true });
  });

  // POST /api/darknet/market/:id/buy
  app.post('/api/darknet/market/:id/buy', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const market = loadMarket();
    const item = market.find(m => m.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.sellerId === uid) return res.status(400).json({ error: 'Cannot buy own item' });
    const buyerWallet = getKrypto(uid);
    const sellerWallet = getKrypto(item.sellerId);
    if (buyerWallet.dc < item.price) return res.status(400).json({ error: 'Not enough PC Coins' });

    buyerWallet.dc -= item.price;
    sellerWallet.dc += item.price;
    setKrypto(uid, buyerWallet);
    setKrypto(item.sellerId, sellerWallet);

    item.status = 'sold';
    item.buyerId = uid;
    item.buyerUsername = getOrCreateUser(uid).username;
    item.soldAt = Date.now();
    saveMarket(market);

    const transactions = loadTransactions();
    transactions.push({
      id: 'dwt_' + crypto.randomBytes(8).toString('hex'),
      itemId: item.id, buyerId: uid, sellerId: item.sellerId,
      price: item.price, status: 'completed', createdAt: Date.now()
    });
    saveTransactions(transactions);

    // Create auto-message in chat
    const chats = loadChats();
    const chatId = 'chat_' + crypto.randomBytes(6).toString('hex');
    chats.push({
      id: chatId, type: 'dm', participants: [uid, item.sellerId],
      createdAt: Date.now(), updatedAt: Date.now(),
      messages: [{
        id: 'msg_' + crypto.randomBytes(4).toString('hex'),
        senderId: item.sellerId, senderUsername: item.sellerUsername,
        text: 'Danke fuer deinen Einkauf! ' + item.title + ' — Preis: ' + item.price + ' PC Coins. Hier koennen wir alles weitere besprechen.',
        createdAt: Date.now()
      }]
    });
    saveChats(chats);

    res.json({ ok: true, chatId, transactionId: transactions[transactions.length - 1].id });

    // Send DM to seller
    try {
      client.users.fetch(item.sellerId).then(u => {
        u.send(`Neuer Artikel im Darkweb verkauft!
**${item.title}**
Preis: ${item.price} PC Coins
Kaeufer: ${getOrCreateUser(uid).username}
[Zum Verkauf](https://${process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost'}/darknet/chat/${chatId}?dc=${req.query.dc || req.body.dc || ''})`);
      }).catch(() => {});
    } catch {}
  });

  // GET /api/darknet/chats
  app.get('/api/darknet/chats', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chats = loadChats().filter(c => c.participants.includes(uid));
    res.json(chats.map(c => ({
      id: c.id, type: c.type, participants: c.participants,
      updatedAt: c.updatedAt, lastMessage: c.messages[c.messages.length - 1] || null
    })));
  });

  // GET /api/darknet/chat/:id
  app.get('/api/darknet/chat/:id', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chats = loadChats();
    const chat = chats.find(c => c.id === req.params.id);
    if (!chat || !chat.participants.includes(uid)) return res.status(404).json({ error: 'Not found' });
    res.json(chat);
  });

  // POST /api/darknet/chat
  app.post('/api/darknet/chat', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { participants, type } = req.body || {};
    if (!participants || !Array.isArray(participants) || participants.length === 0) return res.status(400).json({ error: 'Missing participants' });
    const all = [uid, ...participants];
    const chats = loadChats();
    const chatId = 'chat_' + crypto.randomBytes(6).toString('hex');
    chats.push({ id: chatId, type: type || 'dm', participants: all, createdAt: Date.now(), updatedAt: Date.now(), messages: [] });
    saveChats(chats);
    res.json({ ok: true, chatId });
  });

  // POST /api/darknet/chat/:id/message
  app.post('/api/darknet/chat/:id/message', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const chats = loadChats();
    const chat = chats.find(c => c.id === req.params.id);
    if (!chat || !chat.participants.includes(uid)) return res.status(404).json({ error: 'Not found' });
    const { text } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Empty message' });
    const msg = {
      id: 'msg_' + crypto.randomBytes(4).toString('hex'),
      senderId: uid, senderUsername: getOrCreateUser(uid).username,
      text: text.trim(), createdAt: Date.now()
    };
    chat.messages.push(msg);
    chat.updatedAt = Date.now();
    saveChats(chats);
    res.json({ ok: true, message: msg });
  });

  // GET /api/darknet/transactions
  app.get('/api/darknet/transactions', (req, res) => {
    const uid = resolveUser(req);
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const t = loadTransactions().filter(tx => tx.buyerId === uid || tx.sellerId === uid);
    res.json(t);
  });

  // GET /api/darknet/wallet/:uid
  app.get('/api/darknet/wallet/:uid', (req, res) => {
    const secret = req.headers['x-darknet-secret'] || req.query.secret;
    if (secret !== adminSecret) return res.status(403).json({ error: 'Forbidden' });
    const wallet = getKrypto(req.params.uid);
    res.json({ discordUserId: req.params.uid, dc: wallet.dc || 0 });
  });

  // POST /api/darknet/wallet/:uid/deduct
  app.post('/api/darknet/wallet/:uid/deduct', (req, res) => {
    const secret = req.headers['x-darknet-secret'] || req.query.secret;
    if (secret !== adminSecret) return res.status(403).json({ error: 'Forbidden' });
    const amount = parseInt(req.body?.amount, 10);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const w = getKrypto(req.params.uid);
    if (w.dc < amount) return res.status(400).json({ error: 'Not enough', dc: w.dc });
    w.dc -= amount; setKrypto(req.params.uid, w);
    res.json({ ok: true, dc: w.dc });
  });

  // POST /api/darknet/wallet/:uid/credit
  app.post('/api/darknet/wallet/:uid/credit', (req, res) => {
    const secret = req.headers['x-darknet-secret'] || req.query.secret;
    if (secret !== adminSecret) return res.status(403).json({ error: 'Forbidden' });
    const amount = parseInt(req.body?.amount, 10);
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const w = getKrypto(req.params.uid);
    w.dc += amount; setKrypto(req.params.uid, w);
    res.json({ ok: true, dc: w.dc });
  });

  // ─── HTML PAGES ─────────────────────────────────────────────────────────────

  const DARKNET_CSS = `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;background:#0a0a0a;color:#e0e0e0;min-height:100vh}
.dn-wrap{max-width:1100px;margin:0 auto;padding:16px}
.dn-header{background:#0d1117;border-bottom:1px solid #21262d;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;position:sticky;top:0;z-index:100}
.dn-header h1{font-size:1.1em;font-weight:700;color:#00ff41;letter-spacing:2px;font-family:'Courier New',monospace}
.dn-header .badge{background:#0d1f0d;border:1px solid #00ff4144;border-radius:8px;padding:6px 12px;font-size:.8em;color:#00ff41;font-weight:600}
.dn-nav{display:flex;gap:8px;flex-wrap:wrap}
.dn-nav a{color:#8b949e;text-decoration:none;font-size:.85em;padding:8px 14px;border-radius:6px;transition:all .2s;border:1px solid transparent}
.dn-nav a:hover,.dn-nav a.active{color:#00ff41;background:#0d1f0d;border-color:#00ff4133}
.dn-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:20px}
.dn-card{background:#161b22;border:1px solid #21262d;border-radius:12px;padding:20px;transition:all .2s;position:relative;overflow:hidden}
.dn-card:hover{border-color:#00ff4155;box-shadow:0 0 20px rgba(0,255,65,.08)}
.dn-card .icon{font-size:2em;margin-bottom:12px}
.dn-card h3{font-size:1em;margin-bottom:8px;color:#e0e0e0}
.dn-card p{font-size:.85em;color:#8b949e;line-height:1.5}
.dn-btn{display:inline-block;padding:10px 20px;background:#0d1f0d;border:1px solid #00ff41;color:#00ff41;border-radius:8px;font-size:.85em;font-weight:600;text-decoration:none;cursor:pointer;transition:all .2s;margin-top:12px}
.dn-btn:hover{background:#00ff41;color:#000}
.dn-btn:disabled{opacity:.5;cursor:not-allowed}
.dn-section{background:#161b22;border:1px solid #21262d;border-radius:12px;padding:20px;margin-top:16px}
.dn-section h2{font-size:1em;color:#00ff41;margin-bottom:16px;letter-spacing:1px;font-family:'Courier New',monospace}
.dn-list{display:flex;flex-direction:column;gap:10px}
.dn-item{background:#0d1117;border:1px solid #21262d;border-radius:8px;padding:14px;display:flex;justify-content:space-between;align-items:center;gap:12px;transition:all .2s}
.dn-item:hover{border-color:#00ff4133}
.dn-item .meta{font-size:.85em;color:#8b949e}
.dn-item .price{font-size:1em;color:#00ff41;font-weight:700}
.dn-form{display:flex;flex-direction:column;gap:12px}
.dn-form input,.dn-form textarea,.dn-form select{background:#0d1117;border:1px solid #30363d;color:#e0e0e0;padding:10px 12px;border-radius:8px;font-size:.9em;font-family:inherit;outline:none;transition:all .2s}
.dn-form input:focus,.dn-form textarea:focus,.dn-form select:focus{border-color:#00ff41}
.dn-form label{font-size:.85em;color:#8b949e;margin-bottom:4px}
.dn-chat{display:flex;flex-direction:column;gap:10px;max-height:500px;overflow-y:auto;padding:10px;background:#0d1117;border-radius:8px}
.dn-msg{padding:10px 14px;border-radius:8px;max-width:80%;font-size:.85em}
.dn-msg.me{background:#0d1f0d;border:1px solid #00ff4133;color:#00ff41;margin-left:auto}
.dn-msg.other{background:#161b22;border:1px solid #21262d;color:#e0e0e0;margin-right:auto}
.dn-msg .meta{font-size:.7em;color:#6b7280;margin-bottom:4px}
.dn-status{display:inline-block;width:8px;height:8px;border-radius:50%;background:#00ff41;box-shadow:0 0 8px #00ff41;margin-right:6px}
.dn-wallet{background:#0d1f0d;border:1px solid #00ff4144;border-radius:8px;padding:10px 16px;font-size:.9em;color:#00ff41;font-weight:700;position:fixed;bottom:16px;right:16px;z-index:200}
.dn-alert{background:#1a0a0a;border:1px solid #f85149;color:#f85149;padding:12px;border-radius:6px;margin-bottom:12px;font-size:.85em}
.dn-success{background:#0d1f0d;border:1px solid #00ff41;color:#00ff41;padding:12px;border-radius:6px;margin-bottom:12px;font-size:.85em}
.dn-tabs{display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid #21262d;padding-bottom:8px}
.dn-tab{color:#8b949e;text-decoration:none;padding:8px 16px;font-size:.85em;border-radius:6px;cursor:pointer;transition:all .2s}
.dn-tab:hover,.dn-tab.active{color:#00ff41;background:#0d1f0d}
.dn-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.dn-tag{background:#0d1117;border:1px solid #30363d;border-radius:4px;padding:4px 8px;font-size:.75em;color:#8b949e}
.dn-tag.active{background:#0d1f0d;border-color:#00ff4144;color:#00ff41}
@media(max-width:768px){.dn-grid{grid-template-columns:1fr}.dn-header{flex-direction:column;align-items:flex-start}}
</style>`;

  const DARKNET_JS = `<script>
const API = '/api/darknet';
const TOKEN = new URLSearchParams(location.search).get('dc');
function auth() { return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN }) }; }
async function fetchJSON(url, opts={}) {
  const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'dc=' + TOKEN, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function loadWallet() {
  try { const d = await fetchJSON('/api/darknet/user/me'); document.getElementById('wallet-dc').textContent = (d.pcCoins || 0).toFixed(4) + ' PC'; } catch {}
}
</script>`;

  const DARKNET_HEADER = (active, title) => `<div class="dn-header"><div class="dn-row"><h1>// DARKNET //</h1><span class="badge">${title || 'ANONYMES NETZWERK'}</span></div><nav class="dn-nav"><a href="/darknet?dc=TOKEN" class="${active === 'home' ? 'active' : ''}">Start</a><a href="/darknet/market?dc=TOKEN" class="${active === 'market' ? 'active' : ''}">Schwarzmarkt</a><a href="/darknet/account?dc=TOKEN" class="${active === 'account' ? 'active' : ''}">Konto</a><a href="/darknet/chats?dc=TOKEN" class="${active === 'chats' ? 'active' : ''}">Chats</a></nav></div>`;

  const DARKNET_WALLET = `<div class="dn-wallet" id="wallet-bar"><span class="dn-status"></span><span id="wallet-dc">--</span></div><script>if(TOKEN) loadWallet();</script>`;

  // GET /darknet — Home
  app.get('/darknet', (req, res) => {
    const token = req.query.dc;
    let uid = null;
    if (token && darknetTokens.has(token)) {
      const e = darknetTokens.get(token);
      if (e.expiresAt > Date.now()) uid = e.discordUserId;
    }
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>// DARKNET //</title>${DARKNET_CSS}</head><body>
${DARKNET_HEADER('home', uid ? 'VERBUNDEN' : 'ANONYM')}
<div class="dn-wrap">
${uid ? '' : '<div class="dn-alert">Anonymer Zugang. Einige Funktionen sind eingeschraenkt. Nutze den Discord-Button fuer vollen Zugriff.</div>'}
<div class="dn-grid">
<div class="dn-card"><div class="icon">🔒</div><h3>Sicher surfen</h3><p>Ende-zu-Ende Verschluesselung. Deine Identitaet bleibt verborgen.</p><a href="/darknet/market?dc=${token || ''}" class="dn-btn">Entdecken</a></div>
<div class="dn-card"><div class="icon">🛡️</div><h3>Verschluesselte IP</h3><p>Tor-Exit-Node Routing. Keine Spuren, keine Logs.</p></div>
<div class="dn-card"><div class="icon">🪙</div><h3>PC Coin Wallet</h3><p>Verwalte deine Krypto-Waehrung. Kaufe, verkaufe, handle anonym.</p><a href="/darknet/account?dc=${token || ''}" class="dn-btn">Wallet</a></div>
<div class="dn-card"><div class="icon">💬</div><h3>Chats</h3><p>Verschluesselte Konversationen. Einzeln oder als Gruppe.</p><a href="/darknet/chats?dc=${token || ''}" class="dn-btn">Oeffnen</a></div>
<div class="dn-card"><div class="icon">📦</div><h3>Schwarzmarkt</h3><p>Angebote posten, kaufen, handeln. Alles anonym.</p><a href="/darknet/market?dc=${token || ''}" class="dn-btn">Markt</a></div>
<div class="dn-card"><div class="icon">📊</div><h3>Netzwerk-Status</h3><p>Live-Statistiken. Verbindung: Stabil. Verschluesselung: Aktiv.</p></div>
</div>
</div>
${DARKNET_JS}
${DARKNET_WALLET}
<script>document.querySelectorAll('.dn-nav a').forEach(a=>a.href=a.href.replace('TOKEN','${token || ''}')); loadWallet();</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // GET /darknet/market
  app.get('/darknet/market', (req, res) => {
    const token = req.query.dc || '';
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>// DARKNET // SCHWARZMARKT</title>${DARKNET_CSS}</head><body>
${DARKNET_HEADER('market', 'SCHWARZMARKT')}
<div class="dn-wrap">
<div class="dn-tabs">
<span class="dn-tab active" onclick="filter('all')">Alle</span>
<span class="dn-tab" onclick="filter('weapons')">Waffen</span>
<span class="dn-tab" onclick="filter('drugs')">Drogen</span>
<span class="dn-tab" onclick="filter('hacking')">Hacking</span>
<span class="dn-tab" onclick="filter('info')">Informationen</span>
<span class="dn-tab" onclick="filter('other')">Sonstiges</span>
</div>
<div class="dn-row" style="margin-bottom:16px"><input type="text" id="search" placeholder="Suchen..." style="flex:1;background:#0d1117;border:1px solid #30363d;color:#e0e0e0;padding:10px 12px;border-radius:8px;outline:none" onkeyup="render()"><button class="dn-btn" onclick="showCreate()">+ Angebot erstellen</button></div>
<div id="market-list" class="dn-list"></div>
<div id="create-form" class="dn-section" style="display:none">
<h2>Neues Angebot</h2>
<div class="dn-form">
<input id="m-title" placeholder="Titel" maxlength="60">
<textarea id="m-desc" placeholder="Beschreibung" rows="3"></textarea>
<input id="m-price" type="number" placeholder="Preis in PC Coins" min="1">
<select id="m-cat"><option value="weapons">Waffen</option><option value="drugs">Drogen</option><option value="hacking">Hacking</option><option value="info">Informationen</option><option value="other">Sonstiges</option></select>
<select id="m-type"><option value="direct">Direkt kaufen</option><option value="meeting">Nur persoenliches Treffen</option></select>
<div class="dn-row"><button class="dn-btn" onclick="createItem()">Erstellen</button><button class="dn-btn" style="background:#1a0a0a;border-color:#f85149;color:#f85149" onclick="hideCreate()">Abbrechen</button></div>
</div>
</div>
</div>
${DARKNET_JS}
${DARKNET_WALLET}
<script>
let items = [];
async function load() { items = await fetchJSON('/api/darknet/market'); render(); }
let currentFilter = 'all';
function filter(cat) { currentFilter = cat; document.querySelectorAll('.dn-tab').forEach(t => t.classList.remove('active')); event.target.classList.add('active'); render(); }
function render() {
  const search = document.getElementById('search').value.toLowerCase();
  let f = items;
  if (currentFilter !== 'all') f = f.filter(i => i.category === currentFilter);
  if (search) f = f.filter(i => i.title.toLowerCase().includes(search) || i.description.toLowerCase().includes(search));
  const el = document.getElementById('market-list');
  el.innerHTML = f.length ? f.map(i => \`
    <div class="dn-item">
      <div>
        <div style="font-weight:700;margin-bottom:4px">\${i.title}</div>
        <div class="meta">\${i.description.slice(0,80)}\${i.description.length>80?'...':''} \u2022 \${i.sellerUsername} \u2022 \${i.purchaseType === 'direct' ? 'Direkt' : 'Treffen'}</div>
        <div class="dn-row" style="margin-top:8px;gap:6px">\${i.category.split(',').map(c => '<span class="dn-tag">'+c+'</span>').join('')}</div>
      </div>
      <div style="text-align:right">
        <div class="price">\${i.price} PC</div>
        <div class="dn-row" style="margin-top:8px;gap:6px">
          <button class="dn-btn" style="padding:6px 12px;font-size:.75em" onclick="buy('\${i.id}')">Kaufen</button>
          <button class="dn-btn" style="padding:6px 12px;font-size:.75em;background:#0d1117;border-color:#30363d;color:#8b949e" onclick="offer('\${i.id}')">Angebot</button>
        </div>
      </div>
    </div>
  \`).join('') : '<div style="text-align:center;color:#6b7280;padding:40px">Keine Angebote gefunden.</div>';
}
function showCreate() { document.getElementById('create-form').style.display = 'block'; }
function hideCreate() { document.getElementById('create-form').style.display = 'none'; }
async function createItem() {
  const title = document.getElementById('m-title').value;
  const description = document.getElementById('m-desc').value;
  const price = parseInt(document.getElementById('m-price').value);
  const category = document.getElementById('m-cat').value;
  const purchaseType = document.getElementById('m-type').value;
  if (!title || !description || !price) return alert('Bitte alle Felder ausfuellen');
  await fetchJSON('/api/darknet/market', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN, title, description, price, category, purchaseType }) });
  hideCreate(); load();
}
async function buy(id) {
  if (!confirm('Kaufen?')) return;
  const r = await fetchJSON('/api/darknet/market/' + id + '/buy', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN }) });
  alert('Gekauft! Chat geoeffnet: ' + r.chatId);
  load();
}
async function offer(id) {
  const price = prompt('Preisvorschlag in PC Coins:');
  if (!price) return;
  await fetchJSON('/api/darknet/market/' + id + '/offer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN, price: parseInt(price) }) });
  alert('Preisvorschlag gesendet!');
}
if(TOKEN) { load(); } else { document.getElementById('market-list').innerHTML = '<div class="dn-alert">Anmeldung erforderlich.</div>'; }
document.querySelectorAll('.dn-nav a').forEach(a=>a.href=a.href.replace('TOKEN','${token}'));
</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // GET /darknet/account
  app.get('/darknet/account', (req, res) => {
    const token = req.query.dc || '';
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>// DARKNET // KONTO</title>${DARKNET_CSS}</head><body>
${DARKNET_HEADER('account', 'KONTO')}
<div class="dn-wrap">
<div class="dn-section"><h2>Profil</h2>
<div class="dn-form"><label>Darknet Nutzername</label><div class="dn-row"><input id="username" placeholder="Alias..." maxlength="20"><button class="dn-btn" onclick="saveUsername()">Speichern</button></div></div>
<div id="profile-info" style="margin-top:16px"></div>
</div>
<div class="dn-section"><h2>PC Coin Wallet</h2><div class="dn-row" style="font-size:1.2em"><span id="wallet-dc">--</span></div></div>
<div class="dn-section"><h2>Meine Angebote</h2><div id="my-listings" class="dn-list"></div></div>
<div class="dn-section"><h2>Meine Verkaeufe</h2><div id="my-sales" class="dn-list"></div></div>
<div class="dn-section"><h2>Meine Einkaeufe</h2><div id="my-buys" class="dn-list"></div></div>
</div>
${DARKNET_JS}
${DARKNET_WALLET}
<script>
async function loadAccount() {
  const user = await fetchJSON('/api/darknet/user/me');
  document.getElementById('username').value = user.username || '';
  document.getElementById('profile-info').innerHTML = '<div class="dn-row"><span class="dn-tag">ID: ' + user.discordUserId.slice(0,6) + '***</span><span class="dn-tag">Mitglied seit: ' + new Date(user.createdAt).toLocaleDateString('de-DE') + '</span></div>';
  const market = await fetchJSON('/api/darknet/market');
  const myListings = market.filter(i => i.sellerId === user.discordUserId);
  const mySales = market.filter(i => i.sellerId === user.discordUserId && i.status === 'sold');
  const myBuys = market.filter(i => i.buyerId === user.discordUserId);
  document.getElementById('my-listings').innerHTML = myListings.length ? myListings.map(i => '<div class="dn-item"><div><div style="font-weight:700">' + i.title + '</div><div class="meta">' + i.status + ' \u2022 ' + i.price + ' PC</div></div></div>').join('') : '<div style="color:#6b7280">Keine aktiven Angebote.</div>';
  document.getElementById('my-sales').innerHTML = mySales.length ? mySales.map(i => '<div class="dn-item"><div><div style="font-weight:700">' + i.title + '</div><div class="meta">Verkauft fuer ' + i.price + ' PC an ' + (i.buyerUsername || '---') + '</div></div></div>').join('') : '<div style="color:#6b7280">Noch keine Verkaeufe.</div>';
  document.getElementById('my-buys').innerHTML = myBuys.length ? myBuys.map(i => '<div class="dn-item"><div><div style="font-weight:700">' + i.title + '</div><div class="meta">Gekauft fuer ' + i.price + ' PC von ' + (i.sellerUsername || '---') + '</div></div></div>').join('') : '<div style="color:#6b7280">Noch keine Einkaeufe.</div>';
  loadWallet();
}
async function saveUsername() {
  const username = document.getElementById('username').value;
  await fetchJSON('/api/darknet/user/username', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN, username }) });
  alert('Nutzername gespeichert!');
  loadAccount();
}
if(TOKEN) { loadAccount(); } else { document.querySelector('.dn-wrap').innerHTML = '<div class="dn-alert">Anmeldung erforderlich.</div>'; }
document.querySelectorAll('.dn-nav a').forEach(a=>a.href=a.href.replace('TOKEN','${token}'));
</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // GET /darknet/chats
  app.get('/darknet/chats', (req, res) => {
    const token = req.query.dc || '';
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>// DARKNET // CHATS</title>${DARKNET_CSS}</head><body>
${DARKNET_HEADER('chats', 'CHATS')}
<div class="dn-wrap">
<div class="dn-row" style="margin-bottom:16px"><button class="dn-btn" onclick="showNew()">+ Neue Konversation</button></div>
<div id="chat-list" class="dn-list"></div>
<div id="new-chat" class="dn-section" style="display:none">
<h2>Neue Konversation</h2>
<div class="dn-form">
<select id="c-type"><option value="dm">Einzelperson</option><option value="group">Gruppe</option></select>
<input id="c-users" placeholder="Nutzername(n) kommagetrennt">
<div class="dn-row"><button class="dn-btn" onclick="createChat()">Starten</button><button class="dn-btn" style="background:#1a0a0a;border-color:#f85149;color:#f85149" onclick="hideNew()">Abbrechen</button></div>
</div>
</div>
</div>
${DARKNET_JS}
${DARKNET_WALLET}
<script>
async function loadChats() {
  const chats = await fetchJSON('/api/darknet/chats');
  const el = document.getElementById('chat-list');
  el.innerHTML = chats.length ? chats.map(c => {
    const last = c.lastMessage;
    return '<a href="/darknet/chat/' + c.id + '?dc=' + TOKEN + '" style="text-decoration:none"><div class="dn-item"><div><div style="font-weight:700">' + (c.type === 'group' ? 'Gruppe' : 'DM') + ' &mdash; ' + c.participants.length + ' Teilnehmer</div><div class="meta">' + (last ? (last.senderUsername + ': ' + last.text.slice(0,40)) : 'Keine Nachrichten') + '</div></div><div class="meta">' + new Date(c.updatedAt).toLocaleString('de-DE', {hour:'2-digit',minute:'2-digit'}) + '</div></div></a>';
  }).join('') : '<div style="text-align:center;color:#6b7280;padding:40px">Noch keine Chats.</div>';
}
function showNew() { document.getElementById('new-chat').style.display = 'block'; }
function hideNew() { document.getElementById('new-chat').style.display = 'none'; }
async function createChat() {
  const type = document.getElementById('c-type').value;
  const usernames = document.getElementById('c-users').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!usernames.length) return alert('Bitte Nutzernamen eingeben');
  const users = await fetchJSON('/api/darknet/user/me');
  const allUsers = await (await fetch('/api/darknet/market?dc=' + TOKEN)).json();
  // Resolve usernames to discord IDs
  const participants = [];
  for (const u of usernames) {
    const found = allUsers.find(x => x.sellerUsername === u);
    if (found) participants.push(found.sellerId);
  }
  const r = await fetchJSON('/api/darknet/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN, participants, type }) });
  hideNew(); loadChats();
  location.href = '/darknet/chat/' + r.chatId + '?dc=' + TOKEN;
}
if(TOKEN) { loadChats(); } else { document.getElementById('chat-list').innerHTML = '<div class="dn-alert">Anmeldung erforderlich.</div>'; }
document.querySelectorAll('.dn-nav a').forEach(a=>a.href=a.href.replace('TOKEN','${token}'));
</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

  // GET /darknet/chat/:id
  app.get('/darknet/chat/:id', (req, res) => {
    const token = req.query.dc || '';
    const chatId = req.params.id;
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>// DARKNET // CHAT</title>${DARKNET_CSS}</head><body>
${DARKNET_HEADER('chats', 'CHAT')}
<div class="dn-wrap">
<div id="chat-info" style="margin-bottom:12px"></div>
<div id="chat-messages" class="dn-chat"></div>
<div class="dn-form" style="margin-top:12px;flex-direction:row">
<input id="msg-text" placeholder="Nachricht..." style="flex:1" onkeydown="if(event.key==='Enter')send()">
<button class="dn-btn" onclick="send()">Senden</button>
</div>
</div>
${DARKNET_JS}
${DARKNET_WALLET}
<script>
const CHAT_ID = '${chatId}';
let myId = '';
async function loadChat() {
  const chat = await fetchJSON('/api/darknet/chat/' + CHAT_ID);
  const user = await fetchJSON('/api/darknet/user/me');
  myId = user.discordUserId;
  document.getElementById('chat-info').innerHTML = '<div class="dn-row"><span class="dn-tag">' + (chat.type === 'group' ? 'Gruppe' : 'DM') + '</span><span class="dn-tag">' + chat.participants.length + ' Teilnehmer</span></div>';
  const el = document.getElementById('chat-messages');
  el.innerHTML = chat.messages.map(m => '<div class="dn-msg ' + (m.senderId === myId ? 'me' : 'other') + '"><div class="meta">' + (m.senderUsername || '---') + ' &bull; ' + new Date(m.createdAt).toLocaleString('de-DE', {hour:'2-digit',minute:'2-digit'}) + '</div>' + m.text + '</div>').join('');
  el.scrollTop = el.scrollHeight;
  loadWallet();
}
async function send() {
  const text = document.getElementById('msg-text').value;
  if (!text.trim()) return;
  await fetchJSON('/api/darknet/chat/' + CHAT_ID + '/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dc: TOKEN, text }) });
  document.getElementById('msg-text').value = '';
  loadChat();
}
if(TOKEN) { loadChat(); setInterval(loadChat, 3000); } else { document.querySelector('.dn-wrap').innerHTML = '<div class="dn-alert">Anmeldung erforderlich.</div>'; }
document.querySelectorAll('.dn-nav a').forEach(a=>a.href=a.href.replace('TOKEN','${token}'));
</script>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  });

};
