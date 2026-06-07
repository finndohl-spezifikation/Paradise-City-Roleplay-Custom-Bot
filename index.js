const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
  AuditLogEvent,
  SlashCommandBuilder,
  REST,
  Routes,
  Colors,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  AttachmentBuilder,
  ActivityType,
} = require('discord.js');
const fs   = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ─── Führerschein Inline Helpers ──────────────────────────────────────────────
function _fsLoadFS() { try { return JSON.parse(require('fs').readFileSync(require('path').join(DATA_DIR,'fuehrerschein','lizenzen.json'),'utf8')); } catch { return {}; } }
function _fsGenToken(userId, createdBy) {
  const tok = require('crypto').randomBytes(24).toString('hex');
  const tokFile = require('path').join(DATA_DIR,'fuehrerschein','tokens.json');
  const dir = require('path').join(DATA_DIR,'fuehrerschein');
  if (!require('fs').existsSync(dir)) require('fs').mkdirSync(dir, {recursive:true});
  let toks = {}; try { toks = JSON.parse(require('fs').readFileSync(tokFile,'utf8')); } catch {}
  for (const [k,v] of Object.entries(toks)) { if(v.userId===userId) delete toks[k]; }
  toks[tok] = { userId, createdBy, expiresAt: Date.now() + 48*60*60*1000 };
  require('fs').writeFileSync(tokFile, JSON.stringify(toks,null,2));
  return tok;
}


// ─── Datenspeicherung ─────────────────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
let _shopCb = {};
const SHOP_MGR_TOK_FILE = path.join(DATA_DIR, 'shop_mgr_tokens.json');
function loadShopMgrToks() { try { return JSON.parse(fs.readFileSync(SHOP_MGR_TOK_FILE,'utf8')); } catch { return {}; } }
function saveShopMgrToks(d) { fs.writeFileSync(SHOP_MGR_TOK_FILE, JSON.stringify(d,null,2),'utf8'); }
// ─── AKTIEN SYSTEM ────────────────────────────────────────────────────────────
const AKTIEN_FILE     = path.join(DATA_DIR, 'aktien.json');
const PORTFOLIO_FILE  = path.join(DATA_DIR, 'aktien_portfolio.json');
const AKTIEN_TOK_FILE = path.join(DATA_DIR, 'aktien_tokens.json');
function loadAktien()      { try { return JSON.parse(fs.readFileSync(AKTIEN_FILE,'utf8')); } catch { return {}; } }
function saveAktien(d)     { fs.writeFileSync(AKTIEN_FILE, JSON.stringify(d,null,2),'utf8'); }
function loadPortfolio()   { try { return JSON.parse(fs.readFileSync(PORTFOLIO_FILE,'utf8')); } catch { return {}; } }
function savePortfolio(d)  { fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(d,null,2),'utf8'); }
function loadAktienToks()  { try { return JSON.parse(fs.readFileSync(AKTIEN_TOK_FILE,'utf8')); } catch { return {}; } }
function saveAktienToks(d) { fs.writeFileSync(AKTIEN_TOK_FILE, JSON.stringify(d,null,2),'utf8'); }
const AKTIEN_MSG_FILE = path.join(DATA_DIR, 'aktien_messages.json');
function loadAktienMsgs()  { try { return JSON.parse(fs.readFileSync(AKTIEN_MSG_FILE,'utf8')); } catch { return {}; } }
function saveAktienMsgs(d) { fs.writeFileSync(AKTIEN_MSG_FILE, JSON.stringify(d,null,2),'utf8'); }

const KRYPTO_FILE      = path.join(DATA_DIR, 'krypto.json');
const KRYPTO_RATE_FILE = path.join(DATA_DIR, 'krypto_rate.json');
const KRYPTO_WALLET_CH = '1506366880284283072';
const KRYPTO_EXCH_CH   = '1506366922793423009';
const KRYPTO_RATES_CH  = '1506366949997678752';

function loadKrypto()      { try { return JSON.parse(fs.readFileSync(KRYPTO_FILE,'utf8')); } catch { return {}; } }
function saveKrypto(d)     { fs.writeFileSync(KRYPTO_FILE, JSON.stringify(d,null,2),'utf8'); }
function getWallet(uid)    { const d=loadKrypto(); return d[uid]||{dc:0}; }
function setWallet(uid,w)  { const d=loadKrypto(); d[uid]=w; saveKrypto(d); }
function loadKryptoRate()  { try { return JSON.parse(fs.readFileSync(KRYPTO_RATE_FILE,'utf8')); } catch { return {rate:100,history:[]}; } }
function saveKryptoRate(d) { fs.writeFileSync(KRYPTO_RATE_FILE, JSON.stringify(d,null,2),'utf8'); }

const KRYPTO_TOK_FILE = path.join(DATA_DIR, 'krypto_tokens.json');
function loadKryptoToks() { try { return JSON.parse(fs.readFileSync(KRYPTO_TOK_FILE,'utf8')); } catch { return {}; } }
function saveKryptoToks(d) { fs.writeFileSync(KRYPTO_TOK_FILE, JSON.stringify(d,null,2),'utf8'); }
function genKryptoToken(userId, type) {
  const token = require('crypto').randomBytes(20).toString('hex');
  const toks = loadKryptoToks();
  // Expire old tokens for this user+type
  for (const [k,v] of Object.entries(toks)) { if(v.userId===userId&&v.type===type) delete toks[k]; }
  toks[token] = { userId, type, expiresAt: Date.now() + 15*60*1000 };
  saveKryptoToks(toks);
  return token;
}
function validateKryptoToken(token) {
  const toks = loadKryptoToks();
  const e = toks[token];
  return (!e || e.expiresAt < Date.now()) ? null : e;
}

function nextKryptoRate(cur) {
  const r=Math.random();
  let pct;
  if(r<0.01){ pct=(Math.random()*0.3+0.2)*(Math.random()<0.5?1:-1); }
  else if(r<0.1){ pct=(Math.random()*0.1+0.05)*(Math.random()<0.5?1:-1); }
  else{ pct=(Math.random()*0.04+0.01)*(Math.random()<0.5?1:-1); }
  return Math.max(10,Math.min(10000,Math.round(cur*(1+pct))));
}

async function updateKryptoRate() {
  const rateData = loadKryptoRate();
  const cur = rateData.rate||100;
  const newRate = nextKryptoRate(cur);
  rateData.rate = newRate;
  rateData.history.push({ rate:newRate, ts:Date.now() });
  if(rateData.history.length>48) rateData.history=rateData.history.slice(-48);
  saveKryptoRate(rateData);
  // Update rates embed
  try {
    const ch = await client.channels.fetch(KRYPTO_RATES_CH).catch(()=>null);
    if(!ch) return;
    const { EmbedBuilder } = require('discord.js');
    const DARKNET_URL_K = process.env.DARKNET_URL||'';
    const ratesUrl = DARKNET_URL_K ? (DARKNET_URL_K.endsWith('/')?DARKNET_URL_K:DARKNET_URL_K+'/') + 'crypto/rates' : '';
    const prev = rateData.history.length>=2?rateData.history[rateData.history.length-2].rate:cur;
    const diff = newRate-prev;
    const trend = diff>=0?'📈':'📉';
    const embed = new EmbedBuilder()
      .setColor(diff>=0?0x22c55e:0xef4444)
      .setTitle('<:emoji_29:1507071093540782110> PC Coin — Aktueller Kurs')
      .setDescription(`${trend} **1 <:emoji_29:1507071093540782110> = ${newRate.toLocaleString('de-DE')} Schwarzgeld**`)
      .addFields(
        { name:'24h Hoch', value:Math.max(...rateData.history.map(h=>h.rate)).toLocaleString('de-DE')+' $', inline:true },
        { name:'24h Tief', value:Math.min(...rateData.history.map(h=>h.rate)).toLocaleString('de-DE')+' $', inline:true },
        { name:'Änderung', value:(diff>=0?'+':'')+diff+' $ ('+(prev>0?(diff/prev*100).toFixed(2):0)+'%)', inline:true }
      )
      .setFooter({ text:'Paradise City • PC Coin System • Kurse aktualisieren sich stündlich' })
      .setTimestamp();
    // Find existing pinned embed and edit, else send (no external button)
    const msgs = await ch.messages.fetch({limit:5}).catch(()=>null);
    const existing = msgs?.find(m=>m.author.id===client.user.id&&m.embeds.length>0);
    if(existing) await existing.edit({embeds:[embed],components:[]}).catch(()=>{});
    else await ch.send({embeds:[embed],components:[]}).catch(()=>{});
  } catch(e){ console.error('[KRYPTO RATE]',e.message); }
}


const AKTIEN_STOCKS = [
  { id:'maze',       name:'Maze Bank',   emoji:'🏦', color:0x1565C0, channel:'1493359040045125844', startPrice:350  },
  { id:'benefactor', name:'Benefactor',  emoji:'🚗', color:0x2E7D32, channel:'1493359230118527078', startPrice:1200 },
  { id:'goldwand',   name:'Goldwand',    emoji:'🏆', color:0xF9A825, channel:'1493360407224516648', startPrice:650  },
  { id:'diamond',    name:'The Diamond', emoji:'💎', color:0x6A1B9A, channel:'1493360555401154700', startPrice:2800 },
];

function initAktien() {
  const d = loadAktien();
  let changed = false;
  for (const s of AKTIEN_STOCKS) {
    if (!d[s.id]) {
      d[s.id] = { price: s.startPrice, history: [{ price: s.startPrice, ts: Date.now() }] };
      changed = true;
    }
  }
  if (changed) saveAktien(d);
}

function nextAktienPrice(cur) {
  const r = Math.random();
  let pct;
  if (r < 0.002) {
    return Math.random() < 0.5
      ? Math.floor(Math.random() * 50000 + 50000)
      : Math.floor(Math.random() * 200 + 100);
  } else if (r < 0.017) {
    pct = (Math.random() * 0.2 + 0.4) * (Math.random() < 0.5 ? 1 : -1);
  } else if (r < 0.09) {
    pct = (Math.random() * 0.15 + 0.2) * (Math.random() < 0.5 ? 1 : -1);
  } else {
    pct = (Math.random() * 0.09 + 0.03) * (Math.random() < 0.5 ? 1 : -1);
  }
  const next = Math.round(cur * (1 + pct));
  return Math.max(100, Math.min(100000, next));
}

async function updateAktienPrices() {
  const d = loadAktien();
  const { EmbedBuilder } = require('discord.js');
  const WEBAPP_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
  for (const s of AKTIEN_STOCKS) {
    if (!d[s.id]) d[s.id] = { price: s.startPrice, history: [] };
    const oldPrice = d[s.id].price;
    const newPrice = nextAktienPrice(oldPrice);
    const diff     = newPrice - oldPrice;
    const diffPct  = oldPrice > 0 ? ((diff / oldPrice) * 100).toFixed(2) : '0.00';
    const trend    = diff >= 0 ? '📈' : '📉';
    const embedCol = diff >= 0 ? 0x22c55e : 0xef4444;
    const sign     = diff >= 0 ? '+' : '';
    d[s.id].price = newPrice;
    d[s.id].history.push({ price: newPrice, ts: Date.now() });
    if (d[s.id].history.length > 48) d[s.id].history = d[s.id].history.slice(-48);
    try {
      const _msgs = loadAktienMsgs();
      if (_msgs[s.id]) {
        // Embed existiert bereits — nichts tun
        const ch = await client.channels.fetch(s.channel).catch(() => null);
        if (ch) {
          const _existing = await ch.messages.fetch(_msgs[s.id]).catch(() => null);
          if (_existing) continue; // Nachricht vorhanden → überspringen
        }
      }
      // Kein Embed vorhanden → nichts tun (kein Neu-Senden)
    } catch(e) { console.error('[AKTIEN]', s.id, e.message); }
  }
  saveAktien(d);
}
// ─── END AKTIEN DATEN ─────────────────────────────────────────────────────────

const lapdTokens    = new Map(); // LAPD: token -> { memberId, uname, ranks, expires }
const LOG_SHOP_CH  = '1490878131240829028';
const LOG_MONEY_CH = '1490878138429997087';
const WARN_FILE     = path.join(DATA_DIR, 'teamwarns.json');
const PLAYER_WARN_FILE = path.join(DATA_DIR, 'player_warns.json');
const INVITES_FILE  = path.join(DATA_DIR, 'invites.json');
const SETUP_FILE    = path.join(DATA_DIR, 'setup.json');

if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WARN_FILE))    fs.writeFileSync(WARN_FILE,    '{}', 'utf8');
if (!fs.existsSync(PLAYER_WARN_FILE)) fs.writeFileSync(PLAYER_WARN_FILE, '{}', 'utf8');
if (!fs.existsSync(INVITES_FILE)) fs.writeFileSync(INVITES_FILE, '{}', 'utf8');
if (!fs.existsSync(SETUP_FILE))   fs.writeFileSync(SETUP_FILE,   '{}', 'utf8');

// ─── LOTTO DATA ───────────────────────────────────────────────────────────────
const LOTTO_CH        = '1492636063817138216';
// ─── HANDY SYSTEM ─────────────────────────────────────────────────────────────
const HANDY_CH         = '1490890317199708160';
const ROLE_HANDY_AN    = '1490855780797251744';
const ROLE_HANDY_AUS   = '1490855781778722976';
const MONEY_GIF        = '<:emoji_30:1510247810186874981>';
const ROLE_APP_INSTA   = '1490855786698641428';
const ROLE_APP_EBAY    = '1490855785159331850';
const ROLE_APP_PARSHIP = '1490855785159331850';

const LOTTO_FILE      = path.join(DATA_DIR, 'lotto_tickets.json');
const LOTTO_DRAW_FILE = path.join(DATA_DIR, 'lotto_draws.json');
const LOTTO_WEEK_FILE = path.join(DATA_DIR, 'lotto_week.json');
if (!fs.existsSync(LOTTO_FILE))      fs.writeFileSync(LOTTO_FILE,      '{}', 'utf8');
if (!fs.existsSync(LOTTO_DRAW_FILE)) fs.writeFileSync(LOTTO_DRAW_FILE, '{}', 'utf8');
if (!fs.existsSync(LOTTO_WEEK_FILE)) fs.writeFileSync(LOTTO_WEEK_FILE, JSON.stringify({ winners: 0, weekStart: 0, lastDraw: '' }), 'utf8');
function loadLottoTickets()  { try { return JSON.parse(fs.readFileSync(LOTTO_FILE, 'utf8')); } catch { return {}; } }
function saveLottoTickets(d) { fs.writeFileSync(LOTTO_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadLottoDraw()     { try { return JSON.parse(fs.readFileSync(LOTTO_DRAW_FILE, 'utf8')); } catch { return {}; } }
function saveLottoDraw(d)    { fs.writeFileSync(LOTTO_DRAW_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadLottoWeek()     { try { return JSON.parse(fs.readFileSync(LOTTO_WEEK_FILE, 'utf8')); } catch { return { winners: 0, weekStart: 0, lastDraw: '' }; } }
function saveLottoWeek(d)    { fs.writeFileSync(LOTTO_WEEK_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function getWeekStart(now) {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.getTime();
}
const LOTTO_PRIZES = [
  { richtig: 0, superzahl: true,  label: '🌟 Superzahl',    betrag: 3000000 },
  { richtig: 6, superzahl: false, label: '🎯 6 Richtige',   betrag: 1000000 },
  { richtig: 5, superzahl: false, label: '🎯 5 Richtige',   betrag: 800000  },
  { richtig: 4, superzahl: false, label: '🎯 4 Richtige',   betrag: 400000  },
  { richtig: 3, superzahl: false, label: '🎯 3 Richtige',   betrag: 200000  },
  { richtig: 2, superzahl: false, label: '🎯 2 Richtige',   betrag: 100000  },
  { richtig: 1, superzahl: false, label: '🎯 1 Richtige',   betrag: 50000   },
];

const AUSWEIS_FILE = path.join(DATA_DIR, 'ausweis.json');
const CODES_FILE   = path.join(DATA_DIR, 'einreise_codes.json');
if (!fs.existsSync(AUSWEIS_FILE)) fs.writeFileSync(AUSWEIS_FILE, '{}', 'utf8');
if (!fs.existsSync(CODES_FILE))   fs.writeFileSync(CODES_FILE,   '{}', 'utf8');
function loadAusweis()  { try { return JSON.parse(fs.readFileSync(AUSWEIS_FILE, 'utf8')); } catch { return {}; } }
function saveAusweis(d) { fs.writeFileSync(AUSWEIS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadCodes()    { try { return JSON.parse(fs.readFileSync(CODES_FILE,   'utf8')); } catch { return {}; } }
function saveCodes(d)   { fs.writeFileSync(CODES_FILE,   JSON.stringify(d, null, 2), 'utf8'); }

// ─── Abstimmungs-System ──────────────────────────────────────────────────────
const ABSTIMMUNG_CH   = '1490882563575648256';
const ABSTIMMUNGEN_FILE = path.join(DATA_DIR, 'abstimmungen.json');
if (!fs.existsSync(ABSTIMMUNGEN_FILE)) fs.writeFileSync(ABSTIMMUNGEN_FILE, '{}', 'utf8');
function loadAbstimmungen()  { try { return JSON.parse(fs.readFileSync(ABSTIMMUNGEN_FILE, 'utf8')); } catch { return {}; } }
function saveAbstimmungen(d) { fs.writeFileSync(ABSTIMMUNGEN_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// ─── Lobby-Poll-System ───────────────────────────────────────────────────────
const LOBBY_POLLS_FILE = path.join(DATA_DIR, 'lobby_polls.json');
if (!fs.existsSync(LOBBY_POLLS_FILE)) fs.writeFileSync(LOBBY_POLLS_FILE, '{}', 'utf8');
function loadLobbyPolls()  { try { return JSON.parse(fs.readFileSync(LOBBY_POLLS_FILE, 'utf8')); } catch { return {}; } }
function saveLobbyPolls(d) { fs.writeFileSync(LOBBY_POLLS_FILE, JSON.stringify(d, null, 2), 'utf8'); }

function makeBar(count, total) {
  const pct    = total === 0 ? 0 : Math.round((count / total) * 100);
  const filled = total === 0 ? 0 : Math.round((count / total) * 20);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(20 - filled) + '  **' + pct + '%**  (' + count + ' Stimmen)';
}
function buildAbstimmungEmbed(poll) {
  const ups   = Object.values(poll.voters).filter(v => v === 'up').length;
  const downs = Object.values(poll.voters).filter(v => v === 'down').length;
  const total = ups + downs;
  return new EmbedBuilder()
    .setColor(DARK_ORANGE)
    .setTitle('\uD83D\uDDF3\uFE0F Abstimmung')
    .setDescription('**' + poll.frage + '**')
    .addFields(
      { name: '\uD83D\uDC4D ' + poll.antwort1, value: makeBar(ups,   total), inline: false },
      { name: '\uD83D\uDC4E ' + poll.antwort2, value: makeBar(downs, total), inline: false },
      { name: '\uD83D\uDCCA Stimmen gesamt', value: String(total), inline: true },
    )
    .setFooter({ text: 'Du kannst nur f\u00FCr eine Option gleichzeitig stimmen' })
    .setTimestamp();
}

// ─── Ausweis-Token-System ───────────────────────────────────────────────────
const AUSWEIS_TOKEN_FILE = path.join(DATA_DIR, 'ausweis_tokens.json');
if (!fs.existsSync(AUSWEIS_TOKEN_FILE)) fs.writeFileSync(AUSWEIS_TOKEN_FILE, '{}', 'utf8');
function loadAusweisTokens()  { try { return JSON.parse(fs.readFileSync(AUSWEIS_TOKEN_FILE, 'utf8')); } catch { return {}; } }
function saveAusweisTokens(d) { fs.writeFileSync(AUSWEIS_TOKEN_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function genToken() { return require('crypto').randomBytes(20).toString('hex'); }
function loadAusweisData()  { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ausweis.json'), 'utf8')); } catch { return {}; } }

// ─── Aktivitätscheck-System ─────────────────────────────────────────────────
const AKTIVITAET_CH      = '1502382574310392040';
  const TEAM_OVERVIEW_CH   = '1490882570899030136';
  const FRAK_OVERVIEW_CH   = '1492701250528084059';
  const FRAK_LOG_CH        = '1492701273571725433';
  const FRAK_FILE          = path.join(DATA_DIR, 'fraktionen.json');
  if (!fs.existsSync(FRAK_FILE)) fs.writeFileSync(FRAK_FILE, '{}', 'utf8');
  function loadFraktionen() { try { return JSON.parse(fs.readFileSync(FRAK_FILE, 'utf8')); } catch { return {}; } }
  function saveFraktionen(d) { fs.writeFileSync(FRAK_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  const VORSCHLAG_FILE = path.join(__dirname, 'data', 'vorschlaege.json');
    const VORSCHLAG_CH   = '1490882579765661837';
    function loadVorschlaege() { try { return JSON.parse(fs.readFileSync(VORSCHLAG_FILE, 'utf8')); } catch { return []; } }
    function saveVorschlaege(d) { fs.writeFileSync(VORSCHLAG_FILE, JSON.stringify(d, null, 2), 'utf8'); }
  const COUNTER_FILE = path.join(__dirname, 'data', 'counter.json');
    const COUNTER_CH   = '1490882580487340044';
    const COUNTER_GOAL = 1000;
    function loadCounter() { try { return JSON.parse(fs.readFileSync(COUNTER_FILE, 'utf8')); } catch { return { count: 0, lastUserId: null }; } }
    function saveCounter(d) { fs.writeFileSync(COUNTER_FILE, JSON.stringify(d, null, 2), 'utf8'); }

    const SHOPS_FILE   = path.join(__dirname, 'data', 'shops.json');
    const BARGELD_FILE = path.join(__dirname, 'data', 'bargeld.json');
    const SHOP_CHANNELS = { kwik: '1490890311755628584', baumarkt: '1492976742497783818', angler: '1497804333541097532', schwarz: '1492977067665526804' };
    const SHOP_META = {
      kwik:     { name: 'Kwik-E-Markt',  emoji: '\u{1F3EA}', color: 0xF4A400, desc: 'Dein freundlicher Nachbarschaftsmarkt' },
      baumarkt: { name: 'Baumarkt',      emoji: '\u{1F528}', color: 0xA0522D, desc: 'Alles fuer Bau und Handwerk' },
      angler:   { name: 'Angler Shop',   emoji: '\u{1F3A3}', color: 0x006994, desc: 'Ausruestung fuer Angler' },
      schwarz:  { name: 'Schwarzmarkt',  emoji: '\u{1F311}', color: 0x1a1a2e, desc: 'Hier findest du das Besondere' },
    };
    const shopCarts = new Map();
    function loadShops()    { try { return JSON.parse(fs.readFileSync(SHOPS_FILE, 'utf8')); } catch { return { kwik:[], baumarkt:[], angler:[], schwarz:[], team:[] }; } }
    function saveShops(d)   { fs.writeFileSync(SHOPS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
    function loadBargeld()  { try { return JSON.parse(fs.readFileSync(BARGELD_FILE, 'utf8')); } catch { return {}; } }
    function saveBargeld(d) { fs.writeFileSync(BARGELD_FILE, JSON.stringify(d, null, 2), 'utf8'); }
    function getCash(uid)   { return loadBargeld()[uid] || 0; }
    function setCash(uid, amount) { const d = loadBargeld(); d[uid] = Math.max(0, amount); saveBargeld(d); }
    function getCart(uid, shopId) { const key = uid + shopId; if (!shopCarts.has(key)) shopCarts.set(key, []); return shopCarts.get(key); }
    function clearCart(uid, shopId) { shopCarts.set(uid + shopId, []); }
    function cartTotal(cart) { return cart.reduce((s, i) => s + i.preis * i.menge, 0); }

  // ─── KONTO / BANKING HELPERS ─────────────────────────────────────────────────
  const KONTO_FILE       = path.join(__dirname, 'data', 'konto.json');
  const TRANS_FILE       = path.join(__dirname, 'data', 'transaktionen.json');
  const LOHNLOG_FILE     = path.join(__dirname, 'data', 'lohnlog.json');
  const RECHNUNGEN_FILE  = path.join(__dirname, 'data', 'rechnungen.json');
if (!fs.existsSync(KONTO_FILE))      fs.writeFileSync(KONTO_FILE,     '{}', 'utf8');
if (!fs.existsSync(TRANS_FILE))      fs.writeFileSync(TRANS_FILE,     '{}', 'utf8');
if (!fs.existsSync(LOHNLOG_FILE))    fs.writeFileSync(LOHNLOG_FILE,   '{}', 'utf8');
if (!fs.existsSync(RECHNUNGEN_FILE)) fs.writeFileSync(RECHNUNGEN_FILE,'{}', 'utf8');

  function loadKonto() {
    try { return JSON.parse(fs.readFileSync(KONTO_FILE, 'utf8')); } catch { return {}; }
  }
  function saveKonto(d) { fs.writeFileSync(KONTO_FILE, JSON.stringify(d, null, 2)); }
  function getKonto(uid) { const d = loadKonto(); return d[uid] ?? { konto: 0, schwarz: 0 }; }
  function setKonto(uid, obj) { const d = loadKonto(); d[uid] = obj; saveKonto(d); }

  function loadTrans() {
    try { return JSON.parse(fs.readFileSync(TRANS_FILE, 'utf8')); } catch { return {}; }
  }
  function saveTrans(d) { fs.writeFileSync(TRANS_FILE, JSON.stringify(d, null, 2)); }
  function addTrans(uid, entry) {
    const d = loadTrans();
    if (!d[uid]) d[uid] = [];
    d[uid].unshift(entry);
    if (d[uid].length > 50) d[uid] = d[uid].slice(0, 50);
    saveTrans(d);
  }
  function getLastTrans(uid, n = 5) {
    const d = loadTrans();
    return (d[uid] ?? []).slice(0, n);
  }

  function loadLohnlog() {
    try { return JSON.parse(fs.readFileSync(LOHNLOG_FILE, 'utf8')); } catch { return {}; }
  }
  function saveLohnlog(d) { fs.writeFileSync(LOHNLOG_FILE, JSON.stringify(d, null, 2)); }

  function loadRechnungen() {
    try { return JSON.parse(fs.readFileSync(RECHNUNGEN_FILE, 'utf8')); } catch { return {}; }
  }
  function saveRechnungen(d) { fs.writeFileSync(RECHNUNGEN_FILE, JSON.stringify(d, null, 2)); }

  // ─── LOHNKLASSEN CONFIG ───────────────────────────────────────────────────────
  const LOHNKLASSEN = [
    { roleId: '1490855796932739093', label: 'Arbeitslosengeld',    betrag: 1000 },
    { roleId: '1490855789844234310', label: 'Niedrige Lohnklasse', betrag: 3000 },
    { roleId: '1490855790913785886', label: 'Mittlere Lohnklasse', betrag: 3600 },
    { roleId: '1490855791953973421', label: 'Hohe Lohnklasse',     betrag: 4500 },
  ];
  const SCHWARZ_ROLE = '1490855730767597738';
  const LOHN_INTERVAL_MS = 60 * 60 * 1000; // 1 Stunde
  

    function buildShopPageEmbed(shopId, page, items) {
      const m = SHOP_META[shopId];
      const totalPages = Math.max(1, Math.ceil(items.length / 10));
      const pageItems = items.slice(page * 10, (page + 1) * 10);
      const TICK = String.fromCharCode(96);
      const rows = pageItems.length
        ? pageItems.map((it, i) => TICK + String(page*10+i+1).padStart(2,'0') + TICK + '  **' + it.name + '** — 💵 ' + it.preis.toLocaleString('de-DE') + ' Euro').join('\n')
        : '_Keine Items_';
      return new EmbedBuilder()
        .setColor(m.color)
        .setAuthor({ name: 'Paradise City Roleplay  •  ' + m.name })
        .setTitle(m.emoji + '  ' + m.name)
        .setDescription('*' + m.desc + '*\n\n' + rows)
        .setFooter({ text: 'Seite ' + (page+1) + '/' + totalPages + '  •  ' + items.length + ' Items  •  Paradise City Roleplay' });
    }

    function buildCartEmbed(shopId, cart, cash) {
      const m = SHOP_META[shopId];
      const total = cartTotal(cart);
      const cartRows = cart.length
        ? cart.map(i => '▸ **' + i.name + '** x' + i.menge + ' — 💵 ' + (i.preis*i.menge).toLocaleString('de-DE') + ' Euro').join('\n')
        : '_Warenkorb ist leer_';
      const enough = cash >= total && cart.length > 0;
      return new EmbedBuilder()
        .setColor(m.color)
        .setTitle('🛒  Warenkorb — ' + m.name)
        .setDescription(cartRows)
        .addFields(
          { name: '💰  Zwischensumme', value: '**' + total.toLocaleString('de-DE') + ' Euro**', inline: true },
          { name: '💵  Dein Bargeld',  value: '**' + cash.toLocaleString('de-DE') + ' Euro**', inline: true },
          { name: enough ? '✅  Genug' : cart.length === 0 ? '🛒  Leer' : '❌  Nicht genug',
            value: enough ? 'Du kannst kaufen!' : cart.length === 0 ? 'Fuege Items hinzu' : 'Fehlen: ' + (total-cash).toLocaleString('de-DE') + ' Euro', inline: true }
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Warenkorb' });
    }

    function buildTeamShopEmbed(items, page) {
      const totalPages = Math.max(1, Math.ceil(items.length / 10));
      const pageItems = items.slice(page * 10, (page + 1) * 10);
      const TICK = String.fromCharCode(96);
      const rows = pageItems.length
        ? pageItems.map((it, i) => TICK + String(page*10+i+1).padStart(2,'0') + TICK + '  **' + it.name + '** — 🎁 Kostenlos').join('\n')
        : '_Keine Items_';
      return new EmbedBuilder()
        .setColor(0xE65100)
        .setAuthor({ name: 'Paradise City Roleplay  •  Team Shop' })
        .setTitle('🎖️  Team Shop')
        .setDescription('*Exklusiv fuer das Team — kostenlos beziehen*\n\n' + rows)
        .setFooter({ text: 'Seite ' + (page+1) + '/' + totalPages + '  •  ' + items.length + ' Items  •  Paradise City Roleplay' });
    }

    function buildShopSession(shopId, items, page, cart, cash) {
      const m = SHOP_META[shopId];
      const totalPages = Math.max(1, Math.ceil(items.length / 10));
      const pageItems  = items.slice(page * 10, (page + 1) * 10);
      const TICK = String.fromCharCode(96);
      const rows = pageItems.length
        ? pageItems.map((it, i) => TICK + String(page*10+i+1).padStart(2,'0') + TICK + '  **' + it.name + '** — 💵 ' + it.preis.toLocaleString('de-DE') + ' Euro').join('\n')
        : '_Keine Items_';
      const total = cartTotal(cart);
      const cartInfo = cart.length
        ? '🛒 **Warenkorb:** ' + cart.map(c => c.name + ' x' + c.menge).join(', ') + '\n💰 **Gesamt:** ' + total.toLocaleString('de-DE') + ' Euro  •  💵 **Bargeld:** ' + cash.toLocaleString('de-DE') + ' Euro'
        : '🛒 Warenkorb leer  •  💵 **Bargeld:** ' + cash.toLocaleString('de-DE') + ' Euro';
      const embed = new EmbedBuilder()
        .setColor(m.color)
        .setAuthor({ name: 'Paradise City Roleplay  •  ' + m.name })
        .setTitle(m.emoji + '  ' + m.name)
        .setDescription('*' + m.desc + '*\n\n' + rows + '\n\n' + cartInfo)
        .setFooter({ text: 'Seite ' + (page+1) + '/' + totalPages + '  •  Paradise City Roleplay' });
      const pagePrev = new ButtonBuilder().setCustomId('sp_prev:' + page + ':' + shopId).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
      const pageNext = new ButtonBuilder().setCustomId('sp_next:' + page + ':' + shopId).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1);
      const buyBtn   = new ButtonBuilder().setCustomId('sp_buy:' + page + ':' + shopId).setLabel('💰 Kaufen').setStyle(ButtonStyle.Success).setDisabled(!cart.length);
      const clearBtn = new ButtonBuilder().setCustomId('sp_clear:' + page + ':' + shopId).setLabel('🗑️ Leeren').setStyle(ButtonStyle.Danger).setDisabled(!cart.length);
      const navRow   = new ActionRowBuilder().addComponents(pagePrev, pageNext, buyBtn, clearBtn);
      const selOpts  = pageItems.map(it => ({ label: it.name, description: it.preis.toLocaleString('de-DE') + ' Euro', value: it.name }));
      const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('sp_sel:' + page + ':' + shopId)
          .setPlaceholder('Item in den Warenkorb legen...')
          .addOptions(selOpts)
      );
      const components = [navRow, selectRow];
      if (cart.length) {
        const rmOpts = cart.map(c => ({ label: c.name + ' x' + c.menge, description: (c.preis * c.menge).toLocaleString('de-DE') + ' Euro', value: c.name }));
        components.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('sp_rm:' + page + ':' + shopId)
            .setPlaceholder('❌ Item aus Warenkorb entfernen...')
            .addOptions(rmOpts)
        ));
      }
      return { embed, components };
    }

    // ─── LOHNLISTE EMBED ────────────────────────────────────────────────────────
  async function updateLohnlisteEmbed(client) {
    const setup = loadSetup();
    const ch = await client.channels.fetch('1490890346668888194').catch(() => null);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0xE65100)
      .setTitle('💵 Lohnliste')
      .setDescription(
        '<@&1490855796932739093>\n**1\'000 $ Stündlich**\nDiese Lohnklasse ist für alle arbeitslosen Spieler/in die keinen Privaten oder Staatlichen Beruf ausüben.\n\n' +
        '<@&1490855789844234310>\n**3\'000 $ Stündlich**\nDiese Lohnklasse ist für alle Normal Angestellten von Staatlichen Unternehmen.\n\n' +
        '<@&1490855790913785886>\n**3\'600 $ Stündlich**\nDiese Lohnklasse ist für alle Angestellten mit einem Befehlsposten in Staatlichen Unternehmen.\n\n' +
        '<@&1490855791953973421>\n**4\'500 $ Stündlich**\nDiese Lohnklasse ist für alle die einen Posten in einer Leitungsebene haben in Staatlichen Unternehmen.\n\n' +
        '━━━━━━━━━━━━━━━━━━\nℹ️ **Lohn Info**\nSpieler/in die einen Privaten Beruf ausüben müssen vom Unternehmenschef Privat bezahlt werden. Der Anspruch auf Staatlichen Lohn oder Arbeitslosengeld fällt hier weg.'
      );
    if (setup.lohnlisteMsgId) {
      try {
        const msg = await ch.messages.fetch(setup.lohnlisteMsgId);
        await msg.edit({ embeds: [embed], components: [] });
        return;
      } catch {}
    }
    // Fallback: check channel for existing embed
    const msgs_lohnlisteMsgId = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs_lohnlisteMsgId) {
      const ex_lohnlisteMsgId = msgs_lohnlisteMsgId.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Lohnliste');
      });
      if (ex_lohnlisteMsgId) {
        await ex_lohnlisteMsgId.edit({ embeds: [embed], components: [] }).catch(() => {});
        setup.lohnlisteMsgId = ex_lohnlisteMsgId.id;
        saveSetup(setup);
        return;
      }
    }
    const sentL = await ch.send({ embeds: [embed], components: [] });
    setup.lohnlisteMsgId = sentL.id;
    saveSetup(setup);
  }

  // ─── LOHNBÜRO EMBED ─────────────────────────────────────────────────────────
  async function updateLohnbueroEmbed(client) {
    const setup = loadSetup();
    const ch = await client.channels.fetch('1490890348254200049').catch(() => null);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0xE65100)
      .setTitle('🏦 Lohnbüro')
      .setDescription('Drücke den Button um deinen stündlichen Lohn abzuholen.\nDu kannst deinen Lohn nur **einmal pro Stunde** abholen und nur wenn du eine gültige Lohnklassen-Rolle hast.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('lohn_abholen').setLabel('💵 Lohn abholen').setStyle(ButtonStyle.Success)
    );
    if (setup.lohnbueroMsgId) {
      try {
        const msg = await ch.messages.fetch(setup.lohnbueroMsgId);
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {}
    }
    // Fallback: check channel for existing embed
    const msgs_lohnbuero = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs_lohnbuero) {
      const ex_lohnbuero = msgs_lohnbuero.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Lohnbüro');
      });
      if (ex_lohnbuero) {
        await ex_lohnbuero.edit({ embeds: [embed], components: [row] }).catch(() => {});
        setup.lohnbueroMsgId = ex_lohnbuero.id;
        saveSetup(setup);
        return;
      }
    }
    const sentLB = await ch.send({ embeds: [embed], components: [row] });
    setup.lohnbueroMsgId = sentLB.id;
    saveSetup(setup);
  }

  // ─── ONLINE BANKING EMBED ────────────────────────────────────────────────────
  async function updateBankingEmbed(client) {
    const setup = loadSetup();
    const ch = await client.channels.fetch('1490890349382734044').catch(() => null);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0xE65100)
      .setTitle(`\u{1F3E7} Online Banking ${MONEY_GIF}`)
      .setDescription(
        `Klicke den Button um dein persönliches **Online-Banking** zu öffnen.\n` +
        `${MONEY_GIF} Bargeld- & Kontostand einsehen\n` +
        `${MONEY_GIF} Letzte Transaktionen\n` +
        `${MONEY_GIF} Ein-/Auszahlen & Überweisen\n\n` +
        '*Sicher. Schnell. Paradise City.*'
      )
      .setFooter({ text: 'Paradise City Roleplay • Banking System' }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('banking_open').setLabel('\u{1F3E7} Online Banking öffnen').setStyle(ButtonStyle.Primary)
    );
    if (setup.bankingMsgId) {
      try {
        const msg = await ch.messages.fetch(setup.bankingMsgId);
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {}
    }
    // Fallback: check channel for existing embed
    const msgs_bankingMsgId = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs_bankingMsgId) {
      const ex_bankingMsgId = msgs_bankingMsgId.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Online Banking');
      });
      if (ex_bankingMsgId) {
        await ex_bankingMsgId.edit({ embeds: [embed], components: [row] }).catch(() => {});
        setup.bankingMsgId = ex_bankingMsgId.id;
        saveSetup(setup);
        return;
      }
    }
    const sentB = await ch.send({ embeds: [embed], components: [row] });
    setup.bankingMsgId = sentB.id;
    saveSetup(setup);
  }

  // ─── RECHNUNGEN EMBED ───────────────────────────────────────────────────────
  async function updateRechnungenEmbed(client) {
    const setup = loadSetup();
    const ch = await client.channels.fetch('1492314171373649983').catch(() => null);
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setColor(0xE65100)
      .setTitle('🧾 Rechnungen')
      .setDescription('Klicke den Button um deine offenen Rechnungen einzusehen.\nDu kannst Rechnungen einzeln oder alle auf einmal bezahlen.');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rechnungen_open').setLabel('🧾 Rechnungen anzeigen').setStyle(ButtonStyle.Secondary)
    );
    if (setup.rechnungenMsgId) {
      try {
        const msg = await ch.messages.fetch(setup.rechnungenMsgId);
        await msg.edit({ embeds: [embed], components: [row] });
        return;
      } catch {}
    }
    // Fallback: check channel for existing embed
    const msgs_rechnungen = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs_rechnungen) {
      const ex_rechnungen = msgs_rechnungen.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('Rechnungen');
      });
      if (ex_rechnungen) {
        await ex_rechnungen.edit({ embeds: [embed], components: [row] }).catch(() => {});
        setup.rechnungenMsgId = ex_rechnungen.id;
        saveSetup(setup);
        return;
      }
    }
    const sentR = await ch.send({ embeds: [embed], components: [row] });
    setup.rechnungenMsgId = sentR.id;
    saveSetup(setup);
  }
  async function updateShopEmbed(shopId) {
      const m = SHOP_META[shopId];
      if (!m) return;
      const chId  = SHOP_CHANNELS[shopId];
      const ch = await client.channels.fetch(chId).catch(() => null);
      if (!ch) return;
      // Scan last 50 messages: if bot already sent shop embed here → skip
      const recent = await ch.messages.fetch({ limit: 50 }).catch(() => null);
      if (recent) {
        const exists = recent.find(msg =>
          msg.author.id === client.user.id &&
          msg.components.length > 0 &&
          msg.components[0]?.components?.[0]?.customId === 'sp_shop:' + shopId
        );
        if (exists) return;
      }
      // Not found → skip, never send new on restart
    }
  _shopCb = { updateShopEmbed, loadShops, saveShops, SHOP_META };

    const INV_FILE    = path.join(__dirname, 'data', 'inventar.json');
    const LAGER_FILE  = path.join(__dirname, 'data', 'lager.json');
    const ITEMS_FILE  = path.join(__dirname, 'data', 'shop_items.json');
    const INV_CH      = '1490882591023173682';
    const UEBERGABE_CH = '1490882592445304972';
    const USE_CH      = '1490882589014364250';
    const ITEMS_PER_PAGE = 10;
    function loadInv()    { try { return JSON.parse(fs.readFileSync(INV_FILE,   'utf8')); } catch { return {}; } }
    function saveInv(d)   { fs.writeFileSync(INV_FILE,   JSON.stringify(d, null, 2), 'utf8'); }
    function loadLager()  { try { return JSON.parse(fs.readFileSync(LAGER_FILE, 'utf8')); } catch { return {}; } }
    function saveLager(d) { fs.writeFileSync(LAGER_FILE, JSON.stringify(d, null, 2), 'utf8'); }
    function loadItems()  { try { return JSON.parse(fs.readFileSync(ITEMS_FILE, 'utf8')); } catch { return []; } }
    function saveItems(d) { fs.writeFileSync(ITEMS_FILE, JSON.stringify(d, null, 2), 'utf8'); }
    function getUserInv(userId)   { const d = loadInv();   return d[userId]   || {}; }
    function getUserLager(userId) { const d = loadLager(); return d[userId]   || {}; }
    function setUserInv(userId, items)   { const d = loadInv();   d[userId] = items;   saveInv(d); }
    function setUserLager(userId, items) { const d = loadLager(); d[userId] = items;   saveLager(d); }

    // ─── ITEM HELPER: kanonischen Shop-Namen per Fuzzy finden ────────────────
    function findShopItem(searchName) {
      const shops = loadShops();
      const allItems = Object.values(shops).flat().map(function(i) { return i.name; }).filter(Boolean);
      const q = (searchName || '').toLowerCase().trim();
      const exact = allItems.find(function(n) { return n.toLowerCase() === q; });
      if (exact) return exact;
      const contains = allItems.find(function(n) { return n.toLowerCase().includes(q); });
      if (contains) return contains;
      const partOf = allItems.find(function(n) { return q.includes(n.toLowerCase()); });
      if (partOf) return partOf;
      const words = q.split(/\s+/).filter(function(w) { return w.length > 2; });
      const wordMatch = allItems.find(function(n) {
        const nLow = n.toLowerCase();
        return words.some(function(w) { return nLow.includes(w); });
      });
      return wordMatch || searchName;
    }

    // ─── ITEM HELPER: Item im Inventar per Fuzzy finden ─────────────────────
    function findInvItem(inv, searchName) {
      const q = (searchName || '').toLowerCase().trim();
      const keys = Object.keys(inv);
      const exact = keys.find(function(k) { return k.toLowerCase() === q; });
      if (exact) return exact;
      const contains = keys.find(function(k) { return k.toLowerCase().includes(q); });
      if (contains) return contains;
      const partOf = keys.find(function(k) { return q.includes(k.toLowerCase()); });
      if (partOf) return partOf;
      const words = q.split(/\s+/).filter(function(w) { return w.length > 2; });
      return keys.find(function(k) {
        const kLow = k.toLowerCase();
        return words.some(function(w) { return kLow.includes(w); });
      }) || null;
    }
    // ─── END ITEM HELPERS ────────────────────────────────────────────────────
    function buildInvEmbed(targetUser, page, store) {
      const items = Object.entries(store);
      const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
      const pageItems  = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
      const rows = pageItems.length
        ? pageItems.map(([n,q],i) => `\`${(page*ITEMS_PER_PAGE+i+1).toString().padStart(2,'0')}\`  **${n}** — ${q}x`).join('\n')
        : '_Keine Items vorhanden_';
      return new EmbedBuilder()
        .setColor(0xE65100)
        .setTitle(`🎒  Rucksack von ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(rows)
        .setFooter({ text: `Seite ${page+1}/${totalPages}  •  ${items.length} Items gesamt  •  Paradise City Roleplay` });
    }
    function buildLagerEmbed(targetUser, page, store) {
      const items = Object.entries(store);
      const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
      const pageItems  = items.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
      const rows = pageItems.length
        ? pageItems.map(([n,q],i) => `\`${(page*ITEMS_PER_PAGE+i+1).toString().padStart(2,'0')}\`  **${n}** — ${q}x`).join('\n')
        : '_Lager ist leer_';
      return new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`🏪  Lager von ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .setDescription(rows)
        .setFooter({ text: `Seite ${page+1}/${totalPages}  •  ${items.length} Items gesamt  •  Paradise City Roleplay` });
    }
    function invPageButtons(page, totalPages, targetId, type) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`${type}_prev:${page}:${targetId}`).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`${type}_next:${page}:${targetId}`).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1)
      );
      return row;
    }
    function lagerActionButtons(page, targetId) {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lager_einlagern:${page}:${targetId}`).setLabel('📦 Items einlagern').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`lager_rucksack:${page}:${targetId}`).setLabel('🎒 In Rucksack legen').setStyle(ButtonStyle.Success)
      );
    }
  
  
  
  const TEAM_ROLE_IDS      = [
    '1490855647259136053','1490855648978669599','1498395437206601828','1498395500137807932',
    '1490855654347505706','1490855657543303239','1490855655408664577','1490855656352251987',
    '1496136847338770693','1490855659506372743','1490855661137956879','1490855664854106225',
    '1490855699282516100','1490855680708579389','1490855688208126095','1490855689424212110',
    '1490855690183381087','1492678578071146536','1492678644277969048','1490855692477923520',
    '1490855693786550404','1490855695363342358','1490855695912931329',
  ];
const AKTIVITAET_FILE    = path.join(DATA_DIR, 'aktivitaetscheck.json');
if (!fs.existsSync(AKTIVITAET_FILE)) fs.writeFileSync(AKTIVITAET_FILE, '{}', 'utf8');
function loadAktivitaet()  { try { return JSON.parse(fs.readFileSync(AKTIVITAET_FILE, 'utf8')); } catch { return {}; } }
function saveAktivitaet(d) { fs.writeFileSync(AKTIVITAET_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function buildAktivitaetEmbed(data) {
  const members = data.members || [];
  const count   = members.length;
  const names   = members.length > 0 ? members.map(m => '**' + m.tag + '**').join('\n') : '*Noch niemand hat abgestimmt.*';
  const bar     = count === 0 ? '░░░░░░░░░░░░░░░░░░░░' : '█'.repeat(Math.min(count, 20)) + '░'.repeat(Math.max(0, 20 - count));
  return new EmbedBuilder()
    .setColor(DARK_ORANGE)
    .setTitle('— AKTIVITÄTSCHECK —')
    .setDescription(
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      'Bist du derzeit auf **Paradise City Roleplay** aktiv?\n' +
      'Bestätige deine Aktivität mit einem ✅ unter dieser Nachricht!\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
    )
    .addFields(
      {
        name: '◈  AKTIVE MITGLIEDER  ◈',
        value: '```' + bar + '```' + '**' + count + '** Spieler ' + (count === 1 ? 'hat' : 'haben') + ' bestätigt',
        inline: false,
      },
      {
        name: '\u200b',
        value: names.length > 1024 ? names.slice(0, 1020) + '...' : names,
        inline: false,
      },
    )
    .setFooter({ text: 'Paradise City Roleplay  •  Aktivitätscheck  •  Reagiere mit ✅' })
    .setTimestamp(data.createdAt ? new Date(data.createdAt) : new Date());
}

function parseDuration(str) {
  const s = str.trim().toLowerCase();
  let ms = 0;
  const d = s.match(/(\d+)d/); if (d) ms += parseInt(d[1]) * 86400000;
  const h = s.match(/(\d+)h/); if (h) ms += parseInt(h[1]) * 3600000;
  const m = s.match(/(\d+)m/); if (m) ms += parseInt(m[1]) * 60000;
  return ms;
}
function formatDuration(ms) {
  const d = Math.floor(ms / 86400000); ms %= 86400000;
  const h = Math.floor(ms / 3600000);  ms %= 3600000;
  const m = Math.floor(ms / 60000);
  return [d && d+'d', h && h+'h', m && m+'m'].filter(Boolean).join(' ') || '< 1m';
}
function buildGiveawayEmbed(preis, endetAt, teilnehmer) {
  const endetTs = Math.floor(endetAt / 1000);
  return new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('\uD83C\uDF89  \u2501\u2501\u2501  G I V E A W A Y  \u2501\u2501\u2501  \uD83C\uDF89')
    .setDescription(
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
      '**Reagiere mit \uD83C\uDF89 um teilzunehmen!**\n' +
      '*(Nur Mitglieder mit der B\u00FCrger-Rolle werden ausgelost)*\n' +
      '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'
    )
    .addFields(
      { name: '\uD83C\uDFC6  PREIS',      value: '```' + preis + '```', inline: false },
      { name: '\u23F3  ENDET',       value: '<t:' + endetTs + ':R> \u2022 <t:' + endetTs + ':f>', inline: false },
      { name: '\uD83C\uDF9F\uFE0F  TEILNEHMER', value: '**' + teilnehmer + '** Personen nehmen teil', inline: false },
    )
    .setFooter({ text: 'Paradise City Roleplay  \u2022  Giveaway  \u2022  Reagiere mit \uD83C\uDF89' })
    .setTimestamp();
}
const activeGiveaways = new Map();

function makeCode()     { return Math.random().toString(36).toUpperCase().slice(2, 8); }

function loadWarns()    { try { return JSON.parse(fs.readFileSync(WARN_FILE,    'utf8')); } catch { return {}; } }
function saveWarns(d)   { fs.writeFileSync(WARN_FILE,    JSON.stringify(d, null, 2), 'utf8'); }
function loadPlayerWarns() { try { return JSON.parse(fs.readFileSync(PLAYER_WARN_FILE, 'utf8')); } catch { return {}; } }
function savePlayerWarns(d) { fs.writeFileSync(PLAYER_WARN_FILE, JSON.stringify(d, null, 2), 'utf8'); }
const PLAYER_WARN_ROLES = ['1490855747192361000','1490855745842053221','1490855744868716695','1490855743610552491','1490855743015092405'];
const PLAYER_WARN_CH    = '1491113577258684466';
function loadInvites()  { try { return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8')); } catch { return {}; } }
function saveInvites(d) { fs.writeFileSync(INVITES_FILE, JSON.stringify(d, null, 2), 'utf8'); }
function loadSetup()    { try { return JSON.parse(fs.readFileSync(SETUP_FILE,   'utf8')); } catch { return {}; } }
function saveSetup(d)   { fs.writeFileSync(SETUP_FILE,   JSON.stringify(d, null, 2), 'utf8'); }

const inviteCache = new Map();

// ─── Kanal-IDs ───────────────────────────────────────────────────────────────
const CH = {
  ACTIVITY:    '1497385121324732567',
  SERVER_LOG:  '1490878131240829028',
  MOD_LOG:     '1490878132230819840',
  RESTART_LOG: '1490878133279264842',
  MEMBER_LOG:  '1490878134847930368',
  MSG_LOG:     '1490878135837917234',
  ROLE_LOG:    '1490878137385619598',
  TEAM_WARN:   '1490878144146833450',
  WELCOME:     '1490878151897911557',
  GOODBYE:     '1490878154733260951',
  INVITE_LOG:  '1490878153391083683',
  LINK_CHANNEL: '1490882578276810924',
};

const DARK_ORANGE = 0xE65100;

// Entfernt custom Discord Emojis (<:name:id> und <a:name:id>) aus Text für Anzeige
function stripCustomEmoji(text) {
  const cleaned = text.replace(/<a?:[^:]+:\d+>/g, '').replace(/^\s*\|\s*/, '').trim();
  return cleaned.length > 0 ? cleaned : text.trim();
}

// Rollen die von ALLEN Filterregeln ausgenommen sind
const EXEMPT_ROLE = '1490855646558556282';

// Rollen die Links senden dürfen (zusätzlich zu EXEMPT_ROLE)
const LINK_EXEMPT_ROLES = ['1490855702225485936', '1490855703370534965'];

// Discord-Invite Regex

// ─── Ticket-System ────────────────────────────────────────────────────────────
const TICKET_TRANSCRIPT_CH = '1490878139306606743';
const TICKET_RATING_CH     = '1491788506404491336';
const TICKET_PANEL_CH      = '1490885002030874775';

// ─── LAPD-System Konstanten ───────────────────────────────────────────────────
const LAPD_GUILD_ID        = '1498482541751963698';
const LAPD_JOIN_CH         = '1498488683962040431';
const LAPD_LEAVE_CH        = '1498488790212284556';
const LAPD_TICKET_PANEL_CH = '1498489823386669117';
const LAPD_TICKET_OPEN_CAT = '1498487711827234968';
const LAPD_TEAM_CH         = '1498489577386545182';
const LAPD_ROLE_IDS        = ['1498483561982984212','1498484038363648121','1498484537368510504','1498484869863444660'];
const LAPD_ROLE_NAMES      = { '1498483561982984212':'Command Staff (Leitung)', '1498484038363648121':'Supervisory Staff', '1498484537368510504':'Detective Division', '1498484869863444660':'Officer Division' };
const LAPD_TICKET_TYPES    = {
  email:      { label: '✉️ E-Mail Schreiben',       roles: ['1498483561982984212','1498484038363648121','1498484537368510504','1498484869863444660'] },
  anzeige:    { label: '📋 Anzeige Erstatten',      roles: ['1498483561982984212','1498484038363648121','1498484537368510504','1498484869863444660'] },
  beschwerde: { label: '⚠️ Beschwerde Einreichen', roles: ['1498483561982984212','1498484038363648121'] },
  bewerbung:  { label: '📝 Bewerbung',              roles: ['1498483561982984212','1498484038363648121'] },
};

const TICKETS_FILE         = path.join(DATA_DIR, 'tickets.json');
if (!fs.existsSync(TICKETS_FILE)) fs.writeFileSync(TICKETS_FILE, '{}', 'utf8');
function loadTickets()  { try { return JSON.parse(fs.readFileSync(TICKETS_FILE, 'utf8')); } catch { return {}; } }
function saveTickets(d) { fs.writeFileSync(TICKETS_FILE, JSON.stringify(d, null, 2), 'utf8'); }

const TICKET_TYPES = {
  support:    { label: '🎫 Support / Anliegen', category: '1490882554570608751', roles: ['1490855703370534965','1490855702225485936'], pingRoles: [] },
  beschwerde: { label: '📋 Beschwerde',          category: '1490882554570608751', roles: ['1490855703370534965','1490855702225485936'], pingRoles: [] },
  sc_crew:    { label: '👥 SC Crew Anfrage',     category: '1490882554570608751', roles: ['1490855703370534965','1490855702225485936'], pingRoles: ['1490855712627233032'] },
  highteam:   { label: '⭐ Highteam Ticket',     category: '1491069210389119016', roles: ['1490855702225485936'],                      pingRoles: [] },
  fraktion:   { label: '⚔️ Fraktions Ticket',   category: '1491069425384685750', roles: ['1490855704293277898'],                      pingRoles: [] },
  bewerbung:  { label: '📝 Team Bewerbung',      category: '1490882554570608751', roles: ['1490855702225485936'],                      pingRoles: [] },
};

function hasTicketRights(member, type) {
  if (!member || !TICKET_TYPES[type]) return false;
  return TICKET_TYPES[type].roles.some(r => member.roles.cache.has(r)) ||
         member.permissions.has(PermissionFlagsBits.Administrator);
}

async function generateTranscript(channel) {
  const msgs = [];
  let lastId;
  while (true) {
    const fetched = await channel.messages.fetch({ limit: 100, ...(lastId ? { before: lastId } : {}) });
    if (!fetched.size) break;
    msgs.push(...fetched.values());
    lastId = fetched.last().id;
    if (fetched.size < 100) break;
  }
  msgs.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  return msgs.map(m =>
    `[${new Date(m.createdTimestamp).toLocaleString('de-DE')}] ${m.author.tag}: ${m.content || (m.embeds.length ? '[Embed]' : '[Anhang]')}`
  ).join('\n');
}

const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9\-]+/gi;
// Normaler Link Regex (http/https)
const URL_REGEX = /https?:\/\/[^\s]+/gi;

const spamTracker             = new Map();
const SPAM_LIMIT              = 10;
const SPAM_WINDOW_MS          = 6000;
const SPAM_TIMEOUT_VIOLATIONS = 3;
const SPAM_TIMEOUT_DURATION   = 10 * 60 * 1000;

// ─── Client ──────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildIntegrations,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.Reaction],
});

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function isExempt(member) {
  return member?.roles?.cache?.has(EXEMPT_ROLE) ||
         member?.permissions?.has(PermissionFlagsBits.Administrator);
}

function isLinkExempt(member) {
  if (isExempt(member)) return true;
  return LINK_EXEMPT_ROLES.some(r => member?.roles?.cache?.has(r));
}

async function sendLog(channelId, embed) {
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error(`Log-Kanal ${channelId}:`, e.message); }
}

async function getAuditEntry(guild, actionType, delay = 1500) {
  await new Promise(r => setTimeout(r, delay));
  try {
    const logs = await guild.fetchAuditLogs({ type: actionType, limit: 1 });
    return logs.entries.first();
  } catch { return null; }
}

function ts(date = new Date()) {
  return Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Sendet eine Nachricht die nur der Nutzer sieht:
// Versucht erst DM, fällt auf kurze Kanal-Nachricht zurück
async function sendPrivate(member, channel, content) {
  try {
    await member.send({ content });
  } catch {
    // DMs deaktiviert → Kanal-Nachricht die nach 6s verschwindet
    const msg = await channel.send({ content: `<@${member.id}> ${content}` });
    setTimeout(() => msg.delete().catch(() => {}), 6000);
  }
}

// ─── Invite-Cache ─────────────────────────────────────────────────────────────
async function buildInviteCache(guild) {
  try {
    const fetched = await guild.invites.fetch();
    const map = new Map();
    for (const inv of fetched.values()) {
      map.set(inv.code, {
        uses:       inv.uses ?? 0,
        inviterId:  inv.inviter?.id  ?? null,
        inviterTag: inv.inviter?.tag ?? 'Unbekannt',
      });
    }
    inviteCache.set(guild.id, map);
    return map;
  } catch (e) {
    console.error(`Invite-Cache (${guild.name}):`, e.message);
    return new Map();
  }
}

// ─── READY ───────────────────────────────────────────────────────────────────
// ─── FRAKTIONEN ÜBERSICHT ────────────────────────────────────────────────────
  async function updateFrakEmbed() {
    try {
      const data = loadFraktionen();
      const names = Object.keys(data);
      const legal    = names.filter(n => data[n].typ === 'Legal');
      const illegal  = names.filter(n => data[n].typ === 'Illegal');

      function frakLine(name) {
        const f = data[name];
        const warnBadge  = f.warns?.length
          ? (f.warns.length >= 3 ? `🔴 **${f.warns.length} Warns**` : `🟡 ${f.warns.length} Warn(s)`)
          : '';
        const sperrBadge = f.gesperrt ? '🔒 **GESPERRT**' : '';
        const badges = [warnBadge, sperrBadge].filter(Boolean);
        const status  = badges.length ? ` — ${badges.join('  ')}` : ` — ✅ Aktiv`;
        return `╰ **${name}**${status}`;
      }

      const legalBlock   = legal.length   ? legal.map(frakLine).join('\n')   : '_Keine_';
      const illegalBlock = illegal.length ? illegal.map(frakLine).join('\n') : '_Keine_';
      const totalWarns  = names.reduce((s,n) => s + (data[n].warns?.length||0), 0);
      const totalSperrt = names.filter(n => data[n].gesperrt).length;

      const embed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🏙️  Fraktionsübersicht — Paradise City Roleplay')
        .setDescription(
          `> Alle registrierten Fraktionen auf **Paradise City Roleplay**\n` +
          `> ─────────────────────────────────────\n` +
          `> 📂 Gesamt: **${names.length}**  ·  🟢 Legal: **${legal.length}**  ·  🔴 Illegal: **${illegal.length}**\n` +
          `> ⚠️ Offene Warns: **${totalWarns}**  ·  🔒 Gesperrt: **${totalSperrt}**`
        )
        .addFields(
          { name: '🟢  Legale Fraktionen', value: legalBlock, inline: false },
          { name: '🔴  Illegale Fraktionen', value: illegalBlock, inline: false }
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Fraktionsverwaltung  |  Zuletzt aktualisiert' })
        .setTimestamp();

      const setup = loadSetup();
      const ch = await client.channels.fetch(FRAK_OVERVIEW_CH).catch(() => null);
      if (!ch) return;
      if (setup.frakOverviewMsgId) {
        const msg = await ch.messages.fetch(setup.frakOverviewMsgId).catch(() => null);
        if (msg) { await msg.edit({ embeds: [embed] }); return; }
      }
      const sent = await ch.send({ embeds: [embed] });
      setup.frakOverviewMsgId = sent.id;
      saveSetup(setup);
    } catch (e) { console.error('[Frak-Embed] Fehler:', e.message); }
  }

  // ─── TEAM ÜBERSICHT ──────────────────────────────────────────────────────────
  async function updateTeamEmbed(guild) {
    try {
      await guild.members.fetch();
      const fields = [];
      for (const roleId of TEAM_ROLE_IDS) {
        const role = guild.roles.cache.get(roleId);
        if (!role) continue;
        const members = role.members.map(m => m.toString());
        if (members.length === 0) {
          fields.push({ name: `${role.name} [0]`, value: '_Nicht besetzt_', inline: true });
          continue;
        }
        const chunks = [];
        for (let i = 0; i < members.length; i += 10) chunks.push(members.slice(i, i + 10));
        chunks.forEach((chunk, ci) => {
          fields.push({
            name: ci === 0 ? `${role.name} [${members.length}]` : `​`,
            value: chunk.join('\n'),
            inline: true,
          });
        });
      }
      const totalTeam = [...new Set(
        TEAM_ROLE_IDS.flatMap(id => (guild.roles.cache.get(id)?.members.map(m => m.id) ?? []))
      )].length;
      const embed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('👥  Team Übersicht — Paradise City Roleplay')
        .setDescription(
          `Hier siehst du alle aktuellen **Teammitglieder** von Paradise City Roleplay.\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `👤 **Gesamte Teammitglieder:** ${totalTeam}`
        )
        .addFields(fields.length ? fields : [{ name: 'Keine Einträge', value: 'Noch keine Teammitglieder.' }])
        .setFooter({ text: 'Paradise City Roleplay  •  Team' })
        .setTimestamp();
      const setup = loadSetup();
      const ch = await client.channels.fetch(TEAM_OVERVIEW_CH).catch(() => null);
      if (!ch) return;
      if (setup.teamOverviewMsgId) {
        const msg = await ch.messages.fetch(setup.teamOverviewMsgId).catch(() => null);
        if (msg) { await msg.edit({ embeds: [embed] }); return; }
      }
      const sent = await ch.send({ embeds: [embed] });
      setup.teamOverviewMsgId = sent.id;
      saveSetup(setup);
    } catch (e) { console.error('[Team-Embed] Fehler:', e.message); }
  }

  // ─── LAPD Team-Übersicht aktualisieren ──────────────────────────────────────
async function updateLapdTeamOverview() {
  try {
    const guild = await client.guilds.fetch(LAPD_GUILD_ID).catch(() => null);
    if (!guild) return;
    await guild.members.fetch();
    const fields = [];
    for (const roleId of LAPD_ROLE_IDS) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      const members = role.members.filter(m => !m.user.bot)
        .sort((a,b) => (a.displayName||a.user.username).localeCompare(b.displayName||b.user.username));
      if (!members.size) continue;
      const list = members.map(m => `• ${m.displayName || m.user.username}`).join('\n');
      const chunks = [];
      let cur = '';
      for (const line of list.split('\n')) {
        if ((cur + '\n' + line).length > 1000) { chunks.push(cur); cur = line; }
        else cur = cur ? cur + '\n' + line : line;
      }
      if (cur) chunks.push(cur);
      chunks.forEach((chunk, ci) => {
        fields.push({ name: ci === 0 ? `${LAPD_ROLE_NAMES[roleId] || role.name} [${members.size}]` : '​', value: chunk, inline: false });
      });
    }
    const total = [...new Set(LAPD_ROLE_IDS.flatMap(id => (guild.roles.cache.get(id)?.members.filter(m=>!m.user.bot).map(m=>m.id) ?? [])))].length;
    const embed = new EmbedBuilder()
      .setColor(0x1F51FF)
      .setTitle('👮 LAPD Team — Übersicht')
      .setDescription(
        'Alle aktuellen Mitglieder des **Los Angeles Police Department**\n'
        + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
        + `👤 **Mitglieder gesamt:** ${total}`
      )
      .addFields(fields.length ? fields : [{ name: 'Keine Einträge', value: 'Noch keine LAPD-Mitglieder mit Rolle.' }])
      .setFooter({ text: 'LAPD System  •  Paradise City Roleplay  •  Echtzeit-Aktualisierung' })
      .setTimestamp();
    const setup = loadSetup();
    const ch = await client.channels.fetch(LAPD_TEAM_CH).catch(() => null);
    if (!ch) return;
    if (setup.lapdTeamMsgId) {
      const msg = await ch.messages.fetch(setup.lapdTeamMsgId).catch(() => null);
      if (msg) { await msg.edit({ embeds: [embed] }); return; }
    }
    const sent = await ch.send({ embeds: [embed] });
    setup.lapdTeamMsgId = sent.id;
    saveSetup(setup);
  } catch (e) { console.error('[LAPD Team-Embed] Fehler:', e.message); }
}


// ── Firmen-Auslastung Live Embed ─────────────────────────────────────────────
const FIRMEN_AUSLASTUNG_CH  = '1490890354638192803';
const FIRMEN_ROLE_IDS = [
  '1490855751797969039',
  '1490855752712327210',
  '1490855754213753024',
  '1490855758051409930',
  '1490855756327686214',
];
const FIRMEN_MAX_MEMBERS = 20;

function makeFirmenBar(count, max) {
  const pct    = Math.min(100, Math.round((count / max) * 100));
  const filled = Math.round(pct / 10);
  const empty  = 10 - filled;
  const bar    = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
  const icon   = pct >= 80 ? '\uD83D\uDD34' : pct >= 50 ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
  return icon + ' `' + bar + '` **' + count + '/' + max + '** (' + pct + '%)';
}

async function updateFirmenEmbed(client) {
  try {
    const guild = client.guilds.cache.first();
    if (!guild) return;
    await guild.members.fetch();
    const ch = await client.channels.fetch(FIRMEN_AUSLASTUNG_CH);
    if (!ch) return;
    const fields = [];
    for (const roleId of FIRMEN_ROLE_IDS) {
      const role = guild.roles.cache.get(roleId);
      if (!role) continue;
      const count = role.members.size;
      fields.push({ name: '\uD83C\uDFE2 ' + role.name, value: makeFirmenBar(count, FIRMEN_MAX_MEMBERS), inline: false });
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const embed = new EmbedBuilder()
      .setTitle('\uD83C\uDFE2 Firmen-Auslastung \u2014 Paradise City')
      .setDescription('Echtzeit-\u00dcbersicht der aktiven Mitarbeiter in allen Firmen')
      .addFields(fields)
      .setColor(0x5865F2)
      .setFooter({ text: 'Zuletzt aktualisiert: ' + timeStr + ' Uhr  \u2022  Alle 60 Sekunden' })
      .setTimestamp();
    const setupF = loadSetup();
    if (!setupF.firmenEmbedMsgId) {
      const msg = await ch.send({ embeds: [embed] });
      setupF.firmenEmbedMsgId = msg.id;
      saveSetup(setupF);
    } else {
      try {
        const msg = await ch.messages.fetch(setupF.firmenEmbedMsgId);
        await msg.edit({ embeds: [embed] });
      } catch (_) {
        const msg = await ch.send({ embeds: [embed] });
        setupF.firmenEmbedMsgId = msg.id;
        saveSetup(setupF);
      }
    }
  } catch (e) {
    console.error('[FIRMEN EMBED]', e.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: 'Paradise City Roleplay | PS5', type: ActivityType.Playing }], status: 'online' });
  // ─── EINMALIG: Team-Overview-Embed neu senden (v_paradise_4) ───────────────
  {
    const setup = loadSetup();
    if (setup.globalEmbedVersion !== 'v_paradise_4') {
      delete setup.teamOverviewMsgId;
      setup.globalEmbedVersion = 'v_paradise_4';
      saveSetup(setup);
      console.log('[FIX] Team-Overview-Embed wird neu gesendet.');
    }
  }
  // ─── END EINMALIG ────────────────────────────────────────────────────────

  initAktien();
  // ─── Stündliche Aktienkurse aktualisieren ─────────────────────────────────
  setInterval(() => { updateAktienPrices().catch(e => console.error('[AKTIEN INTERVAL]', e.message)); }, 60 * 60 * 1000);
  // ─── Stündliche DarkCoin-Kurse aktualisieren ─────────────────────────────
  setInterval(() => { updateKryptoRate().catch(e => console.error('[KRYPTO INTERVAL]', e.message)); }, 60 * 60 * 1000);
  setTimeout(() => { updateKryptoRate().catch(e => console.error('[KRYPTO START]', e.message)); }, 8000);
  // ─── Firmen-Auslastung: Start + alle 60s ────────────────────────────────────
  setTimeout(() => { updateFirmenEmbed(client).catch(e => console.error('[FIRMEN START]', e.message)); }, 6000);
  setInterval(() => { updateFirmenEmbed(client).catch(e => console.error('[FIRMEN INTERVAL]', e.message)); }, 60 * 1000);


  // ─── AUTO: Krypto-Embeds beim Start senden (channel-check) ──────────────
  setTimeout(async () => {
    try {
      const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
      const rateData = loadKryptoRate();

      // Hilfsfunktion: prueft ob Bot-Embed mit diesem Titel bereits im Channel ist
      async function embedExistsInChannel(ch, titleFragment) {
        try {
          const msgs = await ch.messages.fetch({ limit: 20 });
          return msgs.some(function(m) {
            return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes(titleFragment);
          });
        } catch (e2) { return false; }
      }

      // Channel 1: Wallet
      const ch1 = await client.channels.fetch(KRYPTO_WALLET_CH).catch(function() { return null; });
      if (ch1) {
        const exists1 = await embedExistsInChannel(ch1, 'PC Coin — Mein Wallet');
        if (!exists1) {
          const embed1 = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('" + PC_EMOJI + " PC Coin — Mein Wallet')
            .setDescription('Sieh dein persönliches PC Coin-Guthaben ein und überweise <:emoji_29:1507071093540782110> an andere Spieler.\n\nKlicke auf den Button um dein Wallet zu sehen.')
            .addFields(
              { name: '💡 Was ist PC Coin?', value: 'Die Kryptowährung von Paradise City. Überweise <:emoji_29:1507071093540782110> direkt an andere Spieler.', inline: false },
              { name: '🔒 Sicherheit', value: 'Dein Wallet ist nur für dich sichtbar.', inline: true }
            )
            .setFooter({ text: 'Paradise City • PC Coin System' }).setTimestamp();
          const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('krypto_wallet').setLabel('💰 Wallet öffnen').setStyle(ButtonStyle.Primary)
          );
          await ch1.send({ embeds: [embed1], components: [row1] }).catch(function(e) { console.error('[KRYPTO EMBED W]', e.message); });
          console.log('[KRYPTO] Wallet-Embed gesendet.');
        } else {
          console.log('[KRYPTO] Wallet-Embed bereits vorhanden, übersprungen.');
        }
      }

      // Channel 2: Tauschbörse
      const ch2 = await client.channels.fetch(KRYPTO_EXCH_CH).catch(function() { return null; });
      if (ch2) {
        const exists2 = await embedExistsInChannel(ch2, 'PC Coin — Tauschbörse');
        if (!exists2) {
          const embed2 = new EmbedBuilder()
            .setColor(0xf59e0b)
            .setTitle('⚖️ PC Coin — Tauschbörse')
            .setDescription('Tausche dein Bankgeld in PC Coin um — oder verkaufe deine <:emoji_29:1507071093540782110> zurück in Bankgeld.')
            .addFields(
              { name: '📈 Aktueller Kurs', value: '1 <:emoji_29:1507071093540782110> = **' + rateData.rate.toLocaleString('de-DE') + ' $**', inline: true },
              { name: '🏦 Bankgeld → PC Coin', value: 'Kaufe PC Coin mit deinem Bankkonto', inline: true },
              { name: '💱 PC Coin → Bankgeld', value: 'Verkaufe PC Coin zurück in Bankgeld', inline: true }
            )
            .setFooter({ text: 'Paradise City • PC Coin System • Kurse aktualisieren stündlich' }).setTimestamp();
          const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('krypto_exchange').setLabel('⚖️ Tauschbörse öffnen').setStyle(ButtonStyle.Primary)
          );
          await ch2.send({ embeds: [embed2], components: [row2] }).catch(function(e) { console.error('[KRYPTO EMBED E]', e.message); });
          console.log('[KRYPTO] Tauschbörse-Embed gesendet.');
        } else {
          console.log('[KRYPTO] Tauschbörse-Embed bereits vorhanden, übersprungen.');
        }
      }

      // Channel 3: Kurse (wird von updateKryptoRate() befüllt)

    } catch (e) { console.error('[KRYPTO AUTO-EMBED]', e.message); }
  }, 12000);
  // ─── END AUTO Krypto-Embeds ───────────────────────────────────────────────
  // Sofort beim Start einmal senden (5s Verzögerung damit alle Channels geladen sind)
  setTimeout(() => { updateAktienPrices().catch(e => console.error('[AKTIEN START]', e.message)); }, 5000);

  for (const guild of client.guilds.cache.values()) {
    await buildInviteCache(guild);
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('delete')
      .setDescription('Löscht Nachrichten in diesem Kanal (max. 200)')
      .addIntegerOption(opt =>
        opt.setName('anzahl').setDescription('Anzahl (1–200)').setRequired(true).setMinValue(1).setMaxValue(200))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn')
      .setDescription('Erteilt einem Teammitglied eine offizielle Team Warn')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund').setRequired(true))
      .addStringOption(opt => opt.setName('konsequenz').setDescription('Konsequenz').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-remove')
      .setDescription('Entfernt die letzte Team Warn eines Teammitglieds')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-list')
      .setDescription('Zeigt alle Team Warns eines Nutzers')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .toJSON(),

      new SlashCommandBuilder()
        .setName('einreise-code')
        .setDescription('Generiert deinen persönlichen Einreise-Code für das Webformular')
        .toJSON(),

      new SlashCommandBuilder()
        .setName('ausweis')
        .setDescription('Zeigt einen Ausweis an (eigener oder einer anderen Person)')
        .addUserOption(opt => opt.setName('person').setDescription('Person (optional — leer lassen für eigenen Ausweis)').setRequired(false))
        .toJSON(),

    new SlashCommandBuilder()
      .setName('abstimmung')
      .setDescription('Erstellt eine neue Abstimmung im Abstimmungs-Kanal')
      .addStringOption(opt => opt.setName('frage').setDescription('Die Abstimmungsfrage').setRequired(true))
      .addStringOption(opt => opt.setName('antwort1').setDescription('Erste Option (\uD83D\uDC4D Daumen hoch)').setRequired(true))
      .addStringOption(opt => opt.setName('antwort2').setDescription('Zweite Option (\uD83D\uDC4E Daumen runter)').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ausweis-create')
      .setDescription('Erstellt einen Ausweis-Erstellungslink und sendet ihn per DM')
      .addUserOption(opt => opt.setName('mitglied').setDescription('Für welches Mitglied den Ausweis erstellen').setRequired(true))
      .addStringOption(o => o.setName('einreiseart').setDescription('Legal oder Illegal').setRequired(true)
        .addChoices({ name: 'Legal', value: 'legal' }, { name: 'Illegal', value: 'illegal' }))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ausweis-delete')
      .setDescription('Löscht den Ausweis eines Mitglieds')
      .addUserOption(opt => opt.setName('mitglied').setDescription('Mitglied dessen Ausweis gelöscht werden soll').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fuehrerschein-create')
      .setDescription('Erstellt einen Führerschein-Link für ein Mitglied')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('mitglied').setDescription('Für wen?').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fuehrerschein')
      .setDescription('Ruft den eigenen Führerschein ab (nur im Führerschein-Kanal)')
      .addUserOption(o => o.setName('person').setDescription('Person (optional)').setRequired(false))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fuehrerschein-delete')
      .setDescription('Löscht den Führerschein eines Mitglieds')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('mitglied').setDescription('Mitglied').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fuehrerschein-edit')
      .setDescription('Öffnet den Dashboard-Link zum Bearbeiten des Führerscheins')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addUserOption(o => o.setName('mitglied').setDescription('Mitglied').setRequired(true))
      .toJSON(),



    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Erteilt einem Spieler eine Verwarnung')
      .addUserOption(opt => opt.setName('spieler').setDescription('Welcher Spieler?').setRequired(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund der Verwarnung').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warn-remove')
      .setDescription('Entfernt einen bestimmten Warn eines Spielers')
      .addUserOption(opt => opt.setName('spieler').setDescription('Welcher Spieler?').setRequired(true))
      .addIntegerOption(opt => opt.setName('nummer').setDescription('Welche Warn-Nummer entfernen? (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('warnlist')
      .setDescription('Zeigt die Warn-Liste eines Spielers')
      .addUserOption(opt => opt.setName('spieler').setDescription('Welcher Spieler?').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Startet ein Giveaway im Event-Kanal')
      .addStringOption(opt => opt.setName('preis').setDescription('Was wird verlost?').setRequired(true))
      .addStringOption(opt => opt.setName('dauer').setDescription('Dauer z.B. 1h, 30m, 1d').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
        .setName('event')
        .setDescription('Sendet ein Event-Embed in den Event-Kanal')
        .addStringOption(opt => opt.setName('was').setDescription('Was ist das Event?').setRequired(true))
        .addStringOption(opt => opt.setName('wann').setDescription('Wann findet das Event statt?').setRequired(true))
        .addStringOption(opt => opt.setName('preis').setDescription('Preis / Belohnung').setRequired(true))
        .toJSON(),
      new SlashCommandBuilder()
      .setName('aktivit\u00e4tscheck')
      .setDescription('Startet einen Aktivit\u00e4tscheck im zugeh\u00f6rigen Kanal')
      .toJSON(),


    new SlashCommandBuilder()
      .setName('frakadd')
      .setDescription('Fügt eine neue Fraktion hinzu')
      .addStringOption(opt => opt.setName('name').setDescription('Name der Fraktion').setRequired(true))
      .addStringOption(opt => opt.setName('typ').setDescription('Legal oder Illegal').setRequired(true)
        .addChoices({ name: 'Legal', value: 'Legal' }, { name: 'Illegal', value: 'Illegal' }))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('frak-delete')
      .setDescription('Löscht eine Fraktion')
      .addStringOption(opt => opt.setName('name').setDescription('Name der Fraktion').setRequired(true).setAutocomplete(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('frakwarn')
      .setDescription('Erteilt einer Fraktion eine Verwarnung')
      .addStringOption(opt => opt.setName('fraktion').setDescription('Name der Fraktion').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund der Verwarnung').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('frakwarn-remove')
      .setDescription('Entfernt die letzte Verwarnung einer Fraktion')
      .addStringOption(opt => opt.setName('fraktion').setDescription('Name der Fraktion').setRequired(true).setAutocomplete(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fraksperre')
      .setDescription('Sperrt eine Fraktion')
      .addStringOption(opt => opt.setName('fraktion').setDescription('Name der Fraktion').setRequired(true).setAutocomplete(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund der Sperre').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fraksperre-remove')
      .setDescription('Hebt die Sperre einer Fraktion auf')
      .addStringOption(opt => opt.setName('fraktion').setDescription('Name der Fraktion').setRequired(true).setAutocomplete(true))
      .toJSON(),

      new SlashCommandBuilder()
        .setName('vorschlag')
        .setDescription('Sendet einen Vorschlag in den Vorschläge-Kanal')
        .addStringOption(opt => opt.setName('text').setDescription('Dein Vorschlag').setRequired(true))
        .toJSON(),


    new SlashCommandBuilder()
      .setName('krypto-setup')
      .setDescription('Sendet die DarkCoin-Embeds in die entsprechenden Kanäle')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('darknet-setup')
      .setDescription('Aktualisiert das Darknet-Embed im Darknet-Kanal (Admin)')
      .toJSON(),

      new SlashCommandBuilder()
        .setName('vorschlag-yes')
        .setDescription('Nimmt einen Vorschlag an')
        .addStringOption(opt => opt.setName('id').setDescription('Vorschlag auswählen').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('grund').setDescription('Begründung (optional)').setRequired(false))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('vorschlag-no')
        .setDescription('Lehnt einen Vorschlag ab')
        .addStringOption(opt => opt.setName('id').setDescription('Vorschlag auswählen').setRequired(true).setAutocomplete(true))
        .addStringOption(opt => opt.setName('grund').setDescription('Begründung (optional)').setRequired(false))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('lobby-abstimmung')
        .setDescription('Startet eine Lobby-Abstimmung')
        .addStringOption(opt => opt.setName('rp-start').setDescription('Wann startet der RP? (z.B. 20:30 Uhr)').setRequired(true))
        .toJSON(),

    new SlashCommandBuilder()
      .setName('lobby-open')
      .setDescription('Öffnet die Lobby')
      .toJSON(),

    new SlashCommandBuilder()
      .setName('lobby-close')
      .setDescription('Schließt die Lobby')
      .toJSON(),

      new SlashCommandBuilder()
        .setName('rucksack')
        .setDescription('Zeigt dein Inventar an')
        .addUserOption(opt => opt.setName('spieler').setDescription('Inventar eines anderen Spielers').setRequired(false))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('übergeben')
        .setDescription('Übergibt Items an einen anderen Spieler')
        .addStringOption(opt => opt.setName('item').setDescription('Item aus deinem Inventar').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('menge').setDescription('Menge').setRequired(true).setMinValue(1))
        .addUserOption(opt => opt.setName('an-wen').setDescription('Empfänger').setRequired(true))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('use')
        .setDescription('Verbraucht ein Item aus deinem Inventar')
        .addStringOption(opt => opt.setName('item').setDescription('Item aus deinem Inventar').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('menge').setDescription('Menge').setRequired(true).setMinValue(1))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('item-give')
        .setDescription('Gibt einem Spieler Items')
        .addUserOption(opt => opt.setName('spieler').setDescription('Spieler').setRequired(true))
        .addStringOption(opt => opt.setName('item').setDescription('Item-Name').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('menge').setDescription('Menge').setRequired(true).setMinValue(1))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('item-remove')
        .setDescription('Nimmt einem Spieler Items weg')
        .addUserOption(opt => opt.setName('spieler').setDescription('Spieler').setRequired(true))
        .addStringOption(opt => opt.setName('item').setDescription('Item-Name').setRequired(true).setAutocomplete(true))
        .addIntegerOption(opt => opt.setName('menge').setDescription('Menge').setRequired(true).setMinValue(1))
        .toJSON(),

      new SlashCommandBuilder()
        .setName('lager')
        .setDescription('Zeigt dein Lager an')
        .addUserOption(opt => opt.setName('spieler').setDescription('Lager eines anderen Spielers').setRequired(false))
        .toJSON(),
    new SlashCommandBuilder().setName('teamshop').setDescription('Oeffnet den Team-Shop').toJSON(),
    new SlashCommandBuilder()
      .setName('shop-add')
      .setDescription('Shop-Manager oeffnen und mehrere Items gleichzeitig hinzufuegen')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('shop-edit')
      .setDescription('Bearbeitet ein Item in einem Shop')
      .addStringOption(opt => opt.setName('shop').setDescription('Shop waehlen').setRequired(true)
        .addChoices({name:'Kwik-E-Markt',value:'kwik'},{name:'Baumarkt',value:'baumarkt'},{name:'Angler Shop',value:'angler'},{name:'Schwarzmarkt',value:'schwarz'},{name:'Team-Shop',value:'team'}))
      .addStringOption(opt => opt.setName('item').setDescription('Item waehlen').setRequired(true).setAutocomplete(true))
      .addIntegerOption(opt => opt.setName('preis').setDescription('Neuer Preis').setRequired(true).setMinValue(1))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('shop-delete')
      .setDescription('Loescht ein Item aus einem Shop')
      .addStringOption(opt => opt.setName('shop').setDescription('Shop waehlen').setRequired(true)
        .addChoices({name:'Kwik-E-Markt',value:'kwik'},{name:'Baumarkt',value:'baumarkt'},{name:'Angler Shop',value:'angler'},{name:'Schwarzmarkt',value:'schwarz'},{name:'Team-Shop',value:'team'}))
      .addStringOption(opt => opt.setName('item').setDescription('Item waehlen').setRequired(true).setAutocomplete(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('money-add')
      .setDescription('Fuege einem Spieler Geld hinzu')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .addStringOption(o => o.setName('typ').setDescription('Art des Geldes').setRequired(true)
        .addChoices(
          { name: 'Kontogeld',   value: 'konto' },
          { name: 'Bargeld',     value: 'bargeld' },
          { name: 'Schwarzgeld', value: 'schwarz' },
          { name: 'PC Coins',     value: 'pc_coins' }
        ))
      .addIntegerOption(o => o.setName('betrag').setDescription('Betrag').setRequired(true).setMinValue(1))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('money-remove')
      .setDescription('Entferne einem Spieler Geld')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .addStringOption(o => o.setName('typ').setDescription('Art des Geldes').setRequired(true)
        .addChoices(
          { name: 'Kontogeld',   value: 'konto' },
          { name: 'Bargeld',     value: 'bargeld' },
          { name: 'Schwarzgeld', value: 'schwarz' },
          { name: 'PC Coins',     value: 'pc_coins' }
        ))
      .addIntegerOption(o => o.setName('betrag').setDescription('Betrag').setRequired(true).setMinValue(1))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('bargeld')
      .setDescription('Bargeldstand eines Spielers (nur im Finanzkanal)')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('rechnung-create')
      .setDescription('Erstelle eine Rechnung fuer einen Spieler')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .addStringOption(o => o.setName('beschreibung').setDescription('Beschreibung').setRequired(true))
      .addIntegerOption(o => o.setName('betrag').setDescription('Betrag in $').setRequired(true).setMinValue(1))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('charakter-reset')
      .setDescription('Setzt einen Spieler vollständig zurück (Konto, Inventar, Ausweis, Nickname)')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler auswählen').setRequired(true))
      .toJSON(),
    new SlashCommandBuilder()
      .setName('einreise-link')
      .setDescription('Sendet einem Spieler einen persönlichen Einreise-Link per DM')
      .addUserOption(o => o.setName('spieler').setDescription('Spieler auswählen').setRequired(true))
      .addStringOption(o => o.setName('art').setDescription('Einreiseart').setRequired(true)
        .addChoices({ name: 'Legal', value: 'legal' }, { name: 'Illegal', value: 'illegal' }))
      .toJSON(),
    new SlashCommandBuilder()
        .setName('rubbellos-setup')
        .setDescription('Postet das Rubbellos-Embed in den Rubbellos-Kanal')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),
    new SlashCommandBuilder()
        .setName('lotto-ziehung')
        .setDescription('Führt die Lotto-Ziehung manuell durch (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .toJSON(),

    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Bannt einen Nutzer permanent vom Server (inkl. Mod-Log-Eintrag)')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(opt => opt.setName('nutzer').setDescription('Welcher Nutzer soll gebannt werden?').setRequired(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund für den permanenten Ban').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Entbannt einen Nutzer vom Server')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addStringOption(opt => opt.setName('nutzer_id').setDescription('Discord User-ID des gebannten Nutzers').setRequired(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund für den Unban').setRequired(false))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Versetzt einen Spieler in einen Timeout')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(opt => opt.setName('spieler').setDescription('Welcher Spieler?').setRequired(true))
      .addStringOption(opt => opt.setName('dauer').setDescription('Dauer des Timeouts').setRequired(true).addChoices(
        { name: '5 Minuten',  value: '300000' },
        { name: '10 Minuten', value: '600000' },
        { name: '30 Minuten', value: '1800000' },
        { name: '1 Stunde',   value: '3600000' },
        { name: '6 Stunden',  value: '21600000' },
        { name: '12 Stunden', value: '43200000' },
        { name: '24 Stunden', value: '86400000' },
        { name: '7 Tage',     value: '604800000' }
      ))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund für den Timeout').setRequired(true))
      .toJSON(),

    // ─── ATM Raub Commands ──────────────────────────────────────────────────────
    new SlashCommandBuilder()
      .setName('raub-fail')
      .setDescription('Markiert einen Raubüberfall als fehlgeschlagen (kein Cooldown)')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption(o => o.setName('typ').setDescription('Art des Raubs').setRequired(true)
        .addChoices({ name: 'ATM-Raub', value: 'atm' },{ name: 'Shop-Raub', value: 'shop' },{ name: 'Bar-Raub', value: 'bar' },{ name: 'Humane Labs Raub', value: 'humane' },{ name: 'Staatsbank Raub', value: 'staatsbank' }))
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('raub-cooldown')
      .setDescription('Setzt den Raub-Cooldown eines Spielers manuell zurück')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addStringOption(o => o.setName('typ').setDescription('Art des Raubs').setRequired(true)
        .addChoices({ name: 'ATM-Raub', value: 'atm' },{ name: 'Shop-Raub', value: 'shop' },{ name: 'Bar-Raub', value: 'bar' },{ name: 'Humane Labs Raub', value: 'humane' },{ name: 'Staatsbank Raub', value: 'staatsbank' }))
      .addUserOption(o => o.setName('spieler').setDescription('Spieler').setRequired(true))
      .toJSON(),

    // ─── Verstecken / Fesseln Commands ─────────────────────────────────────────
    new SlashCommandBuilder()
      .setName('verstecken')
      .setDescription('Verstecke Items aus deinem Inventar an einem Ort')
      .addStringOption(o => o.setName('item').setDescription('Welches Item möchtest du verstecken?').setRequired(true).setAutocomplete(true))
      .addIntegerOption(o => o.setName('menge').setDescription('Wie viele Stück?').setRequired(true).setMinValue(1))
      .addStringOption(o => o.setName('ort').setDescription('Wo versteckst du die Items?').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('fesseln')
      .setDescription('Fessle einen anderen Spieler mit Handschellen (aus Baumarkt)')
      .addUserOption(o => o.setName('spieler').setDescription('Welchen Spieler möchtest du fesseln?').setRequired(true))
      .toJSON(),
    ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  console.log('[COMMANDS] Guilds in cache:', client.guilds.cache.size, '| Commands to register:', commands.length);
  if (client.guilds.cache.size === 0) {
    // Fallback: fetch guilds first
    console.log('[COMMANDS] Guild cache empty — fetching via REST...');
    try {
      const guildList = await rest.get(Routes.userGuilds());
      console.log('[COMMANDS] Found', guildList.length, 'guilds via REST');
      for (const g of guildList) {
        try {
          const result = await rest.put(Routes.applicationGuildCommands(client.user.id, g.id), { body: commands });
          console.log('[COMMANDS] ✅ Registered', result.length, 'commands in guild', g.id, g.name);
        } catch (e) { console.error('[COMMANDS] ❌ Guild', g.id, ':', e.message); }
      }
    } catch (e) { console.error('[COMMANDS] REST guild fetch failed:', e.message); }
  } else {
    for (const guild of client.guilds.cache.values()) {
      try {
        const result = await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
        console.log('[COMMANDS] ✅ Registered', result.length, 'commands in guild:', guild.name, '('+guild.id+')');
      } catch (e) { console.error('[COMMANDS] ❌ Slash Command Fehler in', guild.name, ':', e.message); }
    }
  }

  await sendLog(CH.RESTART_LOG, new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('🔄 Bot neugestartet')
    .setDescription(`**${client.user.tag}** ist wieder online.`)
    .addFields({ name: '🕐 Zeitpunkt', value: `<t:${ts()}:F>` })
    .setTimestamp()
  );


  await updateLohnlisteEmbed(client);
  await updateLohnbueroEmbed(client);
  await updateBankingEmbed(client);
  await updateRechnungenEmbed(client);
  for (const shopId of Object.keys(SHOP_CHANNELS)) {
    await updateShopEmbed(shopId).catch(e => console.error('Shop embed init:', shopId, e.message));
  }
  // ── Einmalig: Einreise-Embed mit Button senden ─────────────────────────────
  const setup = loadSetup();
  if (!setup.einreiseEmbedV5Sent) {
    const WEBAPP_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : 'http://localhost:8080')).replace(/\/$/, '');
    const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    const LINE2 = '─────────────────────────────────────────';
    const einreiseEmbed = new EmbedBuilder()
      .setColor(DARK_ORANGE)
      .setTitle('🛂  Einreise — Paradise City Roleplay')
      .setDescription(
        `Willkommen! Wähle deinen **Einreiseweg** und starte dein Leben in Paradise City.\n` +
        `Jeder Weg bringt andere Möglichkeiten und Einschränkungen.\n\n` +
        LINE
      )
      .addFields(
        {
          name: '\u200b',
          value:
            `🟢  **LEGALE EINREISE**\n` +
            LINE2 + '\n' +
            `> Du reist **legal** in den Staat ein und bist offiziell registriert.\n` +
            `> Du erhältst einen **Ausweis** und darfst **staatliche Jobs** ausführen.\n` +
            `> ⚠️ Illegale Aktivitäten sind für dich **strikt verboten**.`,
          inline: false,
        },
        {
          name: LINE,
          value:
            `🔴  **ILLEGALE EINREISE**\n` +
            LINE2 + '\n' +
            `> Du reist **illegal** in den Staat ein — ohne offizielle Registrierung.\n` +
            `> ❌ Kein **Ausweis**, keine **staatlichen Jobs** möglich.\n` +
            `> Du bewegst dich im Untergrund und kannst illegale Aktivitäten ausführen.`,
          inline: false,
        },
        {
          name: LINE,
          value:
            `🟡  **GRUPPEN EINREISE**\n` +
            LINE2 + '\n' +
            `> Gilt ab **mindestens 4 Personen** — alle gemeinsam, ein Weg.\n` +
            `> ⚠️ Alle Mitglieder der Gruppe **müssen denselben Lebensweg** wählen.\n` +
            `> ✨ Als Belohnung erhaltet ihr **exklusive Gruppen-Boni**.\n` +
            `> Stärke liegt in der Gemeinschaft — plant euren Einstieg zusammen.`,
          inline: false,
        },
        {
          name: LINE,
          value: `*Bei Fragen wende dich gerne jederzeit an den Support.*`,
          inline: false,
        },
      )
      .setFooter({ text: 'Paradise City Roleplay  •  Einreisebehörde' })
      .setTimestamp();

    const einreiseButton = new ButtonBuilder()
      .setLabel('Einreise starten')
      .setEmoji('🛂')
      .setStyle(ButtonStyle.Link)
      .setURL(`${WEBAPP_URL}/einreise`);
    const row = new ActionRowBuilder().addComponents(einreiseButton);

    try {
      const einreiseCh = await client.channels.fetch('1490878156582686853');
      if (einreiseCh) {
        await einreiseCh.send({ embeds: [einreiseEmbed], components: [row] });
        setup.einreiseEmbedV5Sent = true;
        saveSetup(setup);
        console.log('✅ Einreise-Embed v2 (mit Button) einmalig gesendet.');
      }
    } catch (e) { console.error('Einreise-Embed Fehler:', e.message); }
  }




  // ── Einmalig: Startpunkt-Embed senden ─────────────────────────────────────
    if (!setup.startpunktEmbedSent) {
      const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      const LINE2 = '─────────────────────────────────────────';
      const startEmbed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🗺️  Wo starte ich? — Paradise City Roleplay')
        .setDescription(
          `Willkommen in **Paradise City**! Wähle deinen Startpunkt je nach Einreiseart.\n` +
          `Dein Startfahrzeug findest du in <#1490878162009939998> 🧳\n\n` +
          LINE
        )
        .addFields(
          {
            name: '\u200b',
            value:
              `🟢  **LEGALE EINREISE**\n` +
              LINE2 + '\n' +
              `> Du startest am **Flughafen von Los Santos**.\n` +
              `> Nimm ein **Taxi** zum Autohaus und hole dein Startfahrzeug ab.`,
            inline: false,
          },
          {
            name: LINE,
            value:
              `🔴  **ILLEGALE EINREISE**\n` +
              LINE2 + '\n' +
              `> Du kommst am **Hafen von Los Santos** an.\n` +
              `> Begib dich **unauffällig** zum Autohaus, ohne vom **LAPD** erwischt zu werden.`,
            inline: false,
          },
          {
            name: LINE,
            value: `*Bei Fragen wende dich gerne jederzeit an den Support.*`,
            inline: false,
          },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Einreisebehörde' })
        .setTimestamp();

      try {
        const startCh = await client.channels.fetch('1490878159032422433');
        if (startCh) {
          await startCh.send({ embeds: [startEmbed] });
          setup.startpunktEmbedSent = true;
          saveSetup(setup);
          console.log('✅ Startpunkt-Embed einmalig gesendet.');
        }
      } catch (e) { console.error('Startpunkt-Embed Fehler:', e.message); }
    }

  // ── Einmalig: Starterpaket-Embed senden ───────────────────────────────────
    if (!setup.starterpaketEmbedSent) {
      const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      const LINE2 = '─────────────────────────────────────────';
      const starterEmbed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🧳  Starterpaket — Paradise City Roleplay')
        .setDescription(
          `Willkommen auf **Paradise City Roleplay**!\n` +
          `Je nach Einreiseart erhältst du beim Start folgendes Paket.\n` +
          `Das Fahrzeug steht bereits am Startpunkt bereit.\n\n` +
          LINE
        )
        .addFields(
          {
            name: '\u200b',
            value:
              `🟢  **LEGALE EINREISE**\n` +
              LINE2 + '\n' +
              `> 💵 **5.000 $** Startkapital\n` +
              `> 🚗 **Declasse Rhapsody**`,
            inline: false,
          },
          {
            name: LINE,
            value:
              `🔴  **ILLEGALE EINREISE**\n` +
              LINE2 + '\n' +
              `> 💵 **5.000 $** Startkapital\n` +
              `> 🚗 **Karin Kuruma**`,
            inline: false,
          },
          {
            name: LINE,
            value:
              `🟡  **GRUPPENEINREISE** *(ab 5 Personen)*\n` +
              LINE2 + '\n' +
              `> 💵 **10.000 $** pro Person Startkapital\n` +
              `> 🚗 **Enus Huntley S**`,
            inline: false,
          },
          {
            name: LINE,
            value: `*Bei Fragen wende dich gerne jederzeit an den Support.*`,
            inline: false,
          },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Einreisebehörde' })
        .setTimestamp();

      try {
        const starterCh = await client.channels.fetch('1490878159804174470');
        if (starterCh) {
          await starterCh.send({ embeds: [starterEmbed] });
          setup.starterpaketEmbedSent = true;
          saveSetup(setup);
          console.log('✅ Starterpaket-Embed einmalig gesendet.');
        }
      } catch (e) { console.error('Starterpaket-Embed Fehler:', e.message); }
    }

    // ── Einmalig: Regelwerk 1/2 Embed senden ──────────────────────────────────
    if (!setup.regelwerkEmbed1SentV2) {
      const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      const DIV   = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
      const regelEmbed1 = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('📕  Paradise City Roleplay — Serverregelwerk (1/2)')
        .addFields(
          {
            name: '🎮  Roleplay-Grundlagen & Begriffe',
            value:
              `Was ist Roleplay (RP)? Du übernimmst eine fiktive Rolle in einer realistischen Spielwelt und handelst als dein Charakter — realistisch und glaubwürdig.\n\n` +
              `📌 **Wichtige Begriffe**\n` +
              `> **IC** *(In Character)* — Alles was im Spiel innerhalb deiner Rolle passiert.\n` +
              `> **OOC** *(Out of Character)* — Alles außerhalb deines Charakters.\n` +
              `> **Metagaming** — Externe Infos im RP nutzen. ❌ Verboten.\n` +
              `> **PowerRP** — Zwangshandlungen ohne Reaktionsmöglichkeit. ❌ Verboten.\n` +
              `> **FearRP** — Angemessenes Angstverhalten bei Gefahr. ✅ Pflicht.\n` +
              `> **FailRP** — Unrealistisches Verhalten. ❌ Verboten.\n` +
              `> **RDM** — Töten ohne RP-Grund. ❌ Verboten.\n` +
              `> **VDM** — Fahrzeug als Waffe nutzen. ❌ Verboten.\n` +
              `> **Combat Log** — Verlassen einer RP-Situation. ❌ Verboten.\n` +
              `> **IC/OOC Mixing** — Vermischung von IC und OOC. ❌ Verboten.`,
            inline: false,
          },
          { name: DIV, value: '✈️  **Einreise & Charakter**', inline: false },
          {
            name: '\u200b',
            value:
              `**§1** Einreisebedingungen: Jeder Spieler stimmt zu, dass seine Discord-ID gespeichert wird, solange er aktiv ist.\n` +
              `**§1.1** Charaktererstellung — Keine Whitelist erforderlich. Realistische Angaben sind Pflicht. Charakteränderung nur durch RP-Tod.\n` +
              `**§1.2** Einreisearten: Legal · Illegal · Gruppeneinreise *(ab 4 Personen)*\n` +
              `**§1.3** Gruppeneinreise: Nachweis im Support erforderlich.\n` +
              `**§1.4** Zweitcharaktere: Nur mit Anmeldung im Support erlaubt.`,
            inline: false,
          },
          { name: DIV, value: '🤝  **Verhalten auf dem Server**', inline: false },
          {
            name: '\u200b',
            value:
              `**§2** Grundverhalten: Respekt ist Pflicht. Diskriminierung und Beleidigungen sind verboten.\n` +
              `**§2.1** Spam & Werbung: Keine Werbung · Keine Serverlinks · Kein Spam.\n` +
              `**§2.2** Teamkommunikation: Kein privater Kontakt zu Teammitgliedern.\n` +
              `**§2.3** Support: Richtige Kategorie nutzen · Kein Spam · Geduld zeigen.\n` +
              `**§2.4** Serverstörung: Griefing und Sabotage sind verboten.`,
            inline: false,
          },
          { name: DIV, value: '🎫  **Support & Systeme**', inline: false },
          {
            name: '\u200b',
            value:
              `**§3** Supportsystem: Nur über Tickets oder Supportbereiche.\n` +
              `**§3.1** Ingame-Support: Nur erlaubt wenn vom Serverteam genehmigt — ausschließlich in einem CO.\n` +
              `**§3.2** Clips: Nur im Support verwenden.\n` +
              `**§3.3** Teamrechte & Warnsystem: Missbrauch melden · Warns anfechtbar · Einspruch möglich.`,
            inline: false,
          },
          { name: DIV, value: '🔒  **Serversicherheit**', inline: false },
          {
            name: '\u200b',
            value:
              `**§4** Exploits & Bugs: Das Ausnutzen von Bugs, Glitches oder Exploits ist streng verboten.\n` +
              `**§4.1** Bot-Fehler: Müssen sofort gemeldet werden — Nutzung verboten.\n` +
              `**§4.2** Serverangriffe: Führen zum sofortigen Ausschluss.`,
            inline: false,
          },
          { name: DIV, value: '🎙️  **Kommunikation & UI**', inline: false },
          {
            name: '\u200b',
            value:
              `**§5** Ingame Voice: Nur GTA-Ingame-Voice erlaubt.\n` +
              `**§5.1** Funk: Erlaubt, solange die Lobby nicht voll ist. Bei voller Lobby auflösen.\n` +
              `**§5.2** Minimap & Spieleranzeige: Beim Betreten der Lobby deaktivieren.`,
            inline: false,
          },
          { name: DIV, value: '🎲  **Ingame-Regeln**', inline: false },
          {
            name: '\u200b',
            value:
              `**§6** Realismus: Alles muss realistisch gespielt werden.\n` +
              `**§6.1** Schusscall: Pflicht — 15 Minuten gültig.\n` +
              `**§6.2** Bewusstlosigkeit: Maximal 10 Minuten.\n` +
              `**§6.3** Dispatch-System: Wenn ein Spieler bewusstlos aufgefunden wird — Dispatch absetzen oder Erstversorgung durchführen.\n` +
              `**§6.4** RP-Tod: Der Charakter verliert alle Items.`,
            inline: false,
          },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Serverleitung' })
        .setTimestamp();

      try {
        const regelCh1 = await client.channels.fetch('1490882546144383156');
        if (regelCh1) {
          await regelCh1.send({ embeds: [regelEmbed1] });
          setup.regelwerkEmbed1SentV2 = true;
          saveSetup(setup);
          console.log('✅ Regelwerk-Embed 1/2 einmalig gesendet.');
        }
      } catch (e) { console.error('Regelwerk-Embed 1/2 Fehler:', e.message); }
    }

      // ── Einmalig: Regelwerk 2/2 Embed senden ──────────────────────────────────
    if (!setup.regelwerkEmbed2SentV2) {
      const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      const DIV   = '▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬';
      const regelEmbed2 = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('📕  Paradise City Roleplay — Serverregelwerk (2/2)')
        .addFields(
          {
            name: '🎒  Inventar & Besitzsystem',
            value:
              `**§7** Grundregel: Nur verwenden, was im RP besessen wird.\n` +
              `**§7.1** Fahrzeuge: Müssen im RP gekauft sein — Fahrzeugdiebstahl ist verboten.\n` +
              `**§7.2** Waffen & Items: Nur eigene Items erlaubt.\n` +
              `**§7.3** Lager: Items dürfen nicht verwendet werden, solange sie im Lager liegen.\n` +
              `**§7.4** Immobilien: Nur mit RP-Besitz nutzbar.`,
            inline: false,
          },
          { name: DIV, value: '👮  **Polizei & Medizin**', inline: false },
          {
            name: '\u200b',
            value:
              `**§8** PD-Regeln: Kein grundloser Angriff auf die Polizei (PD).\n` +
              `**§8.1** MD-Regeln: Der Medizinische Dienst (MD) darf nicht ausgeraubt oder entführt werden.`,
            inline: false,
          },
          { name: DIV, value: '💰  **Wirtschaft & Aktivitäten**', inline: false },
          {
            name: '\u200b',
            value:
              `**§9** Farmregeln: Nur nach Vorgabe erlaubt.\n` +
              `**§9.1** Minijobs: Nur eine Aktivität gleichzeitig erlaubt.\n` +
              `**§9.2** Raubüberfälle: Geltende Regeln sind einzuhalten.\n` +
              `**§9.3** Safezones: Keine Gewalt erlaubt.`,
            inline: false,
          },
          { name: DIV, value: '🚗  **Fahrzeuge & Tuning**', inline: false },
          {
            name: '\u200b',
            value:
              `**§10** Fahrzeuge: Müssen realistisch genutzt werden.\n` +
              `**§10.1** Tuning: Bis Stufe 2 erlaubt · Über Stufe 2 gilt als illegal · Jedes Tuning muss im RP erworben werden.\n` +
              `**§10.2** Illegales Tuning: Nur beim illegalen Tuner erhältlich.\n` +
              `**§10.3** Bennys Felgen: Nur beim illegalen Tuner erhältlich.\n` +
              `**§10.4** F1-Reifen: Nur bei Geländewagen erlaubt.\n` +
              `**§10.5** Kennzeichen: Alle erlaubt, außer Regierungskennzeichen (SA Exempt). Leere Kennzeichen gelten als ungültig.`,
            inline: false,
          },
          { name: DIV, value: '👕  **Kleidung**', inline: false },
          {
            name: '\u200b',
            value:
              `**§11** Kleidungssystem — Grundsätzlich erlaubt, außer:\n` +
              `> ❌ Gemoddete Outfits verboten\n` +
              `> ❌ Verglitchte Kleidung verboten\n` +
              `> ✅ Joggers erlaubt (wenn keine unsichtbaren Stellen sichtbar sind)\n` +
              `> ✅ Eselmütze / Spielverderberhut erlaubt\n` +
              `> ✅ Duffel Bags erlaubt (realistisch einsetzen)`,
            inline: false,
          },
          { name: DIV, value: '⚖️  **Servergrundsatz**', inline: false },
          {
            name: '\u200b',
            value:
              `**§12** Grundregel: Alles, was nicht ausdrücklich erlaubt ist, kann sanktioniert werden.\n\n` +
              `*Die Serverleitung behält sich das Recht vor, das Regelwerk jederzeit zu verändern. Änderungen treten sofort in Kraft und werden im <#1490882546144383156> angekündigt.*`,
            inline: false,
          },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Serverleitung' })
        .setTimestamp();

      try {
        const regelCh2 = await client.channels.fetch('1490882546144383156');
        if (regelCh2) {
          await regelCh2.send({ embeds: [regelEmbed2] });
          setup.regelwerkEmbed2SentV2 = true;
          saveSetup(setup);
          console.log('✅ Regelwerk-Embed 2/2 einmalig gesendet.');
        }
      } catch (e) { console.error('Regelwerk-Embed 2/2 Fehler:', e.message); }
    }

  // ── Einmalig: Fraktionsregelwerk-Embed senden ──────────────────────────────
    if (!setup.fraktionsregelwerkEmbedV4) {
      try {
        const fraktCh = await client.channels.fetch('1490882548266696849');
        if (fraktCh) {
          const fraktEmbed1 = new EmbedBuilder()
            .setColor(DARK_ORANGE)
            .setTitle('Fraktionsregelwerk — Paradise City Roleplay')
            .setDescription(
              'Dieses Regelwerk gilt für **alle Fraktionen** auf dem Server. ' +
              'Jedes Fraktionsmitglied ist verpflichtet, sich an die folgenden Bestimmungen zu halten.'
            )
            .addFields(
              {
                name: 'Verhalten',
                value: '\u200b',
                inline: false,
              },
              {
                name: '§1  Allgemeines Verhalten',
                value:
                  '(1)  Grundloses Angreifen von Spielern, Beamten oder anderen Fraktionen ohne RP-Hintergrund ist untersagt.\n' +
                  '(2)  Jegliche Form von unrealistischem oder regelwidrigem Verhalten ist zu unterlassen.',
                inline: false,
              },
              {
                name: '§2  Illegale Routen',
                value:
                  '(1)  Fraktionen sind berechtigt, illegale Routen für sich zu beanspruchen.\n' +
                  '(2)  Die Klärung und Durchsetzung solcher Ansprüueche muss ausschließlich IC erfolgen.',
                inline: false,
              },
              {
                name: '§3  Gambo-Verhalten',
                value:
                  '(1)  Auffälliges, nicht RP-basiertes Kampfverhalten (Gambo) ist untersagt.\n' +
                  '(2)  Verstöße führen zu Fraktionsverwarnungen.\n' +
                  '(3)  Im Wiederholungsfall kann die Fraktion aufgelöst werden.',
                inline: false,
              },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Seite 1 / 3' });

          const fraktEmbed2 = new EmbedBuilder()
            .setColor(DARK_ORANGE)
            .setTitle('Fraktionsregelwerk — Organisation')
            .addFields(
              {
                name: 'Organisation',
                value: '\u200b',
                inline: false,
              },
              {
                name: '§4  Fraktionsgründung',
                value:
                  '(1)  Jede Fraktion muss vor der Gründung eine Bewerbung einreichen.\n' +
                  '(2)  Über die Annahme entscheidet die Projektleitung.\n' +
                  '(3)  Es besteht kein Anspruch auf Genehmigung.',
                inline: false,
              },
              {
                name: '§5  Namensgebung',
                value: 'Echtnamen sowie Fraktionsnamen von anderen Servern sind erlaubt.',
                inline: false,
              },
              {
                name: '§6  Ausstattung',
                value:
                  '(1)  Keine Einschränkungen bei Fraktionskleidung, Fahrzeugen oder Immobilien.\n' +
                  '(2)  Die Nutzung hat dennoch im Rahmen des Roleplays zu erfolgen.',
                inline: false,
              },
              {
                name: '§7  Mitgliederanzahl',
                value:
                  '(1)  Kein festes Limit für Fraktionsmitglieder.\n' +
                  '(2)  Ab 15 Mitgliedern kann eine Aufteilung durch die Projektleitung angeordnet werden.',
                inline: false,
              },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Seite 2 / 3' });

          const fraktEmbed3 = new EmbedBuilder()
            .setColor(DARK_ORANGE)
            .setTitle('Fraktionsregelwerk — Ressourcen & Sanktionen')
            .addFields(
              {
                name: 'Ressourcen',
                value: '\u200b',
                inline: false,
              },
              {
                name: '§8  Fraktionsgüter',
                value:
                  '(1)  Der Server stellt keine Fraktionsgüter zur Verfügung.\n' +
                  '(2)  Fahrzeuge, Immobilien, Waffen und Gegenstände müssen IC erworben werden.\n' +
                  '(3)  Ausgenommen: Kleidungsgegenstände.',
                inline: false,
              },
              {
                name: 'Sanktionen',
                value: '\u200b',
                inline: false,
              },
              {
                name: '§9  Strafen & Konsequenzen',
                value:
                  '(1)  Wiederholtes negatives Auffallen kann zu Fraktionsverwarnungen führen.\n' +
                  '(2)  Im Extremfall: Fraktionssperre oder Auflösung.\n' +
                  '(3)  Vergehen einzelner Mitglieder werden individuell bestraft.\n' +
                  '(4)  Fehlverhalten im Namen der Fraktion kann die gesamte Fraktion sanktionieren.',
                inline: false,
              },
              {
                name: '§10  Änderungsvorbehalt',
                value:
                  'Die Projektleitung behält sich das Recht vor, das Regelwerk jederzeit zu verändern. ' +
                  'Änderungen treten sofort in Kraft und werden in <#1490882546144383156> angekündigt.',
                inline: false,
              },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Serverleitung  •  Seite 3 / 3' })
            .setTimestamp();

          await fraktCh.send({ embeds: [fraktEmbed1] });
          await fraktCh.send({ embeds: [fraktEmbed2] });
          await fraktCh.send({ embeds: [fraktEmbed3] });
          console.log('Fraktionsregelwerk-Embeds gesendet.');
          setup.fraktionsregelwerkEmbedV4 = true;
          saveSetup(setup);
        }
      } catch (e) { console.error('Fraktionsregelwerk-Embed Fehler:', e.message); }
    }
    if (!setup.safeZonesEmbedSent) {
      const LINE  = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      const safeEmbed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🛡️  Safe Zones — Paradise City Roleplay')
        .setDescription(
          `Regierungsgebäude, alle Flächen und Objekte staatlicher Unternehmen sowie die Spieler, die sich dort befinden, dürfen **weder angegriffen noch entführt** werden.\n\n` +
          LINE
        )
        .addFields(
          {
            name: '⚠️  Ausnahme — PD-Gebäude',
            value:
              `Wenn ein **Überfall geplant** ist oder sich ein **Fraktionsmitglied in Gewahrsam** befindet, darf das betroffene Mitglied befreit werden.`,
            inline: false,
          },
          {
            name: LINE,
            value: `> ❌ Verstöße jeglicher Art werden **sanktioniert**.`,
            inline: false,
          },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Serverleitung' })
        .setTimestamp();

      try {
        const safeCh = await client.channels.fetch('1490882549499564184');
        if (safeCh) {
          await safeCh.send({ embeds: [safeEmbed] });
          setup.safeZonesEmbedSent = true;
          saveSetup(setup);
          console.log('✅ Safe-Zones-Embed einmalig gesendet.');
        }
      } catch (e) { console.error('Safe-Zones-Embed Fehler:', e.message); }
    }


    // ── Einmalig: Ticket-Panel senden ────────────────────────────────────────
    const setupT = loadSetup();
    if (!setupT.ticketPanelSent) {
      const panelEmbed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🎫  Support — Paradise City Roleplay')
        .setDescription(
          `Willkommen beim **Support-System** von Paradise City Roleplay.\n` +
          `Wähle eine Kategorie aus dem Dropdown-Menü um ein Ticket zu öffnen.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🎫 **Support / Anliegen** — Allgemeine Unterstützung\n` +
          `📋 **Beschwerde** — Beschwerde einreichen\n` +
          `👥 **SC Crew Anfrage** — Social Club Anfrage\n` +
          `⭐ **Highteam Ticket** — Direktkontakt Highteam\n` +
          `⚔️ **Fraktions Ticket** — Fraktions-Anliegen\n` +
          `📝 **Team Bewerbung** — Bewerbung als Teammitglied\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Support' })
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_select')
        .setPlaceholder('📂 Ticket-Kategorie auswählen...')
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('🎫 Support / Anliegen').setValue('support').setDescription('Allgemeine Unterstützung und Anliegen'),
          new StringSelectMenuOptionBuilder().setLabel('📋 Beschwerde').setValue('beschwerde').setDescription('Eine Beschwerde einreichen'),
          new StringSelectMenuOptionBuilder().setLabel('👥 SC Crew Anfrage').setValue('sc_crew').setDescription('Social Club Crew Anfrage stellen'),
          new StringSelectMenuOptionBuilder().setLabel('⭐ Highteam Ticket').setValue('highteam').setDescription('Direktkontakt zum Highteam'),
          new StringSelectMenuOptionBuilder().setLabel('⚔️ Fraktions Ticket').setValue('fraktion').setDescription('Fraktions-Anfrage oder Anliegen'),
          new StringSelectMenuOptionBuilder().setLabel('📝 Team Bewerbung').setValue('bewerbung').setDescription('Bewerbung als Teammitglied einreichen'),
        );

      const panelRow = new ActionRowBuilder().addComponents(selectMenu);
      try {
        const panelCh = await client.channels.fetch(TICKET_PANEL_CH);
        if (panelCh) {
          await panelCh.send({ embeds: [panelEmbed], components: [panelRow] });
          setupT.ticketPanelSent = true;
          saveSetup(setupT);
          console.log('✅ Ticket-Panel einmalig gesendet.');
        }
      } catch (e) { console.error('Ticket-Panel Fehler:', e.message); }
    }



      // ── Einmalig: Ping-Rollen Embed senden ───────────────────────────────────
      const setupPing = loadSetup();
      if (!setupPing.pingRollenEmbedSent) {
        const PING_ROLLEN_CH = '1490882567690518579';
        const PING_ROLES_CFG = [
          { label: '📌 Lobby Ping',     value: 'ping_lobby',    id: '1490855734517174376' },
          { label: '📌 Event Ping',     value: 'ping_event',    id: '1490855737130221598' },
          { label: '📌 Fraktions Ping', value: 'ping_fraktion', id: '1490855739495813150' },
          { label: '📌 IC Ping',        value: 'ping_ic',       id: '1490855738644365603' },
          { label: '📌 Info Ping',      value: 'ping_info',     id: '1490855733124923486' },
          { label: '📌 Update Ping',    value: 'ping_update',   id: '1490855740435468320' },
        ];
        const pingEmbed = new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('🔔  Ping-Rollen — Paradise City Roleplay')
          .setDescription(
            'Wähle deine **Ping-Rollen** über das Auswahlmenü aus.\n' +
            'Du kannst mehrere Rollen gleichzeitig auswählen.\n' +
            'Bereits ausgewählte Rollen werden **entfernt**, nicht ausgewählte werden **hinzugefügt**.\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
            '📌 **Lobby Ping** — Werde bei Lobby-Nachrichten gepingt\n' +
            '📌 **Event Ping** — Werde bei Events gepingt\n' +
            '📌 **Fraktions Ping** — Werde bei Fraktions-Nachrichten gepingt\n' +
            '📌 **IC Ping** — Werde bei IC-Nachrichten gepingt\n' +
            '📌 **Info Ping** — Werde bei Infos gepingt\n' +
            '📌 **Update Ping** — Werde bei Updates gepingt'
          )
          .setFooter({ text: 'Paradise City Roleplay  •  Ping-Rollen verwalten' });
        const pingSelect = new StringSelectMenuBuilder()
          .setCustomId('ping_rollen_select')
          .setPlaceholder('Ping-Rolle hinzufügen / entfernen …')
          .setMinValues(1)
          .setMaxValues(PING_ROLES_CFG.length)
          .addOptions(PING_ROLES_CFG.map(r => new StringSelectMenuOptionBuilder().setLabel(r.label).setValue(r.value)));
        const pingRow = new ActionRowBuilder().addComponents(pingSelect);
        try {
          const pingCh = await client.channels.fetch(PING_ROLLEN_CH);
          if (pingCh) {
            await pingCh.send({ embeds: [pingEmbed], components: [pingRow] });
            setupPing.pingRollenEmbedSent = true;
            saveSetup(setupPing);
            console.log('✅ Ping-Rollen-Embed einmalig gesendet.');
          }
        } catch (e) { console.error('Ping-Rollen-Embed Fehler:', e.message); }
      }



      // ── Einmalig: Rubbellos-Embed senden ────────────────────────────────────────
      {
        const setupR = loadSetup();
        if (!setupR.rubbellosEmbedSent2) {
          const rubbelEmbed = new EmbedBuilder()
            .setColor(0xE65100)
            .setTitle('🎟️  Rubbellos')
            .setDescription(
              `**Mögliche Gewinne:**
❌  Niete
💵  1'000 $
💴  2'500 $
💶  5'000 $
💰  25'000 $
🚬  10× Marlboro Rot
🚲  Elektro Fahrrad
🏌️‍♂️  Golfschläger
🎟️  Lottoschein
🎫  20% Rabatt beim Autohaus

🛒 Kaufe ein Rubbellos im **Kwik-E-Markt** für **1.000 $**.
▶️ Drücke den Button um dein Rubbellos einzulösen.

🎯 Rubbele alle 9 Felder frei — **3× dasselbe Symbol = Gewinn!**`
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Rubbellos' });
          const rubbBtn = new ButtonBuilder()
            .setCustomId('rubbellos_use')
            .setLabel('🎟️ Rubbellos einlösen')
            .setStyle(ButtonStyle.Primary);
          const rubbRow = new ActionRowBuilder().addComponents(rubbBtn);
          try {
            const rubbCh = await client.channels.fetch('1490889784753782784');
            if (rubbCh) {
              await rubbCh.send({ embeds: [rubbelEmbed], components: [rubbRow] });
              setupR.rubbellosEmbedSent2 = true;
              saveSetup(setupR);
              console.log('✅ Rubbellos-Embed einmalig gesendet.');
            }
          } catch (e) { console.error('Rubbellos-Embed Fehler:', e.message); }
        }
      }

      // ── LAPD: Ticket-Panel senden (einmalig) ─────────────────────────────────
      {
        const setupLapdT = loadSetup();
        if (!setupLapdT.lapdTicketPanelSent) {
          // Verify via channel: skip if embed already exists
          let lapdAlreadyExists = false;
          try {
            const lapdCh2 = await client.channels.fetch(LAPD_TICKET_PANEL_CH);
            if (lapdCh2) {
              const lapdMsgs = await lapdCh2.messages.fetch({ limit: 20 });
              lapdAlreadyExists = lapdMsgs.some(function(m) {
                return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('LAPD');
              });
              if (lapdAlreadyExists) { setupLapdT.lapdTicketPanelSent = true; saveSetup(setupLapdT); }
            }
          } catch(e2) {}

          if (!lapdAlreadyExists) {
            const lapdPanelEmbed = new EmbedBuilder()
              .setColor(0x1F51FF)
              .setTitle('🏛️ LAPD — Kontakt')
              .setDescription(
                'Willkommen beim **LAPD Kontaktsystem** von Paradise City Roleplay.\n'
                + 'Wähle eine Kategorie um fortzufahren.\n\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
                + '✉️ **E-Mail Schreiben** — Offizielle Anfrage an das LAPD\n'
                + '⚠️ **Beschwerde Einreichen** — Beschwerde gegen LAPD-Mitglieder\n'
                + '📋 **Anzeige Erstatten** — Strafanzeige erstatten\n'
                + '📝 **Bewerbung** — Bewerbung beim LAPD einreichen\n'
                + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
              )
              .setFooter({ text: 'LAPD System  •  Paradise City Roleplay' })
              .setTimestamp();
            const lapdSelect = new StringSelectMenuBuilder()
              .setCustomId('lapd_ticket_select')
              .setPlaceholder('📂 Kategorie auswählen...')
              .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('✉️ E-Mail Schreiben').setValue('email').setDescription('Offizielle Anfrage an das LAPD senden'),
                new StringSelectMenuOptionBuilder().setLabel('⚠️ Beschwerde Einreichen').setValue('beschwerde').setDescription('Beschwerde gegen ein LAPD-Mitglied'),
                new StringSelectMenuOptionBuilder().setLabel('📋 Anzeige Erstatten').setValue('anzeige').setDescription('Strafanzeige erstatten'),
                new StringSelectMenuOptionBuilder().setLabel('📝 Bewerbung').setValue('bewerbung').setDescription('Beim LAPD bewerben'),
              );
            const lapdPanelRow = new ActionRowBuilder().addComponents(lapdSelect);
            try {
              const lapdPanelCh = await client.channels.fetch(LAPD_TICKET_PANEL_CH);
              if (lapdPanelCh) {
                await lapdPanelCh.send({ embeds: [lapdPanelEmbed], components: [lapdPanelRow] });
                setupLapdT.lapdTicketPanelSent = true;
                saveSetup(setupLapdT);
                console.log('\u2705 LAPD Ticket-Panel einmalig gesendet.');
              }
            } catch (e) { console.error('LAPD Ticket-Panel Fehler:', e.message); }
          }
        }
      }

      // ── LAPD: Team-Übersicht initialisieren ──────────────────────────────────
      await updateLapdTeamOverview();




    });


    // ─── TICKET INTERAKTIONEN ─────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    try {

      // ── LAPD: Select Menu — Ticket erstellen ─────────────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId === 'lapd_ticket_select') {
        const type = interaction.values[0];
        const cfg  = LAPD_TICKET_TYPES[type];
        if (!cfg) return interaction.reply({ content: '❌ Ungültige Kategorie.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const guild  = interaction.guild;
        const member = interaction.member;
        // Prüfen ob bereits ein offenes Ticket vorhanden
        const allTickets = loadTickets();
        const existingLapd = Object.values(allTickets).find(t => t.openerId === member.id && t.type === 'lapd_'+type && !t.closed);
        if (existingLapd && guild.channels.cache.get(existingLapd.channelId)) {
          return interaction.editReply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existingLapd.channelId}>` });
        }
        const ticketId = generateId();
        const name = `lapd-${type}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10)}-${ticketId.slice(-4)}`;
        const permOverwrites = [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        ];
        for (const roleId of cfg.roles) {
          permOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] });
        }
        const ticketCh = await guild.channels.create({
          name, type: ChannelType.GuildText, parent: LAPD_TICKET_OPEN_CAT, topic: `${ticketId}|lapd_${type}|${member.id}`,
          permissionOverwrites: permOverwrites,
        });
        allTickets[ticketCh.id] = { id: ticketId, channelId: ticketCh.id, openerId: member.id, openerTag: member.user.tag, type: 'lapd_'+type, label: cfg.label, createdAt: new Date().toISOString(), closed: false };
        saveTickets(allTickets);
        const welcomeEmbed2 = new EmbedBuilder()
          .setColor(0x1F51FF)
          .setTitle(cfg.label)
          .setDescription(`Hallo <@${member.id}>!\n\nBitte schildere dein Anliegen so detailliert wie möglich.\nEin Mitarbeiter wird sich in Kürze bei dir melden.`)
          .addFields(
            { name: '👤 Geöffnet von', value: `<@${member.id}>`, inline: true },
            { name: '🕐 Erstellt am',  value: `<t:${ts()}:F>`,  inline: true },
            { name: '🔖 Ticket-ID',    value: `\`${ticketId}\``, inline: true },
          )
          .setFooter({ text: 'LAPD System  •  Paradise City Roleplay' }).setTimestamp();
        const closeBtnL  = new ButtonBuilder().setCustomId('lapd_ticket_close').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger);
        const rowL = new ActionRowBuilder().addComponents(closeBtnL);
        const pings = cfg.roles.map(r => `<@&${r}>`).join(' ');
        await ticketCh.send({ content: pings, embeds: [welcomeEmbed2], components: [rowL] });
        return interaction.editReply({ content: `✅ Ticket erstellt: <#${ticketCh.id}>` });
      }

      // ── LAPD: Button — Ticket schließen ──────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'lapd_ticket_close') {
        const allT2 = loadTickets();
        const tkt = allT2[interaction.channel?.id];
        if (!tkt || tkt.closed) return interaction.reply({ content: '❌ Kein offenes Ticket gefunden.', ephemeral: true });
        const canClose = LAPD_TICKET_TYPES[tkt.type.replace('lapd_','')]?.roles.some(r => interaction.member.roles.cache.has(r)) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        if (!canClose) return interaction.reply({ content: '❌ Du hast keine Berechtigung dieses Ticket zu schließen.', ephemeral: true });
        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('lapd_ticket_close_confirm').setLabel('✅ Ja, schließen').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('lapd_ticket_close_cancel').setLabel('❌ Abbrechen').setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({ content: '⚠️ Soll dieses Ticket wirklich geschlossen werden?', components: [confirmRow], ephemeral: true });
      }
      if (interaction.isButton() && interaction.customId === 'lapd_ticket_close_cancel') {
        return interaction.update({ content: '✅ Schließen abgebrochen.', components: [] });
      }
      if (interaction.isButton() && interaction.customId === 'lapd_ticket_close_confirm') {
        const allT3 = loadTickets();
        const tkt3 = allT3[interaction.channel?.id];
        if (!tkt3 || tkt3.closed) return interaction.reply({ content: '❌ Ticket bereits geschlossen.', ephemeral: true });
        await interaction.deferUpdate();
        tkt3.closed = true; tkt3.closedAt = new Date().toISOString(); tkt3.closedBy = interaction.user.tag;
        saveTickets(allT3);
        try { await interaction.channel.send('🔒 Ticket wird in 5 Sekunden geschlossen und gelöscht...'); } catch {}
        setTimeout(async () => { try { await interaction.channel.delete(); } catch {} }, 5000);
        return;
      }

      // ── Select Menu: Ticket erstellen ─────────────────────────────────────────
      if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
        const type = interaction.values[0];
        const cfg  = TICKET_TYPES[type];
        if (!cfg) return interaction.reply({ content: '❌ Ungültige Kategorie.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const guild  = interaction.guild;
        const member = interaction.member;
        const tickets = loadTickets();
        const existing = Object.values(tickets).find(t => t.openerId === member.id && t.type === type && !t.closed);
        if (existing && guild.channels.cache.get(existing.channelId)) {
          return interaction.editReply({ content: `❌ Du hast bereits ein offenes Ticket: <#${existing.channelId}>` });
        }
        const ticketId = generateId();
        const name = `ticket-${type.replace('_','-')}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,12)}-${ticketId.slice(-4)}`;
        const permOverwrites = [
          { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
          { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        ];
        for (const roleId of cfg.roles) {
          permOverwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.AttachFiles] });
        }
        const ticketCh = await guild.channels.create({ name, type: ChannelType.GuildText, parent: cfg.category, topic: `${ticketId}|${type}|${member.id}`, permissionOverwrites: permOverwrites });
        tickets[ticketCh.id] = { id: ticketId, channelId: ticketCh.id, openerId: member.id, openerTag: member.user.tag, type, label: cfg.label, createdAt: new Date().toISOString(), bearbeiter: null, bearbeiterTag: null, assignedUsers: [], closed: false, rated: false };
        saveTickets(tickets);
        const welcomeEmbed = new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle(cfg.label)
          .setDescription(`Hallo <@${member.id}>!\n\nBitte schildere dein Anliegen so detailliert wie möglich.\nEin Mitarbeiter wird sich in Kürze melden.`)
          .addFields(
            { name: '👤 Geöffnet von', value: `<@${member.id}>`, inline: true },
            { name: '🕐 Erstellt am',  value: `<t:${ts()}:F>`,  inline: true },
            { name: '🔖 Ticket-ID',    value: `\`${ticketId}\``,       inline: true },
            { name: '🛠️ Bearbeiter', value: 'Noch kein Bearbeiter', inline: true },
          )
          .setFooter({ text: 'Paradise City Roleplay  •  Support' }).setTimestamp();
        const closeBtn  = new ButtonBuilder().setCustomId('ticket_close').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger);
        const assignBtn = new ButtonBuilder().setCustomId('ticket_assign').setLabel('Nutzer zuweisen').setEmoji('👤').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(closeBtn, assignBtn);
        const pings = [...cfg.roles.map(r => `<@&${r}>`), ...cfg.pingRoles.map(r => `<@&${r}>`)].join(' ');
        const welcomeMsg = await ticketCh.send({ content: pings, embeds: [welcomeEmbed], components: [row] });
        tickets[ticketCh.id].welcomeMsgId = welcomeMsg.id; saveTickets(tickets);
        return interaction.editReply({ content: `✅ Ticket erstellt: <#${ticketCh.id}>` });
      }

      // ── Button: Ticket schließen anfordern ────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'ticket_close') {
        const tickets = loadTickets();
        let ticket  = tickets[interaction.channel?.id];
        if (!ticket) {
          const tp = interaction.channel.topic?.split('|');
          if (tp?.length >= 3) { const [tId,tType,tOpener]=tp; const cfg2=TICKET_TYPES[tType]||{}; ticket={ id:tId, channelId:interaction.channel.id, openerId:tOpener, type:tType, label:cfg2.label||tType, createdAt:new Date().toISOString(), bearbeiter:null, bearbeiterTag:null, assignedUsers:[], closed:false }; }
        }
        if (!ticket) return interaction.reply({ content: '❌ Kein Ticket gefunden.', ephemeral: true });
        const canClose = hasTicketRights(interaction.member, ticket.type);
        if (!canClose) return interaction.reply({ content: '❌ Du hast keine Berechtigung dieses Ticket zu schließen.', ephemeral: true });
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('✅ Ja, schließen').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('❌ Abbrechen').setStyle(ButtonStyle.Secondary),
        );
        return interaction.reply({ content: '⚠️ Soll dieses Ticket wirklich geschlossen werden?', components: [row], ephemeral: true });
      }

      // ── Button: Schließen abbrechen ───────────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'ticket_close_cancel') {
        return interaction.update({ content: '✅ Schließen abgebrochen.', components: [] });
      }

      // ── Button: Schließen bestätigt ───────────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'ticket_close_confirm') {
        const tickets = loadTickets();
        let ticket  = tickets[interaction.channel?.id];
        if (!ticket) {
          const tp = interaction.channel.topic?.split('|');
          if (tp?.length >= 3) { const [tId,tType,tOpener]=tp; const cfg2=TICKET_TYPES[tType]||{}; ticket={ id:tId, channelId:interaction.channel.id, openerId:tOpener, type:tType, label:cfg2.label||tType, createdAt:new Date().toISOString(), bearbeiter:null, bearbeiterTag:null, assignedUsers:[], closed:false }; }
        }
        if (!ticket || ticket.closed) return interaction.reply({ content: '❌ Ticket bereits geschlossen.', ephemeral: true });
        const canClose = hasTicketRights(interaction.member, ticket.type);
        if (!canClose) return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
        await interaction.deferUpdate();
        ticket.closed   = true;
        ticket.closedAt = new Date().toISOString();
        ticket.closedBy = interaction.user.tag;
        saveTickets(tickets);

        // Transkript generieren
        let transcriptText = '';
        try { transcriptText = await generateTranscript(interaction.channel); } catch {}
        const header = `TICKET TRANSKRIPT\n=================\nTicket-ID : ${ticket.id}\nTyp       : ${ticket.label}\nVon       : ${ticket.openerTag}\nBearbeiter: ${ticket.bearbeiterTag || 'Kein Bearbeiter'}\nErstellt  : ${new Date(ticket.createdAt).toLocaleString('de-DE')}\nGeschlossen: ${new Date().toLocaleString('de-DE')}\nGeschlossen von: ${ticket.closedBy}\n=================\n\n`;
        const buf        = Buffer.from(header + transcriptText, 'utf-8');
        const attachment = new AttachmentBuilder(buf, { name: `ticket-${ticket.id}.txt` });

        try {
          const transcriptCh = await client.channels.fetch(TICKET_TRANSCRIPT_CH);
          const tEmbed = new EmbedBuilder()
            .setColor(DARK_ORANGE).setTitle('📄 Ticket Transkript')
            .addFields(
              { name: '🔖 Ticket-ID',    value: `\`${ticket.id}\``,                                         inline: true },
              { name: '📂 Typ',          value: ticket.label,                                           inline: true },
              { name: '👤 Geöffnet von', value: `<@${ticket.openerId}>`,                               inline: true },
              { name: '🛠️ Bearbeiter',   value: ticket.bearbeiter ? `<@${ticket.bearbeiter}>` : 'Kein Bearbeiter', inline: true },
              { name: '🔒 Geschlossen von', value: `<@${interaction.user.id}>`,                        inline: true },
              { name: '🕐 Geschlossen am',  value: `<t:${ts()}:F>`,                                   inline: true },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Ticket System' }).setTimestamp();
          await transcriptCh.send({ embeds: [tEmbed], files: [attachment] });
        } catch (e) { console.error('Transkript Fehler:', e.message); }

        // Rating-DM
        try {
          const opener = await client.users.fetch(ticket.openerId);
          const bearbeiterName = ticket.bearbeiterTag || 'Kein Bearbeiter';
          const rEmbed = new EmbedBuilder()
            .setColor(DARK_ORANGE).setTitle('⭐ Ticket Bewertung — Paradise City Roleplay')
            .setDescription(`Dein Ticket **${ticket.label}** wurde geschlossen.\nBitte bewerte den Support!`)
            .addFields(
              { name: '📂 Ticket-Typ',       value: ticket.label,     inline: true },
              { name: '\uD83D\uDEE0\uFE0F Bearbeitet von', value: bearbeiterName, inline: true },
            );
          const rRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`ticket_rate_select_${ticket.id}`)
              .setPlaceholder('⭐ Bewertung auswählen...')
              .addOptions(
                new StringSelectMenuOptionBuilder().setLabel('1/5 ⭐ — Sehr schlecht').setValue('1'),
                new StringSelectMenuOptionBuilder().setLabel('2/5 ⭐⭐ — Schlecht').setValue('2'),
                new StringSelectMenuOptionBuilder().setLabel('3/5 ⭐⭐⭐ — Okay').setValue('3'),
                new StringSelectMenuOptionBuilder().setLabel('4/5 ⭐⭐⭐⭐ — Gut').setValue('4'),
                new StringSelectMenuOptionBuilder().setLabel('5/5 ⭐⭐⭐⭐⭐ — Sehr gut').setValue('5'),
              )
          )
          await opener.send({ embeds: [rEmbed], components: [rRow] });
        } catch (e) { console.error('Rating DM Fehler:', e.message); }

        await interaction.channel.send({ embeds: [new EmbedBuilder().setColor(Colors.Red).setDescription('🔒 Ticket wird in 5 Sekunden gelöscht...')] });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }

      // ── Button: Nutzer zuweisen ───────────────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'ticket_assign') {
        let tktChk = loadTickets()[interaction.channel?.id];
        if (!tktChk) { const tp=interaction.channel.topic?.split('|'); if (tp?.length>=3) tktChk={ type:tp[1] }; }
        if (!tktChk) return interaction.reply({ content: '❌ Kein Ticket.', ephemeral: true });
        if (!hasTicketRights(interaction.member, tktChk.type)) return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
        const asel = new UserSelectMenuBuilder().setCustomId('ticket_assign_sel').setPlaceholder('Nutzer auswählen').setMinValues(1).setMaxValues(1);
        return interaction.reply({ content: '👤 **Wen möchtest du dem Ticket zuweisen?**', components: [new ActionRowBuilder().addComponents(asel)], ephemeral: true });
      }

      // ── Modal: Nutzer zuweisen ────────────────────────────────────────────────
      // ── UserSelect: Nutzer zuweisen ─────────────────────────────────────────
      if (interaction.isUserSelectMenu() && interaction.customId === 'ticket_assign_sel') {
        const userId  = interaction.values[0];
        const tickets = loadTickets();
        const ticket  = tickets[interaction.channel?.id];
        try {
          await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
          if (ticket && !ticket.assignedUsers.includes(userId)) { ticket.assignedUsers.push(userId); saveTickets(tickets); }
          return interaction.reply({ content: `✅ <@${userId}> wurde dem Ticket zugewiesen und kann es jetzt sehen.` });
        } catch (e) { return interaction.reply({ content: `❌ Fehler: ${e.message}`, ephemeral: true }); }
      }

      // ── Select Menu: Ping-Rollen hinzufügen / entfernen ─────────────────────
        if (interaction.isStringSelectMenu() && interaction.customId === 'ping_rollen_select') {
          const PING_ROLES_MAP = {
            ping_lobby:    '1490855734517174376',
            ping_event:    '1490855737130221598',
            ping_fraktion: '1490855739495813150',
            ping_ic:       '1490855738644365603',
            ping_info:     '1490855733124923486',
            ping_update:   '1490855740435468320',
          };
          await interaction.deferReply({ ephemeral: true });
          const member = interaction.member;
          const selected = interaction.values;
          const added = [], removed = [];
          for (const val of selected) {
            const roleId = PING_ROLES_MAP[val];
            if (!roleId) continue;
            if (member.roles.cache.has(roleId)) {
              await member.roles.remove(roleId).catch(() => {});
              removed.push(val.replace('ping_', '').replace('fraktion', 'Fraktions').replace(/^w/, c => c.toUpperCase()) + ' Ping');
            } else {
              await member.roles.add(roleId).catch(() => {});
              added.push(val.replace('ping_', '').replace('fraktion', 'Fraktions').replace(/^w/, c => c.toUpperCase()) + ' Ping');
            }
          }
          const lines = [];
          if (added.length)   lines.push('✅ **Hinzugefügt:** ' + added.join(', '));
          if (removed.length) lines.push('❌ **Entfernt:** ' + removed.join(', '));
          return interaction.editReply({ content: lines.join('\n') || 'Keine Änderungen.', ephemeral: true });
        }

              // ── Select Menu: Bewertung auswählen (in DM) ──────────────────────────────
        if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ticket_rate_select_')) {
          const ticketId = interaction.customId.slice('ticket_rate_select_'.length);
          const stars    = parseInt(interaction.values[0]);
          const allT     = loadTickets();
          const rTkt     = Object.values(allT).find(t => t.id === ticketId);
          if (rTkt?.rated) {
            return interaction.update({ content: '❌ Du hast dieses Ticket bereits bewertet.', components: [], embeds: [] });
          }
          const modal = new ModalBuilder()
            .setCustomId(`ticket_rating_modal_${stars}_${ticketId}`)
            .setTitle(`Bewertung: ${stars}/5`);
          modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('rating_comment').setLabel('Kommentar (optional)').setStyle(TextInputStyle.Paragraph).setPlaceholder('Dein Feedback zum Support...').setRequired(false).setMaxLength(500)
          ));
          return interaction.showModal(modal);
        }

      // ── Modal: Bewertung abgeben ──────────────────────────────────────────────
        // ── Modal: LAPD Dispatch Notruf ───────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId === 'dispatch_lapd_modal') {
        const location    = interaction.fields.getTextInputValue('dispatch_location');
        let   description = '';
        try { description = interaction.fields.getTextInputValue('dispatch_desc'); } catch {}
        const caller = interaction.member?.displayName || interaction.user.username;
        try {
          const _wm = require('./web');
          if (typeof _wm.addNotruf === 'function') {
            _wm.addNotruf({ caller, callerId: interaction.user.id, location, description });
          }
        } catch(e) { console.error('Notruf addNotruf:', e.message); }
        return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
          .setColor(0xef4444).setTitle('\u{1F6A8} Notruf abgesendet — LAPD')
          .setDescription('Dein Notruf wurde weitergeleitet.\n\n\u{1F4CD} **Standort:** ' + location
            + (description ? '\n\u{1F4DD} **Beschreibung:** ' + description : ''))
          .setFooter({text:'LAPD wird benachrichtigt  •  Paradise City Roleplay'})
        ]});
      }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_rating_modal_')) {
          const parts    = interaction.customId.split('_');
          const stars    = parseInt(parts[3]);
          const ticketId = parts.slice(4).join('_');
          const comment  = interaction.fields.getTextInputValue('rating_comment') || '*Kein Kommentar*';
          // Nur einmal bewerten
          const allT  = loadTickets();
          const rTkt  = Object.values(allT).find(t => t.id === ticketId);
          if (rTkt?.rated) {
            return interaction.update({ content: '❌ Du hast dieses Ticket bereits bewertet.', components: [], embeds: [] });
          }
          if (rTkt) { rTkt.rated = true; saveTickets(allT); }
          const starsStr = `${stars}/5`;
          const starsFull = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
          try {
            const ratingCh = await client.channels.fetch(TICKET_RATING_CH);
            await ratingCh.send({ embeds: [new EmbedBuilder()
              .setColor(stars >= 4 ? Colors.Green : stars >= 3 ? Colors.Yellow : Colors.Red)
              .setTitle('⭐ Neue Ticket-Bewertung')
              .addFields(
                { name: '🔖 Ticket-ID',    value: `\`${ticketId}\``,              inline: true },
                { name: '⭐ Bewertung',    value: `${starsFull}  (${starsStr})`,    inline: true },
                { name: '👤 Bewertet von', value: `<@${interaction.user.id}>`,      inline: true },
                { name: '💬 Kommentar',    value: comment,                            inline: false },
              )
              .setTimestamp()
            ]});
          } catch (e) { console.error('Rating Channel Fehler:', e.message); }
          return interaction.update({ content: `✅ Danke für deine Bewertung: ${starsFull} (${starsStr})`, components: [], embeds: [] });
        }

    } catch (e) {
        console.error('Ticket Interaction Fehler:', e && e.stack ? e.stack : e);
        try {
          const errMsg = String(e && e.message ? e.message : e);
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: 'Interner Fehler: ' + errMsg }).catch(() => {});
          } else {
            await interaction.reply({ content: 'Interner Fehler: ' + errMsg, ephemeral: true }).catch(() => {});
          }
        } catch {}
      }


});

  // ─── BEARBEITER TRACKING ──────────────────────────────────────────────────────
  // ─── INVITE EVENTS ────────────────────────────────────────────────────────────
client.on('inviteCreate', async (invite) => { await buildInviteCache(invite.guild); });
client.on('inviteDelete', async (invite) => { await buildInviteCache(invite.guild); });
client.on('guildCreate',  async (guild)  => { await buildInviteCache(guild); });

// ─── MEMBER ADD ───────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  // ── LAPD-Server: Beitrittsnachricht ────────────────────────────────────────
  if (member.guild.id === LAPD_GUILD_ID) {
    if (member.user.bot) return;
    try {
      const ch = await client.channels.fetch(LAPD_JOIN_CH);
      if (ch) await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0x1F51FF)
        .setTitle('👮 Neues Mitglied — LAPD')
        .setDescription(`<@${member.id}> hat den LAPD-Server betreten.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤 Nutzer', value: `${member.user.tag}`, inline: true },
          { name: '📅 Beigetreten', value: `<t:${ts()}:F>`, inline: true },
          { name: '🏠 Mitglieder gesamt', value: `${member.guild.memberCount}`, inline: true },
        )
        .setFooter({ text: 'LAPD System  •  Paradise City Roleplay' })
        .setTimestamp()
      ]});
    } catch (e) { console.error('LAPD Join Fehler:', e.message); }
    await updateLapdTeamOverview();
    return;
  }

  if (!member.user.bot) {
    // Auto-Rolle
    try { await member.roles.add('1490855725516460234'); }
    catch (e) { console.error('Auto-Rolle Fehler:', e.message); }

    // Invite-Tracking
    const oldCache = inviteCache.get(member.guild.id) ?? new Map();
    const newCache = await buildInviteCache(member.guild);

    let inviterId    = null;
    let inviterTag   = 'Unbekannt';
    let inviteCode   = '—';
    let totalInvites = 0;

    for (const [code, newInv] of newCache) {
      const oldUses = oldCache.get(code)?.uses ?? 0;
      if (newInv.uses > oldUses) {
        inviteCode  = code;
        inviterId   = newInv.inviterId;
        inviterTag  = newInv.inviterTag;
        break;
      }
    }

    if (inviterId) {
      const invData = loadInvites();
      if (!invData[member.guild.id])            invData[member.guild.id] = {};
      if (!invData[member.guild.id][inviterId]) invData[member.guild.id][inviterId] = { tag: inviterTag, count: 0, users: {} };
      invData[member.guild.id][inviterId].count += 1;
      invData[member.guild.id][inviterId].users[member.id] = {
        tag: member.user.tag, joinedAt: new Date().toISOString(), inviteCode,
      };
      totalInvites = invData[member.guild.id][inviterId].count;
      saveInvites(invData);
    }

    const inviterMention = inviterId ? `<@${inviterId}>` : 'Unbekannt';
    const memberCount    = member.guild.memberCount;

    // Willkommens-Embed
    const welcomeEmbed = new EmbedBuilder()
      .setColor(DARK_ORANGE)
      .setTitle(`🎉  Willkommen, ${member.user.username}!`)
      .setDescription(
        `Hey <@${member.id}>, willkommen auf **Paradise City Roleplay**!\n` +
        `Du bist unser **${memberCount}. Mitglied**. Schau dir die Regeln an und viel Spaß! 🚗`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '📨  Eingeladen von', value: inviterMention, inline: true },
        { name: '📆  Account seit',   value: `<t:${ts(member.user.createdAt)}:D>`, inline: true },
      )
      .setTimestamp();

    try {
      const ch = await client.channels.fetch(CH.WELCOME);
      if (ch) await ch.send({ embeds: [welcomeEmbed] });
    } catch (e) { console.error('Welcome Fehler:', e.message); }

      // Willkommens-DM mit Discord-ID
      try {
        await member.send({ embeds: [new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('👋  Willkommen bei Paradise City Roleplay!')
          .setDescription(
            `Hey **${member.user.username}**, willkommen auf **Paradise City Roleplay**! 🚗\n\n` +
            `Um deinen Charakter zu erstellen, geh auf die Einreise-Seite:\n` +
            `https://${(process.env.REPLIT_DOMAINS||process.env.RAILWAY_PUBLIC_DOMAIN||'localhost:8080').split(',')[0]}/einreise\n\n` +
            `Gib dort deine Discord ID ein — sie steht direkt hier unten. 👇`
          )
          .addFields({ name: '🆔  Deine Discord ID', value: `\`${member.id}\``, inline: false })
          .setFooter({ text: 'Kopiere die ID und trage sie im Formular ein.' })
          .setTimestamp()
        ]});
      } catch { /* DMs deaktiviert */ }



    // Invite-Log
    try {
      const ch = await client.channels.fetch(CH.INVITE_LOG);
      if (ch) await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0x43A047)
        .setAuthor({ name: '➕  Mitglied beigetreten' })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤  Mitglied',            value: `<@${member.id}>\n\`${member.user.tag}\``, inline: true },
          { name: '📨  Eingeladen von',       value: inviterId ? `<@${inviterId}>\n\`${inviterTag}\`` : 'Unbekannt', inline: true },
          { name: '🔗  Code',                 value: `\`${inviteCode}\``,  inline: true },
          { name: '📅  Beigetreten',          value: `<t:${ts()}:F>`,      inline: false },
          { name: '🏆  Einladungen gesamt',   value: inviterId ? `**${totalInvites}**` : '—', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
      ]});
    } catch (e) { console.error('Invite-Log Fehler:', e.message); }

    // Member-Log
    await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('✅ Mitglied beigetreten')
      .setDescription(`<@${member.id}> (${member.user.tag}) hat den Server betreten.`)
      .addFields(
        { name: 'Mitglied',         value: `<@${member.id}>`, inline: true },
        { name: 'Account erstellt', value: `<t:${ts(member.user.createdAt)}:R>`, inline: true }
      ).setThumbnail(member.user.displayAvatarURL()).setTimestamp()
    );
    return;
  }

  // Fremder Bot → Bann
  const entry   = await getAuditEntry(member.guild, AuditLogEvent.BotAdd);
  const inviter = entry?.executor;
  try {
    await member.ban({ reason: '⛔ Unerlaubter Bot-Beitritt (automatisch gebannt)' });
    if (inviter) {
      try {
        await inviter.send({ embeds: [new EmbedBuilder()
          .setColor(Colors.Red).setTitle('⛔ Aktion nicht erlaubt')
          .setDescription(
            'Du hast versucht einen fremden Bot auf **Paradise City Roleplay** hinzuzufügen.\n' +
            'Dies ist **nicht gestattet**. Der Bot wurde automatisch gebannt.'
          ).setTimestamp()
        ]});
      } catch {}
    }
    await sendLog(CH.ACTIVITY, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🚨 Aktivitätswarnung — Fremder Bot')
      .addFields(
        { name: 'Bot',             value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: 'Hinzugefügt von', value: inviter ? `<@${inviter.id}> (${inviter.tag})` : 'Unbekannt', inline: true },
        { name: 'Aktion',          value: '✅ Bot wurde permanent gebannt' },
        { name: 'Zeitpunkt',       value: `<t:${ts()}:F>` }
      ).setTimestamp()
    );
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🔨 Automatischer Bann — Bot')
      .addFields(
        { name: 'Bot',            value: `<@${member.id}> (${member.user.tag})` },
        { name: 'Eingeladen von', value: inviter ? `<@${inviter.id}>` : 'Unbekannt' },
        { name: 'Grund',          value: 'Fremder Bot hinzugefügt' }
      ).setTimestamp()
    );
  } catch (e) { console.error('Bot-Bann Fehler:', e.message); }
});

// ─── MEMBER REMOVE ────────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;
  // ── LAPD-Server: Verlassensnachricht ────────────────────────────────────────
  if (member.guild.id === LAPD_GUILD_ID) {
    try {
      const ch = await client.channels.fetch(LAPD_LEAVE_CH);
      if (ch) await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('👋 Mitglied verlassen — LAPD')
        .setDescription(`**${member.user.tag}** hat den LAPD-Server verlassen.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤 Nutzer', value: member.user.tag, inline: true },
          { name: '📅 Verlassen am', value: `<t:${ts()}:F>`, inline: true },
        )
        .setFooter({ text: 'LAPD System  •  Paradise City Roleplay' })
        .setTimestamp()
      ]});
    } catch (e) { console.error('LAPD Leave Fehler:', e.message); }
    await updateLapdTeamOverview();
    return;
  }


  const invData      = loadInvites();
  const guildData    = invData[member.guild.id] ?? {};
  let inviterId      = null;
  let inviterTag     = 'Unbekannt';
  let joinedAt       = null;
  let inviteCode     = '—';
  let remainingCount = 0;

  for (const [iId, iData] of Object.entries(guildData)) {
    if (iData.users?.[member.id]) {
      inviterId      = iId;
      inviterTag     = iData.tag ?? 'Unbekannt';
      joinedAt       = iData.users[member.id].joinedAt;
      inviteCode     = iData.users[member.id].inviteCode ?? '—';
      iData.count    = Math.max(0, (iData.count ?? 1) - 1);
      remainingCount = iData.count;
      delete iData.users[member.id];
      saveInvites(invData);
      break;
    }
  }

  const inviterMention = inviterId ? `<@${inviterId}>` : 'Unbekannt';

  // Aufwiedersehens-Embed
  try {
    const ch = await client.channels.fetch(CH.GOODBYE);
    if (ch) await ch.send({ embeds: [new EmbedBuilder()
      .setColor(DARK_ORANGE)
      .setTitle(`👋  Tschüss, ${member.user.username}!`)
      .setDescription(
        `**${member.user.tag}** hat den Server verlassen. Wir hoffen dich bald wieder zu sehen!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '📨  Eingeladen von', value: inviterMention, inline: true },
        { name: '⏱️  War dabei für',  value: joinedAt ? `<t:${ts(joinedAt)}:R>` : 'Unbekannt', inline: true },
      )
      .setTimestamp()
    ]});
  } catch (e) { console.error('Goodbye Fehler:', e.message); }

  // Invite-Log (Verlassen)
  try {
    const ch = await client.channels.fetch(CH.INVITE_LOG);
    if (ch) await ch.send({ embeds: [new EmbedBuilder()
      .setColor(0xE53935)
      .setAuthor({ name: '➖  Mitglied verlassen' })
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤  Mitglied',               value: `${member.user.tag}`,                               inline: true },
        { name: '📨  War eingeladen von',     value: inviterId ? `<@${inviterId}>\n\`${inviterTag}\`` : 'Unbekannt', inline: true },
        { name: '🔗  Code',                   value: `\`${inviteCode}\``,                                 inline: true },
        { name: '📅  Beigetreten am',         value: joinedAt ? `<t:${ts(joinedAt)}:F>` : 'Unbekannt',  inline: false },
        { name: '📉  Einladungen verbleibend', value: inviterId ? `**${remainingCount}**` : '—',          inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
    ]});
  } catch (e) { console.error('Invite-Log (Leave) Fehler:', e.message); }

  // Member-Log
  await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
    .setColor(Colors.Orange).setTitle('👋 Mitglied verlassen')
    .setDescription(`<@${member.id}> (${member.user.tag}) hat den Server verlassen.`)
    .addFields({ name: 'Mitglied', value: `<@${member.id}>` })
    .setThumbnail(member.user.displayAvatarURL()).setTimestamp()
  );
});

// ─── MEMBER UPDATE ────────────────────────────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  // LAPD-Server: Rollenänderung → Team-Übersicht aktualisieren
  if (newMember.guild.id === LAPD_GUILD_ID) {
    const addedRolesL   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRolesL = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    const lapdChange = [...addedRolesL.keys(), ...removedRolesL.keys()].some(id => LAPD_ROLE_IDS.includes(id));
    if (lapdChange) await updateLapdTeamOverview();
    return;
  }

  if (oldMember.nickname !== newMember.nickname) {
    await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
      .setColor(Colors.Blue).setTitle('✏️ Nickname geändert')
      .addFields(
        { name: 'Mitglied',       value: `<@${newMember.id}> (${newMember.user.tag})` },
        { name: 'Alter Nickname', value: oldMember.nickname || '_keiner_', inline: true },
        { name: 'Neuer Nickname', value: newMember.nickname || '_keiner_', inline: true }
      ).setTimestamp()
    );
  }
  const addedRoles   = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
  const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
  if (addedRoles.size > 0) {
    await sendLog(CH.ROLE_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('🟢 Rolle(n) vergeben')
      .addFields(
        { name: 'Mitglied', value: `<@${newMember.id}> (${newMember.user.tag})` },
        { name: 'Rollen',   value: addedRoles.map(r => r.name).join(', ') }
      ).setTimestamp()
    );
  }
  if (removedRoles.size > 0) {
    await sendLog(CH.ROLE_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🔴 Rolle(n) entfernt')
      .addFields(
        { name: 'Mitglied', value: `<@${newMember.id}> (${newMember.user.tag})` },
        { name: 'Rollen',   value: removedRoles.map(r => r.name).join(', ') }
      ).setTimestamp()
    );
  }

  // ── Firmen-Auslastung: sofort aktualisieren bei Rollen-Änderung ────────────
  {
    const changedIds = [
      ...addedRoles.keys(),
      ...removedRoles.keys(),
    ];
    const firmenBetroffen = changedIds.some(id => FIRMEN_ROLE_IDS.includes(id));
    if (firmenBetroffen) {
      updateFirmenEmbed(client).catch(e => console.error('[FIRMEN UPDATE]', e.message));
    }
  }
});

// ─── NACHRICHTEN ─────────────────────────────────────────────────────────────
// ─── ABSTIMMUNG REAKTIONEN ───────────────────────────────────────────────────
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial)         await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    // ── Abstimmung ──
    const polls = loadAbstimmungen();
    const poll  = polls[reaction.message.id];
    if (poll) {
      const emoji = reaction.emoji.name;
      if (emoji === '\uD83D\uDC4D' || emoji === '\uD83D\uDC4E') {
        const voteDir    = emoji === '\uD83D\uDC4D' ? 'up' : 'down';
        const otherDir   = voteDir === 'up' ? 'down' : 'up';
        const otherEmoji = voteDir === 'up' ? '\uD83D\uDC4E' : '\uD83D\uDC4D';
        const prevVote   = poll.voters[user.id];
        if (prevVote !== voteDir) {
          poll.voters[user.id] = voteDir;
          saveAbstimmungen(polls);
          if (prevVote === otherDir) {
            const other = reaction.message.reactions.cache.get(otherEmoji);
            if (other) await other.users.remove(user.id).catch(() => {});
          }
          await reaction.message.edit({ embeds: [buildAbstimmungEmbed(poll)] }).catch(() => {});
        }
      }
      return;
    }

    // ── Lobby-Abstimmung ──
    const lobbyPolls = loadLobbyPolls();
    const lobbyPoll  = lobbyPolls[reaction.message.id];
    if (lobbyPoll) {
      const emoji = reaction.emoji.name;
      const validEmojis = ['✅', '🕒', '❌'];
      if (validEmojis.includes(emoji)) {
        const prevVote = lobbyPoll.voters ? lobbyPoll.voters[user.id] : null;
        if (prevVote && prevVote !== emoji) {
          const prevReaction = reaction.message.reactions.cache.get(prevVote);
          if (prevReaction) await prevReaction.users.remove(user.id).catch(() => {});
        }
        if (!lobbyPoll.voters) lobbyPoll.voters = {};
        lobbyPoll.voters[user.id] = emoji;
        saveLobbyPolls(lobbyPolls);
      }
      return;
    }

    // ── Vorschlag ──
    const vorschlaegeRct = loadVorschlaege();
    const vorschlagRct = vorschlaegeRct.find(v => v.msgId === reaction.message.id);
    if (vorschlagRct) {
      const emoji = reaction.emoji.name;
      if (emoji === '✅' || emoji === '❌') {
        if (!vorschlagRct.voters) vorschlagRct.voters = {};
        const prevVoteV = vorschlagRct.voters[user.id];
        if (prevVoteV && prevVoteV !== emoji) {
          const prevReactionV = reaction.message.reactions.cache.get(prevVoteV);
          if (prevReactionV) await prevReactionV.users.remove(user.id).catch(() => {});
        }
        vorschlagRct.voters[user.id] = emoji;
        saveVorschlaege(vorschlaegeRct);
      }
      return;
    }

    // ── Aktivitätscheck ──
    const aktChecks = loadAktivitaet();
    const aktCheck  = aktChecks[reaction.message.id];
    if (aktCheck) {
      const emoji = reaction.emoji.name;
      if (emoji !== '\u2705') return;
      const already = aktCheck.members.some(m => m.id === user.id);
      if (!already) {
        aktCheck.members.push({ id: user.id, tag: user.username });
        saveAktivitaet(aktChecks);
        await reaction.message.edit({ embeds: [buildAktivitaetEmbed(aktCheck)] }).catch(() => {});
      }
    }

    // ── Giveaway Teilnehmer-Zähler ──
    const gw = activeGiveaways.get(reaction.message.id);
    if (gw && reaction.emoji.name === '\uD83C\uDF89') {
      const r = reaction.message.reactions.cache.get('\uD83C\uDF89');
      const count = r ? Math.max(0, (r.count || 1) - 1) : 0; // minus Bot
      await reaction.message.edit({ embeds: [buildGiveawayEmbed(gw.preis, gw.endetAt, count)] }).catch(() => {});
    }
  } catch (e) { console.error('ReactionAdd Fehler:', e.message); }
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  try {
    if (reaction.partial)         await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    // ── Abstimmung ──
    const polls = loadAbstimmungen();
    const poll  = polls[reaction.message.id];
    if (poll) {
      const emoji   = reaction.emoji.name;
      const voteDir = emoji === '\uD83D\uDC4D' ? 'up' : 'down';
      if ((emoji === '\uD83D\uDC4D' || emoji === '\uD83D\uDC4E') && poll.voters[user.id] === voteDir) {
        delete poll.voters[user.id];
        saveAbstimmungen(polls);
        await reaction.message.edit({ embeds: [buildAbstimmungEmbed(poll)] }).catch(() => {});
      }
      return;
    }

    // ── Lobby-Abstimmung ──
    const lobbyPollsRm = loadLobbyPolls();
    const lobbyPollRm  = lobbyPollsRm[reaction.message.id];
    if (lobbyPollRm) {
      const emoji = reaction.emoji.name;
      if (lobbyPollRm.voters && lobbyPollRm.voters[user.id] === emoji) {
        delete lobbyPollRm.voters[user.id];
        saveLobbyPolls(lobbyPollsRm);
      }
      return;
    }

    // ── Vorschlag ──
    const vorschlaegeRm = loadVorschlaege();
    const vorschlagRm = vorschlaegeRm.find(v => v.msgId === reaction.message.id);
    if (vorschlagRm && vorschlagRm.voters) {
      const emoji = reaction.emoji.name;
      if (vorschlagRm.voters[user.id] === emoji) {
        delete vorschlagRm.voters[user.id];
        saveVorschlaege(vorschlaegeRm);
      }
      return;
    }

    // ── Aktivitätscheck ──
    const aktChecks = loadAktivitaet();
    const aktCheck  = aktChecks[reaction.message.id];
    if (aktCheck) {
      const emoji = reaction.emoji.name;
      if (emoji !== '\u2705') return;
      const before = aktCheck.members.length;
      aktCheck.members = aktCheck.members.filter(m => m.id !== user.id);
      if (aktCheck.members.length !== before) {
        saveAktivitaet(aktChecks);
        await reaction.message.edit({ embeds: [buildAktivitaetEmbed(aktCheck)] }).catch(() => {});
      }
    }
  } catch (e) { console.error('ReactionRemove Fehler:', e.message); }
});

client.on('messageCreate', async (message) => {
    // Bearbeiter-Tracking für Tickets
    if (!message.author.bot && message.guild) {
      const tickets = loadTickets();
      const ticket  = tickets[message.channel.id];
      if (ticket && !ticket.closed && !ticket.bearbeiter) {
        const mbr = await message.guild.members.fetch(message.author.id).catch(() => null);
        if (mbr && hasTicketRights(mbr, ticket.type) && message.author.id !== ticket.openerId) {
          ticket.bearbeiter    = message.author.id;
          ticket.bearbeiterTag = message.author.tag;
          saveTickets(tickets);
          // Bearbeiter im Welcome-Embed aktualisieren
          if (ticket.welcomeMsgId) {
            try {
              const wMsg = await message.channel.messages.fetch(ticket.welcomeMsgId);
              if (wMsg && wMsg.embeds.length > 0) {
                const oldEmbed = wMsg.embeds[0];
                const newEmbed = EmbedBuilder.from(oldEmbed);
                const fields = oldEmbed.fields.map(f =>
                  f.name === '🛠️ Bearbeiter'
                    ? { name: '🛠️ Bearbeiter', value: `<@${message.author.id}>`, inline: true }
                    : f
                );
                newEmbed.setFields(fields);
                await wMsg.edit({ embeds: [newEmbed] });
              }
            } catch (e) { console.error('Embed-Update Fehler:', e.message); }
          }
        }
      }
    }
  
  if (message.author.bot || !message.guild) return;

      // ── Zähl-Counter ─────────────────────────────────────────────────────────
      if (message.channel.id === COUNTER_CH) {
        const num = parseInt(message.content.trim(), 10);
        const ctr = loadCounter();
        const expected = ctr.count + 1;

        // Not a number → delete silently
        if (isNaN(num) || message.content.trim() !== String(num)) {
          await message.delete().catch(() => {});
          return;
        }

        // Same user twice in a row
        if (message.author.id === ctr.lastUserId) {
          await message.react('❌').catch(() => {});
          await message.reply({ content: `❌ <@${message.author.id}> Du kannst nicht zweimal hintereinander zählen! Neustart bei **1**.` }).catch(() => {});
          saveCounter({ count: 0, lastUserId: null });
          return;
        }

        // Wrong number
        if (num !== expected) {
          await message.react('❌').catch(() => {});
          await message.reply({ content: `❌ <@${message.author.id}> Falsch! Es kam **${expected}**, nicht ${num}. Neustart bei **1**.` }).catch(() => {});
          saveCounter({ count: 0, lastUserId: null });
          return;
        }

        // Correct!
        ctr.count = num;
        ctr.lastUserId = message.author.id;
        saveCounter(ctr);

        if (num === COUNTER_GOAL) {
          await message.react('🎉').catch(() => {});
          await message.channel.send(
            `🎉🎊 **${COUNTER_GOAL} erreicht!** Unglaublich — wir haben es geschafft! Neustart bei **1**.`
          ).catch(() => {});
          saveCounter({ count: 0, lastUserId: null });
        } else {
          const milestones = [100,200,250,300,400,500,600,700,750,800,900,950,999];
          if (milestones.includes(num)) {
            await message.react('🔥').catch(() => {});
          } else {
            await message.react('✅').catch(() => {});
          }
        }
        return;
      }

  
    // ── 67 → 69 (via Webhook, wirkt wie echte Nachricht) ────────────────────
    if (message.content.includes('67')) {
      const newContent = message.content.replace(/67/g, '69');
      try {
        const hooks = await message.channel.fetchWebhooks();
        let hook = hooks.find(h => h.owner?.id === client.user.id && h.name === 'PCR-Edit');
        if (!hook) hook = await message.channel.createWebhook({ name: 'PCR-Edit', avatar: client.user.displayAvatarURL() });
        await message.delete().catch(() => {});
        await hook.send({
          content: newContent,
          username: message.member?.displayName || message.author.username,
          avatarURL: message.author.displayAvatarURL({ dynamic: true }),
        });
      } catch (e) { console.error('[67→69] Webhook Fehler:', e.message); }
      return;
    }
  const member = message.member ||
    await message.guild.members.fetch(message.author.id).catch(() => null);

  // !hallo
  if (message.content.toLowerCase() === '!hallo') {
    await message.reply(`👋 Hallo ${message.author.username}! Willkommen bei **Paradise City Roleplay**!`);
    return;
  }

  // ── 1. Discord-Invite-Links ───────────────────────────────────────────────
  if (!isExempt(member) && INVITE_REGEX.test(message.content)) {
    INVITE_REGEX.lastIndex = 0;
    await message.delete().catch(() => {});
    try {
      await message.author.send({ embeds: [new EmbedBuilder()
        .setColor(Colors.Red).setTitle('⛔ Regelverstoß — Discord-Einladung')
        .setDescription(
          'Das Senden von Discord-Server-Einladungen ist auf **Paradise City Roleplay** nicht erlaubt.\n\n' +
          '⚠️ **Dein Verstoß wurde an das Serverteam weitergeleitet und wird sanktioniert.**'
        ).setTimestamp()
      ]});
    } catch {}
    await sendLog(CH.ACTIVITY, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🚨 Aktivitätswarnung — Discord-Link')
      .addFields(
        { name: 'Nutzer', value: `<@${message.author.id}> (${message.author.tag})` },
        { name: 'Kanal',  value: `<#${message.channel.id}>` },
        { name: 'Inhalt', value: message.content.slice(0, 200) },
        { name: 'Aktion', value: '🗑️ Nachricht gelöscht, Team informiert' }
      ).setTimestamp()
    );
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Orange).setTitle('⚠️ Regelverstoß — Discord-Link')
      .addFields(
        { name: 'Nutzer', value: `<@${message.author.id}> (${message.author.tag})` },
        { name: 'Kanal',  value: `<#${message.channel.id}>` }
      ).setTimestamp()
    );
    return;
  }

  // ── 2. Normale Links (http/https) ─────────────────────────────────────────
  URL_REGEX.lastIndex = 0;
  if (!isLinkExempt(member) && URL_REGEX.test(message.content)) {
    URL_REGEX.lastIndex = 0;
    await message.delete().catch(() => {});
    await sendPrivate(
      member,
      message.channel,
      `⚠️ Bitte verschicke Links nur im Kanal <#${CH.LINK_CHANNEL}>!`
    );
    return;
  }

  // ── 3. Spam-Erkennung ─────────────────────────────────────────────────────
  if (!isExempt(member)) {
    const userId = message.author.id;
    if (!spamTracker.has(userId))
      spamTracker.set(userId, { msgs: [], violations: 0, windowTimer: null });
    const tracker = spamTracker.get(userId);
    tracker.msgs.push(message);

    // Fenster zurücksetzen
    if (tracker.windowTimer) clearTimeout(tracker.windowTimer);
    tracker.windowTimer = setTimeout(() => {
      if (spamTracker.has(userId)) spamTracker.get(userId).msgs = [];
    }, SPAM_WINDOW_MS);

    if (tracker.msgs.length >= SPAM_LIMIT) {
      const toDelete = [...tracker.msgs];
      tracker.msgs   = [];
      tracker.violations += 1;

      // ALLE gespeicherten Spam-Nachrichten löschen
      await Promise.allSettled(toDelete.map(m => m.delete()));

      // Nur die Person sieht die Warnung
      await sendPrivate(
        member,
        message.channel,
        '⚠️ Du hast zu viele Nachrichten auf einmal gesendet! Bitte verlangsame dich.'
      );

      // Bei 3 Verstößen → 10min Timeout
      if (tracker.violations >= SPAM_TIMEOUT_VIOLATIONS) {
        tracker.violations = 0;
        try {
          await member.timeout(SPAM_TIMEOUT_DURATION, 'Spam (3 Wiederholungen)');
          await sendLog(CH.MOD_LOG, new EmbedBuilder()
            .setColor(Colors.Red).setTitle('⏱️ Timeout — Spam')
            .addFields(
              { name: 'Nutzer', value: `<@${message.author.id}> (${message.author.tag})` },
              { name: 'Dauer',  value: '10 Minuten' },
              { name: 'Grund',  value: '3x Spam-Verstöße' }
            ).setTimestamp()
          );
        } catch (e) { console.error('Timeout Fehler:', e.message); }
      }
    }
  }
});

// ─── NACHRICHT GELÖSCHT ───────────────────────────────────────────────────────
client.on('messageDelete', async (message) => {
  if (message.author?.bot) return;
  const entry   = await getAuditEntry(message.guild, AuditLogEvent.MessageDelete);
  const deleter = entry?.executor;
  await sendLog(CH.MSG_LOG, new EmbedBuilder()
    .setColor(Colors.Red).setTitle('🗑️ Nachricht gelöscht')
    .addFields(
      { name: 'Autor',        value: message.author ? `<@${message.author.id}> (${message.author.tag})` : 'Unbekannt' },
      { name: 'Kanal',        value: `<#${message.channel.id}>` },
      { name: 'Inhalt',       value: message.content?.slice(0, 1000) || '_kein Text_' },
      { name: 'Gelöscht von', value: deleter ? `<@${deleter.id}> (${deleter.tag})` : 'Nutzer selbst / unbekannt' }
    ).setTimestamp()
  );
});

// ─── NACHRICHT BEARBEITET ─────────────────────────────────────────────────────
client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
  await sendLog(CH.MSG_LOG, new EmbedBuilder()
    .setColor(Colors.Yellow).setTitle('✏️ Nachricht bearbeitet')
    .addFields(
      { name: 'Nutzer',  value: `<@${newMsg.author.id}> (${newMsg.author.tag})` },
      { name: 'Kanal',   value: `<#${newMsg.channel.id}>` },
      { name: 'Vorher',  value: oldMsg.content?.slice(0, 500) || '_unbekannt_' },
      { name: 'Nachher', value: newMsg.content?.slice(0, 500) || '_leer_' }
    ).setTimestamp()
  );
});

// ─── KANAL / ROLLE EVENTS ─────────────────────────────────────────────────────
client.on('channelDelete', async (channel) => {
  const entry    = await getAuditEntry(channel.guild, AuditLogEvent.ChannelDelete);
  const executor = entry?.executor;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Red).setTitle('🗑️ Kanal gelöscht')
    .addFields(
      { name: 'Kanal',        value: channel.name },
      { name: 'Gelöscht von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' }
    ).setTimestamp()
  );
  if (!executor) return;
  const member = await channel.guild.members.fetch(executor.id).catch(() => null);
  if (!member || isExempt(member)) return;
  try {
    await member.timeout(20 * 60 * 1000, 'Kanal gelöscht');
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('⏱️ Timeout — Kanal gelöscht')
      .addFields(
        { name: 'Nutzer', value: `<@${executor.id}> (${executor.tag})` },
        { name: 'Dauer',  value: '20 Minuten' },
        { name: 'Grund',  value: `Kanal **${channel.name}** gelöscht` }
      ).setTimestamp()
    );
  } catch (e) { console.error('Timeout Fehler:', e.message); }
});

client.on('channelCreate', async (channel) => {
  const entry    = await getAuditEntry(channel.guild, AuditLogEvent.ChannelCreate);
  const executor = entry?.executor;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Green).setTitle('➕ Kanal erstellt')
    .addFields(
      { name: 'Kanal',        value: `<#${channel.id}> (${channel.name})` },
      { name: 'Erstellt von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' }
    ).setTimestamp()
  );
});

client.on('channelUpdate', async (oldCh, newCh) => {
  const entry    = await getAuditEntry(newCh.guild, AuditLogEvent.ChannelUpdate);
  const executor = entry?.executor;
  if (executor?.id === client.user?.id) return;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Yellow).setTitle('✏️ Kanal bearbeitet')
    .addFields(
      { name: 'Kanal',          value: `<#${newCh.id}>` },
      { name: 'Bearbeitet von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' },
      { name: 'Alter Name',     value: oldCh.name, inline: true },
      { name: 'Neuer Name',     value: newCh.name, inline: true }
    ).setTimestamp()
  );
});

client.on('roleCreate', async (role) => {
  const entry    = await getAuditEntry(role.guild, AuditLogEvent.RoleCreate);
  const executor = entry?.executor;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Green).setTitle('➕ Rolle erstellt')
    .addFields(
      { name: 'Rolle',        value: `${role.name} (${role.id})` },
      { name: 'Erstellt von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' }
    ).setTimestamp()
  );
});

client.on('roleDelete', async (role) => {
  const entry    = await getAuditEntry(role.guild, AuditLogEvent.RoleDelete);
  const executor = entry?.executor;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Red).setTitle('🗑️ Rolle gelöscht')
    .addFields(
      { name: 'Rolle',        value: role.name },
      { name: 'Gelöscht von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' }
    ).setTimestamp()
  );
  if (!executor) return;
  const member = await role.guild.members.fetch(executor.id).catch(() => null);
  if (!member || isExempt(member)) return;
  try {
    await member.timeout(20 * 60 * 1000, 'Rolle gelöscht');
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('⏱️ Timeout — Rolle gelöscht')
      .addFields(
        { name: 'Nutzer', value: `<@${executor.id}> (${executor.tag})` },
        { name: 'Dauer',  value: '20 Minuten' },
        { name: 'Grund',  value: `Rolle **${role.name}** gelöscht` }
      ).setTimestamp()
    );
  } catch (e) { console.error('Timeout Fehler:', e.message); }
});

client.on('roleUpdate', async (oldRole, newRole) => {
  // Nur loggen wenn echte Rolleneigenschaften geändert wurden (nicht bei Personen-Rollen-Zuweisung)
  const realChange = oldRole.name !== newRole.name
    || oldRole.color !== newRole.color
    || oldRole.hoist !== newRole.hoist
    || oldRole.mentionable !== newRole.mentionable
    || oldRole.permissions.bitfield !== newRole.permissions.bitfield;
  if (!realChange) return;
  const entry    = await getAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate);
  const executor = entry?.executor;
  await sendLog(CH.SERVER_LOG, new EmbedBuilder()
    .setColor(Colors.Yellow).setTitle('✏️ Rolle bearbeitet')
    .addFields(
      { name: 'Rolle',          value: `${newRole.name} (${newRole.id})` },
      { name: 'Bearbeitet von', value: executor ? `<@${executor.id}> (${executor.tag})` : 'Unbekannt' },
      { name: 'Alter Name',     value: oldRole.name, inline: true },
      { name: 'Neuer Name',     value: newRole.name, inline: true }
    ).setTimestamp()
  );
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
client.on('guildAuditLogEntryCreate', async (entry, guild) => {
  if (entry.action === AuditLogEvent.MemberUpdate) {
    const tc = entry.changes?.find(c => c.key === 'communication_disabled_until');
    if (tc?.newValue) {
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Orange).setTitle('⏱️ Timeout vergeben')
        .addFields(
          { name: 'Nutzer', value: entry.targetId ? `<@${entry.targetId}>` : 'Unbekannt' },
          { name: 'Von',    value: entry.executor ? `<@${entry.executor.id}>` : 'Unbekannt' },
          { name: 'Bis',    value: `<t:${Math.floor(new Date(tc.newValue).getTime() / 1000)}:F>` },
          { name: 'Grund',  value: entry.reason || '_kein Grund_' }
        ).setTimestamp()
      );
    }
  }
  if (entry.action === AuditLogEvent.MemberBanAdd) {
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.DarkRed).setTitle('🔨 Ban vergeben')
      .addFields(
        { name: 'Nutzer', value: entry.targetId ? `<@${entry.targetId}>` : 'Unbekannt' },
        { name: 'Von',    value: entry.executor ? `<@${entry.executor.id}>` : 'Unbekannt' },
        { name: 'Grund',  value: entry.reason || '_kein Grund_' }
      ).setTimestamp()
    );
  }
  if (entry.action === AuditLogEvent.MemberBanRemove) {
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('✅ Ban aufgehoben')
      .addFields(
        { name: 'Nutzer', value: entry.targetId ? `<@${entry.targetId}>` : 'Unbekannt' },
        { name: 'Von',    value: entry.executor ? `<@${entry.executor.id}>` : 'Unbekannt' }
      ).setTimestamp()
    );
  }
  if ([AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete].includes(entry.action)) {
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Blurple).setTitle('🔒 Kanal-Rechte geändert')
      .addFields(
        { name: 'Kanal',        value: `<#${entry.targetId}>` },
        { name: 'Geändert von', value: entry.executor ? `<@${entry.executor.id}> (${entry.executor.tag})` : 'Unbekannt' }
      ).setTimestamp()
    );
  }
});

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

    // ── LAPD Dashboard Button ──────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'lapd_dashboard') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const LAPD_GUILD_ID_B = '1498482541751963698';
        const LAPD_RANKS_B = [
      {id:'1498483561982984212',name:'Command Staff (Leitung)',   ebene:'leitung'  },
      {id:'1498484038363648121',name:'Supervisory Staff (Befehl)',ebene:'befehl'   },
      {id:'1498484537368510504',name:'Detective Division',        ebene:'detective'},
      {id:'1498484869863444660',name:'Officer Division',         ebene:'officer'  },
    ];
        let guild = client.guilds.cache.get(LAPD_GUILD_ID_B);
        if (!guild) guild = await client.guilds.fetch(LAPD_GUILD_ID_B).catch(() => null);
        if (!guild) {
          return interaction.editReply({ content: '❌ LAPD-Server nicht erreichbar.' });
        }
        const member = await guild.members.fetch({ user: interaction.user.id, force: true }).catch(() => null);
        if (!member) {
          return interaction.editReply({ content: '❌ Du bist kein Mitglied des LAPD-Servers.' });
        }
        const memberRanks = LAPD_RANKS_B.filter(r => member.roles.cache.has(r.id));
        if (memberRanks.length === 0) {
          // Nochmal versuchen mit explizitem Roles-Fetch
          await member.fetch().catch(()=>{});
          const retryRanks = LAPD_RANKS_B.filter(r => member.roles.cache.has(r.id));
          if (retryRanks.length === 0) {
            return interaction.editReply({ content: '❌ Du hast keine LAPD-Rolle auf dem Server 1498482541751963698.' });
          }
          memberRanks.push(...retryRanks);
        }
        const token   = require('crypto').randomBytes(32).toString('hex');
        const expires = Date.now() + 10 * 60 * 1000; // 10 Minuten
        lapdTokens.set(token, { memberId: member.id, uname: member.user.username, displayName: member.displayName, ranks: memberRanks, expires });
        // Token nach Ablauf aufräumen
        setTimeout(() => lapdTokens.delete(token), 10 * 60 * 1000);
        const _LAPD_BASE = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/,'');
        const authUrl = _LAPD_BASE + '/lapd/auth/' + token;
        const LAPD_PW_B = { leitung:'LAPD_Chief_2025', befehl:'LAPD_Command_2025', detective:'LAPD_Detective_2025', officer:'LAPD_Officer_2025' };
        const rankLine  = memberRanks[0] ? memberRanks[0].name : 'Unbekannter Rang';
        const ebene     = memberRanks[0] ? memberRanks[0].ebene : 'officer';
        const pw        = LAPD_PW_B[ebene] || '—';
        const replyEmbed = new EmbedBuilder()
          .setColor(0x0e1f52)
          .setTitle('🛡️ LAPD Dashboard')
          .setDescription(
            '👤 **' + member.displayName + '**\n' +
            '🎖️ **Rang:** ' + rankLine + '\n' +
            '🔑 **Passwort:** `' + pw + '`\n\n' +
            'Klicke den Button, gib das Passwort ein und du bist drin.\n' +
            'Der Link ist **10 Minuten** gültig.'
          )
          .setFooter({ text: 'Nur für dich sichtbar • Nicht weitergeben' });
        const authBtn = new ButtonBuilder().setLabel('🛡️ Dashboard öffnen').setURL(authUrl).setStyle(ButtonStyle.Link);
        const authRow = new ActionRowBuilder().addComponents(authBtn);
        return interaction.editReply({
          embeds: [replyEmbed],
          components: [authRow]
        });
      } catch (e) {
        console.error('LAPD Button Fehler:', e.message);
        return interaction.editReply({ content: '❌ Fehler beim Generieren des Login-Links.' });
      }
    } // end lapd_dashboard

    // ── Vacation Approve ─────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('lapd_vac_approve_')) {
      const vacId = interaction.customId.replace('lapd_vac_approve_', '');
      const vacFile = require('path').join(DATA_DIR, 'lapd_vacations.json');
      let vacs = [];
      try { vacs = JSON.parse(require('fs').readFileSync(vacFile,'utf8')); } catch {}
      const vac = vacs.find(v => v.id === vacId);
      if (!vac) return interaction.reply({ content: '❌ Vacation request not found.', ephemeral: true });
      if (vac.status !== 'pending') return interaction.reply({ content: '⚠️ This request has already been reviewed.', ephemeral: true });
      vac.status = 'approved';
      vac.reviewerName = interaction.user.username;
      vac.reviewedAt = Date.now();
      require('fs').writeFileSync(vacFile, JSON.stringify(vacs, null, 2), 'utf8');
      await interaction.update({ components: [] }).catch(() => {});
      await interaction.followUp({ content: '✅ Vacation request **approved** by '+interaction.user.username+'.', ephemeral: false }).catch(() => {});
      // DM requester
      try {
        const reqUser = await client.users.fetch(vac.userId).catch(() => null);
        if (reqUser) {
          const { EmbedBuilder: _AVEB } = require('discord.js');
          const aEmbed = new _AVEB()
            .setColor(0x66bb6a)
            .setTitle('✅ Vacation Request — Approved')
            .setDescription('Your vacation request has been approved.')
            .addFields(
              { name: 'Period', value: vac.from + ' — ' + vac.to, inline: true },
              { name: 'Approved by', value: interaction.user.username, inline: true }
            )
            .setFooter({ text: 'With kind regards, LAPD Command Staff' })
            .setTimestamp();
          await reqUser.send({ embeds: [aEmbed] }).catch(() => {});
        }
      } catch (e) { console.error('vac approve DM:', e.message); }
      return;
    }

    // ── Vacation Reject (show modal) ─────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('lapd_vac_reject_')) {
      const vacId = interaction.customId.replace('lapd_vac_reject_', '');
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder: _MRAB } = require('discord.js');
      const modal = new ModalBuilder()
        .setCustomId('lapd_vac_reject_modal_' + vacId)
        .setTitle('Reject Vacation Request');
      const input = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('Reason for rejection')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(5)
        .setMaxLength(500)
        .setRequired(true);
      modal.addComponents(new _MRAB().addComponents(input));
      return interaction.showModal(modal);
    }

    // ── Vacation Reject Modal Submit ─────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId.startsWith('lapd_vac_reject_modal_')) {
      const vacId = interaction.customId.replace('lapd_vac_reject_modal_', '');
      const reason = interaction.fields.getTextInputValue('reason');
      const vacFile = require('path').join(DATA_DIR, 'lapd_vacations.json');
      let vacs = [];
      try { vacs = JSON.parse(require('fs').readFileSync(vacFile,'utf8')); } catch {}
      const vac = vacs.find(v => v.id === vacId);
      if (!vac) return interaction.reply({ content: '❌ Vacation request not found.', ephemeral: true });
      if (vac.status !== 'pending') return interaction.reply({ content: '⚠️ Already reviewed.', ephemeral: true });
      vac.status = 'rejected';
      vac.rejectReason = reason;
      vac.reviewerName = interaction.user.username;
      vac.reviewedAt = Date.now();
      require('fs').writeFileSync(vacFile, JSON.stringify(vacs, null, 2), 'utf8');
      await interaction.reply({ content: '❌ Vacation request **rejected**.', ephemeral: false }).catch(() => {});
      // DM requester
      try {
        const reqUser = await client.users.fetch(vac.userId).catch(() => null);
        if (reqUser) {
          const { EmbedBuilder: _RVEB } = require('discord.js');
          const rEmbed = new _RVEB()
            .setColor(0xb71c1c)
            .setTitle('❌ Vacation Request — Rejected')
            .setDescription('Your vacation request has been rejected.')
            .addFields(
              { name: 'Period', value: vac.from + ' — ' + vac.to, inline: true },
              { name: 'Rejected by', value: interaction.user.username, inline: true },
              { name: 'Reason', value: reason }
            )
            .setFooter({ text: 'LAPD Command Staff' })
            .setTimestamp();
          await reqUser.send({ embeds: [rEmbed] }).catch(() => {});
        }
      } catch (e) { console.error('vac reject DM:', e.message); }
      return;
    }

    // ── Autocomplete: Fraktionsnamen ──────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const cmd = interaction.commandName;
      const frakCmds = ['frak-delete','frakwarn','frakwarn-remove','fraksperre','fraksperre-remove'];
      if (frakCmds.includes(cmd)) {
        const focused = interaction.options.getFocused().toLowerCase();
        const data = loadFraktionen();
        const choices = Object.keys(data)
          .filter(n => n.toLowerCase().includes(focused))
          .slice(0, 25)
          .map(n => ({ name: `${n} [${data[n].typ}]`, value: n }));
        return interaction.respond(choices);
      }
      if (cmd === 'vorschlag-yes' || cmd === 'vorschlag-no') {
          const focused = interaction.options.getFocused().toLowerCase();
          const vorschlaege = loadVorschlaege();
          const choices = vorschlaege
            .filter(v => v.status === 'offen')
            .filter(v => v.text.toLowerCase().includes(focused) || String(v.id).includes(focused))
            .slice(0, 25)
            .map(v => ({ name: `#${v.id} — ${v.text.slice(0, 80)}`, value: String(v.id) }));
          return interaction.respond(choices);
        }
        if (cmd === 'übergeben' || cmd === 'use') {
          const focused = interaction.options.getFocused().toLowerCase();
          const inv = getUserInv(interaction.user.id);
          const choices = Object.entries(inv)
            .filter(([n]) => n.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(([n, q]) => ({ name: stripCustomEmoji(n) + '  (' + q + 'x)', value: n }));
          return interaction.respond(choices);
        }
        if (cmd === 'item-give') {
          const focused = interaction.options.getFocused().toLowerCase();
          const items = loadItems();
          const shops = loadShops();
          const shopItems = Object.values(shops).flat().map(i => i.name).filter(Boolean);
          const allItems = [...new Set([...items, ...shopItems])].sort((a,b) => a.localeCompare(b,'de'));
          const choices = allItems
            .filter(n => n.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(n => { const nm = stripCustomEmoji(n).slice(0,100); return nm ? { name: nm, value: n.slice(0,100) } : null; })
            .filter(Boolean);
          return interaction.respond(choices);
        }
        if (cmd === 'item-remove') {
          const focused = interaction.options.getFocused().toLowerCase();
          // Ziel-Spieler ID aus den bereits gesetzten Optionen holen
          const targetId = interaction.options.get('spieler')?.value;
          if (targetId) {
            // Nur Items anzeigen die der Spieler tatsächlich hat
            const inv = getUserInv(targetId);
            const choices = Object.entries(inv)
              .filter(([n]) => n.toLowerCase().includes(focused))
              .sort((a, b) => a[0].localeCompare(b[0], 'de'))
              .slice(0, 25)
              .map(([n, q]) => ({ name: stripCustomEmoji(n) + '  (' + q + 'x)', value: n }));
            return interaction.respond(choices);
          }
          // Fallback: alle Items (wenn noch kein Spieler gewählt)
          const items = loadItems();
          const shops = loadShops();
          const shopItems = Object.values(shops).flat().map(i => i.name).filter(Boolean);
          const allItems = [...new Set([...items, ...shopItems])].sort((a,b) => a.localeCompare(b,'de'));
          const choices = allItems
            .filter(n => n.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(n => { const nm = stripCustomEmoji(n).slice(0,100); return nm ? { name: nm, value: n.slice(0,100) } : null; })
            .filter(Boolean);
          return interaction.respond(choices);
        }
        if (cmd === 'teamshop-delete') {
          const focused = interaction.options.getFocused().toLowerCase();
          const shops = loadShops();
          const choices = (shops.team||[]).filter(i => i.name.toLowerCase().includes(focused)).slice(0,25).map(i => ({name:i.name,value:i.name}));
          return interaction.respond(choices);
        }
        if (cmd === 'shop-edit' || cmd === 'shop-delete') {
          const shopId  = interaction.options.getString('shop');
          const focused = interaction.options.getFocused().toLowerCase();
          if (!shopId) return interaction.respond([]);
          const shops   = loadShops();
          const choices = (shops[shopId]||[]).filter(i => i.name.toLowerCase().includes(focused)).slice(0,25).map(i => ({name:i.name + ' — ' + i.preis,value:i.name}));
          return interaction.respond(choices);
        }
        return interaction.respond([]);
    }

    if (!interaction.isChatInputCommand()) return;
  const { commandName, member, user } = interaction;

  // /delete
  if (commandName === 'delete') {
    if (!member.permissions.has(PermissionFlagsBits.ManageMessages))
      return interaction.reply({ content: '⛔ Du hast keine Berechtigung dafür.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    let deleted = 0, remaining = interaction.options.getInteger('anzahl');
    while (remaining > 0) {
      const batch = Math.min(remaining, 100);
      const msgs  = await interaction.channel.bulkDelete(batch, true).catch(() => null);
      if (!msgs || msgs.size === 0) break;
      deleted   += msgs.size;
      remaining -= msgs.size;
      if (msgs.size < batch) break;
    }
    await interaction.editReply({ content: `✅ ${deleted} Nachrichten wurden gelöscht.` });
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Orange).setTitle('🗑️ /delete ausgeführt')
      .addFields(
        { name: 'Von',      value: `<@${user.id}> (${user.tag})` },
        { name: 'Kanal',    value: `<#${interaction.channel.id}>` },
        { name: 'Gelöscht', value: `${deleted} Nachrichten` }
      ).setTimestamp()
    );
    return;
  }

  // /teamwarn

  // ── /ban ─────────────────────────────────────────────────────────────────
  if (commandName === 'ban') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '\u274C Keine Berechtigung f\u00fcr permanente Bans.', ephemeral: true });
    }
    const target  = interaction.options.getUser('nutzer');
    const grund   = interaction.options.getString('grund');
    if (target.id === interaction.user.id)
      return interaction.reply({ content: '\u274C Du kannst dich nicht selbst bannen.', ephemeral: true });
    try {
      await interaction.guild.members.ban(target.id, { reason: grund, deleteMessageSeconds: 0 });
      const logCh = await client.channels.fetch(CH.MOD_LOG).catch(() => null);
      if (logCh) {
        await logCh.send({ embeds: [new EmbedBuilder()
          .setColor(0x7f1d1d)
          .setTitle('\u{1F528} Permanenter Ban')
          .addFields(
            { name: 'Nutzer',     value: target.tag + ' (`' + target.id + '`)', inline: true },
            { name: 'Moderator',  value: interaction.user.tag + ' (`' + interaction.user.id + '`)', inline: true },
            { name: 'Grund',      value: grund },
            { name: 'Hinweis',    value: '\u26A0\uFE0F Discord-Bots haben keinen Zugriff auf IP-Adressen. Der Discord-Account ist dauerhaft gebannt.' }
          )
          .setTimestamp()
          .setFooter({ text: 'Paradise City Roleplay \u2022 Mod Log' })
        ] });
      }
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(0x7f1d1d)
          .setTitle('\u{1F528} Nutzer gebannt')
          .setDescription('**' + target.tag + '** wurde permanent vom Server entfernt.')
          .addFields({ name: 'Grund', value: grund })
          .setTimestamp()
        ],
        ephemeral: true
      });
    } catch (e) {
      return interaction.reply({ content: '\u274C Ban fehlgeschlagen: ' + e.message, ephemeral: true });
    }
  }


  // ── /unban ──────────────────────────────────────────────────────────────────
  if (commandName === 'unban') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Keine Berechtigung für Unbans.', ephemeral: true });
    }
    const userId = interaction.options.getString('nutzer_id').trim();
    const grund  = interaction.options.getString('grund') || 'Kein Grund angegeben';
    try {
      await interaction.guild.members.unban(userId, grund);
      const logCh = await client.channels.fetch(CH.MOD_LOG).catch(() => null);
      if (logCh) await logCh.send({ embeds: [new EmbedBuilder().setColor(0x16a34a).setTitle('✅ Unban')
        .addFields({ name:'Nutzer-ID', value: userId, inline:true },{ name:'Moderator', value:`${interaction.user.tag} (${interaction.user.id})`, inline:true },{ name:'Grund', value:grund })
        .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Mod Log' })] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x16a34a).setTitle('✅ Nutzer entbannt').setDescription(`Nutzer ${userId} wurde vom Server entbannt.`).addFields({ name:'Grund', value:grund }).setTimestamp()], ephemeral: true });
    } catch (e) {
      return interaction.reply({ content: '❌ Unban fehlgeschlagen: ' + e.message, ephemeral: true });
    }
  }

  // ── /timeout ─────────────────────────────────────────────────────────────────
  if (commandName === 'timeout') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers) &&
        !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Keine Berechtigung für Timeouts.', ephemeral: true });
    }
    const target = interaction.options.getUser('spieler');
    const dauer  = parseInt(interaction.options.getString('dauer'));
    const grund  = interaction.options.getString('grund');
    if (target.id === interaction.user.id)
      return interaction.reply({ content: '❌ Du kannst dich nicht selbst timeouten.', ephemeral: true });
    try {
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Mitglied nicht gefunden.', ephemeral: true });
      await member.timeout(dauer, grund);
      const dauerLabel = dauer < 3600000 ? (dauer/60000)+' Min.' : dauer < 86400000 ? (dauer/3600000)+' Std.' : (dauer/86400000)+' Tage';
      const logCh = await client.channels.fetch(CH.MOD_LOG).catch(() => null);
      if (logCh) await logCh.send({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('⏱️ Timeout')
        .addFields({ name:'Spieler', value:`${target.tag} (${target.id})`, inline:true },{ name:'Moderator', value:`${interaction.user.tag}`, inline:true },{ name:'Dauer', value:dauerLabel, inline:true },{ name:'Grund', value:grund })
        .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Mod Log' })] });
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle('⏱️ Timeout gesetzt').addFields({ name:'Spieler', value:`${target.tag}`, inline:true },{ name:'Dauer', value:dauerLabel, inline:true },{ name:'Grund', value:grund }).setTimestamp()], ephemeral: true });
    } catch (e) {
      const hint = e.message.toLowerCase().includes('missing permissions')
        ? '❌ Timeout fehlgeschlagen: Der Bot hat keine Berechtigung. Bitte gib der Bot-Rolle die Berechtigung **"Mitglieder per Timeout stummschalten"** in den Servereinstellungen, oder stelle sicher dass die Bot-Rolle höher als die Rolle des Spielers ist.'
        : '❌ Timeout fehlgeschlagen: ' + e.message;
      return interaction.reply({ content: hint, ephemeral: true });
    }
  }

  if (commandName === 'teamwarn') {
    const target     = interaction.options.getUser('nutzer');
    const grund      = interaction.options.getString('grund');
    const konsequenz = interaction.options.getString('konsequenz');
    const warnsData  = loadWarns();
    if (!warnsData[target.id]) warnsData[target.id] = [];
    const warnEntry = { id: generateId(), grund, konsequenz, moderator: user.id, moderatorTag: user.tag, timestamp: new Date().toISOString() };
    warnsData[target.id].push(warnEntry);
    saveWarns(warnsData);
    const warnCount = warnsData[target.id].length;

    const warnEmbed = new EmbedBuilder()
      .setColor(0xD32F2F)
      .setTitle('🚨  Team Warn')
      .setDescription(`**Ein Teammitglied hat eine offizielle Verwarnung erhalten.**\n${'━'.repeat(38)}`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤  Verwarnt',         value: `<@${target.id}>\n\`${target.tag}\``, inline: true },
        { name: '🛡️  Ausgestellt von', value: `<@${user.id}>\n\`${user.tag}\``,    inline: true },
        { name: '🔢  Verwarnung Nr.',   value: `\`${warnCount}\``,                  inline: true },
        { name: '\u200b', value: `${'━'.repeat(38)}`, inline: false },
        { name: '📋  Grund',            value: `> ${grund}`,                        inline: false },
        { name: '⚡  Konsequenz',       value: `> ${konsequenz}`,                   inline: false },
        { name: '\u200b', value: `${'━'.repeat(38)}`, inline: false },
      )
      .setTimestamp()
      .setFooter({ text: 'Paradise City Roleplay  •  Teamverwarnungssystem' });

    try {
      const warnCh = await client.channels.fetch(CH.TEAM_WARN);
      if (warnCh) await warnCh.send({ embeds: [warnEmbed] });
    } catch (e) { console.error('Team-Warn Fehler:', e.message); }

    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Orange).setTitle('📋 Team Warn ausgestellt')
      .addFields(
        { name: 'Mitglied',   value: `<@${target.id}> (${target.tag})` },
        { name: 'Grund',      value: grund },
        { name: 'Konsequenz', value: konsequenz },
        { name: 'Von',        value: `<@${user.id}>` },
        { name: 'Nummer',     value: `${warnCount}` },
      ).setTimestamp()
    );
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Green)
        .setDescription(`✅ Team Warn für **${target.tag}** ausgestellt (Verwarnung Nr. ${warnCount}).`)],
      ephemeral: true
    });
    return;
  }

  // /teamwarn-remove
  if (commandName === 'teamwarn-remove') {
    const target    = interaction.options.getUser('nutzer');
    const warnsData = loadWarns();
    if (!warnsData[target.id] || warnsData[target.id].length === 0)
      return interaction.reply({ content: `⚠️ Keine Verwarnungen für ${target.tag} gefunden.`, ephemeral: true });
    const removed = warnsData[target.id].pop();
    saveWarns(warnsData);
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('🗑️ Team Warn entfernt')
      .addFields(
        { name: 'Mitglied',     value: `<@${target.id}> (${target.tag})` },
        { name: 'Grund war',    value: removed.grund },
        { name: 'Entfernt von', value: `<@${user.id}>` }
      ).setTimestamp()
    );
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Green)
        .setDescription(`✅ Letzte Team Warn von **${target.tag}** entfernt.\n📋 Grund war: ${removed.grund}`)],
      ephemeral: true
    });
    return;
  }

  // /teamwarn-list
  if (commandName === 'teamwarn-list') {
    const target    = interaction.options.getUser('nutzer');
    const warnsData = loadWarns();
    const warns     = warnsData[target.id] || [];
    if (warns.length === 0)
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(Colors.Green)
          .setDescription(`✅ **${target.tag}** hat keine Team Warns.`)],
        ephemeral: true
      });
    const warnLines = warns.map((w, i) =>
      `**${i + 1}.** 📋 **Grund:** ${w.grund}\n⚡ **Konsequenz:** ${w.konsequenz}\n🛡️ **Von:** ${w.moderatorTag} — <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>`
    ).join('\n\n');
    await interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle(`📋  Team Warns — ${target.tag}`)
        .setDescription(warnLines.slice(0, 4000))
        .addFields({ name: 'Gesamt', value: `${warns.length} Verwarnung(en)` })
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setTimestamp()
      ],
      ephemeral: true
    });
    return;
  }

  // /warn
  if (commandName === 'warn') {
    const target = interaction.options.getUser('spieler');
    const grund  = interaction.options.getString('grund');
    const warns  = loadPlayerWarns();
    if (!warns[target.id]) warns[target.id] = [];
    if (warns[target.id].length >= 3)
      return interaction.reply({ content: '❌ **' + target.username + '** hat bereits 3 Warns (Maximum).', ephemeral: true });
    const warnNum = warns[target.id].length + 1;
    const roleId  = PLAYER_WARN_ROLES[warnNum - 1];
    const entry   = { id: Date.now().toString(), nummer: warnNum, grund, roleId, moderator: user.id, moderatorTag: user.tag, timestamp: new Date().toISOString() };
    warns[target.id].push(entry);
    savePlayerWarns(warns);
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
      if (member && roleId) await member.roles.add(roleId).catch(() => {});
    } catch {}
    try {
      const warnCh = await client.channels.fetch(PLAYER_WARN_CH).catch(() => null);
      if (warnCh) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('🚨 Verwarnung')
          .addFields(
            { name: '👮 Ausgestellt von', value: '<@' + user.id + '>', inline: true },
            { name: '👤 Erteilt an',      value: '<@' + target.id + '>', inline: true },
            { name: '📋 Grund',           value: grund, inline: false },
            { name: '🔢 Verwarnung',      value: warnNum + '/3', inline: false },
          )
          .setFooter({ text: 'Paradise City Roleplay • Verwarnungssystem' })
          .setTimestamp();
        await warnCh.send({ embeds: [embed] });
      }
    } catch (e) { console.error('Warn-Channel Fehler:', e.message); }
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xFF0000)
        .setDescription('🚨 Warn **' + warnNum + '/3** für **' + target.username + '** ausgestellt.\n📋 Grund: ' + grund)],
      ephemeral: true
    });
  }

  // /warn-remove
  if (commandName === 'warn-remove') {
    const target = interaction.options.getUser('spieler');
    const nummer = interaction.options.getInteger('nummer');
    const warns  = loadPlayerWarns();
    const list   = warns[target.id] || [];
    const entry  = list.find(w => w.nummer === nummer);
    if (!entry)
      return interaction.reply({ content: '\u274C Warn Nr. **' + nummer + '** bei **' + target.username + '** nicht gefunden.', ephemeral: true });
    warns[target.id] = list.filter(w => w.id !== entry.id);
    if (warns[target.id].length === 0) delete warns[target.id];
    savePlayerWarns(warns);
    try {
      const guild  = client.guilds.cache.first();
      const member = guild ? await guild.members.fetch(target.id).catch(() => null) : null;
      if (member && entry.roleId) await member.roles.remove(entry.roleId).catch(() => {});
    } catch {}
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0x3FB950)
        .setTitle('\u2705 Warn entfernt')
        .setDescription('Warn Nr. **' + nummer + '** von **' + target.username + '** wurde entfernt.\n\uD83D\uDCCB Grund war: ' + entry.grund)],
      ephemeral: true
    });
  }

  // /warnlist
  if (commandName === 'warnlist') {
    const target = interaction.options.getUser('spieler');
    const warns  = loadPlayerWarns();
    const list   = warns[target.id] || [];
    if (list.length === 0)
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x3FB950)
          .setDescription('\u2705 **' + target.username + '** hat keine aktiven Warns.')],
        ephemeral: true
      });
    const warnBars2 = ['\uD83D\uDFE5\u2B1B\u2B1B\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\u2B1B\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5'];
    const fields = list.map(w =>
      ({ name: '\uD83D\uDEA8 Warn ' + w.nummer + ' / 5  \u2502  ' + warnBars2[w.nummer-1], value: '\uD83D\uDCCB **Grund:** ' + w.grund + '\n\uD83D\uDEE1\uFE0F **Von:** <@' + w.moderator + '> \u2022 <t:' + Math.floor(new Date(w.timestamp).getTime()/1000) + ':R>', inline: false })
    );
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('\uD83D\uDCCB  Warn-Liste — ' + target.username)
        .setDescription('\u2501'.repeat(38) + '\n' + list.length + '/5 aktive Warns\n' + '\u2501'.repeat(38))
        .addFields(...fields)
        .setFooter({ text: 'Paradise City Roleplay  \u2022  Verwarnungssystem' })
        .setTimestamp()],
      ephemeral: true
    });
  }

    // /einreise-code
    if (commandName === 'einreise-code') {
      const existingCodes = loadCodes();
      for (const [k, v] of Object.entries(existingCodes)) {
        if (v.userId === user.id && Date.now() > v.expiresAt) delete existingCodes[k];
      }
      for (const [k, v] of Object.entries(existingCodes)) {
        if (v.userId === user.id) delete existingCodes[k];
      }
      const code    = makeCode();
      const expires = Date.now() + 15 * 60 * 1000;
      existingCodes[code] = { userId: user.id, userTag: user.tag, expiresAt: expires };
      saveCodes(existingCodes);
      await interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('🔑 Dein Einreise-Code')
          .setDescription(
            '**Code:** \x60\x60\x60' + code + '\x60\x60\x60\n1. \u00d6ffne das Einreise-Formular\n2. Trage diesen Code im Feld **"Einreise-Code"** ein\n3. Deine Rollen werden nach dem Absenden automatisch vergeben\n\n\u23f3 G\u00fcltig f\u00fcr **15 Minuten** \u00b7 nur einmalig verwendbar'
          )
          .setFooter({ text: 'Paradise City Roleplay  •  Einreise-System' })
        ],
        ephemeral: true
      });
      return;
    }

    // /ausweis
    if (commandName === 'ausweis') {
      const AUSWEIS_CH = '1490882590012604538';
      if (interaction.channel.id !== AUSWEIS_CH)
        return interaction.reply({ content: '❌ Dieser Befehl ist nur in <#' + AUSWEIS_CH + '> verfügbar.', ephemeral: true });
      const target      = interaction.options.getUser('person') || user;
      const ausweisData = loadAusweis();
      const eintrag     = ausweisData[target.id];
      if (!eintrag || eintrag.typ === 'illegal')
        return interaction.reply({ content: target.id === user.id ? '❌ Du hast noch keinen Ausweis. Bitte reise zuerst legal ein.' : `❌ **${target.username}** hat noch keinen Ausweis.`, ephemeral: true });
      const domainAW = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const viewLink = `https://${domainAW}/ausweis/view/${target.id}`;
      const isSelf = target.id === user.id;
      return interaction.reply({
        content: isSelf
          ? `🆔 **Dein offizieller Ausweis:**\n🔗 [${eintrag.vorname} ${eintrag.nachname} — Ausweis öffnen](${viewLink})\n*Nur für dich sichtbar. Der Link ist dauerhaft gültig.*`
          : `🆔 **Ausweis von ${target.username}:**\n🔗 [${eintrag.vorname} ${eintrag.nachname} — Ausweis öffnen](${viewLink})`,
        ephemeral: true
      });
    }

    // /abstimmung
    if (commandName === 'abstimmung') {
      const frage    = interaction.options.getString('frage');
      const antwort1 = interaction.options.getString('antwort1');
      const antwort2 = interaction.options.getString('antwort2');
      try {
        const ch   = await client.channels.fetch(ABSTIMMUNG_CH);
        const poll = { frage, antwort1, antwort2, voters: {}, channelId: ABSTIMMUNG_CH };
        const msg  = await ch.send({ embeds: [buildAbstimmungEmbed(poll)] });
        await msg.react('\uD83D\uDC4D');
        await msg.react('\uD83D\uDC4E');
        const polls = loadAbstimmungen();
        polls[msg.id] = { ...poll, messageId: msg.id };
        saveAbstimmungen(polls);
        return interaction.reply({ content: '\u2705 Abstimmung erstellt: ' + msg.url, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: '\u274C Fehler: ' + e.message, ephemeral: true });
      }
    }

    // /aktivitätscheck
    if (commandName === 'aktivit\u00e4tscheck') {
      try {
        const ch   = await client.channels.fetch(AKTIVITAET_CH);
        const data = { members: [], createdAt: Date.now(), channelId: AKTIVITAET_CH };
        await ch.send({ content: '<@&1490855722534310003>' });
        const msg  = await ch.send({ embeds: [buildAktivitaetEmbed(data)] });
        await msg.react('\u2705');
        const all = loadAktivitaet();
        all[msg.id] = { ...data, messageId: msg.id };
        saveAktivitaet(all);
        return interaction.reply({ content: '\u2705 Aktivit\u00e4tscheck gestartet: ' + msg.url, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: '\u274C Fehler: ' + e.message, ephemeral: true });
      }
    }

    // /ausweis-create
    if (commandName === 'ausweis-create') {
      const target = interaction.options.getUser('mitglied');
      const art    = interaction.options.getString('einreiseart');
      const ausweise = loadAusweisData();
      if (ausweise[target.id]) {
        return interaction.reply({ content: `❌ **${target.tag}** hat bereits einen Ausweis. Erst mit \`/ausweis-delete\` löschen.`, ephemeral: true });
      }
      if (art === 'illegal') {
        return interaction.reply({ content: '❌ Illegale Bewohner erhalten **keinen Ausweis**.\nDie Illegale Einzel- und Gruppeneinreise berechtigt nicht zur Ausweiserstellung.', ephemeral: true });
      }
      // Legal: DM mit Ausweis-Link
      const tokens = loadAusweisTokens();
      const pending = Object.values(tokens).find(t => t.userId === target.id && t.expiresAt > Date.now());
      const tok    = genToken();
      const domain = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const link   = `https://${domain}/ausweis/create/${tok}`;
      tokens[tok]  = { token: tok, userId: target.id, userTag: target.tag, createdBy: interaction.user.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
      saveAusweisTokens(tokens);
      try {
        await target.send({
          embeds: [new EmbedBuilder().setColor(DARK_ORANGE).setTitle('🆔  Ausweis erstellen — Paradise City Roleplay')
            .setDescription('Du wurdest aufgefordert, deinen Charakter-Ausweis auszufüllen.')
            .addFields({ name: '🔗  Link', value: `[Hier klicken um Ausweis auszufüllen](${link})`, inline: false }, { name: '⏱️  Gültig bis', value: `<t:${Math.floor((Date.now()+86400000)/1000)}:F>`, inline: false })
            .setFooter({ text: 'Paradise City Roleplay  •  Ausweis-Erstellung' }).setTimestamp()]
        });
        return interaction.reply({ content: `✅ DM an **${target.tag}** gesendet mit dem Ausweis-Erstellungslink.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: `❌ Konnte keine DM an **${target.tag}** senden. DMs möglicherweise deaktiviert.`, ephemeral: true });
      }
    }

    // /ausweis-delete
    if (commandName === 'ausweis-delete') {
      const target   = interaction.options.getUser('mitglied');
      const ausweise = loadAusweisData();
      if (!ausweise[target.id]) {
        return interaction.reply({ content: `❌ **${target.tag}** hat keinen Ausweis.`, ephemeral: true });
      }
      delete ausweise[target.id];
      fs.writeFileSync(path.join(DATA_DIR, 'ausweis.json'), JSON.stringify(ausweise, null, 2), 'utf8');
      // Passbild löschen falls vorhanden
      try {
        const uploadsDir = path.join(DATA_DIR, 'uploads');
        if (fs.existsSync(uploadsDir)) {
          const files = fs.readdirSync(uploadsDir).filter(f => f.startsWith(target.id + '.'));
          files.forEach(f => fs.unlinkSync(path.join(uploadsDir, f)));
        }
      } catch {}
      // Rollen zurücksetzen: ROLE_REMOVE hinzufügen, Einreise-Rollen entfernen
        try {
          const _guild = interaction.guild || client.guilds.cache.first();
          const _mem   = _guild ? await _guild.members.fetch(target.id).catch(() => null) : null;
          if (_mem) {
            await _mem.roles.add('1490855725516460234').catch(() => {});
            for (const r of ['1490855719853887569','1490855722534310003','1495982076703539310','1497051373672599622','1490855731950256128','1490855741647618251','1490855728473178282','1490855779694280876','1490855729635135489','1490855750329696446','1490855788829216940','1490855796932739093','1498392324277796965','1490855730767597738','1498393200426221679']) await _mem.roles.remove(r).catch(() => {});
            await _mem.setNickname(null).catch(() => {});
          }
        } catch {}
        return interaction.reply({ content: `✅ Ausweis von **${target.tag}** wurde gelöscht und Rollen zurückgesetzt.`, ephemeral: true });
    }

    // /fuehrerschein-create
    if (commandName === 'fuehrerschein-create') {
      const target = interaction.options.getUser('mitglied');
      const domain = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const tok    = _fsGenToken(target.id, interaction.user.id);
      const link   = `https://${domain}/fuehrerschein/create/${tok}`;
      try {
        await target.send({ embeds: [new EmbedBuilder().setColor(0x003087)
          .setTitle('🚗 Führerschein erstellen — Paradise City')
          .setDescription('Du wurdest aufgefordert, deinen Führerschein auszufüllen.')
          .addFields({ name: '🔗 Link', value: `[Hier klicken](${link})`, inline: false }, { name: '⏱️ Gültig bis', value: `<t:${Math.floor((Date.now()+172800000)/1000)}:F>`, inline: false })
          .setFooter({ text: 'Paradise City Roleplay • Führerschein-Erstellung' }).setTimestamp()] });
        return interaction.reply({ content: `✅ Führerschein-Link per DM an **${target.tag}** gesendet.`, ephemeral: true });
      } catch {
        return interaction.reply({ content: `❌ Konnte keine DM senden. DMs möglicherweise deaktiviert.\nLink: ${link}`, ephemeral: true });
      }
    }

    // /fuehrerschein
    if (commandName === 'fuehrerschein') {
      const FS_CHANNEL = '1490882590012604538';
      if (interaction.channelId !== FS_CHANNEL) return interaction.reply({ content: `❌ Dieser Command ist nur in <#${FS_CHANNEL}> erlaubt.`, ephemeral: true });
      const target = interaction.options.getUser('person') || user;
      const all = _fsLoadFS();
      const fsEntry = all[target.id];
      if (!fsEntry) return interaction.reply({ content: target.id === user.id ? '❌ Du hast noch keinen Führerschein.' : `❌ **${target.username}** hat keinen Führerschein.`, ephemeral: true });
      if (fsEntry.entzogen) return interaction.reply({ content: '🚫 Dieser Führerschein ist derzeit entzogen.', ephemeral: true });
      await interaction.deferReply();
      try {
        const domain2 = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
        const imgUrl  = `https://${domain2}/fuehrerschein/image/${target.id}`;
        const res2    = await fetch(imgUrl);
        const buf2    = Buffer.from(await res2.arrayBuffer());
        const att2    = new AttachmentBuilder(buf2, { name: `fuehrerschein_${fsEntry.lizenznummer}.png` });
        await interaction.editReply({ files: [att2] });
      } catch(e) {
        await interaction.editReply({ content: '❌ Bild konnte nicht generiert werden: ' + e.message });
      }
    }

    // /fuehrerschein-delete
    if (commandName === 'fuehrerschein-delete') {
      const target = interaction.options.getUser('mitglied');
      const all2   = _fsLoadFS();
      if (!all2[target.id]) return interaction.reply({ content: `❌ **${target.tag}** hat keinen Führerschein.`, ephemeral: true });
      await fetch(`http://localhost:${process.env.PORT||8080}/api/fuehrerschein/loeschen`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: target.id }) }).catch(()=>{});
      return interaction.reply({ content: `✅ Führerschein von **${target.tag}** gelöscht.`, ephemeral: true });
    }

    // /fuehrerschein-edit
    if (commandName === 'fuehrerschein-edit') {
      const target = interaction.options.getUser('mitglied');
      const domain3 = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const editLink = `https://${domain3}/lapd/dashboard?tab=fuehrerscheine`;
      return interaction.reply({ content: `🔗 **Führerschein bearbeiten:**\n${editLink}\n\nDort im Tab **Führerscheine** den Eintrag von **${target.tag}** bearbeiten.`, ephemeral: true });
    }
  



        // /event
        if (commandName === 'event') {
          const was   = interaction.options.getString('was');
          const wann  = interaction.options.getString('wann');
          const preis = interaction.options.getString('preis');
          const EVENT_CH   = '1490882564561567864';
          const EVENT_ROLE = '1490855737130221598';
          const ch = await client.channels.fetch(EVENT_CH).catch(() => null);
          if (!ch) return interaction.reply({ content: '❌ Event-Kanal nicht gefunden.', ephemeral: true });
          const embed = new EmbedBuilder()
            .setColor(DARK_ORANGE)
            .setTitle('🎉  Event Ankündigung')
            .addFields(
              { name: '📌 Was',   value: was,   inline: false },
              { name: '📅 Wann',  value: wann,  inline: true  },
              { name: '🏆 Preis', value: preis, inline: true  },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Events' })
            .setTimestamp();
          await ch.send({ content: `<@&${EVENT_ROLE}>`, embeds: [embed] });
          return interaction.reply({ content: '✅ Event wurde im Event-Kanal gepostet!', ephemeral: true });
        }

      // /giveaway
      if (commandName === 'giveaway') {
        const preis = interaction.options.getString('preis');
        const dauerStr = interaction.options.getString('dauer');
        const dauerMs = parseDuration(dauerStr);
        if (!dauerMs || dauerMs < 60000) return interaction.reply({ content: '\u274C Mindestdauer: 1 Minute. Beispiele: 1h, 30m, 1d', ephemeral: true });
        if (dauerMs > 7 * 86400000) return interaction.reply({ content: '\u274C Maximale Dauer: 7 Tage.', ephemeral: true });
        const GIVEAWAY_CH   = '1490882565618536551';
        const GIVEAWAY_ROLE = '1490855722534310003';
        const endetAt = Date.now() + dauerMs;
        try {
          const ch = await client.channels.fetch(GIVEAWAY_CH).catch(() => null);
          if (!ch) return interaction.reply({ content: '\u274C Giveaway-Kanal nicht gefunden.', ephemeral: true });
          const pingMsg = await ch.send({ content: '<@&' + GIVEAWAY_ROLE + '>' });
          const gwMsg   = await ch.send({ embeds: [buildGiveawayEmbed(preis, endetAt, 0)] });
          await gwMsg.react('\uD83C\uDF89');
          activeGiveaways.set(gwMsg.id, { endetAt, preis, channelId: GIVEAWAY_CH, roleId: GIVEAWAY_ROLE });
          await interaction.reply({ content: '\u2705 Giveaway gestartet: ' + gwMsg.url, ephemeral: true });
          setTimeout(async () => {
            try {
              const gwMsgFresh = await ch.messages.fetch(gwMsg.id).catch(() => null);
              if (!gwMsgFresh) return;
              const reaction = gwMsgFresh.reactions.cache.get('\uD83C\uDF89');
              const reactUsers = reaction ? await reaction.users.fetch() : new Map();
              const guild = ch.guild;
              const eligible = [];
              for (const [uid, u] of reactUsers) {
                if (u.bot) continue;
                const mem = await guild.members.fetch(uid).catch(() => null);
                if (mem && mem.roles.cache.has(GIVEAWAY_ROLE)) eligible.push(mem);
              }
              activeGiveaways.delete(gwMsg.id);
              if (eligible.length === 0) {
                const noWinEmbed = new EmbedBuilder()
                  .setColor(0xFF4444)
                  .setTitle('\uD83C\uDF89  GIVEAWAY BEENDET')
                  .setDescription('Leider hat niemand mit der ben\u00F6tigten Rolle teilgenommen.\n**Preis:** ' + preis)
                  .setTimestamp();
                await gwMsgFresh.edit({ embeds: [noWinEmbed] });
                await ch.send({ content: '\u274C Kein g\u00FCltiger Teilnehmer gefunden. Giveaway endet ohne Gewinner.' });
                return;
              }
              const winner = eligible[Math.floor(Math.random() * eligible.length)];
              const winEmbed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle('\uD83C\uDF89  GIVEAWAY BEENDET  \uD83C\uDF89')
                .setDescription(
                  '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n' +
                  '\uD83C\uDFC6 **Gewinner:** <@' + winner.id + '>\n' +
                  '\uD83C\uDF81 **Preis:** ' + preis + '\n' +
                  '\uD83C\uDF9F\uFE0F **Teilnehmer:** ' + eligible.length + '\n' +
                  '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'
                )
                .setFooter({ text: 'Paradise City Roleplay  \u2022  Giveaway abgeschlossen' })
                .setTimestamp();
              await gwMsgFresh.edit({ embeds: [winEmbed] });
              await ch.send({ content: '\uD83C\uDF89 Herzlichen Gl\u00FCckwunsch <@' + winner.id + '>! Du hast **' + preis + '** gewonnen!' });
            } catch (e2) { console.error('Giveaway-Ende Fehler:', e2.message); }
          }, dauerMs);
        } catch (e) { return interaction.reply({ content: '\u274C Fehler: ' + e.message, ephemeral: true }); }
        return;
      }


        // /frakadd
        if (commandName === 'frakadd') {
          const name = interaction.options.getString('name').trim();
          const typ  = interaction.options.getString('typ');
          const data = loadFraktionen();
          if (data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** existiert bereits.`, ephemeral: true });
          data[name] = { typ, warns: [], gesperrt: false, sperreGrund: null, addedBy: user.id, addedAt: new Date().toISOString() };
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          return interaction.reply({ content: `✅ Fraktion **${name}** (${typ}) wurde hinzugefügt.`, ephemeral: true });
        }

        // /frak-delete
        if (commandName === 'frak-delete') {
          const name = interaction.options.getString('name').trim();
          const data = loadFraktionen();
          if (!data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** nicht gefunden.`, ephemeral: true });
          delete data[name];
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          return interaction.reply({ content: `✅ Fraktion **${name}** wurde gelöscht.`, ephemeral: true });
        }

        // /frakwarn
        if (commandName === 'frakwarn') {
          const name  = interaction.options.getString('fraktion').trim();
          const grund = interaction.options.getString('grund');
          const data  = loadFraktionen();
          if (!data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** nicht gefunden.`, ephemeral: true });
          data[name].warns.push({ grund, by: user.id, at: new Date().toISOString() });
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          const logCh = await client.channels.fetch(FRAK_LOG_CH).catch(() => null);
          if (logCh) await logCh.send({ embeds: [new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨  FRAKTIONSVERWARNUNG')
            .setDescription(
              `## ${name}\n` +
              `> **Typ:** ${data[name].typ}  ·  **Warns:** ${data[name].warns.length}\n` +
              `> ${'🔴'.repeat(Math.min(data[name].warns.length,5))}${'⚫'.repeat(Math.max(0,5-data[name].warns.length))}`
            )
            .addFields(
              { name: '📋  Grund', value: `\`\`\`${grund}\`\`\``, inline: false },
              { name: '👤  Vergeben von', value: `<@${user.id}>`, inline: true },
              { name: '🕐  Zeitpunkt', value: `<t:${ts()}:F>`, inline: true },
              { name: '⚠️  Warns gesamt', value: `**${data[name].warns.length}**`, inline: true }
            ).setFooter({ text: 'Paradise City Roleplay  •  Fraktions-Verwarnungssystem' }).setTimestamp()
          ]});
          return interaction.reply({ content: `✅ **${name}** hat jetzt ${data[name].warns.length} Verwarnung(en).`, ephemeral: true });
        }

        // /frakwarn-remove
        if (commandName === 'frakwarn-remove') {
          const name = interaction.options.getString('fraktion').trim();
          const data = loadFraktionen();
          if (!data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** nicht gefunden.`, ephemeral: true });
          if (!data[name].warns.length) return interaction.reply({ content: `❌ **${name}** hat keine Verwarnungen.`, ephemeral: true });
          const removed = data[name].warns.pop();
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          const logCh = await client.channels.fetch(FRAK_LOG_CH).catch(() => null);
          if (logCh) await logCh.send({ embeds: [new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(`✅  Fraktionsverwarnung entfernt — ${name}`)
            .addFields(
              { name: 'Fraktion', value: `**${name}** (${data[name].typ})`, inline: true },
              { name: 'Warns verbleibend', value: `${data[name].warns.length}`, inline: true },
              { name: 'Entfernte Warn', value: removed.grund },
              { name: 'Entfernt von', value: `<@${user.id}>`, inline: true },
              { name: 'Zeitpunkt', value: `<t:${ts()}:F>`, inline: true }
            ).setFooter({ text: 'Paradise City Roleplay  •  Fraktions-Log' }).setTimestamp()
          ]});
          return interaction.reply({ content: `✅ Letzte Verwarnung von **${name}** entfernt. Noch ${data[name].warns.length} übrig.`, ephemeral: true });
        }

        // /fraksperre
        if (commandName === 'fraksperre') {
          const name  = interaction.options.getString('fraktion').trim();
          const grund = interaction.options.getString('grund');
          const data  = loadFraktionen();
          if (!data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** nicht gefunden.`, ephemeral: true });
          if (data[name].gesperrt) return interaction.reply({ content: `❌ **${name}** ist bereits gesperrt.`, ephemeral: true });
          data[name].gesperrt = true; data[name].sperreGrund = grund;
          data[name].gesperrtBy = user.id; data[name].gesperrtAt = new Date().toISOString();
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          const logCh = await client.channels.fetch(FRAK_LOG_CH).catch(() => null);
          const sperreEmbed = new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle(`🔒  Fraktion gesperrt — ${name}`)
            .addFields(
              { name: 'Fraktion', value: `**${name}** (${data[name].typ})`, inline: true },
              { name: 'Grund', value: grund },
              { name: 'Gesperrt von', value: `<@${user.id}>`, inline: true },
              { name: 'Zeitpunkt', value: `<t:${ts()}:F>`, inline: true }
            ).setFooter({ text: 'Paradise City Roleplay  •  Fraktions-Log' }).setTimestamp();
          if (logCh) await logCh.send({ embeds: [sperreEmbed] });
          const sperreCh = await client.channels.fetch('1497050512028205186').catch(() => null);
          if (sperreCh) await sperreCh.send({ embeds: [sperreEmbed] });
          return interaction.reply({ content: `🔒 Fraktion **${name}** wurde gesperrt.`, ephemeral: true });
        }

        // /fraksperre-remove
        if (commandName === 'fraksperre-remove') {
          const name = interaction.options.getString('fraktion').trim();
          const data = loadFraktionen();
          if (!data[name]) return interaction.reply({ content: `❌ Fraktion **${name}** nicht gefunden.`, ephemeral: true });
          if (!data[name].gesperrt) return interaction.reply({ content: `❌ **${name}** ist nicht gesperrt.`, ephemeral: true });
          data[name].gesperrt = false; data[name].sperreGrund = null;
          data[name].gesperrtBy = null; data[name].gesperrtAt = null;
          saveFraktionen(data);
          await updateFrakEmbed().catch(() => {});
          const logCh = await client.channels.fetch(FRAK_LOG_CH).catch(() => null);
          if (logCh) await logCh.send({ embeds: [new EmbedBuilder()
            .setColor(Colors.Green)
            .setTitle(`🔓  Fraktionssperre aufgehoben — ${name}`)
            .addFields(
              { name: 'Fraktion', value: `**${name}** (${data[name].typ})`, inline: true },
              { name: 'Aufgehoben von', value: `<@${user.id}>`, inline: true },
              { name: 'Zeitpunkt', value: `<t:${ts()}:F>`, inline: true }
            ).setFooter({ text: 'Paradise City Roleplay  •  Fraktions-Log' }).setTimestamp()
          ]});
          return interaction.reply({ content: `🔓 Sperre von **${name}** wurde aufgehoben.`, ephemeral: true });
        }


        // /vorschlag
        if (commandName === 'vorschlag') {
          const text = interaction.options.getString('text');
          const vorschlaege = loadVorschlaege();
          const newId = vorschlaege.length ? Math.max(...vorschlaege.map(v => v.id)) + 1 : 1;
          const ch = await client.channels.fetch(VORSCHLAG_CH).catch(() => null);
          if (!ch) return interaction.reply({ content: '❌ Vorschläge-Kanal nicht gefunden.', ephemeral: true });
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`💡  Vorschlag #${newId}`)
            .setDescription(`\`\`\`${text}\`\`\``)
            .addFields(
              { name: '👤  Eingereicht von', value: `<@${user.id}>`, inline: true },
              { name: '📅  Datum', value: `<t:${ts()}:D>`, inline: true },
              { name: '📊  Status', value: '🟡 **Offen**', inline: true }
            )
            .setFooter({ text: `Paradise City Roleplay  •  Vorschlag #${newId}` })
            .setTimestamp();
          const msg = await ch.send({ embeds: [embed] });
          await msg.react('✅');
          await msg.react('❌');
          const entry = { id: newId, text, status: 'offen', by: user.id, at: new Date().toISOString(), msgId: msg.id };
          vorschlaege.push(entry);
          saveVorschlaege(vorschlaege);
          return interaction.reply({ content: `✅ Dein Vorschlag wurde als **#${newId}** eingereicht!`, ephemeral: true });
        }

        // /vorschlag-yes
        if (commandName === 'vorschlag-yes') {
          const id = parseInt(interaction.options.getString('id'));
          const grund = interaction.options.getString('grund') || '_Keine Begründung angegeben._';
          const vorschlaege = loadVorschlaege();
          const entry = vorschlaege.find(v => v.id === id);
          if (!entry) return interaction.reply({ content: `❌ Vorschlag #${id} nicht gefunden.`, ephemeral: true });
          if (entry.status !== 'offen') return interaction.reply({ content: `❌ Vorschlag #${id} ist bereits **${entry.status}**.`, ephemeral: true });
          entry.status = 'angenommen'; entry.decidedBy = user.id; entry.decidedAt = new Date().toISOString(); entry.grund = grund;
          saveVorschlaege(vorschlaege);
          const ch = await client.channels.fetch(VORSCHLAG_CH).catch(() => null);
          if (ch && entry.msgId) {
            const msg = await ch.messages.fetch(entry.msgId).catch(() => null);
            if (msg) await msg.edit({ embeds: [new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle(`✅  Vorschlag #${id} — Angenommen`)
              .setDescription(`\`\`\`${entry.text}\`\`\``)
              .addFields(
                { name: '👤  Eingereicht von', value: `<@${entry.by}>`, inline: true },
                { name: '📊  Status', value: '✅ **Angenommen**', inline: true },
                { name: '✅  Entschieden von', value: `<@${user.id}>`, inline: true },
                { name: '💬  Begründung', value: grund, inline: false }
              )
              .setFooter({ text: `Paradise City Roleplay  •  Vorschlag #${id}` })
              .setTimestamp()
            ]});
          }
          return interaction.reply({ content: `✅ Vorschlag **#${id}** wurde angenommen.`, ephemeral: true });
        }

        // /vorschlag-no
        if (commandName === 'vorschlag-no') {
          const id = parseInt(interaction.options.getString('id'));
          const grund = interaction.options.getString('grund') || '_Keine Begründung angegeben._';
          const vorschlaege = loadVorschlaege();
          const entry = vorschlaege.find(v => v.id === id);
          if (!entry) return interaction.reply({ content: `❌ Vorschlag #${id} nicht gefunden.`, ephemeral: true });
          if (entry.status !== 'offen') return interaction.reply({ content: `❌ Vorschlag #${id} ist bereits **${entry.status}**.`, ephemeral: true });
          entry.status = 'abgelehnt'; entry.decidedBy = user.id; entry.decidedAt = new Date().toISOString(); entry.grund = grund;
          saveVorschlaege(vorschlaege);
          const ch = await client.channels.fetch(VORSCHLAG_CH).catch(() => null);
          if (ch && entry.msgId) {
            const msg = await ch.messages.fetch(entry.msgId).catch(() => null);
            if (msg) await msg.edit({ embeds: [new EmbedBuilder()
              .setColor(0xED4245)
              .setTitle(`❌  Vorschlag #${id} — Abgelehnt`)
              .setDescription(`\`\`\`${entry.text}\`\`\``)
              .addFields(
                { name: '👤  Eingereicht von', value: `<@${entry.by}>`, inline: true },
                { name: '📊  Status', value: '❌ **Abgelehnt**', inline: true },
                { name: '✅  Entschieden von', value: `<@${user.id}>`, inline: true },
                { name: '💬  Begründung', value: grund, inline: false }
              )
              .setFooter({ text: `Paradise City Roleplay  •  Vorschlag #${id}` })
              .setTimestamp()
            ]});
          }
          return interaction.reply({ content: `✅ Vorschlag **#${id}** wurde abgelehnt.`, ephemeral: true });
        }

  
        // /lobby-abstimmung
          if (commandName === 'lobby-abstimmung') {
            const rpStart = interaction.options.getString('rp-start');
            const LOBBY_CH   = '1490882583909765190';
            const LOBBY_ROLE = '1490855734517174376';
            const ch = await client.channels.fetch(LOBBY_CH).catch(() => null);
            if (!ch) return interaction.reply({ content: '❌ Kanal nicht gefunden.', ephemeral: true });
            const today = new Date();
            const dateStr = `${today.getDate().toString().padStart(2,'0')}.${(today.getMonth()+1).toString().padStart(2,'0')}.${today.getFullYear()}`;
            const embed = new EmbedBuilder()
              .setColor(0xE65100)
              .setAuthor({ name: 'Paradise City Roleplay', iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
              .setTitle('🗳️  Lobby-Abstimmung')
              .setDescription('## Wirst du heute dabei sein?\nStimme ab und lass es uns wissen!')
              .addFields(
                { name: '📅  Datum', value: `**${dateStr}**`, inline: true },
                { name: '🎬  RP Start', value: `**${rpStart}**`, inline: true },
                { name: '\u200b', value: '\u200b', inline: true },
                { name: '✅  Ich bin dabei', value: 'Sobald die Lobby offen ist', inline: true },
                { name: '🕒  Ich komme später', value: 'Ich stoße etwas später dazu', inline: true },
                { name: '❌  Ich komme nicht', value: 'Heute leider nicht dabei', inline: true }
              )
              .setFooter({ text: `Gestartet von ${user.tag}  •  Paradise City Roleplay` })
              .setTimestamp();
            await interaction.reply({ content: '✅ Abstimmung gesendet!', ephemeral: true });
            const msg = await ch.send({ content: `<@&${LOBBY_ROLE}>`, embeds: [embed] });
            await msg.react('✅'); await msg.react('🕒'); await msg.react('❌');
            const lPolls = loadLobbyPolls();
            lPolls[msg.id] = { voters: {}, channelId: LOBBY_CH, createdAt: Date.now() };
            saveLobbyPolls(lPolls);
            return;
          }

          // /lobby-open
          if (commandName === 'lobby-open') {
            const LOBBY_STATUS_CH = '1490882585046290542';
            const LOBBY_ROLE      = '1490855734517174376';
            const ch = await client.channels.fetch(LOBBY_STATUS_CH).catch(() => null);
            if (!ch) return interaction.reply({ content: '❌ Kanal nicht gefunden.', ephemeral: true });
            const embed = new EmbedBuilder()
              .setColor(0x57F287)
              .setAuthor({ name: 'Paradise City Roleplay', iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
              .setTitle('🟢  Lobby ist jetzt OFFEN!')
              .setDescription('Die Lobby wurde geöffnet — komm jetzt rein!')
              .addFields(
                { name: '👑  Lobby Host', value: `<@${user.id}>`, inline: true },
                { name: '🕐  Geöffnet um', value: `<t:${ts()}:t>`, inline: true }
              )
              .setFooter({ text: 'Paradise City Roleplay  •  Lobby-Status' })
              .setTimestamp();
            await interaction.reply({ content: '✅ Lobby als **offen** markiert!', ephemeral: true });
            await ch.send({ content: `<@&${LOBBY_ROLE}>`, embeds: [embed] });
            return;
          }

          // /lobby-close
          if (commandName === 'lobby-close') {
            const LOBBY_STATUS_CH = '1490882585046290542';
            const ch = await client.channels.fetch(LOBBY_STATUS_CH).catch(() => null);
            if (!ch) return interaction.reply({ content: '❌ Kanal nicht gefunden.', ephemeral: true });
            const embed = new EmbedBuilder()
              .setColor(0xED4245)
              .setAuthor({ name: 'Paradise City Roleplay', iconURL: interaction.guild.iconURL({ dynamic: true }) ?? undefined })
              .setTitle('🔴  Lobby ist jetzt GESCHLOSSEN')
              .setDescription('Die Lobby wurde geschlossen. Bis zum nächsten Mal!')
              .addFields(
                { name: '👤  Geschlossen von', value: `<@${user.id}>`, inline: true },
                { name: '🕐  Geschlossen um', value: `<t:${ts()}:t>`, inline: true }
              )
              .setFooter({ text: 'Paradise City Roleplay  •  Lobby-Status' })
              .setTimestamp();
            await interaction.reply({ content: '✅ Lobby als **geschlossen** markiert!', ephemeral: true });
            await ch.send({ embeds: [embed] });
            return;
          }
        // /rucksack
        if (commandName === 'rucksack') {
          if (interaction.channelId !== INV_CH) return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${INV_CH}>.`, ephemeral: true });
          const target = interaction.options.getUser('spieler') || user;
          const inv = getUserInv(target.id);
          const totalPages = Math.max(1, Math.ceil(Object.keys(inv).length / ITEMS_PER_PAGE));
          const embed = buildInvEmbed(target, 0, inv);
          const rows = [invPageButtons(0, totalPages, target.id, 'inv')];
          return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }

        // /lager
        if (commandName === 'lager') {
          if (interaction.channelId !== INV_CH) return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${INV_CH}>.`, ephemeral: true });
          const target = interaction.options.getUser('spieler') || user;
          const lager = getUserLager(target.id);
          const totalPages = Math.max(1, Math.ceil(Object.keys(lager).length / ITEMS_PER_PAGE));
          const embed = buildLagerEmbed(target, 0, lager);
          const rows = [invPageButtons(0, totalPages, target.id, 'lager'), lagerActionButtons(0, target.id)];
          return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }

        // /übergeben
        if (commandName === 'übergeben') {
          if (interaction.channelId !== UEBERGABE_CH) return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${UEBERGABE_CH}>.`, ephemeral: true });
          const itemName = interaction.options.getString('item');
          const menge    = interaction.options.getInteger('menge');
          const target   = interaction.options.getUser('an-wen');
          if (target.id === user.id) return interaction.reply({ content: '❌ Du kannst dir nicht selbst Items übergeben.', ephemeral: true });
          const inv = getUserInv(user.id);
          const foundKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
          if (!foundKey || inv[foundKey] < menge) return interaction.reply({ content: `❌ Du hast nicht genug **${itemName}** im Inventar (hast: ${foundKey ? inv[foundKey] : 0}x).`, ephemeral: true });
          inv[foundKey] -= menge;
          if (inv[foundKey] <= 0) delete inv[foundKey];
          setUserInv(user.id, inv);
          const targetInv = getUserInv(target.id);
          targetInv[foundKey] = (targetInv[foundKey] || 0) + menge;
          setUserInv(target.id, targetInv);
          return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
            .setColor(0x57F287).setTitle('📦  Übergabe erfolgreich')
            .setDescription(`<@${user.id}> hat **${menge}x ${foundKey}** an <@${target.id}> übergeben.`)
            .setTimestamp().setFooter({ text: 'Paradise City Roleplay  •  Inventar' })
          ]});
        }

        // /use
        if (commandName === 'use') {
          if (interaction.channelId !== USE_CH) return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${USE_CH}>.`, ephemeral: true });
          const itemName = interaction.options.getString('item');
          const menge    = interaction.options.getInteger('menge');
          const inv = getUserInv(user.id);
          const foundKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
          if (!foundKey || inv[foundKey] < menge) return interaction.reply({ content: `❌ Du hast nicht genug **${itemName}** im Inventar (hast: ${foundKey ? inv[foundKey] : 0}x).`, ephemeral: true });
          inv[foundKey] -= menge;
          if (inv[foundKey] <= 0) delete inv[foundKey];
          setUserInv(user.id, inv);
          return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
            .setColor(0xE65100).setTitle('✅  Item verwendet')
            .setDescription(`Du hast **${menge}x ${foundKey}** verwendet.`)
            .setTimestamp().setFooter({ text: 'Paradise City Roleplay  •  Inventar' })
          ]});
        }

        // /item-give
        if (commandName === 'item-give') {
          const target     = interaction.options.getUser('spieler');
          const rawName    = interaction.options.getString('item');
          const menge      = interaction.options.getInteger('menge');
          const itemName   = findShopItem(rawName);
          const inv = getUserInv(target.id);
          inv[itemName] = (inv[itemName] || 0) + menge;
          setUserInv(target.id, inv);
          const items = loadItems();
          if (!items.includes(itemName)) { items.push(itemName); saveItems(items); }
          const nameNote = itemName !== rawName ? ' *(normalisiert aus Shop)*' : '';
          return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
            .setColor(0x57F287).setTitle('📦  Item vergeben')
            .addFields(
              { name: 'Spieler', value: `<@${target.id}>`, inline: true },
              { name: 'Item', value: `**${itemName}**${nameNote}`, inline: true },
              { name: 'Menge', value: `**${menge}x**`, inline: true }
            ).setTimestamp().setFooter({ text: 'Paradise City Roleplay  •  Inventar' })
          ], ephemeral: true });
        }

        // /item-remove
        if (commandName === 'item-remove') {
          const target   = interaction.options.getUser('spieler');
          const rawName  = interaction.options.getString('item');
          const menge    = interaction.options.getInteger('menge');
          const inv = getUserInv(target.id);
          const itemName = findInvItem(inv, rawName) || rawName;
          if (!inv[itemName] || inv[itemName] < menge) return interaction.reply({ content: `❌ <@${target.id}> hat nicht genug **${itemName}** im Inventar (hat: ${inv[itemName] ?? 0}x).`, ephemeral: true });
          inv[itemName] -= menge;
          if (inv[itemName] <= 0) delete inv[itemName];
          setUserInv(target.id, inv);
          return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
            .setColor(0xED4245).setTitle('❌  Item entfernt')
            .addFields(
              { name: 'Spieler', value: `<@${target.id}>`, inline: true },
              { name: 'Item', value: `**${itemName}**`, inline: true },
              { name: 'Menge', value: `**${menge}x**`, inline: true }
            ).setTimestamp().setFooter({ text: 'Paradise City Roleplay  •  Inventar' })
          ], ephemeral: true });
        }

  

      // ── SHOP SLASH HANDLERS ──────────────────────────────────────────────
      if (commandName === 'teamshop') {
        const shops = loadShops(); const items = shops.team || [];
        const totalPages = Math.max(1, Math.ceil(items.length / 10));
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('ts_prev:0').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('ts_next:0').setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1),
        );
        return interaction.reply({ embeds: [buildTeamShopEmbed(items, 0)], components: [row], ephemeral: true });
      }
            if (commandName === 'shop-add') {
        const tok = require('crypto').randomBytes(16).toString('hex');
        const toks = loadShopMgrToks();
        // Token 1h gültig
        toks[tok] = { userId: interaction.user.id, userTag: interaction.user.tag, expiresAt: Date.now() + 3600000 };
        // Alte Tokens aufräumen
        for (const k of Object.keys(toks)) { if (toks[k].expiresAt < Date.now()) delete toks[k]; }
        saveShopMgrToks(toks);
        const _WEBAPP = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
        return interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder()
          .setColor(0xE65100)
          .setTitle('🏪 Shop-Manager')
          .setDescription(`Öffne den Shop-Manager um mehrere Items auf einmal hinzuzufügen:

🔗 **[Shop-Manager öffnen](${_WEBAPP}/shop-manager/${tok})**

⏱️ *Link ist 1 Stunde gültig.*`)
          .setFooter({ text: 'Paradise City Roleplay  •  Shop-Manager' })
        ]});
      }
      if (commandName === 'shop-edit') {
        const shopId = interaction.options.getString('shop');
        const name   = interaction.options.getString('item');
        const preis  = interaction.options.getInteger('preis');
        const shops  = loadShops();
        const item   = (shops[shopId]||[]).find(i => i.name === name);
        if (!item) return interaction.reply({ content: '❌ **' + name + '** nicht gefunden.', ephemeral: true });
        item.preis = preis; saveShops(shops);
        await updateShopEmbed(shopId).catch(() => {});
        sendLog(LOG_SHOP_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('🏪 Shop-Log: Item bearbeitet')
          .addFields({ name:'Shop', value:SHOP_META[shopId]?.name||shopId, inline:true },{ name:'Item', value:name, inline:true },{ name:'Neuer Preis', value:`${preis.toLocaleString('de-DE')} €`, inline:true },{ name:'Von', value:`<@${interaction.user.id}>` })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
        return interaction.reply({ content: '✅ **' + name + '** kostet jetzt ' + preis.toLocaleString('de-DE') + ' Euro.', ephemeral: true });
      }
      if (commandName === 'shop-delete') {
        const shopId = interaction.options.getString('shop');
        const name   = interaction.options.getString('item');
        const shops  = loadShops(); const lenB2 = (shops[shopId]||[]).length;
        shops[shopId] = (shops[shopId]||[]).filter(i => i.name !== name);
        if ((shops[shopId]||[]).length === lenB2) return interaction.reply({ content: '❌ **' + name + '** nicht gefunden.', ephemeral: true });
        saveShops(shops); await updateShopEmbed(shopId).catch(() => {});
        sendLog(LOG_SHOP_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('🏪 Shop-Log: Item gelöscht')
          .addFields({ name:'Shop', value:SHOP_META[shopId]?.name||shopId, inline:true },{ name:'Item', value:name, inline:true },{ name:'Von', value:`<@${interaction.user.id}>` })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
        return interaction.reply({ content: '✅ **' + name + '** entfernt.', ephemeral: true });
      }
  
        // ─── MONEY-ADD ──────────────────────────────────────────────────────────
        if (commandName === 'money-add') {
          const target = interaction.options.getUser('spieler');
          const typ    = interaction.options.getString('typ');
          const betrag = interaction.options.getInteger('betrag');
          if (typ === 'bargeld') {
            const cur = getCash(target.id);
            setCash(target.id, cur + betrag);
            addTrans(target.id, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Bargeld (Admin)`, betrag });
          } else if (typ === 'pc_coins') {
            const w = getWallet(target.id); w.dc = (Number(w.dc)||0) + betrag; setWallet(target.id, w);
          } else {
            const k = getKonto(target.id);
            if (typ === 'konto') k.konto += betrag;
            else k.schwarz += betrag;
            setKonto(target.id, k);
            addTrans(target.id, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} ${typ === 'konto' ? 'Kontogeld' : 'Schwarzgeld'} (Admin)`, betrag });
          }
          const typLabel = typ === 'konto' ? 'Kontogeld' : typ === 'bargeld' ? 'Bargeld' : typ === 'pc_coins' ? 'PC Coins' : 'Schwarzgeld';
          sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
            .setTitle('💰 Geld-Log: Geld hinzugefügt (/money-add)')
            .addFields({ name:'Spieler', value:`<@${target.id}>`, inline:true },{ name:'Typ', value:typLabel, inline:true },{ name:'Betrag', value:`+${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true },{ name:'Von', value:`<@${interaction.user.id}>` })
            .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
          return interaction.reply({ content: `✅ <@${target.id}> hat **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ` ${typLabel}** erhalten.`, ephemeral: true });
        }

        // ─── MONEY-REMOVE ───────────────────────────────────────────────────────
        if (commandName === 'money-remove') {
          const target = interaction.options.getUser('spieler');
          const typ    = interaction.options.getString('typ');
          const betrag = interaction.options.getInteger('betrag');
          if (typ === 'bargeld') {
            const cur = getCash(target.id);
            const neu = Math.max(0, cur - betrag);
            setCash(target.id, neu);
            addTrans(target.id, { ts: Date.now(), text: `-${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Bargeld (Admin)`, betrag: -betrag });
          } else {
            const k = getKonto(target.id);
            if (typ === 'konto') k.konto = Math.max(0, k.konto - betrag);
            else k.schwarz = Math.max(0, k.schwarz - betrag);
            setKonto(target.id, k);
            addTrans(target.id, { ts: Date.now(), text: `-${betrag.toLocaleString('de-CH')} ${MONEY_GIF} ${typ === 'konto' ? 'Kontogeld' : 'Schwarzgeld'} (Admin)`, betrag: -betrag });
          }
          } else if (typ === 'pc_coins') {
            const w2 = getWallet(target.id); w2.dc = Math.max(0, (Number(w2.dc)||0) - betrag); setWallet(target.id, w2);
          const typLabel = typ === 'konto' ? 'Kontogeld' : typ === 'bargeld' ? 'Bargeld' : typ === 'pc_coins' ? 'PC Coins' : 'Schwarzgeld';
          sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
            .setTitle('💰 Geld-Log: Geld abgezogen (/money-remove)')
            .addFields({ name:'Spieler', value:`<@${target.id}>`, inline:true },{ name:'Typ', value:typLabel, inline:true },{ name:'Betrag', value:`-${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true },{ name:'Von', value:`<@${interaction.user.id}>` })
            .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
          return interaction.reply({ content: `✅ <@${target.id}> wurden **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ` ${typLabel}** abgezogen.`, ephemeral: true });
        }

        // ─── BARGELD (nur Finanzkanal) ───────────────────────────────────────────
        if (commandName === 'bargeld') {
          const FINANCE_CH = '1490882589014364250';
          if (interaction.channelId !== FINANCE_CH) {
            return interaction.reply({ content: `❌ Dieser Command ist nur in <#${FINANCE_CH}> erlaubt.`, ephemeral: true });
          }
          const target = interaction.options.getUser('spieler');
          const cash   = getCash(target.id);
          return interaction.reply({ content: `💵 **${target.username}** hat **${cash.toLocaleString('de-CH')} ${MONEY_GIF}** Bargeld.`, ephemeral: true });
        }

        // ─── RECHNUNG-CREATE ────────────────────────────────────────────────────
        if (commandName === 'rechnung-create') {
          const target      = interaction.options.getUser('spieler');
          const beschreibung = interaction.options.getString('beschreibung');
          const betrag      = interaction.options.getInteger('betrag');
          const rechnungen  = loadRechnungen();
          if (!rechnungen[target.id]) rechnungen[target.id] = [];
          const id = Date.now().toString();
          rechnungen[target.id].push({ id, beschreibung, betrag, erstellt: Date.now(), von: interaction.user.id });
          saveRechnungen(rechnungen);
          sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
            .setTitle('💰 Geld-Log: Rechnung erstellt')
            .addFields({ name:'Spieler', value:`<@${target.id}>`, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true },{ name:'Beschreibung', value:beschreibung },{ name:'Erstellt von', value:`<@${interaction.user.id}>` })
            .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
          return interaction.reply({ content: `✅ Rechnung über **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + `** für <@${target.id}> erstellt.`, ephemeral: true });
        }

  
        // ─── EINREISE STARTGELD ──────────────────────────────────────────────────
        if (commandName === 'einreise-startgeld') {
          const target = interaction.options.getUser('spieler');
          const typ    = interaction.options.getString('typ');
          const startgeldLog = loadKonto();
          // Check if already received startgeld (one-time)
          const existing = startgeldLog[target.id];
          if (existing?._startgeld) {
            return interaction.reply({ content: `❌ <@${target.id}> hat bereits einmalig Startgeld erhalten.`, ephemeral: true });
          }
          let betrag = 0, art = '', isSchwarz = false;
          if (typ === 'legal')         { betrag = 5000;  art = 'Legal (Konto)';             isSchwarz = false; }
          if (typ === 'illegal')       { betrag = 5000;  art = 'Illegal (Konto)';             isSchwarz = false; }
          if (typ === 'gruppe_legal')  { betrag = 10000; art = 'Gruppeneinreise (Konto)';  isSchwarz = false; }
          if (typ === 'gruppe_illegal'){ betrag = 10000; art = 'Gruppeneinreise (Konto)';  isSchwarz = false; }

          const k = getKonto(target.id);
          if (isSchwarz) k.schwarz += betrag;
          else k.konto += betrag;
          k._startgeld = true;
          setKonto(target.id, k);
          addTrans(target.id, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Startgeld (${art})`, betrag });
          sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
            .setTitle('💰 Geld-Log: Einreise-Startgeld')
            .addFields({ name:'Spieler', value:`<@${target.id}>`, inline:true },{ name:'Art', value:art, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true },{ name:'Vergeben von', value:`<@${interaction.user.id}>` })
            .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
          return interaction.reply({
            embeds: [new EmbedBuilder().setColor(0x43A047).setTitle('💵 Startgeld vergeben')
              .setDescription(`<@${target.id}> hat **${betrag.toLocaleString('de-CH')} ${MONEY_GIF}** als ${isSchwarz ? 'Schwarzgeld' : 'Kontogeld'} erhalten.\n**Einreiseart:** ${art}`)
            ], ephemeral: true
          });
        }

      // ─── CHARAKTER RESET ──────────────────────────────────────────────────────
      // ─── EINREISE-LINK ────────────────────────────────────────────────────────
      if (commandName === 'einreise-link') {
        const target = interaction.options.getUser('spieler');
        const art    = interaction.options.getString('art');
        // Generate token via web.js helper (call through shared token file)
        const EINREISE_TOKEN_FILE = require('path').join(DATA_DIR, 'einreise_tokens.json');
        let toks = {}; try { toks = JSON.parse(require('fs').readFileSync(EINREISE_TOKEN_FILE,'utf8')); } catch {}
        // Remove expired tokens for this user
        toks = Object.fromEntries(Object.entries(toks).filter(([,v]) => v.expiresAt > Date.now() && v.userId !== target.id));
        const tok = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
        toks[tok] = { userId: target.id, art, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
        require('fs').writeFileSync(EINREISE_TOKEN_FILE, JSON.stringify(toks, null, 2));
        const domain = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.REPLIT_DOMAINS || 'localhost:8080').split(',')[0].trim();
        const link   = `https://${domain}/einreise/${art}/${tok}`;
        try {
          await target.send({ embeds: [new EmbedBuilder().setColor(art === 'legal' ? 0x43A047 : 0xb71c1c)
            .setTitle(art === 'legal' ? '🏛️ Legale Einreise — Paradise City' : '🚫 Illegale Einreise — Paradise City')
            .setDescription('Klicke auf den Link um deine Einreise auszufüllen. Der Link ist **7 Tage** gültig.')
            .addFields({ name: '🔗 Persönlicher Link', value: `[Hier klicken](${link})`, inline: false },
                       { name: '⏱️ Gültig bis', value: `<t:${Math.floor((Date.now()+7*24*60*60*1000)/1000)}:F>`, inline: false })
            .setFooter({ text: 'Paradise City Roleplay • Einreise' }).setTimestamp()] });
          return interaction.reply({ content: `✅ Einreise-Link (${art}) per DM an **${target.tag}** gesendet.`, ephemeral: true });
        } catch {
          return interaction.reply({ content: `❌ Konnte keine DM an **${target.tag}** senden. DMs möglicherweise deaktiviert.
Link: ${link}`, ephemeral: true });
        }
      }


        // ── /rubbellos-setup ────────────────────────────────────────────────────
        // ── /lotto-ziehung (manuell) ──────────────────────────────────────────────
        if (commandName === 'lotto-ziehung') {
          await interaction.deferReply({ ephemeral: true });
          await doLottoZiehung(client);
          return interaction.editReply({ content: '✅ Lotto-Ziehung wurde manuell durchgeführt!' });
        }

        if (commandName === 'rubbellos-setup') {
          const RUBBELLOS_CH = '1490889784753782784';
          const ch = await client.channels.fetch(RUBBELLOS_CH).catch(() => null);
          if (!ch) return interaction.reply({ content: '❌ Kanal nicht gefunden.', ephemeral: true });
          const rubbEmbed = new EmbedBuilder()
            .setColor(0xE65100)
            .setTitle('🎟️  Rubbellos')
            .setDescription(
              `**Mögliche Gewinne:**
❌  Niete
💵  1.000 $
💴  2.500 $
💶  5.000 $
💷  10.000 $
💰  25.000 $
🚬  10× Marlboro Rot
🚲  Elektro Fahrrad
⛳  Golfschläger
🎰  Lottoschein
🎟️  20% Gutschein Autohaus
🏎️  **SPORTWAGEN** *(Hauptgewinn — Ticket erstellen!)*

🛒 Kaufe ein Rubbellos im **Kwik-E-Markt** für **1.000 $**.
▶️ Drücke den Button um dein Rubbellos einzulösen.

🎯 Rubbele alle 9 Felder frei — **3× dasselbe Symbol = Gewinn!**
🏆 Beim Sportwagen-Hauptgewinn bitte ein **Ticket erstellen!**`
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Rubbellos' });
          const rubbBtn = new ButtonBuilder()
            .setCustomId('rubbellos_use')
            .setLabel('🎟️ Rubbellos einlösen')
            .setStyle(ButtonStyle.Primary);
          const rubbRow = new ActionRowBuilder().addComponents(rubbBtn);
          await ch.send({ embeds: [rubbEmbed], components: [rubbRow] });
          return interaction.reply({ content: '✅ Rubbellos-Embed wurde gepostet!', ephemeral: true });
        }

        if (commandName === 'charakter-reset') {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('spieler');
        const uid    = target.id;

        // Konto + Bargeld + Transaktionen + Lohnlog + Rechnungen
        const konto = loadKonto(); delete konto[uid]; setKonto && saveKonto ? (delete konto[uid], saveKonto(konto)) : (() => { delete konto[uid]; fs.writeFileSync(KONTO_FILE, JSON.stringify(konto,null,2)); })();
        const bargeld = loadBargeld ? loadBargeld() : (()=>{ try{return JSON.parse(fs.readFileSync(BARGELD_FILE,'utf8'));}catch{return{};} })(); delete bargeld[uid]; fs.writeFileSync(BARGELD_FILE, JSON.stringify(bargeld,null,2));
        const trans = loadTrans ? loadTrans() : (()=>{ try{return JSON.parse(fs.readFileSync(TRANS_FILE,'utf8'));}catch{return{};} })(); delete trans[uid]; fs.writeFileSync(TRANS_FILE, JSON.stringify(trans,null,2));
        const lohnlog = loadLohnlog(); delete lohnlog[uid]; saveLohnlog(lohnlog);
        const rechnungen = loadRechnungen(); delete rechnungen[uid]; saveRechnungen(rechnungen);

        // Inventar + Lager
        const inv = loadInv(); delete inv[uid]; saveInv(inv);
        const lager = loadLager(); delete lager[uid]; saveLager(lager);

        // Ausweis + Einreise-Code
        const ausweis = loadAusweis(); delete ausweis[uid]; saveAusweis(ausweis);
        try { const codes = loadCodes ? loadCodes() : JSON.parse(fs.readFileSync(CODES_FILE,'utf8')||'{}'); const newCodes = Object.fromEntries(Object.entries(codes).filter(([k,v])=>v!==uid && k!==uid)); fs.writeFileSync(CODES_FILE, JSON.stringify(newCodes,null,2)); } catch {}
        try { const tokens = loadAusweisTokens(); const newTok = Object.fromEntries(Object.entries(tokens).filter(([k,v])=>v.discordId!==uid&&k!==uid)); saveAusweisTokens(newTok); } catch {}

        // Passbild löschen
        for (const ext of ['jpg','png','webp']) { try { fs.unlinkSync(path.join(DATA_DIR,'uploads',uid+'.'+ext)); } catch {} }

        // Server-Nickname + Rollen zurücksetzen
          try {
            const member = await interaction.guild.members.fetch(uid).catch(() => null);
            if (member) {
              await member.setNickname(null).catch(() => {});
              await member.roles.add('1490855725516460234').catch(() => {});
              for (const r of ['1490855719853887569','1490855722534310003','1495982076703539310','1497051373672599622','1490855731950256128','1490855741647618251','1490855728473178282','1490855779694280876','1490855729635135489','1490855750329696446','1490855788829216940','1490855796932739093','1498392324277796965','1490855730767597738','1498393200426221679']) await member.roles.remove(r).catch(() => {});
            }
          } catch {}

        // Log charakter-reset to channel
        try {
          const _rLogCh = await client.channels.fetch('1490878131240829028').catch(()=>null);
          if (_rLogCh) await _rLogCh.send({ embeds: [new EmbedBuilder().setColor(0xE65100)
            .setTitle('🔄 Charakter-Reset Protokoll')
            .addFields(
              { name: '👤 Spieler', value: `<@${uid}> — ${target.tag}`, inline: false },
              { name: '🛡️ Durchgeführt von', value: `<@${interaction.user.id}> — ${interaction.user.tag}`, inline: false },
              { name: '🕐 Zeitpunkt', value: `<t:${Math.floor(Date.now()/1000)}:F>`, inline: false }
            ).setFooter({ text: "Paradise City Roleplay • Charakter-Reset" }).setTimestamp()] });
        } catch {}

        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0xE65100).setTitle('🔄 Charakter zurückgesetzt')
            .setDescription(`<@${uid}> wurde vollständig zurückgesetzt.`)
            .addFields(
              { name: '🗑️ Gelöscht', value: 'Konto · Bargeld · Inventar · Lager · Ausweis · Transaktionen · Rechnungen · Lohnlog · Nickname', inline: false },
            )
            .setFooter({ text: `Durchgeführt von ${interaction.user.tag}` }).setTimestamp()
          ]
        });
        return;
      }

  // ─── INVENTAR: Buttons & Modals ──────────────────────────────────────────────
});

  
  // ─── RUBBELLOS ────────────────────────────────────────────────────────────────
    const RUBBELLOS_PRIZES = [
      { sym: '❌', label: 'Niete',                    type: 'niete',  weight: 35   },
      { sym: '💵', label: '1.000 $',            type: 'cash',   amount: 1000,  weight: 20   },
      { sym: '💴', label: '2.500 $',            type: 'cash',   amount: 2500,  weight: 13   },
      { sym: '💶', label: '5.000 $',            type: 'cash',   amount: 5000,  weight: 10   },
      { sym: '💰', label: '25.000 $',           type: 'cash',   amount: 25000, weight: 5    },
      { sym: '🚬', label: '10× Marlboro Rot',  type: 'item',   item: 'Marlboro Rot',           menge: 10, weight: 4   },
      { sym: '🚲', label: 'Elektro Fahrrad',    type: 'item',   item: 'Elektro Fahrrad',        menge: 1,  weight: 2   },
      { sym: '🏌️‍♂️', label: 'Golfschläger',          type: 'item',   item: 'Golfschläger',        menge: 1,  weight: 1.5 },
      { sym: '🎟️', label: 'Lottoschein',        type: 'item',   item: 'Lottoschein',            menge: 1,  weight: 1   },
      { sym: '🎫', label: '20% Rabatt beim Autohaus', type: 'item', item: '20% Rabatt beim Autohaus', menge: 1, weight: 1 },
    ];
    function pickRubbelPrize() {
      const total = RUBBELLOS_PRIZES.reduce((s, p) => s + p.weight, 0);
      let r = Math.random() * total;
      for (const p of RUBBELLOS_PRIZES) { r -= p.weight; if (r <= 0) return p; }
      return RUBBELLOS_PRIZES[0];
    }
    function buildRubbelGrid(prize) {
      const allSyms = RUBBELLOS_PRIZES.map(p => p.sym);
      if (prize.type === 'niete') {
        const grid = [];
        for (let i = 0; i < 9; i++) {
          let sym, att = 0;
          do { sym = allSyms[Math.floor(Math.random() * allSyms.length)]; att++; }
          while (att < 30 && (
            (i >= 2 && grid[i-1] === sym && grid[i-2] === sym) ||
            (i >= 6 && grid[i-3] === sym && grid[i-6] === sym)
          ));
          grid.push(sym);
        }
        return grid;
      } else {
        const others = allSyms.filter(s => s !== prize.sym);
        const winRow = Math.floor(Math.random() * 3);
        return Array(9).fill(null).map((_, i) => Math.floor(i / 3) === winRow ? prize.sym : others[Math.floor(Math.random() * others.length)]);
      }
    }
    function formatRubbelGrid(g) {
      const NL = String.fromCharCode(10);
    }

  // ─── SHOP: Buttons, Selects & Modals ──────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  const uid = interaction.user?.id;

  // ── Button: Rubbellos einlösen ──────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'rubbellos_use') {
      const inv = getUserInv(uid);
      const rubbelKey = Object.keys(inv).find(k => k.toLowerCase().includes('rubbellos'));
      if (!rubbelKey || inv[rubbelKey] < 1) {
        return interaction.reply({ content: '\u274C Du hast kein **Rubbellos** im Inventar.\n\uD83D\uDED2 Kaufe eines im **Kwik-E-Markt**!', ephemeral: true });
      }
      // Rubbellos aus Inventar entfernen
      inv[rubbelKey] -= 1;
      if (inv[rubbelKey] <= 0) delete inv[rubbelKey];
      setUserInv(uid, inv);
      // Gewinn + Grid vorbestimmen
      const rubbelPrize = pickRubbelPrize();
      const rubbelGrid  = buildRubbelGrid(rubbelPrize);
      // Einmal-Token generieren (30 min gueltig)
      const rubbelToken = crypto.randomBytes(16).toString('hex');
      _webMod.tokens.set(rubbelToken, { uid, prize: rubbelPrize, grid: rubbelGrid, usedAt: null, expiresAt: Date.now() + 30 * 60 * 1000 });
      const WEBAPP_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
      const scratchUrl = WEBAPP_URL + '/rubbellos?token=' + rubbelToken;
      const scratchBtn = new ButtonBuilder()
        .setLabel('\uD83C\uDF9F\uFE0F Jetzt Rubbeln!')
        .setStyle(ButtonStyle.Link)
        .setURL(scratchUrl);
      const scratchRow = new ActionRowBuilder().addComponents(scratchBtn);
      return interaction.reply({
        content: '\uD83C\uDF9F\uFE0F Dein Rubbellos ist bereit! Klicke den Button um es im Browser zu rubbeln.\n\u23F0 Der Link ist **30 Minuten** g\u00FCltig.',
        components: [scratchRow],
        ephemeral: true
      });
    }

  // ── Lotto: "Lotto spielen" Button → Browser-Seite öffnen ────────────────────
  if (interaction.isButton() && interaction.customId === 'lotto_play') {
    const inv = getUserInv(uid);
    const lottoKey = Object.keys(inv).find(k => k.toLowerCase().includes('lottoschein'));
    if (!lottoKey || inv[lottoKey] < 1) {
      return interaction.reply({
        content: '❌ Du hast keinen **Lottoschein** im Inventar!\n🛒 Kaufe einen im **Kwik-E-Markt** für **2.800 $**.',
        ephemeral: true
      });
    }
    // Token generieren (30 Min gültig)
    const lottoToken = crypto.randomBytes(16).toString('hex');
    _webMod.lottoTokens.set(lottoToken, {
      uid,
      userTag: interaction.user.tag,
      expiresAt: Date.now() + 30 * 60 * 1000,
      submitted: false
    });
    const WEBAPP_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
    const lottoUrl = WEBAPP_URL + '/lotto?token=' + lottoToken;
    const lottoBtn = new ButtonBuilder()
      .setLabel('🎰 Lotto-Schein ausfüllen')
      .setStyle(ButtonStyle.Link)
      .setURL(lottoUrl);
    return interaction.reply({
      content: '🎰 Dein Lotto-Schein ist bereit! Klicke den Button und wähle deine Zahlen im Browser.\n⏰ Der Link ist **30 Minuten** gültig.',
      components: [new ActionRowBuilder().addComponents(lottoBtn)],
      ephemeral: true
    });
  }

  // Team Shop: pagination & take
  if (interaction.isButton() && interaction.customId.startsWith('ts_')) {
    const parts = interaction.customId.split(':');
    const action = parts[0];
    const shops = loadShops(); const items = shops.team || [];
    const totalPages = Math.max(1, Math.ceil(items.length / 10));
    let page = parseInt(parts[1]) || 0;
    if (action === 'ts_prev') page = Math.max(0, page - 1);
    else if (action === 'ts_next') page = Math.min(totalPages - 1, page + 1);
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ts_prev:' + page).setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId('ts_next:' + page).setEmoji('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages - 1),
    );
    return interaction.update({ embeds: [buildTeamShopEmbed(items, page)], components: [navRow] });
  }

  // Team Shop: item select -> give

    // ─── LOHN ABHOLEN ────────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'lohn_abholen') {
      const uid = interaction.user.id;
      const member = await interaction.guild.members.fetch(uid).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Konnte dein Mitglied nicht laden.', ephemeral: true });

      const lohnklasse = LOHNKLASSEN.find(lk => member.roles.cache.has(lk.roleId));
      if (!lohnklasse) return interaction.reply({ content: '❌ Du hast keine gültige Lohnklassen-Rolle.', ephemeral: true });

      const lohnlog = loadLohnlog();
      const now = Date.now();
      const last = lohnlog[uid] ?? 0;
      if (now - last < LOHN_INTERVAL_MS) {
        const remaining = Math.ceil((LOHN_INTERVAL_MS - (now - last)) / 60000);
        return interaction.reply({ content: `⏳ Du musst noch **${remaining} Minute(n)** warten.`, ephemeral: true });
      }

      const k = getKonto(uid);
      k.konto += lohnklasse.betrag;
      setKonto(uid, k);
      lohnlog[uid] = now;
      saveLohnlog(lohnlog);
      addTrans(uid, { ts: now, text: `+${lohnklasse.betrag.toLocaleString('de-CH')} ${MONEY_GIF} Lohn (${lohnklasse.label})`, betrag: lohnklasse.betrag });
      sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
        .setTitle('💰 Geld-Log: Lohn abgeholt')
        .addFields({ name:'Spieler', value:`<@${uid}>`, inline:true },{ name:'Klasse', value:lohnklasse.label, inline:true },{ name:'Betrag', value:`${lohnklasse.betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true })
        .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});

      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x43A047).setTitle('💵 Lohn abgeholt').setDescription(
          `Du hast **${lohnklasse.betrag.toLocaleString('de-CH')} ${MONEY_GIF}** als **${lohnklasse.label}** erhalten.\n\nNeuer Kontostand: **${k.konto.toLocaleString('de-CH')} ${MONEY_GIF}**`
        )], ephemeral: true
      });
    }

    // ─── ONLINE BANKING OPEN ────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'banking_open') {
      const uid = interaction.user.id;
      const member = await interaction.guild.members.fetch(uid).catch(() => null);
      const k = getKonto(uid);
      const trans = getLastTrans(uid, 50);
      const hasSchwarz = member?.roles.cache.has(SCHWARZ_ROLE) ?? false;

      // Nur Ausgaben (negatives betrag) anzeigen
      const ausgaben = trans.filter(t => typeof t.betrag === 'number' && t.betrag < 0).slice(0, 8);
      const transText = ausgaben.length
        ? ausgaben.map(t => `${MONEY_GIF} **${Math.abs(t.betrag).toLocaleString('de-CH')} $** — <t:${Math.floor(t.ts/1000)}:R>`).join('\n')
        : '_Keine Ausgaben vorhanden_';

      const balFelder = [
        { name: `${MONEY_GIF} Kontostand`, value: `**${k.konto.toLocaleString('de-CH')} $**`, inline: true },
        ...(hasSchwarz ? [{ name: `🖤 Schwarzgeld`, value: `**${(k.schwarz||0).toLocaleString('de-CH')} $**`, inline: true }] : []),
      ];

      const embed = new EmbedBuilder()
        .setColor(0xE65100)
        .setTitle(`🏧  Online Banking  ${MONEY_GIF}`)
        .addFields(...balFelder)
        .addFields(
          { name: `📤 Letzte Ausgaben`, value: transText }
        )
        .setFooter({ text: `Paradise City Bank • Sicher & Verschlüsselt` })
        .setTimestamp();

      const rows = [];
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bank_einzahlen').setLabel(`\u{1F4B0} Einzahlen`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('bank_auszahlen').setLabel(`\u{1F4B8} Auszahlen`).setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('bank_ueberweisen').setLabel(`\u{1F4E4} Überweisen`).setStyle(ButtonStyle.Primary)
      );
      rows.push(row1);
      if (hasSchwarz) {
        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('bank_schwarz_send').setLabel(`\u{1F5A4} Schwarzgeld senden`).setStyle(ButtonStyle.Secondary)
        );
        rows.push(row2);
      }

      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    // ─── BANKING: Einzahlen Modal ────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'bank_einzahlen') {
      const modal = new ModalBuilder().setCustomId('bank_modal_einzahlen').setTitle('💰 Bargeld einzahlen');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('bank_betrag').setLabel(`Betrag ${MONEY_GIF}`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('z.B. 1000')
      ));
      return interaction.showModal(modal);
    }

    // ─── BANKING: Auszahlen Modal ────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'bank_auszahlen') {
      const modal = new ModalBuilder().setCustomId('bank_modal_auszahlen').setTitle(`💸 Kontogeld auszahlen ${MONEY_GIF}`);
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('bank_betrag').setLabel(`Betrag ${MONEY_GIF}`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('z.B. 1000')
      ));
      return interaction.showModal(modal);
    }

    // ─── BANKING: Überweisen Modal ───────────────────────────────────────────
    // ─── BANKING: Überweisen → User auswählen ───────────────────────────────
    if (interaction.isButton() && interaction.customId === 'bank_ueberweisen') {
      const select = new UserSelectMenuBuilder().setCustomId('bank_sel_ueb').setPlaceholder('Empfänger auswählen').setMinValues(1).setMaxValues(1);
      return interaction.reply({ content: '📤 **Empfänger für Überweisung auswählen:**', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    // ─── BANKING: Schwarzgeld verschicken Modal ──────────────────────────────
    // ─── BANKING: Schwarzgeld → User auswählen ──────────────────────────────
    if (interaction.isButton() && interaction.customId === 'bank_schwarz_send') {
      const select = new UserSelectMenuBuilder().setCustomId('bank_sel_schw').setPlaceholder('Empfänger auswählen').setMinValues(1).setMaxValues(1);
      return interaction.reply({ content: '🖤 **Empfänger für Schwarzgeld auswählen:**', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    // ─── BANKING: User gewählt → Betrag Modal (Überweisen) ──────────────────
    if (interaction.isUserSelectMenu() && interaction.customId === 'bank_sel_ueb') {
      const targetId = interaction.values[0];
      if (targetId === interaction.user.id) return interaction.reply({ content: '❌ Du kannst nicht an dich selbst überweisen.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId(`bank_modal_ueb:${targetId}`).setTitle('📤 Betrag überweisen');
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bank_betrag').setLabel(`Betrag ${MONEY_GIF}`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('z.B. 500')));
      return interaction.showModal(modal);
    }

    // ─── BANKING: User gewählt → Betrag Modal (Schwarzgeld) ─────────────────
    if (interaction.isUserSelectMenu() && interaction.customId === 'bank_sel_schw') {
      const targetId = interaction.values[0];
      if (targetId === interaction.user.id) return interaction.reply({ content: '❌ Du kannst nicht an dich selbst senden.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId(`bank_modal_schw:${targetId}`).setTitle(`🖤 Schwarzgeld senden ${MONEY_GIF}`);
      modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bank_betrag').setLabel(`Betrag ${MONEY_GIF}`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('z.B. 500')));
      return interaction.showModal(modal);
    }
    // ─── RECHNUNGEN OPEN ────────────────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'rechnungen_open') {
      const uid = interaction.user.id;
      const alle = loadRechnungen();
      const meine = alle[uid] ?? [];
      if (!meine.length) return interaction.reply({ content: '✅ Du hast keine offenen Rechnungen.', ephemeral: true });

      const embed = new EmbedBuilder().setColor(0xE65100).setTitle('🧾 Deine Rechnungen');
      let desc = '';
      meine.forEach((r, i) => {
        desc += `**${i+1}. ${r.beschreibung}** — ${r.betrag.toLocaleString('de-CH')} ${MONEY_GIF}\n`;
      });
      embed.setDescription(desc);

      const rows = [];
      // Individual pay buttons (max 5 per row, max 2 rows = 10 buttons; use select if more)
      if (meine.length <= 5) {
        const row = new ActionRowBuilder();
        meine.forEach((r, i) => {
          row.addComponents(new ButtonBuilder().setCustomId(`rechnung_pay:${r.id}`).setLabel(`${i+1}. bezahlen (${r.betrag.toLocaleString('de-CH')} ${MONEY_GIF})`).setStyle(ButtonStyle.Primary));
        });
        rows.push(row);
      } else {
        // Use select menu for many invoices
        const sel = new StringSelectMenuBuilder().setCustomId('rechnung_pay_select').setPlaceholder('Rechnung auswählen')
          .addOptions(meine.map((r, i) => ({ label: `${i+1}. ${r.beschreibung}`, description: `${r.betrag.toLocaleString('de-CH')} ${MONEY_GIF}`, value: r.id })));
        rows.push(new ActionRowBuilder().addComponents(sel));
      }
      // Pay all button
      const rowAll = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rechnung_pay_all').setLabel('✅ Alle bezahlen').setStyle(ButtonStyle.Success)
      );
      rows.push(rowAll);

      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }

    // ─── RECHNUNG EINZELN BEZAHLEN ──────────────────────────────────────────
    if (interaction.isButton() && interaction.customId.startsWith('rechnung_pay:')) {
      const uid = interaction.user.id;
      const rId = interaction.customId.split(':')[1];
      const alle = loadRechnungen();
      const meine = alle[uid] ?? [];
      const rechnung = meine.find(r => r.id === rId);
      if (!rechnung) return interaction.reply({ content: '❌ Rechnung nicht gefunden.', ephemeral: true });
      const k = getKonto(uid);
      if (k.konto < rechnung.betrag) return interaction.reply({ content: `❌ Nicht genug Kontogeld. Du hast **${k.konto.toLocaleString('de-CH')} ${MONEY_GIF}**, benötigt: **${rechnung.betrag.toLocaleString('de-CH')} ${MONEY_GIF}**.`, ephemeral: true });
      k.konto -= rechnung.betrag;
      setKonto(uid, k);
      alle[uid] = meine.filter(r => r.id !== rId);
      saveRechnungen(alle);
      addTrans(uid, { ts: Date.now(), text: `-${rechnung.betrag.toLocaleString('de-CH')} ${MONEY_GIF} Rechnung: ${rechnung.beschreibung}`, betrag: -rechnung.betrag });
      return interaction.reply({ content: `✅ Rechnung **${rechnung.beschreibung}** über **${rechnung.betrag.toLocaleString('de-CH')} ${MONEY_GIF}** bezahlt.`, ephemeral: true });
    }

    // ─── ALLE RECHNUNGEN BEZAHLEN ───────────────────────────────────────────
    if (interaction.isButton() && interaction.customId === 'rechnung_pay_all') {
      const uid = interaction.user.id;
      const alle = loadRechnungen();
      const meine = alle[uid] ?? [];
      if (!meine.length) return interaction.reply({ content: '✅ Keine offenen Rechnungen.', ephemeral: true });
      const total = meine.reduce((s, r) => s + r.betrag, 0);
      const k = getKonto(uid);
      if (k.konto < total) return interaction.reply({ content: `❌ Nicht genug Kontogeld. Du hast **${k.konto.toLocaleString('de-CH')} ${MONEY_GIF}**, benötigt: **${total.toLocaleString('de-CH')} ${MONEY_GIF}**.`, ephemeral: true });
      k.konto -= total;
      setKonto(uid, k);
      alle[uid] = [];
      saveRechnungen(alle);
      addTrans(uid, { ts: Date.now(), text: `-${total.toLocaleString('de-CH')} ${MONEY_GIF} Alle Rechnungen beglichen`, betrag: -total });
      return interaction.reply({ content: `✅ Alle **${meine.length}** Rechnungen über insgesamt **${total.toLocaleString('de-CH')} ${MONEY_GIF}** bezahlt.`, ephemeral: true });
    }

    // ─── RECHNUNG SELECT MENU ───────────────────────────────────────────────
    if (interaction.isStringSelectMenu() && interaction.customId === 'rechnung_pay_select') {
      const uid = interaction.user.id;
      const rId = interaction.values[0];
      const alle = loadRechnungen();
      const meine = alle[uid] ?? [];
      const rechnung = meine.find(r => r.id === rId);
      if (!rechnung) return interaction.reply({ content: '❌ Rechnung nicht gefunden.', ephemeral: true });
      const k = getKonto(uid);
      if (k.konto < rechnung.betrag) return interaction.reply({ content: `❌ Nicht genug Kontogeld.`, ephemeral: true });
      k.konto -= rechnung.betrag;
      setKonto(uid, k);
      alle[uid] = meine.filter(r => r.id !== rId);
      saveRechnungen(alle);
      addTrans(uid, { ts: Date.now(), text: `-${rechnung.betrag.toLocaleString('de-CH')} ${MONEY_GIF} Rechnung: ${rechnung.beschreibung}`, betrag: -rechnung.betrag });
      return interaction.reply({ content: `✅ Rechnung **${rechnung.beschreibung}** über **${rechnung.betrag.toLocaleString('de-CH')} ${MONEY_GIF}** bezahlt.`, ephemeral: true });
    }

    // Regular shop: open session
  if (interaction.isButton() && interaction.customId.startsWith('sp_shop:')) {
    const shopId = interaction.customId.split(':')[1];
    clearCart(uid, shopId);
    const shops = loadShops(); const items = shops[shopId] || [];
    if (!items.length) return interaction.reply({ content: '❌ Dieser Shop hat noch keine Items.', ephemeral: true });
    const { embed, components } = buildShopSession(shopId, items, 0, getCart(uid, shopId), getCash(uid));
    return interaction.reply({ embeds: [embed], components, ephemeral: true });
  }

  // Regular shop: pagination
  if (interaction.isButton() && (interaction.customId.startsWith('sp_prev:') || interaction.customId.startsWith('sp_next:'))) {
    const parts  = interaction.customId.split(':');
    const action = parts[0]; const shopId = parts[2];
    const shops  = loadShops(); const items = shops[shopId] || [];
    const totalP = Math.max(1, Math.ceil(items.length / 10));
    let page = parseInt(parts[1]) || 0;
    if (action === 'sp_prev') page = Math.max(0, page - 1);
    else page = Math.min(totalP - 1, page + 1);
    const { embed, components } = buildShopSession(shopId, items, page, getCart(uid, shopId), getCash(uid));
    return interaction.update({ embeds: [embed], components });
  }

  // Regular shop: item select -> qty modal
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sp_sel:')) {
    const parts    = interaction.customId.split(':');
    const page     = parts[1]; const shopId = parts[2];
    const itemName = interaction.values[0];
    const modal = new ModalBuilder().setCustomId('sp_qty:' + page + ':' + shopId + ':' + itemName).setTitle('Menge eingeben');
    const qtyIn = new TextInputBuilder().setCustomId('qty').setLabel('Wie viele von "' + itemName + '"?').setStyle(TextInputStyle.Short).setPlaceholder('z.B. 3').setRequired(true).setMinLength(1).setMaxLength(4);
    modal.addComponents(new ActionRowBuilder().addComponents(qtyIn));
    return interaction.showModal(modal);
  }

  // ─── BANKING MODALS ────────────────────────────────────────────────────────
    if (interaction.isModalSubmit() && interaction.customId === 'bank_modal_einzahlen') {
      const uid = interaction.user.id;
      const betrag = parseInt(interaction.fields.getTextInputValue('bank_betrag').replace(/[^0-9]/g,''));
      if (isNaN(betrag) || betrag <= 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });
      const bar = getCash(uid);
      if (bar < betrag) return interaction.reply({ content: `❌ Nicht genug Bargeld. Du hast **${bar.toLocaleString('de-CH')} ` + MONEY_GIF + `**.`, ephemeral: true });
      setCash(uid, bar - betrag);
      const k = getKonto(uid);
      k.konto += betrag;
      setKonto(uid, k);
      addTrans(uid, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Einzahlung`, betrag });
        sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('💰 Geld-Log: Einzahlung (Bargeld→Konto)')
          .addFields({ name:'Spieler', value:`<@${uid}>`, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
      return interaction.reply({ content: `✅ **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + `** erfolgreich eingezahlt. Neuer Kontostand: **${k.konto.toLocaleString('de-CH')} ` + MONEY_GIF + `**`, ephemeral: true });
    }

    if (interaction.isModalSubmit() && interaction.customId === 'bank_modal_auszahlen') {
      const uid = interaction.user.id;
      const betrag = parseInt(interaction.fields.getTextInputValue('bank_betrag').replace(/[^0-9]/g,''));
      if (isNaN(betrag) || betrag <= 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });
      const k = getKonto(uid);
      if (k.konto < betrag) return interaction.reply({ content: `❌ Nicht genug Kontogeld. Du hast **${k.konto.toLocaleString('de-CH')} ` + MONEY_GIF + `**.`, ephemeral: true });
      k.konto -= betrag;
      setKonto(uid, k);
      setCash(uid, getCash(uid) + betrag);
      addTrans(uid, { ts: Date.now(), text: `-${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Auszahlung`, betrag: -betrag });
        sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('💰 Geld-Log: Auszahlung (Konto→Bargeld)')
          .addFields({ name:'Spieler', value:`<@${uid}>`, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
      return interaction.reply({ content: `✅ **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + `** ausgezahlt. Neuer Kontostand: **${k.konto.toLocaleString('de-CH')} ` + MONEY_GIF + `**`, ephemeral: true });
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('bank_modal_ueb:')) {
      const targetId = interaction.customId.split(':')[1];
      const uid    = interaction.user.id;
      const betrag   = parseInt(interaction.fields.getTextInputValue('bank_betrag').replace(/[^0-9]/g,''));
      if (isNaN(betrag) || betrag <= 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });
      if (targetId === uid) return interaction.reply({ content: '❌ Du kannst nicht an dich selbst überweisen.', ephemeral: true });
      const k = getKonto(uid);
      if (k.konto < betrag) return interaction.reply({ content: `❌ Nicht genug Kontogeld. Du hast **${k.konto.toLocaleString('de-CH')} ` + MONEY_GIF + `**.`, ephemeral: true });
      k.konto -= betrag;
      setKonto(uid, k);
      const kt = getKonto(targetId);
      kt.konto += betrag;
      setKonto(targetId, kt);
      addTrans(uid, { ts: Date.now(), text: `-${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Überweisung an <@${targetId}>`, betrag: -betrag });
      addTrans(targetId, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Überweisung von <@${uid}>`, betrag });
        sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('💰 Geld-Log: Überweisung')
          .addFields({ name:'Von', value:`<@${uid}>`, inline:true },{ name:'An', value:`<@${targetId}>`, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
      return interaction.reply({ content: `✅ **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + `** an <@${targetId}> überwiesen.`, ephemeral: true });
    }
  // ── AUSWEIS CREATE (ILLEGAL) Modal — DEAKTIVIERT (Illegale erhalten keinen Ausweis) ──
  if (interaction.isModalSubmit() && interaction.customId.startsWith('ausweis_create_ill:')) {
    const targetId   = interaction.customId.split(':')[1];
    const illVor     = interaction.fields.getTextInputValue('ill_vorname').trim();
    const illNach    = interaction.fields.getTextInputValue('ill_nachname').trim();
    const illPsn     = interaction.fields.getTextInputValue('ill_psn').trim();
    const illGeschl  = interaction.fields.getTextInputValue('ill_geschlecht').trim();
    if (!illVor || !illNach || !illPsn || !illGeschl) {
      return interaction.reply({ content: '❌ Bitte alle Felder ausfüllen.', ephemeral: true });
    }
    // Ausweis speichern
    const ausweise = loadAusweis();
    ausweise[targetId] = { vorname: illVor, nachname: illNach, psn: illPsn, geschlecht: illGeschl, typ: 'illegal', createdAt: new Date().toISOString(), createdBy: interaction.user.id };
    saveAusweis(ausweise);
    // Rollen vergeben
    try {
      const _guild  = interaction.guild;
      const _member = _guild ? await _guild.members.fetch(targetId).catch(() => null) : null;
      if (_member) {
        await _member.roles.remove('1490855725516460234').catch(() => {});
        for (const r of [...['1490855719853887569','1490855722534310003','1495982076703539310','1497051373672599622','1490855731950256128','1490855741647618251','1490855728473178282','1490855779694280876'], ...['1490855730767597738','1498393200426221679']]) await _member.roles.add(r).catch(() => {});
        await _member.setNickname(`${illVor} ${illNach} | ${illPsn}`).catch(() => {});
      }
    } catch {}
    // Startgeld (5000 $, einmalig auf Konto)
    try {
      const _k = getKonto(targetId);
      if (!_k._startgeld) { _k.konto += 5000; _k._startgeld = true; setKonto(targetId, _k); addTrans(targetId, { ts: Date.now(), text: '+5.000 $ Startgeld (Illegale Einreise)', betrag: 5000 }); }
    } catch {}
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xE65100).setTitle('🚫 Illegale Einreise registriert')
        .addFields({ name: 'Spieler', value: `<@${targetId}>`, inline: true }, { name: 'Name', value: `${illVor} ${illNach}`, inline: true }, { name: 'PSN', value: illPsn, inline: true }, { name: 'Geschlecht', value: illGeschl, inline: true })
        .setFooter({ text: `Erstellt von ${interaction.user.tag}` }).setTimestamp()],
      ephemeral: true
    });
  }

    if (interaction.isModalSubmit() && interaction.customId.startsWith('bank_modal_schw:')) {
      const targetId = interaction.customId.split(':')[1];
      const uid      = interaction.user.id;
      const betrag   = parseInt(interaction.fields.getTextInputValue('bank_betrag').replace(/[^0-9]/g,''));
      if (isNaN(betrag) || betrag <= 0) return interaction.reply({ content: '❌ Ungültiger Betrag.', ephemeral: true });
      if (targetId === uid) return interaction.reply({ content: '❌ Du kannst nicht an dich selbst senden.', ephemeral: true });
      const senderMember = await interaction.guild.members.fetch(uid).catch(() => null);
      if (!senderMember?.roles.cache.has(SCHWARZ_ROLE)) return interaction.reply({ content: '❌ Du hast keine Berechtigung Schwarzgeld zu verschicken.', ephemeral: true });
      const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
      if (!targetMember?.roles.cache.has(SCHWARZ_ROLE)) return interaction.reply({ content: '❌ Der Empfänger hat keine Schwarzgeld-Rolle.', ephemeral: true });
      const k = getKonto(uid);
      if (k.schwarz < betrag) return interaction.reply({ content: `❌ Nicht genug Schwarzgeld. Du hast **${k.schwarz.toLocaleString('de-CH')} ${MONEY_GIF}**.`, ephemeral: true });
      k.schwarz -= betrag;
      setKonto(uid, k);
      const kt = getKonto(targetId);
      kt.schwarz += betrag;
      setKonto(targetId, kt);
      addTrans(uid, { ts: Date.now(), text: `-${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Schwarzgeld an <@${targetId}>`, betrag: -betrag });
      addTrans(targetId, { ts: Date.now(), text: `+${betrag.toLocaleString('de-CH')} ${MONEY_GIF} Schwarzgeld von <@${uid}>`, betrag });
        sendLog(LOG_MONEY_CH, new EmbedBuilder().setColor(0xE65100)
          .setTitle('💰 Geld-Log: Schwarzgeld gesendet')
          .addFields({ name:'Von', value:`<@${uid}>`, inline:true },{ name:'An', value:`<@${targetId}>`, inline:true },{ name:'Betrag', value:`${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + ``, inline:true })
          .setFooter({ text: interaction.user.tag }).setTimestamp()).catch(()=>{});
      return interaction.reply({ content: `✅ **${betrag.toLocaleString('de-CH')} ` + MONEY_GIF + `** Schwarzgeld an <@${targetId}> verschickt.`, ephemeral: true });
    }

    // Regular shop: modal -> add to cart
  if (interaction.isModalSubmit() && interaction.customId.startsWith('sp_qty:')) {
    const parts    = interaction.customId.split(':');
    const page     = parseInt(parts[1]) || 0; const shopId = parts[2]; const itemName = parts.slice(3).join(':');
    const menge    = parseInt(interaction.fields.getTextInputValue('qty').trim());
    if (isNaN(menge) || menge < 1) return interaction.reply({ content: '❌ Ungültige Menge.', ephemeral: true });
    const shops = loadShops(); const items = shops[shopId] || [];
    const item  = items.find(i => i.name === itemName);
    if (!item) return interaction.reply({ content: '❌ Item nicht gefunden.', ephemeral: true });
    const cart  = getCart(uid, shopId);
    const exist = cart.find(c => c.name === itemName);
    if (exist) exist.menge += menge; else cart.push({ name: itemName, preis: item.preis, menge });
    const cash = getCash(uid);
    const { embed: shopEmbed, components } = buildShopSession(shopId, items, page, cart, cash);
    const cartEmbed = buildCartEmbed(shopId, cart, cash);
    return interaction.reply({ content: '🛒 **' + itemName + '** x' + menge + ' zum Warenkorb!', embeds: [shopEmbed, cartEmbed], components, ephemeral: true });
  }

  // Regular shop: remove from cart
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('sp_rm:')) {
    const parts    = interaction.customId.split(':');
    const page     = parseInt(parts[1]) || 0; const shopId = parts[2]; const itemName = interaction.values[0];
    const cart     = getCart(uid, shopId);
    const rmIdx    = cart.findIndex(c => c.name === itemName);
    if (rmIdx !== -1) cart.splice(rmIdx, 1);
    const shops = loadShops(); const items = shops[shopId] || [];
    const cash  = getCash(uid);
    const { embed: shopEmbed, components } = buildShopSession(shopId, items, page, cart, cash);
    const cartEmbed = buildCartEmbed(shopId, cart, cash);
    return interaction.update({ content: '🗑️ **' + itemName + '** entfernt.', embeds: [shopEmbed, cartEmbed], components });
  }

  // Regular shop: clear cart
  if (interaction.isButton() && interaction.customId.startsWith('sp_clear:')) {
    const parts  = interaction.customId.split(':');
    const page   = parseInt(parts[1]) || 0; const shopId = parts[2];
    clearCart(uid, shopId);
    const shops = loadShops(); const items = shops[shopId] || [];
    const { embed, components } = buildShopSession(shopId, items, page, [], getCash(uid));
    return interaction.update({ content: '🗑️ Warenkorb geleert.', embeds: [embed], components });
  }

  // Regular shop: buy
  if (interaction.isButton() && interaction.customId.startsWith('sp_buy:')) {
    const parts  = interaction.customId.split(':');
    const shopId = parts[2];
    const cart   = getCart(uid, shopId);
    if (!cart.length) return interaction.reply({ content: '❌ Warenkorb ist leer.', ephemeral: true });
    const total = cartTotal(cart); const cash = getCash(uid);
    if (cash < total) return interaction.reply({ content: '❌ Nicht genug Bargeld! Du hast ' + cash.toLocaleString('de-DE') + ' Euro, benötigst ' + total.toLocaleString('de-DE') + ' Euro.', ephemeral: true });
    setCash(uid, cash - total);
    const inv = loadInv(); if (!inv[uid]) inv[uid] = {};
    for (const ci of cart) { inv[uid][ci.name] = (inv[uid][ci.name] || 0) + ci.menge; }
    saveInv(inv);
    const itemList = cart.map(c => '▸ **' + c.name + '** x' + c.menge).join('\n');
    clearCart(uid, shopId);
    const m = SHOP_META[shopId];
    const receipt = new EmbedBuilder().setColor(0x57F287).setTitle('🧾  Einkauf erfolgreich!')
      .setDescription(itemList)
      .addFields(
        { name: '💸  Gezahlt', value: total.toLocaleString('de-DE') + ' Euro', inline: true },
        { name: '💵  Verbleibendes Bargeld', value: getCash(uid).toLocaleString('de-DE') + ' Euro', inline: true }
      ).setFooter({ text: 'Paradise City Roleplay  •  ' + m.name }).setTimestamp();
    


  return interaction.update({ content: null, embeds: [receipt], components: [] });
  }
});

// ─── LOTTO ZIEHUNG FUNKTION ───────────────────────────────────────────────────
async function doLottoZiehung(client) {
  try {
    const now = Date.now();
    const today = new Date(now).toISOString().split('T')[0];
    let week = loadLottoWeek();
    const currentWeekStart = getWeekStart(now);

    // Wochenzähler zurücksetzen wenn neue Woche
    if (week.weekStart < currentWeekStart) {
      week = { winners: 0, weekStart: currentWeekStart, lastDraw: week.lastDraw };
    }

    // Schon heute gezogen?
    if (week.lastDraw === today) return;

    // 6 einmalige Zahlen 1-100 ziehen
    const pool = Array.from({ length: 100 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const gezogeneZahlen = pool.slice(0, 6).sort((a, b) => a - b);
    const gezogeneSuperzahl = Math.floor(Math.random() * 10) + 1;

    // Alle Tickets von heute auswerten
    const tickets = loadLottoTickets();
    const winners = [];
    const MAX_WINNERS_PER_WEEK = 5;

    for (const [userId, userTickets] of Object.entries(tickets)) {
      const todayTickets = userTickets.filter(t => t.drawKey === today);
      for (const ticket of todayTickets) {
        if (week.winners >= MAX_WINNERS_PER_WEEK) break;
        const richtige = ticket.zahlen.filter(z => gezogeneZahlen.includes(z)).length;
        const superzahlTreffer = ticket.superzahl === gezogeneSuperzahl;

        // Superzahl-Jackpot hat Vorrang (alle 6 richtig + Superzahl)
        let gewinnPrize = null;
        if (richtige === 6 && superzahlTreffer) {
          gewinnPrize = LOTTO_PRIZES.find(p => p.superzahl);
        } else {
          gewinnPrize = LOTTO_PRIZES.find(p => !p.superzahl && p.richtig === richtige);
        }

        if (gewinnPrize && gewinnPrize.betrag > 0) {
          winners.push({ userId, richtige, superzahlTreffer, betrag: gewinnPrize.betrag, label: gewinnPrize.label, ticket });
          week.winners++;
        }
      }
    }

    // Gewinne auszahlen + DMs senden
    for (const w of winners) {
      const k = getKonto(w.userId);
      k.konto += w.betrag;
      setKonto(w.userId, k);
      addTrans(w.userId, { ts: now, text: `+${w.betrag.toLocaleString('de-CH')} ${MONEY_GIF} Lotto-Gewinn (${w.label})`, betrag: w.betrag });

      // DM an Gewinner
      try {
        const user = await client.users.fetch(w.userId);
        const dmEmbed = new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('🏆 Du hast im Lotto gewonnen!')
          .setDescription(
            `**Herzlichen Glückwunsch!** 🎉\n\n` +
            `**Deine Zahlen:** ${w.ticket.zahlen.map(n => `\`${String(n).padStart(2,'0')}\``).join(' ')}\n` +
            `**Superzahl:** \`${w.ticket.superzahl}\`\n\n` +
            `**Gezogene Zahlen:** ${gezogeneZahlen.map(n => `\`${String(n).padStart(2,'0')}\``).join(' ')}\n` +
            `**Gezogene Superzahl:** \`${gezogeneSuperzahl}\`\n\n` +
            `**Ergebnis:** ${w.label}\n` +
            `**Gewinn:** 💰 **${w.betrag.toLocaleString('de-CH')} $**\n\n` +
            `Der Betrag wurde direkt auf dein Konto überwiesen!`
          )
          .setFooter({ text: 'Paradise City Roleplay  •  Lotto' })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] }).catch(() => {});
      } catch (_) {}
    }

    // Ziehungs-Ergebnis im Lotto-Kanal posten
    const lottoCh = await client.channels.fetch(LOTTO_CH).catch(() => null);
    if (lottoCh) {
      const zahlenStr = gezogeneZahlen.map(n => `\`${String(n).padStart(2,'0')}\``).join('  ');
      let winnersText = winners.length > 0
        ? winners.map(w => `<@${w.userId}> — ${w.label} — **${w.betrag.toLocaleString('de-CH')} $**`).join('\n')
        : '_Heute keine Gewinner — versuche es morgen!_ 🍀';
      if (week.winners >= MAX_WINNERS_PER_WEEK && winners.length === 0) {
        winnersText = '⚠️ **Wochenlimit erreicht** — keine weiteren Gewinne bis nächste Woche!';
      }

      const resultEmbed = new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('🎰 Paradise City Lotto — Tagesziehung')
        .setDescription(
          `**📅 Datum:** ${today}\n\n` +
          `**🎱 Gezogene Zahlen:**\n${zahlenStr}\n\n` +
          `**🌟 Superzahl:** \`${gezogeneSuperzahl}\`\n\n` +
          `**🏆 Gewinner:**\n${winnersText}\n\n` +
          `*Gewinne werden automatisch aufs Konto überwiesen.*\n` +
          `*Die nächste Ziehung findet morgen um 12:00 Uhr statt.*`
        )
        .setFooter({ text: `Paradise City Roleplay  •  Lotto  •  ${week.winners}/${MAX_WINNERS_PER_WEEK} Wochengewinner` })
        .setTimestamp();

      const playBtn = new ButtonBuilder()
        .setCustomId('lotto_play')
        .setLabel('🎰 Lotto spielen')
        .setStyle(ButtonStyle.Primary);
      await lottoCh.send({ embeds: [resultEmbed], components: [new ActionRowBuilder().addComponents(playBtn)] });
    }

    // Alle heutigen Tickets löschen, Woche speichern
    for (const userId of Object.keys(tickets)) {
      tickets[userId] = (tickets[userId] || []).filter(t => t.drawKey !== today);
      if (tickets[userId].length === 0) delete tickets[userId];
    }
    saveLottoTickets(tickets);
    week.lastDraw = today;
    saveLottoWeek(week);
  } catch (err) {
    console.error('[LOTTO ZIEHUNG FEHLER]', err);
  }
}

// ─── LOTTO TÄGLICHE ZIEHUNG (12:00 Uhr CET = 10:00 UTC) ─────────────────────
setInterval(async () => {
  const now = new Date();
  const hour = now.getUTCHours();
  const min  = now.getUTCMinutes();
  if (hour === 10 && min === 0) {
    await doLottoZiehung(client);
  }
}, 60 * 1000);


// ─── HANDY INTERACTIONS ───────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  // Nur Handy-relevante Interaktionen
  if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;

  const cid = interaction.customId;

  // Select-Menu: effectiveId = gewählter Wert, sonst = customId
  const effectiveId = (interaction.isStringSelectMenu() && cid === 'handy_menu')
    ? interaction.values[0]
    : cid;

  // Nur weiterverarbeiten wenn es ein Handy-Befehl ist
  const handyIds = ['handy_an','handy_aus','handy_apps','handy_spiele','handy_dispatch','handy_whatsapp'];
  const subIds   = ['app_select','spiel_snake','spiel_tetris','dispatch_lapd','dispatch_lamd','dispatch_lacs','whatsapp_empfaenger'];
  if (cid !== 'handy_menu' && !handyIds.includes(cid) && !subIds.includes(cid) && !cid.startsWith('whatsapp_msg_')) return;

  const uid    = interaction.user.id;
  const member = interaction.member;

  // Inventar-Helfer (eigene Kopie damit kein Scope-Problem)
  const _path = require('path');
  const _fs   = require('fs');
  const INV_FILE_H = _path.join(__dirname, 'data', 'inventar.json');
  function _loadInv() { try { return JSON.parse(_fs.readFileSync(INV_FILE_H, 'utf8')); } catch { return {}; } }
  function _getUserInv(id) { return _loadInv()[id] || {}; }
  function _setUserInv(id, items) { const d = _loadInv(); d[id] = items; _fs.writeFileSync(INV_FILE_H, JSON.stringify(d, null, 2), 'utf8'); }

  // hatHandy: NUR Inventar prüfen — Item-Name muss "handy" enthalten
  function hatHandy(uid) {
    const inv = _getUserInv(uid);
    return Object.keys(inv).some(n => n.toLowerCase().includes('smartphone'));
  }
  // hatHandyAn: Handy eingeschaltet = Rolle vorhanden UND Item noch im Inventar
  function hatHandyAn(m, uid) {
    return m.roles.cache.has(ROLE_HANDY_AN) && hatHandy(uid);
  }

  // Antwort-Helfer: ephemeral reply für Select-Menu und Button
  async function sendReply(opts) {
    try {
      if (interaction.isStringSelectMenu()) {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: true });
        }
        return await interaction.editReply(opts);
      }
      if (!interaction.deferred && !interaction.replied) {
        return await interaction.reply({ ...opts, ephemeral: true });
      }
      return await interaction.editReply(opts);
    } catch (e) {
      console.error('[HANDY] Reply-Fehler:', e.message);
    }
  }

  // ── HANDY AN ──────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_an') {
    if (!hatHandy(uid)) {
      // Rollen aufräumen falls noch gesetzt
      await member.roles.remove(ROLE_HANDY_AN).catch(() => {});
      await member.roles.remove(ROLE_HANDY_AUS).catch(() => {});
      return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    }
    if (hatHandyAn(member, uid)) {
      return sendReply({ embeds: [new EmbedBuilder().setColor(0xffa500).setDescription('📱 Dein Handy ist bereits **eingeschaltet**!')] });
    }
    await member.roles.add(ROLE_HANDY_AN).catch(() => {});
    await member.roles.remove(ROLE_HANDY_AUS).catch(() => {});
    return sendReply({ embeds: [new EmbedBuilder().setColor(0x57f287).setDescription('📱 Dein Handy wurde **eingeschaltet**!')] });
  }

  // ── HANDY AUS ─────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_aus') {
    if (!hatHandy(uid)) {
      return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    }
    if (!hatHandyAn(member, uid)) {
      return sendReply({ embeds: [new EmbedBuilder().setColor(0xffa500).setDescription('📵 Dein Handy ist bereits **ausgeschaltet**!')] });
    }
    await member.roles.remove(ROLE_HANDY_AN).catch(() => {});
    await member.roles.add(ROLE_HANDY_AUS).catch(() => {});
    return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('📵 Dein Handy wurde **ausgeschaltet**!')] });
  }

  // ── APPS ──────────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_apps') {
    if (!hatHandy(uid))        return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    if (!hatHandyAn(member, uid)) return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Dein Handy ist **ausgeschaltet**! Schalte es zuerst ein.')] });
    // Häkchen: welche Apps hat der Spieler bereits?
    const hasInsta   = member.roles.cache.has(ROLE_APP_INSTA);
    const hasEbay    = member.roles.cache.has(ROLE_APP_EBAY);
    const hasParship = member.roles.cache.has(ROLE_APP_PARSHIP);
    const appSelect = new StringSelectMenuBuilder()
      .setCustomId('app_select')
      .setPlaceholder('App auswählen...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel((hasInsta   ? '✅ ' : '') + 'Instagram')
          .setValue('instagram').setEmoji('📸')
          .setDescription(hasInsta   ? 'Installiert – Klicken zum Deinstallieren' : 'Instagram-Rolle installieren')
          .setDefault(hasInsta),
        new StringSelectMenuOptionBuilder()
          .setLabel((hasEbay    ? '✅ ' : '') + 'eBay')
          .setValue('ebay').setEmoji('🛒')
          .setDescription(hasEbay    ? 'Installiert – Klicken zum Deinstallieren' : 'eBay-Rolle installieren')
          .setDefault(hasEbay),
        new StringSelectMenuOptionBuilder()
          .setLabel((hasParship ? '✅ ' : '') + 'Parship')
          .setValue('parship').setEmoji('💕')
          .setDescription(hasParship ? 'Installiert – Klicken zum Deinstallieren' : 'Parship-Rolle installieren')
          .setDefault(hasParship),
      );
    const installedCount = [hasInsta, hasEbay, hasParship].filter(Boolean).length;
    return sendReply({
      embeds: [new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('📲 Apps')
        .setDescription('Wähle eine App zum Installieren oder Deinstallieren.\n✅ = bereits installiert')
        .setFooter({ text: installedCount + ' von 3 Apps installiert' })],
      components: [new ActionRowBuilder().addComponents(appSelect)],
    });
  }

  // ── APP AUSWAHL ───────────────────────────────────────────────────────────
  if (cid === 'app_select') {
    const val    = interaction.values[0];
    const appMap = {
      instagram: { role: ROLE_APP_INSTA,   name: 'Instagram', emoji: '📸' },
      ebay:      { role: ROLE_APP_EBAY,    name: 'eBay',      emoji: '🛒' },
      parship:   { role: ROLE_APP_PARSHIP, name: 'Parship',   emoji: '💕' },
    };
    const app = appMap[val];
    if (!app) return interaction.update({ content: 'Unbekannte App.', components: [] });
    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate().catch(() => {});
    // Rolle umschalten
    const hatApp = member.roles.cache.has(app.role);
    if (hatApp) {
      await member.roles.remove(app.role).catch(() => {});
    } else {
      await member.roles.add(app.role).catch(() => {});
    }
    // Rollen-Cache neu laden und Menü aktualisieren
    await member.fetch();
    const hasInsta2   = member.roles.cache.has(ROLE_APP_INSTA);
    const hasEbay2    = member.roles.cache.has(ROLE_APP_EBAY);
    const hasParship2 = member.roles.cache.has(ROLE_APP_PARSHIP);
    const appSelect2 = new StringSelectMenuBuilder()
      .setCustomId('app_select')
      .setPlaceholder('App auswählen...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel((hasInsta2   ? '✅ ' : '') + 'Instagram')
          .setValue('instagram').setEmoji('📸')
          .setDescription(hasInsta2   ? 'Installiert – Klicken zum Deinstallieren' : 'Instagram-Rolle installieren')
          .setDefault(hasInsta2),
        new StringSelectMenuOptionBuilder()
          .setLabel((hasEbay2    ? '✅ ' : '') + 'eBay')
          .setValue('ebay').setEmoji('🛒')
          .setDescription(hasEbay2    ? 'Installiert – Klicken zum Deinstallieren' : 'eBay-Rolle installieren')
          .setDefault(hasEbay2),
        new StringSelectMenuOptionBuilder()
          .setLabel((hasParship2 ? '✅ ' : '') + 'Parship')
          .setValue('parship').setEmoji('💕')
          .setDescription(hasParship2 ? 'Installiert – Klicken zum Deinstallieren' : 'Parship-Rolle installieren')
          .setDefault(hasParship2),
      );
    const installedCount2 = [hasInsta2, hasEbay2, hasParship2].filter(Boolean).length;
    const statusMsg = hatApp
      ? app.emoji + ' **' + app.name + '** wurde deinstalliert.'
      : app.emoji + ' **' + app.name + '** wurde installiert!';
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(hatApp ? 0xff9900 : 0x57f287)
        .setTitle('📲 Apps')
        .setDescription(statusMsg + '\n\nWähle eine weitere App oder schließe das Menü.\n✅ = bereits installiert')
        .setFooter({ text: installedCount2 + ' von 3 Apps installiert' })],
      components: [new ActionRowBuilder().addComponents(appSelect2)],
    });
  }

  // ── SPIELE ────────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_spiele') {
    if (!hatHandy(uid))   return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    if (!hatHandyAn(member, uid)) return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Dein Handy ist **ausgeschaltet**! Schalte es zuerst ein.')] });
    return sendReply({
      embeds: [new EmbedBuilder().setColor(DARK_ORANGE).setTitle('🎮 Handy-Spiele').setDescription('Wähle ein Spiel — es öffnet sich im Browser.')],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('spiel_snake').setLabel('Snake').setStyle(ButtonStyle.Secondary).setEmoji('🐍'),
        new ButtonBuilder().setCustomId('spiel_tetris').setLabel('Tetris').setStyle(ButtonStyle.Secondary).setEmoji('🟦'),
      )],
    });
  }

  if (cid === 'spiel_snake') {
    const GAME_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
    return sendReply({
      embeds: [new EmbedBuilder().setColor(0x57f287).setTitle('🐍 Snake').setDescription('Klicke auf den Button und spiele Snake direkt im Browser!')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🐍 Snake spielen').setStyle(ButtonStyle.Link).setURL(GAME_URL + '/snake'))],
    });
  }
  if (cid === 'spiel_tetris') {
    const GAME_URL = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
    return sendReply({
      embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('🟦 Tetris').setDescription('Klicke auf den Button und spiele Tetris direkt im Browser!')],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('🟦 Tetris spielen').setStyle(ButtonStyle.Link).setURL(GAME_URL + '/tetris'))],
    });
  }

  // ── DISPATCH ──────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_dispatch') {
    if (!hatHandy(uid))   return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    if (!hatHandyAn(member, uid)) return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Dein Handy ist **ausgeschaltet**! Schalte es zuerst ein.')] });
    return sendReply({
      embeds: [new EmbedBuilder().setColor(DARK_ORANGE).setTitle('🚨 Dispatch').setDescription('Diese Funktion wird bald aktiviert. Wähle eine Einsatzzentrale:')],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dispatch_lapd').setLabel('Dispatch LAPD').setStyle(ButtonStyle.Primary).setEmoji('🚓'),
        new ButtonBuilder().setCustomId('dispatch_lamd').setLabel('Dispatch LAMD').setStyle(ButtonStyle.Danger).setEmoji('🚑'),
        new ButtonBuilder().setCustomId('dispatch_lacs').setLabel('Dispatch LACS').setStyle(ButtonStyle.Secondary).setEmoji('🚒'),
      )],
    });
  }

  if (cid === 'dispatch_lapd') {
    const modal = new ModalBuilder().setCustomId('dispatch_lapd_modal').setTitle('\u{1F6A8} Notruf — LAPD');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('dispatch_location')
          .setLabel('Standort / Ort des Vorfalls').setStyle(TextInputStyle.Short)
          .setRequired(true).setMaxLength(200).setPlaceholder('z.B. Alta Street, Los Santos')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('dispatch_desc')
          .setLabel('Was ist passiert?').setStyle(TextInputStyle.Paragraph)
          .setRequired(false).setMaxLength(500).setPlaceholder('Beschreibung des Vorfalls (optional)')
      )
    );
    return interaction.showModal(modal);
  }
  if (cid === 'dispatch_lamd' || cid === 'dispatch_lacs') {
    const labels = { dispatch_lamd: 'LAMD', dispatch_lacs: 'LACS' };
    return sendReply({ embeds: [new EmbedBuilder().setColor(0xffa500).setDescription('\u{1F6A8} **Dispatch ' + labels[cid] + '** — Kommt bald!')] });
  }

  // ── WHATSAPP ──────────────────────────────────────────────────────────────
  if (effectiveId === 'handy_whatsapp') {
    if (!hatHandy(uid))   return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Du hast kein Handy! Kaufe eines im **Kwil E Markt**.')] });
    if (!hatHandyAn(member, uid)) return sendReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Dein Handy ist **ausgeschaltet**! Schalte es zuerst ein.')] });
    // Alle Mitglieder mit eingeschaltetem Handy laden
    const guild = interaction.guild;
    await guild.members.fetch().catch(() => {});
    const online = guild.members.cache.filter(m =>
      m.roles.cache.has(ROLE_HANDY_AN) && m.id !== uid && !m.user.bot
    );
    if (online.size === 0) {
      return sendReply({ embeds: [new EmbedBuilder().setColor(0xff5500).setTitle('💬 WhatsApp').setDescription('📵 Gerade hat **niemand anderes** sein Handy eingeschaltet.\nBitte versuche es später erneut.')] });
    }
    const options = [...online.values()].slice(0, 25).map(m =>
      new StringSelectMenuOptionBuilder()
        .setLabel((m.displayName || m.user.username).slice(0, 100))
        .setValue(m.id)
        .setDescription(('@' + m.user.username).slice(0, 100))
    );
    const menu = new StringSelectMenuBuilder()
      .setCustomId('whatsapp_empfaenger')
      .setPlaceholder('👤 Empfänger auswählen...')
      .addOptions(options);
    const row = new ActionRowBuilder().addComponents(menu);
    return sendReply({
      embeds: [new EmbedBuilder().setColor(0x25d366).setTitle('💬 WhatsApp').setDescription('Wähle einen Spieler aus, dem du schreiben möchtest.\n\n*Nur Spieler mit eingeschaltetem Handy werden angezeigt.*')],
      components: [row]
    });
  }

  // ── WHATSAPP: Empfänger gewählt → Modal ──────────────────────────────────
  if (cid === 'whatsapp_empfaenger') {
    const empfaengerId = interaction.values[0];
    const modal = new ModalBuilder()
      .setCustomId('whatsapp_msg_' + empfaengerId)
      .setTitle('💬 WhatsApp Nachricht');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('wa_nachricht')
          .setLabel('Nachricht')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Schreibe deine Nachricht...')
          .setRequired(true)
          .setMaxLength(1000)
      ),
    );
    return interaction.showModal(modal);
  }

  // ── WHATSAPP MODAL SUBMIT ─────────────────────────────────────────────────
  if (cid.startsWith('whatsapp_msg_')) {
    await interaction.deferReply({ ephemeral: true });
    const empfaengerId = cid.replace('whatsapp_msg_', '');
    const nachricht    = interaction.fields.getTextInputValue('wa_nachricht').trim();
    let empfaenger;
    try { empfaenger = await interaction.client.users.fetch(empfaengerId); }
    catch { return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Empfänger nicht gefunden.')] }); }
    // Prüfe ob Empfänger noch Handy eingeschaltet hat
    const guild = interaction.guild;
    const empMember = await guild.members.fetch(empfaengerId).catch(() => null);
    if (!empMember || !empMember.roles.cache.has(ROLE_HANDY_AN)) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Der Empfänger hat sein Handy inzwischen **ausgeschaltet**.')] });
    }
    const dmEmbed = new EmbedBuilder()
      .setColor(0x25d366)
      .setTitle('💬 WhatsApp Nachricht')
      .setDescription(nachricht)
      .setAuthor({ name: 'Von: ' + interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .setFooter({ text: 'Paradise City Roleplay • WhatsApp' })
      .setTimestamp();
    try {
      await empfaenger.send({ embeds: [dmEmbed] });
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x25d366).setDescription('✅ Nachricht wurde an **' + empfaenger.username + '** gesendet!')] });
    } catch {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xff0000).setDescription('❌ Nachricht konnte nicht gesendet werden. Der Nutzer hat DMs möglicherweise deaktiviert.')] });
    }
  }
});


// ─── RAUB SHARED HELPERS ──────────────────────────────────────────────────────
const _RAUB_NOTRUFE_FILE = path.join(DATA_DIR, 'lapd_notrufe.json');
function _loadRaubNotrufe() { try{return JSON.parse(fs.readFileSync(_RAUB_NOTRUFE_FILE,'utf8'));}catch{return[];} }
function _saveRaubNotrufe(d){ fs.writeFileSync(_RAUB_NOTRUFE_FILE,JSON.stringify(d,null,2),'utf8'); }
function _getKonto(uid){ try{const d=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'konto.json'),'utf8'));return d[uid]??{konto:0,schwarz:0};}catch{return{konto:0,schwarz:0};} }
function _setKonto(uid,obj){ let d={};try{d=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'konto.json'),'utf8'));}catch{} d[uid]=obj; fs.writeFileSync(path.join(DATA_DIR,'konto.json'),JSON.stringify(d,null,2),'utf8'); }
function _getOnDuty(){ try{const d=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'lapd_duty.json'),'utf8'));return Object.values(d).filter(x=>x&&x.onDuty).length;}catch{return 0;} }

// ─── ATM-RAUB SYSTEM ──────────────────────────────────────────────────────────
{
  const ATM_INFO_CH   = '1490894308088352961';
  const ATM_RAUB_CH   = '1490894309145313330';
  const ATM_FILE      = path.join(DATA_DIR, 'atm_raub.json');
  function _loadAtm() { try{return JSON.parse(fs.readFileSync(ATM_FILE,'utf8'));}catch{return{};} }
  function _saveAtm(d){ fs.writeFileSync(ATM_FILE,JSON.stringify(d,null,2),'utf8'); }
  function _loadInv() { try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,'inventar.json'),'utf8'));}catch{return{};} }
  function _saveInv(d){ fs.writeFileSync(path.join(DATA_DIR,'inventar.json'),JSON.stringify(d,null,2),'utf8'); }

  // Info-Embed (einmalig)
  client.once('ready', async () => {
    try {
      const d=_loadAtm(); if(d._infoEmbedSentV2) return;
      const ch=await client.channels.fetch(ATM_INFO_CH).catch(()=>null); if(!ch) return;
      await ch.send({embeds:[new EmbedBuilder()
        .setColor(0xE65100)
        .setTitle('🏧 ATM-Raub')
        .setDescription('> Knappe Kasse? Knack einen Geldautomaten und sichere dir deine Beute!')
        .addFields(
          {name:'💰 Beute',value:'3.000 – 10.000 $',inline:true},
          {name:'👤 Spieler',value:'Ab 1 Person',inline:true},
          {name:'👮 Beamte',value:'Mind. 2 Officers',inline:true},
          {name:'📍 Ort',value:'Alle ATMs im Staat',inline:true},
          {name:'​',value:'​',inline:false},
          {name:'🔧 Benötigte Items',value:'**Brechstange** *(10 Min.)* → 🔨。𝐉𝐢𝐶𝐮𝐦𝐢𝐫𝐤𝐭\n**Automaten Sprengstoff** *(5 Min.)* → 👥。𝐮𝐣𝐬𝐦𝐢𝐫𝐳𝐮𝐢𝐭',inline:false},
          {name:'📋 Ablauf',value:'**1.** Raub In-Game durchführen\n**2.** Foto als Beweis in <#1490894309145313330> senden\n**3.** Werkzeug in der DM auswählen\n**4.** Team bestätigt Erfolg oder Fehlschlag',inline:false}
        )
        .setFooter({text:'Paradise City Roleplay • Raubüberfälle'}).setTimestamp()]});
      d._infoEmbedSentV2=true; _saveAtm(d);
    } catch(e){console.error('[ATM-INFO]',e.message);}
  });

  // Foto-Kanal
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot||msg.channelId!==ATM_RAUB_CH) return;
    if (!msg.attachments.some(a=>a.contentType&&a.contentType.startsWith('image/'))) { await msg.delete().catch(()=>{}); return; }

    const d=_loadAtm(), entry=d[msg.author.id]||{}, now=Date.now();
    if (entry.active) {
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('⚠️ Aktiver Raubüberfall').setDescription('Du hast bereits einen **aktiven ATM-Raub**! Warte bis dieser abgeschlossen ist.').setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }
    if (entry.cooldownUntil&&now<entry.cooldownUntil) {
      const rem=Math.ceil((entry.cooldownUntil-now)/60000),h=Math.floor(rem/60),m=rem%60;
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('⏳ Cooldown aktiv').setDescription(`Du kannst einen ATM-Raub nur **alle 24 Stunden** machen.\nVerbleibend: **${h}h ${m}m**`).setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }
    const onDuty=_getOnDuty();
    if (onDuty<2) {
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('🚫 Nicht genug Officers').setDescription(`Mindestens **2 LAPD Officers** müssen im Dienst sein.\nAktuell: **${onDuty}**`).setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }
    const inv=(_loadInv()[msg.author.id])||{};
    const bKey=Object.keys(inv).find(k=>k.toLowerCase().includes('brechstange'));
    const sKey=Object.keys(inv).find(k=>k.toLowerCase().includes('sprengstoff')||k.toLowerCase().includes('sprengung')||k.toLowerCase().includes('explosiv'));
    const hasB=bKey&&(inv[bKey]||0)>0, hasS=sKey&&(inv[sKey]||0)>0;
    if (!hasB&&!hasS) {
      const list=Object.keys(inv).length?Object.entries(inv).map(([k,v])=>`• **${k}** — ${v}x`).join('\n'):'_Inventar leer_';
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('❌ Kein Werkzeug').setDescription('Du hast weder **Brechstange** noch **Automaten Sprengstoff** im Inventar.\n\n**Dein Inventar:**\n'+list).setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }

    // Alle Checks OK → Server-Log + DM-Auswahl
    sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0xE65100).setTitle('🏧 ATM-Raub: Raub eingeleitet')
      .addFields({name:'👤 Spieler',value:`<@${msg.author.id}> (${msg.author.username})`,inline:true},{name:'📸 Beweis',value:msg.attachments.first()?.url||'-',inline:false})
      .setTimestamp().setFooter({text:'Paradise City Roleplay • ATM-Raub Log'})).catch(()=>{});
    const opts=[];
    if(hasB) opts.push({label:'🔨 Brechstange (10 Min.)',description:'Aus dem Baumarkt',value:'brecheisen'});
    if(hasS) opts.push({label:'💣 Automaten Sprengstoff (5 Min.)',description:'Vom Schwarzmarkt',value:'sprengstoff'});
    const row=new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`atm_tool:${msg.author.id}`).setPlaceholder('Werkzeug auswählen').addOptions(opts));
    try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xE65100).setTitle('🏧 ATM-Raub — Werkzeug auswählen').setDescription('Wähle dein Werkzeug. Es wird sofort aus dem Inventar entfernt.').setFooter({text:'Paradise City Roleplay • ATM-Raub'})],components:[row]});}
    catch{}
    await msg.delete().catch(()=>{});
  });

  // Werkzeug-Auswahl DM
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isStringSelectMenu()||!interaction.customId.startsWith('atm_tool:')) return;
    const userId=interaction.customId.split(':')[1];
    if (interaction.user.id!==userId) return interaction.reply({content:'❌ Das ist nicht deine Auswahl.',ephemeral:true});
    await interaction.deferReply({ephemeral:false}).catch(()=>{});

    const tool=interaction.values[0];
    const durMs=tool==='sprengstoff'?5*60*1000:10*60*1000;
    const durLabel=tool==='sprengstoff'?'5 Minuten':'10 Minuten';
    const allInv=_loadInv(), inv=allInv[userId]||{};
    const finder=tool==='sprengstoff'?(k)=>k.toLowerCase().includes('sprengstoff')||k.toLowerCase().includes('sprengung')||k.toLowerCase().includes('explosiv'):(k)=>k.toLowerCase().includes('brechstange');
    const fKey=Object.keys(inv).find(finder);
    if (!fKey||(inv[fKey]||0)<=0) {
      const list=Object.keys(inv).length?Object.entries(inv).map(([k,v])=>`• **${k}** — ${v}x`).join('\n'):'_Inventar leer_';
      return interaction.editReply({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('❌ Item nicht gefunden').setDescription('Dieses Item wurde nicht gefunden.\n\n**Dein Inventar:**\n'+list)]});
    }
    inv[fKey]-=1; if(inv[fKey]<=0) delete inv[fKey]; allInv[userId]=inv; _saveInv(allInv);

    const d=_loadAtm(); d[userId]=d[userId]||{};
    d[userId].active={tool,itemName:fKey,startedAt:Date.now(),duration:durMs,username:interaction.user.username};
    _saveAtm(d);

    try{const n=_loadRaubNotrufe();n.push({id:Date.now().toString(),ts:Date.now(),type:'atm_raub',title:'🏧 ATM-Raubüberfall',caller:interaction.user.username,userId,location:'Alle ATMs im Staat',description:`ATM-Raub von **${interaction.user.username}** (${fKey}, ${durLabel})`,status:'offen'});_saveRaubNotrufe(n);}catch(e){console.error('[ATM-NOTRUF]',e.message);}

    sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0xE65100).setTitle('🏧 ATM-Raub gestartet')
      .addFields({name:'👤 Spieler',value:`<@${userId}> (${interaction.user.username})`,inline:true},{name:'🔧 Werkzeug',value:fKey,inline:true},{name:'⏱️ Dauer',value:durLabel,inline:true},{name:'📦 Item entfernt',value:fKey,inline:false})
      .setTimestamp().setFooter({text:'Paradise City Roleplay • ATM-Raub Log'})).catch(()=>{});
    await interaction.editReply({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('✅ ATM-Raub gestartet!').setDescription(`**Werkzeug:** ${fKey}\n**Dauer:** ${durLabel}\n\nDeine Beute kommt automatisch nach Ablauf der Zeit.`).setFooter({text:'Paradise City Roleplay • ATM-Raub'}).setTimestamp()]});

    setTimeout(async()=>{
      const cur=_loadAtm(); if(!cur[userId]?.active) return;
      const beute=Math.floor(Math.random()*7001)+3000;
      const k=_getKonto(userId); k.schwarz=(k.schwarz||0)+beute; _setKonto(userId,k);
      cur[userId].active=null; cur[userId].cooldownUntil=Date.now()+24*60*60*1000; _saveAtm(cur);
      try{const n=_loadRaubNotrufe(),x=n.find(y=>y.userId===userId&&y.type==='atm_raub'&&y.status==='offen');if(x){x.status='geschlossen';_saveRaubNotrufe(n);}}catch{}
      sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0x22c55e).setTitle('🏧 ATM-Raub abgeschlossen')
        .addFields({name:'👤 Spieler',value:`<@${userId}>`,inline:true},{name:'💰 Beute',value:`${beute.toLocaleString('de-CH')} $ Schwarzgeld`,inline:true})
        .setTimestamp().setFooter({text:'Paradise City Roleplay • ATM-Raub Log'})).catch(()=>{});
      try{const u=await client.users.fetch(userId).catch(()=>null);if(u){const dm=await u.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('💰 ATM-Raub erfolgreich!').setDescription(`**Beute:** ${beute.toLocaleString('de-CH')} $ Schwarzgeld\n\n⏳ Nächster Raub in **24 Stunden** möglich.`).setFooter({text:'Paradise City Roleplay • ATM-Raub'}).setTimestamp()]});}}catch{}
    },durMs);
  });
}
// ─── END ATM-RAUB SYSTEM ─────────────────────────────────────────────────────

// ─── SHOP-RAUB SYSTEM ─────────────────────────────────────────────────────────
{
  const SHOP_INFO_CH  = '1490894310118392012';
  const SHOP_RAUB_CH  = '1490894311389134858';
  const SHOP_FILE     = path.join(DATA_DIR, 'shop_raub.json');
  const SHOP_DUR_MS   = 15 * 60 * 1000;
  function _loadShop() { try{return JSON.parse(fs.readFileSync(SHOP_FILE,'utf8'));}catch{return{};} }
  function _saveShop(d){ fs.writeFileSync(SHOP_FILE,JSON.stringify(d,null,2),'utf8'); }

  // Info-Embed (einmalig)
  client.once('ready', async () => {
    try {
      const d=_loadShop(); if(d._infoEmbedSentV2) return;
      const ch=await client.channels.fetch(SHOP_INFO_CH).catch(()=>null); if(!ch) return;
      await ch.send({embeds:[new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle('🛍️ Shop-Raub')
        .setDescription('> Schnell rein, schnell raus — räume einen Shop leer und verschwinde mit der Beute!')
        .addFields(
          {name:'💰 Beute',value:'12.000 – 22.000 $',inline:true},
          {name:'👥 Spieler',value:'2–3 Personen',inline:true},
          {name:'👮 Beamte',value:'Mind. 2 Officers',inline:true},
          {name:'📍 Ort',value:'Shops in Los Santos',inline:true},
          {name:'⏱️ Dauer',value:'15 Minuten',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'📋 Ablauf',value:'**1.** Raub In-Game mit 2–3 Spielern starten\n**2.** Foto als Beweis in <#1490894311389134858> senden\n**3.** Beute wird automatisch nach 15 Min. ausgezahlt\n**4.** Team bestätigt Erfolg oder Fehlschlag',inline:false}
        )
        .setFooter({text:'Paradise City Roleplay • Raubüberfälle'}).setTimestamp()]});
      d._infoEmbedSentV2=true; _saveShop(d);
    } catch(e){console.error('[SHOP-INFO]',e.message);}
  });

  // Foto-Kanal
  client.on('messageCreate', async (msg) => {
    if (msg.author.bot||msg.channelId!==SHOP_RAUB_CH) return;
    if (!msg.attachments.some(a=>a.contentType&&a.contentType.startsWith('image/'))) { await msg.delete().catch(()=>{}); return; }

    const d=_loadShop(), entry=d[msg.author.id]||{}, now=Date.now();
    if (entry.active) {
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('⚠️ Aktiver Shop-Raub').setDescription('Du hast bereits einen **aktiven Shop-Raub**! Warte bis dieser abgeschlossen ist.').setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }
    if (entry.cooldownUntil&&now<entry.cooldownUntil) {
      const rem=Math.ceil((entry.cooldownUntil-now)/60000),h=Math.floor(rem/60),m=rem%60;
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('⏳ Cooldown aktiv').setDescription(`Du kannst einen Shop-Raub nur **alle 24 Stunden** machen.\nVerbleibend: **${h}h ${m}m**`).setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }
    const onDuty=_getOnDuty();
    if (onDuty<2) {
      try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle('🚫 Nicht genug Officers').setDescription(`Mindestens **2 LAPD Officers** müssen im Dienst sein.\nAktuell: **${onDuty}**`).setFooter({text:'Paradise City Roleplay'})]});}catch{}
      await msg.delete().catch(()=>{}); return;
    }

    // Alle Checks OK → Raub direkt starten (kein Item nötig)
    d[msg.author.id]=d[msg.author.id]||{};
    d[msg.author.id].active={startedAt:now,duration:SHOP_DUR_MS,username:msg.author.username};
    _saveShop(d);

    try{const n=_loadRaubNotrufe();n.push({id:now+'s',ts:now,type:'shop_raub',title:'🛍️ Shop-Raubüberfall',caller:msg.author.username,userId:msg.author.id,location:'Shops in Los Angeles',description:`Shop-Raub von **${msg.author.username}** (15 Minuten)`,status:'offen'});_saveRaubNotrufe(n);}catch(e){console.error('[SHOP-NOTRUF]',e.message);}

    sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0xE65100).setTitle('🛍️ Shop-Raub gestartet')
      .addFields({name:'👤 Spieler',value:`<@${msg.author.id}> (${msg.author.username})`,inline:true},{name:'⏱️ Dauer',value:'15 Minuten',inline:true},{name:'📸 Beweis',value:msg.attachments.first()?.url||'-',inline:false})
      .setTimestamp().setFooter({text:'Paradise City Roleplay • Shop-Raub Log'})).catch(()=>{});

    try{const dm=await msg.author.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Shop-Raub gestartet!').setDescription('Dein Shop-Raub wurde gestartet!\n\n**Dauer:** 15 Minuten\n**Beute:** 12.000 – 22.000 $ Schwarzgeld\n\nDeine Beute kommt automatisch nach Ablauf der Zeit.').setFooter({text:'Paradise City Roleplay • Shop-Raub'}).setTimestamp()]});}catch{}
    await msg.delete().catch(()=>{});

    const uid=msg.author.id;
    setTimeout(async()=>{
      const cur=_loadShop(); if(!cur[uid]?.active) return;
      const beute=Math.floor(Math.random()*10001)+12000;
      const k=_getKonto(uid); k.schwarz=(k.schwarz||0)+beute; _setKonto(uid,k);
      cur[uid].active=null; cur[uid].cooldownUntil=Date.now()+24*60*60*1000; _saveShop(cur);
      try{const n=_loadRaubNotrufe(),x=n.find(y=>y.userId===uid&&y.type==='shop_raub'&&y.status==='offen');if(x){x.status='geschlossen';_saveRaubNotrufe(n);}}catch{}
      sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0x22c55e).setTitle('🛍️ Shop-Raub abgeschlossen')
        .addFields({name:'👤 Spieler',value:`<@${uid}>`,inline:true},{name:'💰 Beute',value:`${beute.toLocaleString('de-CH')} $ Schwarzgeld`,inline:true})
        .setTimestamp().setFooter({text:'Paradise City Roleplay • Shop-Raub Log'})).catch(()=>{});
      try{const u=await client.users.fetch(uid).catch(()=>null);if(u){const dm=await u.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Shop-Raub erfolgreich!').setDescription(`**Beute:** ${beute.toLocaleString('de-CH')} $ Schwarzgeld\n\n⏳ Nächster Raub in **24 Stunden** möglich.`).setFooter({text:'Paradise City Roleplay • Shop-Raub'}).setTimestamp()]});}}catch{}
    },SHOP_DUR_MS);
  });
}
// ─── END SHOP-RAUB SYSTEM ────────────────────────────────────────────────────
// ─── BAR-RAUB SYSTEM ──────────────────────────────────────────────────────────
{
  const BAR_INFO_CH = '1490894312727117904';
  const BAR_RAUB_CH = '1490894314132213771';
  const BAR_FILE    = path.join(DATA_DIR, 'bar_raub.json');
  const BAR_DUR_MS  = 15 * 60 * 1000;
  function _loadBar() { try{return JSON.parse(fs.readFileSync(BAR_FILE,'utf8'));}catch{return{};} }
  function _saveBar(d){ fs.writeFileSync(BAR_FILE,JSON.stringify(d,null,2),'utf8'); }

  function _giveBier(uid, amount) {
    try {
      const invPath  = path.join(DATA_DIR, 'inventar.json');
      const shopsPath = path.join(__dirname, 'data', 'shops.json');
      const all = (() => { try{return JSON.parse(fs.readFileSync(invPath,'utf8'));}catch{return{};} })();
      if (!all[uid]) all[uid] = {};
      // Exakten Item-Key aus Kwik-E-Markt holen
      let bierKey = 'Bier';
      try {
        const shops = JSON.parse(fs.readFileSync(shopsPath,'utf8'));
        const kwikItem = (shops.kwik || []).find(i => i.name && i.name.toLowerCase().includes('bier'));
        if (kwikItem) bierKey = kwikItem.name;
        else {
          // Fallback: im Inventar des Spielers suchen
          const existing = Object.keys(all[uid]).find(k => k.toLowerCase().includes('bier'));
          if (existing) bierKey = existing;
        }
      } catch {}
      all[uid][bierKey] = (all[uid][bierKey] || 0) + amount;
      fs.writeFileSync(invPath, JSON.stringify(all, null, 2), 'utf8');
    } catch(e) { console.error('[BAR-BIER]', e.message); }
  }

  client.once('ready', async () => {
    try {
      const d = _loadBar(); if (d._infoEmbedSentV2) return;
      const ch = await client.channels.fetch(BAR_INFO_CH).catch(() => null); if (!ch) return;
      await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🍺 Bar-Raub')
        .setDescription('> Leere die Kasse der Bar und sichere dir Schwarzgeld und ein paar kühle Bier!')
        .addFields(
          {name:'💰 Beute',value:'7.000 – 13.000 $',inline:true},
          {name:'🍺 Bonus',value:'1 – 6 Bier',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'👥 Spieler',value:'Mind. 2 Personen',inline:true},
          {name:'👮 Beamte',value:'Mind. 2 Officers',inline:true},
          {name:'⏱️ Dauer',value:'15 Minuten',inline:true},
          {name:'📋 Ablauf',value:'**1.** Raubüberfall In-Game mit min. 2 Spielern starten\n**2.** Foto als Beweis in <#1490894314132213771> senden\n**3.** Team bestätigt Erfolg oder Fehlschlag',inline:false}
        )
        .setFooter({ text: 'Paradise City Roleplay • Raubüberfälle' }).setTimestamp()] });
      d._infoEmbedSentV2 = true; _saveBar(d);
    } catch(e) { console.error('[BAR-INFO]', e.message); }
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot || msg.channelId !== BAR_RAUB_CH) return;
    if (!msg.attachments.some(a => a.contentType && a.contentType.startsWith('image/'))) {
      await msg.delete().catch(() => {}); return;
    }
    const d = _loadBar(), entry = d[msg.author.id] || {}, now = Date.now();
    if (entry.active) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⚠️ Aktiver Bar-Raub').setDescription('Du hast bereits einen **aktiven Bar-Raub**! Warte bis dieser abgeschlossen ist.').setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    if (entry.cooldownUntil && now < entry.cooldownUntil) {
      const rem = Math.ceil((entry.cooldownUntil - now) / 60000), h = Math.floor(rem / 60), m = rem % 60;
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⏳ Cooldown aktiv').setDescription(`Du kannst einen Bar-Raub nur **alle 24 Stunden** machen.\nVerbleibend: **${h}h ${m}m**`).setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    const onDuty = _getOnDuty();
    if (onDuty < 2) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('🚫 Nicht genug Officers').setDescription(`Mindestens **2 LAPD Officers** müssen im Dienst sein.\nAktuell: **${onDuty}**`).setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }

    d[msg.author.id] = d[msg.author.id] || {};
    d[msg.author.id].active = { startedAt: now, duration: BAR_DUR_MS, username: msg.author.username };
    _saveBar(d);

    try { const n = _loadRaubNotrufe(); n.push({ id: now + 'b', ts: now, type: 'bar_raub', title: '🍺 Bar-Raubüberfall', caller: msg.author.username, userId: msg.author.id, location: 'Bar', description: `Bar-Raub von **${msg.author.username}** (15 Minuten)`, status: 'offen' }); _saveRaubNotrufe(n); } catch(e) { console.error('[BAR-NOTRUF]', e.message); }

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0xf59e0b).setTitle('🍺 Bar-Raub gestartet')
      .addFields({ name: '👤 Spieler', value: `<@${msg.author.id}> (${msg.author.username})`, inline: true }, { name: '⏱️ Dauer', value: '15 Minuten', inline: true }, { name: '📸 Beweis', value: msg.attachments.first()?.url || '-', inline: false })
      .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Bar-Raub Log' })).catch(() => {});

    try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Bar-Raub gestartet!').setDescription('Dein Bar-Raub wurde gestartet!\n\n**Dauer:** 15 Minuten\n**Beute:** 7.000 – 13.000 $ Schwarzgeld\n**Bonus:** 1 – 6 Bier\n\nDeine Beute kommt automatisch nach Ablauf der Zeit.').setFooter({ text: 'Paradise City Roleplay • Bar-Raub' }).setTimestamp()] }); } catch {}
    await msg.delete().catch(() => {});

    const uid = msg.author.id;
    setTimeout(async () => {
      const cur = _loadBar(); if (!cur[uid]?.active) return;
      const beute = Math.floor(Math.random() * 6001) + 7000;
      const bier  = Math.floor(Math.random() * 6) + 1;
      const k = _getKonto(uid); k.schwarz = (k.schwarz || 0) + beute; _setKonto(uid, k);
      _giveBier(uid, bier);
      cur[uid].active = null; cur[uid].cooldownUntil = Date.now() + 24 * 60 * 60 * 1000; _saveBar(cur);
      try { const n = _loadRaubNotrufe(), x = n.find(y => y.userId === uid && y.type === 'bar_raub' && y.status === 'offen'); if (x) { x.status = 'geschlossen'; _saveRaubNotrufe(n); } } catch {}
      sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x22c55e).setTitle('🍺 Bar-Raub abgeschlossen')
        .addFields({ name: '👤 Spieler', value: `<@${uid}>`, inline: true }, { name: '💰 Beute', value: `${beute.toLocaleString('de-CH')} $ Schwarzgeld`, inline: true }, { name: '🍺 Bier', value: `${bier}x`, inline: true })
        .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Bar-Raub Log' })).catch(() => {});
      try { const u = await client.users.fetch(uid).catch(() => null); if (u) { const dm = await u.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Bar-Raub erfolgreich!').setDescription(`**Beute:** ${beute.toLocaleString('de-CH')} $ Schwarzgeld\n**Bonus:** ${bier}x Bier\n\n⏳ Nächster Raub in **24 Stunden** möglich.`).setFooter({ text: 'Paradise City Roleplay • Bar-Raub' }).setTimestamp()] }); } } catch {}
    }, BAR_DUR_MS);
  });
}
// ─── END BAR-RAUB SYSTEM ────────────────────────────────────────────

// ─── HUMANE LABS RAUB SYSTEM ──────────────────────────────────────────
{
  const HUMANE_INFO_CH = '1490894316170641458';
  const HUMANE_RAUB_CH = '1490894317462753280';
  const HUMANE_FILE    = path.join(DATA_DIR, 'humane_raub.json');
  const HUMANE_DUR_MS  = 20 * 60 * 1000;
  function _loadHumane() { try{return JSON.parse(fs.readFileSync(HUMANE_FILE,'utf8'));}catch{return{};} }
  function _saveHumane(d){ fs.writeFileSync(HUMANE_FILE,JSON.stringify(d,null,2),'utf8'); }

  client.once('ready', async () => {
    try {
      const d = _loadHumane(); if (d._infoEmbedSentV2) return;
      const ch = await client.channels.fetch(HUMANE_INFO_CH).catch(() => null); if (!ch) return;
      await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0x4f46e5)
        .setTitle('🏭 Humane Labs Raub')
        .setDescription('> Infiltriere das Humane Research Center, überwältige die Wachen und sichere dir die wertvollste Beute im Staat!')
        .addFields(
          {name:'💰 Beute',value:'55.000 – 73.000 $',inline:true},
          {name:'👥 Spieler',value:'Mind. 3 Personen',inline:true},
          {name:'👮 Beamte',value:'Mind. 4 Officers',inline:true},
          {name:'⏱️ Dauer',value:'20 Minuten',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'📋 Ablauf',value:'**1.** Raub In-Game mit min. 3 Spielern starten\n**2.** Foto als Beweis in <#1490894317462753280> senden\n**3.** Team bestätigt Erfolg oder Fehlschlag',inline:false}
        )
        .setFooter({ text: 'Paradise City Roleplay • Raubüberfälle' }).setTimestamp()] });
      d._infoEmbedSentV2 = true; _saveHumane(d);
    } catch(e) { console.error('[HUMANE-INFO]', e.message); }
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot || msg.channelId !== HUMANE_RAUB_CH) return;
    if (!msg.attachments.some(a => a.contentType && a.contentType.startsWith('image/'))) {
      await msg.delete().catch(() => {}); return;
    }
    const d = _loadHumane(), entry = d[msg.author.id] || {}, now = Date.now();
    if (entry.active) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⚠️ Aktiver Humane Labs Raub').setDescription('Du hast bereits einen **aktiven Humane Labs Raub**! Warte bis dieser abgeschlossen ist.').setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    if (entry.cooldownUntil && now < entry.cooldownUntil) {
      const rem = Math.ceil((entry.cooldownUntil - now) / 60000), h = Math.floor(rem / 60), m = rem % 60;
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⏳ Cooldown aktiv').setDescription(`Du kannst einen Humane Labs Raub nur **alle 24 Stunden** machen.\nVerbleibend: **${h}h ${m}m**`).setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    const onDuty = _getOnDuty();
    if (onDuty < 4) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('🚫 Nicht genug Officers').setDescription(`Mindestens **4 LAPD Officers** müssen im Dienst sein.\nAktuell: **${onDuty}**`).setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }

    d[msg.author.id] = d[msg.author.id] || {};
    d[msg.author.id].active = { startedAt: now, duration: HUMANE_DUR_MS, username: msg.author.username };
    _saveHumane(d);

    try { const n = _loadRaubNotrufe(); n.push({ id: now + 'h', ts: now, type: 'humane_raub', title: '🏭 Humane Labs Raubüberfall', caller: msg.author.username, userId: msg.author.id, location: 'Humane Labs', description: `Humane Labs Raub von **${msg.author.username}** (20 Minuten)`, status: 'offen' }); _saveRaubNotrufe(n); } catch(e) { console.error('[HUMANE-NOTRUF]', e.message); }

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x4f46e5).setTitle('🏭 Humane Labs Raub gestartet')
      .addFields({ name: '👤 Spieler', value: `<@${msg.author.id}> (${msg.author.username})`, inline: true }, { name: '⏱️ Dauer', value: '20 Minuten', inline: true }, { name: '📸 Beweis', value: msg.attachments.first()?.url || '-', inline: false })
      .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Humane Labs Log' })).catch(() => {});

    try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Humane Labs Raub gestartet!').setDescription('Dein Humane Labs Raub wurde gestartet!\n\n**Dauer:** 20 Minuten\n**Beute:** 55.000 – 73.000 $ Schwarzgeld\n\nDeine Beute kommt automatisch nach Ablauf der Zeit.').setFooter({ text: 'Paradise City Roleplay • Humane Labs' }).setTimestamp()] }); } catch {}
    await msg.delete().catch(() => {});

    const uid = msg.author.id;
    setTimeout(async () => {
      const cur = _loadHumane(); if (!cur[uid]?.active) return;
      const beute = Math.floor(Math.random() * 18001) + 55000;
      const k = _getKonto(uid); k.schwarz = (k.schwarz || 0) + beute; _setKonto(uid, k);
      cur[uid].active = null; cur[uid].cooldownUntil = Date.now() + 24 * 60 * 60 * 1000; _saveHumane(cur);
      try { const n = _loadRaubNotrufe(), x = n.find(y => y.userId === uid && y.type === 'humane_raub' && y.status === 'offen'); if (x) { x.status = 'geschlossen'; _saveRaubNotrufe(n); } } catch {}
      sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x22c55e).setTitle('🏭 Humane Labs Raub abgeschlossen')
        .addFields({ name: '👤 Spieler', value: `<@${uid}>`, inline: true }, { name: '💰 Beute', value: `${beute.toLocaleString('de-CH')} $ Schwarzgeld`, inline: true })
        .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Humane Labs Log' })).catch(() => {});
      try { const u = await client.users.fetch(uid).catch(() => null); if (u) { const dm = await u.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Humane Labs Raub erfolgreich!').setDescription(`**Beute:** ${beute.toLocaleString('de-CH')} $ Schwarzgeld\n\n⏳ Nächster Raub in **24 Stunden** möglich.`).setFooter({ text: 'Paradise City Roleplay • Humane Labs' }).setTimestamp()] }); } } catch {}
    }, HUMANE_DUR_MS);
  });
}
// ─── END HUMANE LABS RAUB SYSTEM ─────────────────────────────────────────────────

// ─── STAATSBANK RAUB SYSTEM ────────────────────────────────────────────────────────────────────────────────
{
  const STAATSBANK_INFO_CH = '1490894319027097751';
  const STAATSBANK_RAUB_CH = '1490894320604020806';
  const STAATSBANK_FILE    = path.join(DATA_DIR, 'staatsbank_raub.json');
  const STAATSBANK_DUR_MS  = 30 * 60 * 1000;
  function _loadStaatsbank() { try{return JSON.parse(fs.readFileSync(STAATSBANK_FILE,'utf8'));}catch{return{};} }
  function _saveStaatsbank(d){ fs.writeFileSync(STAATSBANK_FILE,JSON.stringify(d,null,2),'utf8'); }

  client.once('ready', async () => {
    try {
      const d = _loadStaatsbank(); if (d._infoEmbedSentV3) return;
      const ch = await client.channels.fetch(STAATSBANK_INFO_CH).catch(() => null); if (!ch) return;
      await ch.send({ embeds: [new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('🏦 Staatsbank Raub')
        .setDescription('> Der Raub, auf den jeder gewartet hat — überfallt die Staatsbank von LA!')
        .addFields(
          {name:'💰 Beute',value:'75.000 – 105.000 $ Schwarzgeld',inline:true},
          {name:'👥 Spieler',value:'Mind. 4 Personen',inline:true},
          {name:'👮 Beamte',value:'Mind. 5 Officers',inline:true},
          {name:'⏱️ Dauer',value:'30 Minuten',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'​',value:'​',inline:true},
          {name:'📋 Ablauf',value:'**1.** Raub In-Game mit min. 4 Spielern starten\n**2.** Foto als Beweis in <#1490894320604020806> senden\n**3.** Team bestätigt Erfolg oder Fehlschlag',inline:false}
        )
        .setFooter({ text: 'Paradise City Roleplay • Raubüberfalle' }).setTimestamp()] });
      d._infoEmbedSentV3 = true; _saveStaatsbank(d);
    } catch(e) { console.error('[STAATSBANK-INFO]', e.message); }
  });

  client.on('messageCreate', async (msg) => {
    if (msg.author.bot || msg.channelId !== STAATSBANK_RAUB_CH) return;
    if (!msg.attachments.some(a => a.contentType && a.contentType.startsWith('image/'))) {
      await msg.delete().catch(() => {}); return;
    }
    const d = _loadStaatsbank(), entry = d[msg.author.id] || {}, now = Date.now();
    if (entry.active) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⚠️ Aktiver Staatsbank Raub').setDescription('Du hast bereits einen **aktiven Staatsbank Raub**! Warte bis dieser abgeschlossen ist.').setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    if (entry.cooldownUntil && now < entry.cooldownUntil) {
      const rem = Math.ceil((entry.cooldownUntil - now) / 60000), h = Math.floor(rem / 60), m = rem % 60;
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('⏳ Cooldown aktiv').setDescription('Du kannst einen Staatsbank Raub nur **alle 24 Stunden** machen.\nVerbleibend: **' + h + 'h ' + m + 'm**').setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }
    const onDuty = _getOnDuty();
    if (onDuty < 5) {
      try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0xff4400).setTitle('🚫 Nicht genug Officers').setDescription('Mindestens **5 LAPD Officers** müssen im Dienst sein.\nAktuell: **' + onDuty + '**').setFooter({ text: 'Paradise City Roleplay' })] }); } catch {}
      await msg.delete().catch(() => {}); return;
    }

    d[msg.author.id] = d[msg.author.id] || {};
    d[msg.author.id].active = { startedAt: now, duration: STAATSBANK_DUR_MS, username: msg.author.username };
    _saveStaatsbank(d);

    try { const n = _loadRaubNotrufe(); n.push({ id: now + 'sb', ts: now, type: 'staatsbank_raub', title: '🏦 Staatsbank Raubüberfall', caller: msg.author.username, userId: msg.author.id, location: 'Staatsbank Los Angeles', description: 'Staatsbank Raub von **' + msg.author.username + '** (30 Minuten)', status: 'offen' }); _saveRaubNotrufe(n); } catch(e) { console.error('[STAATSBANK-NOTRUF]', e.message); }

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0xf59e0b).setTitle('🏦 Staatsbank Raub gestartet')
      .addFields({ name: '👤 Spieler', value: '<@' + msg.author.id + '> (' + msg.author.username + ')', inline: true }, { name: '⏱️ Dauer', value: '30 Minuten', inline: true }, { name: '📸 Beweis', value: msg.attachments.first()?.url || '-', inline: false })
      .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Staatsbank Log' })).catch(() => {});

    try { const dm = await msg.author.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('✅ Staatsbank Raub gestartet!').setDescription('Dein Staatsbank Raub wurde gestartet!\n\n**Dauer:** 30 Minuten\n**Beute:** 75.000 – 105.000 $ Schwarzgeld\n\nDeine Beute kommt automatisch nach Ablauf der Zeit.').setFooter({ text: 'Paradise City Roleplay • Staatsbank' }).setTimestamp()] }); } catch {}
    await msg.delete().catch(() => {});

    const uid = msg.author.id;
    setTimeout(async () => {
      const cur = _loadStaatsbank(); if (!cur[uid]?.active) return;
      const beute = Math.floor(Math.random() * 30001) + 75000;
      const k = _getKonto(uid); k.schwarz = (k.schwarz || 0) + beute; _setKonto(uid, k);
      cur[uid].active = null; cur[uid].cooldownUntil = Date.now() + 24 * 60 * 60 * 1000; _saveStaatsbank(cur);
      try { const n = _loadRaubNotrufe(), x = n.find(y => y.userId === uid && y.type === 'staatsbank_raub' && y.status === 'offen'); if (x) { x.status = 'geschlossen'; _saveRaubNotrufe(n); } } catch {}
      sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x22c55e).setTitle('🏦 Staatsbank Raub abgeschlossen')
        .addFields({ name: '👤 Spieler', value: '<@' + uid + '>', inline: true }, { name: '💰 Beute', value: beute.toLocaleString('de-CH') + ' $ Schwarzgeld', inline: true })
        .setTimestamp().setFooter({ text: 'Paradise City Roleplay • Staatsbank Log' })).catch(() => {});
      try { const u = await client.users.fetch(uid).catch(() => null); if (u) { const dm = await u.createDM(); await dm.send({ embeds: [new EmbedBuilder().setColor(0x22c55e).setTitle('💰 Staatsbank Raub erfolgreich!').setDescription('**Beute:** ' + beute.toLocaleString('de-CH') + ' $ Schwarzgeld\n\n⏳ Nächster Raub in **24 Stunden** möglich.').setFooter({ text: 'Paradise City Roleplay • Staatsbank' }).setTimestamp()] }); } } catch {}
    }, STAATSBANK_DUR_MS);
  });
}
// ─── END STAATSBANK RAUB SYSTEM ──────────────────────────────────────────────────────────────────────────────────────



// ─── RAUB ADMIN COMMANDS (/raub-fail, /raub-cooldown) ─────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName!=='raub-fail'&&interaction.commandName!=='raub-cooldown') return;

  const typ      = interaction.options.getString('typ');       // 'atm' | 'shop'
  const target   = interaction.options.getUser('spieler');
  const typLabel = typ==='staatsbank'?'Staatsbank Raub':typ==='humane'?'Humane Labs Raub':typ==='bar'?'Bar-Raub':typ==='shop'?'Shop-Raub':'ATM-Raub';
  const nType    = typ==='staatsbank'?'staatsbank_raub':typ==='humane'?'humane_raub':typ==='bar'?'bar_raub':typ==='shop'?'shop_raub':'atm_raub';
  const rFile    = path.join(DATA_DIR, typ==='staatsbank'?'staatsbank_raub.json':typ==='humane'?'humane_raub.json':typ==='bar'?'bar_raub.json':typ==='shop'?'shop_raub.json':'atm_raub.json');
  function _lrf(){ try{return JSON.parse(fs.readFileSync(rFile,'utf8'));}catch{return{};} }
  function _srf(d){ fs.writeFileSync(rFile,JSON.stringify(d,null,2),'utf8'); }

  if (interaction.commandName==='raub-fail') {
    const d=_lrf(), e=d[target.id]||{};
    if (!e.active) return interaction.reply({content:`❌ <@${target.id}> hat keinen aktiven ${typLabel}.`,ephemeral:true});
    d[target.id].active=null; _srf(d);
    try{const n=_loadRaubNotrufe(),x=n.find(y=>y.userId===target.id&&y.type===nType&&y.status==='offen');if(x){x.status='geschlossen';_saveRaubNotrufe(n);}}catch{}
    try{const u=await client.users.fetch(target.id).catch(()=>null);if(u){const dm=await u.createDM();await dm.send({embeds:[new EmbedBuilder().setColor(0xff4400).setTitle(`❌ ${typLabel} fehlgeschlagen`).setDescription(`Dein ${typLabel} wurde als **fehlgeschlagen** gewertet.\nKein Cooldown — du kannst es erneut versuchen.`).setFooter({text:'Paradise City Roleplay'})]});}}catch{}
    sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0xff4400).setTitle(`${typ==='humane'?'🏭':typ==='bar'?'🍺':typ==='shop'?'🛍️':'🏧'} ${typLabel} fehlgeschlagen (Admin)`)
      .addFields({name:'👤 Spieler',value:`<@${target.id}> (${target.username})`,inline:true},{name:'👮 Von',value:`<@${interaction.user.id}>`,inline:true})
      .setTimestamp().setFooter({text:'Paradise City Roleplay • Raub Log'})).catch(()=>{});
    return interaction.reply({content:`✅ ${typLabel} von <@${target.id}> fehlgeschlagen markiert. Kein Cooldown.`,ephemeral:true});
  }

  if (interaction.commandName==='raub-cooldown') {
    const d=_lrf(); if(!d[target.id])d[target.id]={};
    d[target.id].cooldownUntil=0; d[target.id].active=null; _srf(d);
    sendLog(CH.SERVER_LOG,new EmbedBuilder().setColor(0x38bdf8).setTitle(`🔓 ${typLabel} Cooldown zurückgesetzt`)
      .addFields({name:'👤 Spieler',value:`<@${target.id}> (${target.username})`,inline:true},{name:'👮 Von',value:`<@${interaction.user.id}>`,inline:true})
      .setTimestamp().setFooter({text:'Paradise City Roleplay • Raub Log'})).catch(()=>{});
    return interaction.reply({content:`✅ Cooldown von <@${target.id}> (${typLabel}) zurückgesetzt.`,ephemeral:true});
  }
});
// ─── END RAUB ADMIN COMMANDS ─────────────────────────────────────────────────


// ─── VERSTECKEN / FESSELN SYSTEM ─────────────────────────────────────────────
{
  const VF_CHANNEL   = '1490882589014364250';
  const VERSTECK_FILE = path.join(DATA_DIR, 'verstecke.json');
  const FESSEL_FILE   = path.join(DATA_DIR, 'fesselungen.json');

  function _loadInvVF(uid){ try{const d=JSON.parse(fs.readFileSync(path.join(DATA_DIR,'inventar.json'),'utf8'));return d[uid]||{};}catch{return{};} }
  function _saveInvVFAll(d){ fs.writeFileSync(path.join(DATA_DIR,'inventar.json'),JSON.stringify(d,null,2),'utf8'); }
  function _loadAllInvVF(){ try{return JSON.parse(fs.readFileSync(path.join(DATA_DIR,'inventar.json'),'utf8'));}catch{return{};} }
  function _loadVerstecke(){ try{return JSON.parse(fs.readFileSync(VERSTECK_FILE,'utf8'));}catch{return{};} }
  function _saveVerstecke(d){ fs.writeFileSync(VERSTECK_FILE,JSON.stringify(d,null,2),'utf8'); }
  function _loadFesselungen(){ try{return JSON.parse(fs.readFileSync(FESSEL_FILE,'utf8'));}catch{return{};} }
  function _saveFesselungen(d){ fs.writeFileSync(FESSEL_FILE,JSON.stringify(d,null,2),'utf8'); }

  // ── Autocomplete für /verstecken item ───────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isAutocomplete()) return;
    if (interaction.commandName !== 'verstecken') return;
    const focused = interaction.options.getFocused().toLowerCase();
    const inv = _loadInvVF(interaction.user.id);
    const choices = Object.entries(inv)
      .filter(([k,v]) => v > 0 && k.toLowerCase().includes(focused))
      .slice(0,25)
      .map(([k,v]) => ({ name: `${k} (${v}x vorhanden)`, value: k }));
    await interaction.respond(choices).catch(()=>{});
  });

  // ── /verstecken ─────────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'verstecken') return;

    if (interaction.channelId !== VF_CHANNEL)
      return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${VF_CHANNEL}>.`, ephemeral: true });

    const itemName = interaction.options.getString('item');
    const menge    = interaction.options.getInteger('menge');
    const ort      = interaction.options.getString('ort');

    const allInv = _loadAllInvVF();
    const inv    = allInv[interaction.user.id] || {};

    // Case-insensitive item suchen
    const foundKey = Object.keys(inv).find(k => k.toLowerCase() === itemName.toLowerCase());
    if (!foundKey || (inv[foundKey] || 0) < menge) {
      const list = Object.keys(inv).length
        ? Object.entries(inv).map(([k,v]) => `• **${k}** — ${v}x`).join('\n')
        : '_Inventar leer_';
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(0xff4400)
        .setTitle('❌ Item nicht gefunden / zu wenig')
        .setDescription(`Du hast nicht genug **${itemName}** im Inventar.\n\n**Dein Inventar:**\n${list}`)
        .setFooter({ text: 'Paradise City Roleplay' })], ephemeral: true });
    }

    // Item abziehen
    inv[foundKey] -= menge;
    if (inv[foundKey] <= 0) delete inv[foundKey];
    allInv[interaction.user.id] = inv;
    _saveInvVFAll(allInv);

    // Versteck-ID erzeugen
    const versteckId = `${interaction.user.id}_${Date.now()}`;

    // Embed + Button
    const btn = new ButtonBuilder()
      .setCustomId(`versteck_holen:${interaction.user.id}:${versteckId}`)
      .setLabel('📦 Items aus Versteck holen')
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(btn);

    const embed = new EmbedBuilder()
      .setColor(0x854d0e)
      .setTitle('🎒 Items versteckt')
      .addFields(
        { name: '👤 Spieler',  value: `<@${interaction.user.id}>`,         inline: true },
        { name: '📦 Item',     value: `${foundKey} — **${menge}x**`,       inline: true },
        { name: '📍 Ort',      value: ort,                                  inline: false },
      )
      .setFooter({ text: 'Paradise City Roleplay • Versteck-System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] });
    const sentMsg = await interaction.fetchReply();

    // Versteck speichern
    const vstecke = _loadVerstecke();
    vstecke[versteckId] = {
      userId: interaction.user.id,
      username: interaction.user.username,
      item: foundKey,
      menge,
      ort,
      messageId: sentMsg.id,
      channelId: sentMsg.channelId,
      createdAt: Date.now()
    };
    _saveVerstecke(vstecke);

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x854d0e).setTitle('🎒 Items versteckt')
      .addFields(
        { name: '👤 Spieler', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
        { name: '📦 Item',    value: `${foundKey} — ${menge}x`, inline: true },
        { name: '📍 Ort',     value: ort, inline: false }
      ).setTimestamp().setFooter({ text: 'Paradise City Roleplay • Versteck-System' })).catch(()=>{});
  });

  // ── Button: Items aus Versteck holen ────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('versteck_holen:')) return;

    const [, ownerId, versteckId] = interaction.customId.split(':');
    if (interaction.user.id !== ownerId)
      return interaction.reply({ content: '❌ Du kannst nur dein **eigenes** Versteck leerholen!', ephemeral: true });

    const vstecke = _loadVerstecke();
    const v = vstecke[versteckId];
    if (!v) return interaction.reply({ content: '❌ Dieses Versteck existiert nicht mehr.', ephemeral: true });

    // Item zurück ins Inventar
    const allInv = _loadAllInvVF();
    const inv = allInv[ownerId] || {};
    inv[v.item] = (inv[v.item] || 0) + v.menge;
    allInv[ownerId] = inv;
    _saveInvVFAll(allInv);

    // Versteck entfernen
    delete vstecke[versteckId];
    _saveVerstecke(vstecke);

    // Embed aktualisieren (Button deaktivieren)
    const disabledBtn = new ButtonBuilder()
      .setCustomId('versteck_leer')
      .setLabel('✅ Versteck geleert')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    await interaction.update({ components: [new ActionRowBuilder().addComponents(disabledBtn)] }).catch(()=>{});

    await interaction.followUp({ embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('✅ Items aus Versteck geholt')
      .setDescription(`**${v.item}** (${v.menge}x) wurde wieder in dein Inventar gelegt.\n**Ort war:** ${v.ort}`)
      .setFooter({ text: 'Paradise City Roleplay • Versteck-System' })
      .setTimestamp()], ephemeral: true });

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x22c55e).setTitle('📦 Versteck geleert')
      .addFields(
        { name: '👤 Spieler', value: `<@${ownerId}> (${v.username})`, inline: true },
        { name: '📦 Item',    value: `${v.item} — ${v.menge}x`, inline: true },
        { name: '📍 Ort',     value: v.ort, inline: false }
      ).setTimestamp().setFooter({ text: 'Paradise City Roleplay • Versteck-System' })).catch(()=>{});
  });

  // ── /fesseln ────────────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'fesseln') return;

    if (interaction.channelId !== VF_CHANNEL)
      return interaction.reply({ content: `❌ Dieser Command funktioniert nur in <#${VF_CHANNEL}>.`, ephemeral: true });

    const target = interaction.options.getUser('spieler');
    if (target.id === interaction.user.id)
      return interaction.reply({ content: '❌ Du kannst dich nicht selbst fesseln.', ephemeral: true });

    const allInv = _loadAllInvVF();
    const inv = allInv[interaction.user.id] || {};

    // Kabelbinder suchen (case-insensitive)
    const kbKey = Object.keys(inv).find(k => k.toLowerCase().includes('handschellen') || k.toLowerCase().includes('fesseln'));
    if (!kbKey || (inv[kbKey] || 0) <= 0) {
      const list = Object.keys(inv).length
        ? Object.entries(inv).map(([k,v]) => `• **${k}** — ${v}x`).join('\n')
        : '_Inventar leer_';
      return interaction.reply({ embeds: [new EmbedBuilder()
        .setColor(0xff4400)
        .setTitle('❌ Keine Handschellen')
        .setDescription(`Du hast keine **Handschellen** im Inventar. Kaufe welche im 🔨〢𝘉𝘢𝘶𝘮𝘢𝘳𝘬𝘵.\n\n**Dein Inventar:**\n${list}`)
        .setFooter({ text: 'Paradise City Roleplay' })], ephemeral: true });
    }

    // Kabelbinder abziehen
    inv[kbKey] -= 1;
    if (inv[kbKey] <= 0) delete inv[kbKey];
    allInv[interaction.user.id] = inv;
    _saveInvVFAll(allInv);

    // Fesselung-ID
    const fesselId = `${interaction.user.id}_${target.id}_${Date.now()}`;

    // Embed + Button
    const btn = new ButtonBuilder()
      .setCustomId(`entfesseln:${interaction.user.id}:${target.id}:${fesselId}`)
      .setLabel('✂️ Entfesseln')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(btn);

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🔗 Spieler gefesselt')
      .addFields(
        { name: '🔒 Gefesselt von', value: `<@${interaction.user.id}>`, inline: true },
        { name: '👤 Gefesselter',   value: `<@${target.id}>`,           inline: true },
        { name: '🔒 Werkzeug',      value: kbKey,                        inline: false },
      )
      .setFooter({ text: 'Paradise City Roleplay • Fesselungs-System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [row] });
    const sentMsg = await interaction.fetchReply();

    // Fesselung speichern
    const fesselungen = _loadFesselungen();
    fesselungen[fesselId] = {
      fesselerId: interaction.user.id,
      fesselerName: interaction.user.username,
      targetId: target.id,
      targetName: target.username,
      kbKey,
      messageId: sentMsg.id,
      channelId: sentMsg.channelId,
      createdAt: Date.now()
    };
    _saveFesselungen(fesselungen);

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x7c3aed).setTitle('🔗 Spieler gefesselt')
      .addFields(
        { name: '🔒 Von',          value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
        { name: '👤 Gefesselter',  value: `<@${target.id}> (${target.username})`,                     inline: true },
        { name: '🔒 Handschellen', value: kbKey, inline: false }
      ).setTimestamp().setFooter({ text: 'Paradise City Roleplay • Fesselungs-System' })).catch(()=>{});
  });

  // ── Button: Entfesseln ───────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith('entfesseln:')) return;

    const parts = interaction.customId.split(':');
    const fesselerId = parts[1];
    const targetId   = parts[2];
    const fesselId   = parts[3];

    if (interaction.user.id !== fesselerId)
      return interaction.reply({ content: '❌ Nur derjenige der gefesselt hat, kann auch entfesseln!', ephemeral: true });

    const fesselungen = _loadFesselungen();
    const f = fesselungen[fesselId];
    if (!f) return interaction.reply({ content: '❌ Diese Fesselung existiert nicht mehr.', ephemeral: true });

    // Kabelbinder zurück ins Inventar des Fesselers
    const allInv = _loadAllInvVF();
    const inv = allInv[fesselerId] || {};
    inv[f.kbKey] = (inv[f.kbKey] || 0) + 1;
    allInv[fesselerId] = inv;
    _saveInvVFAll(allInv);

    // Fesselung entfernen
    delete fesselungen[fesselId];
    _saveFesselungen(fesselungen);

    // Button deaktivieren
    const disabledBtn = new ButtonBuilder()
      .setCustomId('entfesselt_done')
      .setLabel('✅ Entfesselt')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    await interaction.update({ components: [new ActionRowBuilder().addComponents(disabledBtn)] }).catch(()=>{});

    await interaction.followUp({ embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('✅ Spieler entfesselt')
      .setDescription(`<@${targetId}> wurde entfesselt.\n**${f.kbKey}** wurde zurück in dein Inventar gelegt.`)
      .setFooter({ text: 'Paradise City Roleplay • Fesselungs-System' })
      .setTimestamp()], ephemeral: true });

    sendLog(CH.SERVER_LOG, new EmbedBuilder().setColor(0x22c55e).setTitle('✂️ Spieler entfesselt')
      .addFields(
        { name: '🔓 Entfesselt von', value: `<@${fesselerId}> (${f.fesselerName})`, inline: true },
        { name: '👤 Spieler',        value: `<@${targetId}> (${f.targetName})`,      inline: true },
        { name: '🔒 Handschellen zurück', value: f.kbKey, inline: false }
      ).setTimestamp().setFooter({ text: 'Paradise City Roleplay • Fesselungs-System' })).catch(()=>{});
  });
}
// ─── END VERSTECKEN / FESSELN SYSTEM ─────────────────────────────────────────


// ─── AKTIEN HANDELN BUTTON ────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('aktien_handeln:')) return;

  const WEBAPP_URL_AH = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
  const tok = require('crypto').randomBytes(16).toString('hex');
  const toks = loadAktienToks();
  // Abgelaufene Token bereinigen
  for (const [k, v] of Object.entries(toks)) { if (v.expiresAt < Date.now()) delete toks[k]; }
  toks[tok] = { userId: interaction.user.id, userTag: interaction.user.tag, createdAt: Date.now(), expiresAt: Date.now() + 4 * 60 * 60 * 1000 };
  saveAktienToks(toks);

  const aktienUrl = `${WEBAPP_URL_AH}/aktien?token=${tok}`;
  const linkBtn = new ButtonBuilder()
    .setLabel('🌐 Jetzt öffnen')
    .setStyle(ButtonStyle.Link)
    .setURL(aktienUrl);
  const linkRow = new ActionRowBuilder().addComponents(linkBtn);

  return interaction.reply({
    embeds: [new EmbedBuilder()
      .setColor(0x3b82f6)
      .setTitle('📊 Dein persönlicher Aktienmarkt-Zugang')
      .setDescription('Klicke den Button um deinen Aktienmarkt zu öffnen.\nDu kannst Aktien kaufen, verkaufen und dein Portfolio einsehen.\n\n⏳ Link gültig für **4 Stunden**.')
      .setFooter({ text: 'Paradise City Roleplay • Aktienmarkt' })
    ],
    components: [linkRow],
    ephemeral: true
  });
});
// ─── END AKTIEN HANDELN BUTTON ────────────────────────────────────────────────


// ─── DARKNET EMBED ────────────────────────────────────────────────────────────
client.once('ready', async () => {
  try {
    const DARKNET_CH   = '1490890321276702723';
    const DARKNET_ROLE = '1490855730767597738';

    const ch = await client.channels.fetch(DARKNET_CH).catch(() => null);
    if (!ch) return;

    const WEBAPP_DN = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');
    const linkBtn = new ButtonBuilder()
      .setLabel('⬛ DARKNET BETRETEN')
      .setStyle(ButtonStyle.Link)
      .setURL(WEBAPP_DN + '/darknet');
    const row = new ActionRowBuilder().addComponents(linkBtn);

    const darknetEmbed = new EmbedBuilder()
      .setColor(0x00ff41)
      .setTitle('// DARKNET — ANONYMES NETZWERK //')
      .setDescription(
        '```\n> Verbindung wird aufgebaut...\n> Identität wird verschleiert...\n> Zugang gesichert.\n```\n' +
        '**Willkommen im Darknet.** Hier gibt es keine Namen, nur Aliase.\n\n' +
        `**Zugang:** Nur für <@&${DARKNET_ROLE}>\n` +
        '**Features:**\n' +
        '`▸` Schwarzmarkt — Angebote erstellen, kaufen, handeln\n' +
        '`▸` PC Coin Krypto-Integration — echte Wallet-Balance\n' +
        '`▸` Verschlüsselte Chats (DMs & Gruppen)\n' +
        '`▸` Preisverhandlungen & persönliche Treffen\n' +
        '`▸` Automatische Verkaufs-Benachrichtigungen\n\n' +
        '*Keine Logs. Keine Spuren. Kein Mitleid.*'
      )
      .setFooter({ text: 'Paradise City Roleplay • Darknet v2.0 — ENCRYPTED' })
      .setTimestamp();

    // Check if embed already exists → edit it, don't re-send
    const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs) {
      const existing = msgs.find(function(m) {
        return m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('DARKNET');
      });
      if (existing) {
        await existing.edit({ embeds: [darknetEmbed], components: [row] }).catch(() => {});
        console.log('[DARKNET] Embed aktualisiert.');
        return;
      }
    }

    await ch.send({ embeds: [darknetEmbed], components: [row] });
    console.log('[DARKNET] Embed neu gesendet.');
  } catch (e) {
    console.error('[DARKNET EMBED]', e.message);
  }
});
// ─── END DARKNET EMBED ────────────────────────────────────────────────────────

// ─── DARKNET SETUP COMMAND ───────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'darknet-setup') return;
  if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    const DARKNET_CH   = '1490890321276702723';
    const DARKNET_ROLE = '1490855730767597738';

    const ch = await client.channels.fetch(DARKNET_CH).catch(() => null);
    if (!ch) return interaction.editReply({ content: '❌ Darknet-Kanal nicht gefunden.' });

    const enterBtn = new ButtonBuilder()
      .setCustomId('darknet_betreten')
      .setLabel('⬛ DARKNET BETRETEN')
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(enterBtn);

    const darknetEmbed = new EmbedBuilder()
      .setColor(0x00ff41)
      .setTitle('// DARKNET — ANONYMES NETZWERK //')
      .setDescription(
        '```\n> Verbindung wird aufgebaut...\n> Identität wird verschleiert...\n> Zugang gesichert.\n```\n' +
        '**Willkommen im Darknet.** Hier gibt es keine Namen, nur Aliase.\n\n' +
        `**Zugang:** Nur für <@&${DARKNET_ROLE}>\n` +
        '**Features:**\n' +
        '`▸` Schwarzmarkt — Angebote erstellen, kaufen, handeln\n' +
        '`▸` PC Coin Krypto-Integration — echte Wallet-Balance\n' +
        '`▸` Verschlüsselte Chats (DMs & Gruppen)\n' +
        '`▸` Preisverhandlungen & persönliche Treffen\n' +
        '`▸` Automatische Verkaufs-Benachrichtigungen\n\n' +
        '*Keine Logs. Keine Spuren. Kein Mitleid.*'
      )
      .setFooter({ text: 'Paradise City Roleplay • Darknet v2.0 — ENCRYPTED' })
      .setTimestamp();

    // Bestehendes Embed suchen & bearbeiten, sonst neu senden
    const msgs = await ch.messages.fetch({ limit: 20 }).catch(() => null);
    if (msgs) {
      const existing = msgs.find(m =>
        m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title && m.embeds[0].title.includes('DARKNET')
      );
      if (existing) {
        await existing.edit({ embeds: [darknetEmbed], components: [row] });
        return interaction.editReply({ content: '✅ Darknet-Embed aktualisiert.' });
      }
    }

    await ch.send({ embeds: [darknetEmbed], components: [row] });
    return interaction.editReply({ content: '✅ Darknet-Embed neu gesendet.' });
  } catch (e) {
    console.error('[DARKNET SETUP]', e.message);
    return interaction.editReply({ content: '❌ Fehler: ' + e.message });
  }
});
// ─── END DARKNET SETUP COMMAND ───────────────────────────────────────────────




// ─── KRYPTO SETUP ────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'krypto-setup') return;
  if (!interaction.member.permissions.has(require('discord.js').PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
  const WEBAPP_URL_KS = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : '')).replace(/\/$/,'');
  const rateData = loadKryptoRate();

  // 1. Wallet-Channel — interaktiver Button
  try {
    const ch1 = await client.channels.fetch(KRYPTO_WALLET_CH).catch(()=>null);
    if(ch1) {
      const embed1 = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('<:emoji_29:1507071093540782110> PC Coin — Mein Wallet')
        .setDescription('Sieh dein persönliches PC Coin-Guthaben ein und überweise <:emoji_29:1507071093540782110> an andere Spieler.\n\nKlicke auf den Button um dein Wallet zu sehen.')
        .addFields(
          { name:'💡 Was ist PC Coin?', value:'Die Kryptowährung von Paradise City. Überweise <:emoji_29:1507071093540782110> direkt an andere Spieler.', inline:false },
          { name:'🔒 Sicherheit', value:'Dein Wallet ist nur für dich sichtbar.', inline:true }
        )
        .setFooter({ text:'Paradise City • PC Coin System' }).setTimestamp();
      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('krypto_wallet').setLabel('💰 Wallet öffnen').setStyle(ButtonStyle.Primary)
      );
      await ch1.send({ embeds:[embed1], components:[row1] }).catch(()=>{});
    }
  } catch(e){ console.error('[KRYPTO SETUP W]',e.message); }

  // 2. Tauschbörse-Channel — interaktiver Button
  try {
    const ch2 = await client.channels.fetch(KRYPTO_EXCH_CH).catch(()=>null);
    if(ch2) {
      const embed2 = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('⚖️ PC Coin — Tauschbörse')
        .setDescription('Tausche dein Bankgeld in PC Coin um — oder verkaufe deine <:emoji_29:1507071093540782110> zurück in Bankgeld.')
        .addFields(
          { name:'📈 Aktueller Kurs', value:`1 <:emoji_29:1507071093540782110> = **${rateData.rate.toLocaleString('de-DE')} $**`, inline:true },
          { name:'🏦 Bankgeld → PC Coin', value:'Kaufe PC Coin mit deinem Bankkonto', inline:true },
          { name:'💱 PC Coin → Bankgeld', value:'Verkaufe PC Coin zurück in Bankgeld', inline:true }
        )
        .setFooter({ text:'Paradise City • PC Coin System • Kurse aktualisieren stündlich' }).setTimestamp();
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('krypto_exchange').setLabel('⚖️ Tauschbörse öffnen').setStyle(ButtonStyle.Primary)
      );
      await ch2.send({ embeds:[embed2], components:[row2] }).catch(()=>{});
    }
  } catch(e){ console.error('[KRYPTO SETUP E]',e.message); }

  // 3. Kurse-Channel — Link-Button (direkt, kein Token)
  await updateKryptoRate().catch(()=>{});

  await interaction.editReply({ content: '✅ PC Coin Embeds gesendet!' });
});
// ─── END KRYPTO SETUP ─────────────────────────────────────────────────────────

// ─── KRYPTO BUTTON INTERACTIONS ───────────────────────────────────────────────
// Button: Wallet öffnen → ephemeral embed (kein Browser)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'krypto_wallet' && interaction.customId !== 'krypto_exchange' && interaction.customId !== 'krypto_pay' && interaction.customId !== 'krypto_buy_btn' && interaction.customId !== 'krypto_sell_btn') return;

  // ── Wallet Button → ephemeral Embed mit Pay-Button ─────────────────────────
  if (interaction.customId === 'krypto_wallet') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const wallet = getWallet(interaction.user.id);
      const walletEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('<:emoji_29:1507071093540782110> PC Coin Wallet')
        .setDescription('Dein persönliches PC Coin-Guthaben.')
        .addFields(
          { name: '<:emoji_29:1507071093540782110> PC Coin Balance', value: wallet.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>', inline: true }
        )
        .setFooter({ text: 'Paradise City • PC Coin System' })
        .setTimestamp();
      const payBtn = new ButtonBuilder()
        .setCustomId('krypto_pay')
        .setLabel('💸 Überweisung senden')
        .setStyle(ButtonStyle.Primary);
      await interaction.editReply({
        embeds: [walletEmbed],
        components: [new ActionRowBuilder().addComponents(payBtn)]
      });
    } catch(e) { await interaction.editReply({ content: '❌ Fehler: ' + e.message }); }
    return;
  }

  // ── Pay Button → Modal öffnen ───────────────────────────────────────────────
  if (interaction.customId === 'krypto_pay') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('krypto_pay_modal')
        .setTitle('💸 PC Coin Überweisung');
      const recipientInput = new TextInputBuilder()
        .setCustomId('krypto_pay_recipient')
        .setLabel('Empfänger Discord ID')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 123456789012345678')
        .setRequired(true)
        .setMinLength(15).setMaxLength(20);
      const amountInput = new TextInputBuilder()
        .setCustomId('krypto_pay_amount')
        .setLabel('Betrag in PC Coin')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 1.5000')
        .setRequired(true)
        .setMaxLength(20);
      modal.addComponents(
        new ActionRowBuilder().addComponents(recipientInput),
        new ActionRowBuilder().addComponents(amountInput)
      );
      await interaction.showModal(modal);
    } catch(e) { console.error('[KRYPTO PAY MODAL]', e.message); }
    return;
  }

  // ── Tauschbörse Button ──────────────────────────────────────────────────────
  if (interaction.customId === 'krypto_exchange') {
    await interaction.deferReply({ ephemeral: true });
    try {
      const uid_ex = interaction.user.id;
      const wallet_ex = getWallet(uid_ex);
      const rate_ex = loadKryptoRate().rate || 100;
      const konto_ex = _getKonto(uid_ex);
      const exEmbed = new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('⚖️ PC Coin — Tauschbörse')
        .setDescription('Kaufe oder verkaufe <:emoji_29:1507071093540782110> direkt hier in Discord.')
        .addFields(
          { name: '📈 Aktueller Kurs', value: '1 <:emoji_29:1507071093540782110> = **' + rate_ex.toLocaleString('de-DE') + ' $**', inline: false },
          { name: '<:emoji_29:1507071093540782110> PC Coin Guthaben', value: wallet_ex.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>', inline: true },
          { name: '🏦 Bankgeld', value: (konto_ex.konto || 0).toLocaleString('de-DE') + ' $', inline: true }
        )
        .setFooter({ text: 'Paradise City • PC Coin System' })
        .setTimestamp();
      const buyBtn_ex  = new ButtonBuilder().setCustomId('krypto_buy_btn').setLabel('🛒 PC Coin kaufen').setStyle(ButtonStyle.Success);
      const sellBtn_ex = new ButtonBuilder().setCustomId('krypto_sell_btn').setLabel('💱 PC Coin verkaufen').setStyle(ButtonStyle.Danger);
      await interaction.editReply({
        embeds: [exEmbed],
        components: [new ActionRowBuilder().addComponents(buyBtn_ex, sellBtn_ex)]
      });
    } catch(e) { await interaction.editReply({ content: '❌ Fehler: ' + e.message }); }
    return;
  }
});

// ─── KRYPTO PAY MODAL SUBMIT ───────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'krypto_pay_modal') return;

  await interaction.deferReply({ ephemeral: true });
  try {
    const recipientId = interaction.fields.getTextInputValue('krypto_pay_recipient').trim();
    const amountStr   = interaction.fields.getTextInputValue('krypto_pay_amount').trim().replace(',', '.');
    const amount      = parseFloat(amountStr);
    const senderId    = interaction.user.id;

    if (!/^\d{15,20}$/.test(recipientId)) {
      return interaction.editReply({ content: '❌ Ungültige Discord ID (muss eine 15-20-stellige Zahl sein).' });
    }
    if (recipientId === senderId) {
      return interaction.editReply({ content: '❌ Du kannst nicht an dich selbst überweisen.' });
    }
    if (isNaN(amount) || amount <= 0 || amount < 0.0001) {
      return interaction.editReply({ content: '❌ Ungültiger Betrag (mindestens 0.0001 PC Coin).' });
    }

    const senderWallet = getWallet(senderId);
    if (senderWallet.dc < amount) {
      return interaction.editReply({ content: '❌ Nicht genug PC Coin. Du hast nur ' + senderWallet.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>.' });
    }

    // Überweisung durchführen
    senderWallet.dc = Math.round((senderWallet.dc - amount) * 1e8) / 1e8;
    setWallet(senderId, senderWallet);
    const recvWallet  = getWallet(recipientId);
    recvWallet.dc     = Math.round((recvWallet.dc + amount) * 1e8) / 1e8;
    setWallet(recipientId, recvWallet);

    const rate        = loadKryptoRate().rate || 100;
    const schwarzwert = Math.round(amount * rate);

    const confirmEmbed = new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle('✅ Überweisung erfolgreich')
      .addFields(
        { name: 'Empfänger',        value: '<@' + recipientId + '>',                      inline: true },
        { name: 'Betrag',           value: amount.toFixed(4) + ' <:emoji_29:1507071093540782110>',    inline: true },
        { name: 'Schwarzgeld-Wert', value: schwarzwert.toLocaleString('de-DE') + ' $',   inline: true },
        { name: 'Neues Guthaben',   value: senderWallet.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'Paradise City • PC Coin System' });
    await interaction.editReply({ embeds: [confirmEmbed] });

    // Empfänger per DM benachrichtigen
    const notifyEmbed = new EmbedBuilder()
      .setColor(0xf59e0b)
      .setTitle('<:emoji_29:1507071093540782110> PC Coin erhalten')
      .setDescription('Du hast **' + amount.toFixed(4) + ' <:emoji_29:1507071093540782110>** empfangen.')
      .addFields({ name: 'Neues Guthaben', value: recvWallet.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>', inline: true })
      .setTimestamp()
      .setFooter({ text: 'Paradise City • PC Coin System' });
    client.users.fetch(recipientId).then(function(u) {
      u.send({ embeds: [notifyEmbed] }).catch(function() {});
    }).catch(function() {});
  } catch(e) {
    console.error('[KRYPTO PAY SUBMIT]', e.message);
    await interaction.editReply({ content: '❌ Fehler bei der Überweisung: ' + e.message });
  }
});
// ─── END KRYPTO BUTTON INTERACTIONS ───────────────────────────────────────────
// ─── KRYPTO TAUSCHBÖRSE BUTTONS (buy/sell) ───────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'krypto_buy_btn' && interaction.customId !== 'krypto_sell_btn') return;
  const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

  if (interaction.customId === 'krypto_buy_btn') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('krypto_buy_modal')
        .setTitle('🛒 PC Coin kaufen');
      const amtInput = new TextInputBuilder()
        .setCustomId('krypto_buy_amount')
        .setLabel('Betrag in Bankgeld ($)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 5000')
        .setRequired(true)
        .setMaxLength(20);
      modal.addComponents(new ActionRowBuilder().addComponents(amtInput));
      await interaction.showModal(modal);
    } catch(e) { console.error('[KRYPTO BUY BTN]', e.message); }
    return;
  }

  if (interaction.customId === 'krypto_sell_btn') {
    try {
      const modal = new ModalBuilder()
        .setCustomId('krypto_sell_modal')
        .setTitle('💱 PC Coin verkaufen');
      const amtInput = new TextInputBuilder()
        .setCustomId('krypto_sell_amount')
        .setLabel('Betrag in PC Coin')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('z.B. 1.5000')
        .setRequired(true)
        .setMaxLength(20);
      modal.addComponents(new ActionRowBuilder().addComponents(amtInput));
      await interaction.showModal(modal);
    } catch(e) { console.error('[KRYPTO SELL BTN]', e.message); }
    return;
  }
});

// ─── KRYPTO TAUSCHBÖRSE MODAL SUBMIT ─────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId !== 'krypto_buy_modal' && interaction.customId !== 'krypto_sell_modal') return;
  await interaction.deferReply({ ephemeral: true });
  const { EmbedBuilder } = require('discord.js');
  const uid_ts = interaction.user.id;
  const rate_ts = loadKryptoRate().rate || 100;
  try {
    if (interaction.customId === 'krypto_buy_modal') {
      const amtStr = interaction.fields.getTextInputValue('krypto_buy_amount').trim().replace(',','.').replace(/[^0-9.]/g,'');
      const bankgeld = parseFloat(amtStr);
      if (isNaN(bankgeld) || bankgeld <= 0) return interaction.editReply({ content: '\u274c Ungültiger Betrag.' });
      const kontoData_b = _getKonto(uid_ts);
      if ((kontoData_b.konto || 0) < bankgeld) return interaction.editReply({ content: '\u274c Nicht genug Bankgeld. Du hast **' + (kontoData_b.konto || 0).toLocaleString('de-DE') + ' $**.' });
      const dc_bought = Math.round((bankgeld / rate_ts) * 1e8) / 1e8;
      kontoData_b.konto = Math.round(((kontoData_b.konto || 0) - bankgeld) * 100) / 100;
      _setKonto(uid_ts, kontoData_b);
      const wallet_b = getWallet(uid_ts);
      wallet_b.dc = Math.round(((wallet_b.dc || 0) + dc_bought) * 1e8) / 1e8;
      setWallet(uid_ts, wallet_b);
      const confirmEmbed_b = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('\u2705 PC Coin gekauft')
        .addFields(
          { name: 'Bezahlt',                value: bankgeld.toLocaleString('de-DE') + ' $',                        inline: true },
          { name: 'Erhalten',               value: dc_bought.toFixed(4) + ' <:emoji_29:1507071093540782110>',                 inline: true },
          { name: 'Neues PC Coin Guthaben', value: wallet_b.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>',               inline: true },
          { name: 'Verbleibendes Bankgeld', value: kontoData_b.konto.toLocaleString('de-DE') + ' $',              inline: true }
        )
        .setFooter({ text: 'Paradise City \u2022 PC Coin System' }).setTimestamp();
      await interaction.editReply({ embeds: [confirmEmbed_b] });
    }

    if (interaction.customId === 'krypto_sell_modal') {
      const amtStr_s = interaction.fields.getTextInputValue('krypto_sell_amount').trim().replace(',','.');
      const dc_amt = parseFloat(amtStr_s);
      if (isNaN(dc_amt) || dc_amt <= 0 || dc_amt < 0.0001) return interaction.editReply({ content: '\u274c Ungültiger Betrag (mindestens 0.0001 PC Coin).' });
      const wallet_s = getWallet(uid_ts);
      if ((wallet_s.dc || 0) < dc_amt) return interaction.editReply({ content: '\u274c Nicht genug PC Coin. Du hast **' + (wallet_s.dc || 0).toFixed(4) + ' <:emoji_29:1507071093540782110>**.' });
      const payout = Math.round(dc_amt * rate_ts);
      wallet_s.dc = Math.round(((wallet_s.dc || 0) - dc_amt) * 1e8) / 1e8;
      setWallet(uid_ts, wallet_s);
      const kontoData_s = _getKonto(uid_ts);
      kontoData_s.konto = Math.round(((kontoData_s.konto || 0) + payout) * 100) / 100;
      _setKonto(uid_ts, kontoData_s);
      const confirmEmbed_s = new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle('\u2705 PC Coin verkauft')
        .addFields(
          { name: 'Verkauft',           value: dc_amt.toFixed(4) + ' <:emoji_29:1507071093540782110>',                inline: true },
          { name: 'Erhalten',           value: payout.toLocaleString('de-DE') + ' $',                     inline: true },
          { name: 'Neues PC Coin Guthaben', value: wallet_s.dc.toFixed(4) + ' <:emoji_29:1507071093540782110>',      inline: true },
          { name: 'Neues Bankgeld',     value: kontoData_s.konto.toLocaleString('de-DE') + ' $',          inline: true }
        )
        .setFooter({ text: 'Paradise City \u2022 PC Coin System' }).setTimestamp();
      await interaction.editReply({ embeds: [confirmEmbed_s] });
    }
  } catch(e) {
    console.error('[KRYPTO TAUSCH SUBMIT]', e.message);
    await interaction.editReply({ content: '\u274c Fehler: ' + e.message });
  }
});


// ─── DARKNET BETRETEN BUTTON ─────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'darknet_betreten') return;

  await interaction.deferReply({ ephemeral: true });
  try {
    const WEBAPP = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://' + process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/, '');

    // Token direkt in die geteilte Map schreiben — kein HTTP-Call nötig
    const webMod = require('./web');
    const tokenMap = webMod.darknetTokens;
    if (!tokenMap) {
      console.error('[DARKNET BETRETEN] darknetTokens Map nicht verfügbar');
      await interaction.editReply({ content: '❌ Darknet-System nicht bereit. Bitte kurz warten.' });
      return;
    }
    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 Stunden
    tokenMap.set(token, { discordUserId: interaction.user.id, expiresAt });
    setTimeout(() => tokenMap.delete(token), 24 * 60 * 60 * 1000);

    const personalUrl = WEBAPP + '/darknet?dc=' + token;
    const openBtn = new ButtonBuilder()
      .setLabel('⬛ DARKNET ÖFFNEN')
      .setStyle(ButtonStyle.Link)
      .setURL(personalUrl);

    await interaction.editReply({
      content: '```\n> Verbindung wird aufgebaut...\n> Identität wird verschleiert...\n> Persönlicher Zugang bereit.\n```',
      components: [new ActionRowBuilder().addComponents(openBtn)],
    });
  } catch (e) {
    console.error('[DARKNET BETRETEN]', e.message);
    await interaction.editReply({ content: '❌ Interner Fehler: ' + e.message });
  }
});
// ─── END DARKNET BETRETEN BUTTON ─────────────────────────────────────────────


// ─── ERROR HANDLERS ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ─── WEB SERVER ───────────────────────────────────────────────────────────────
const _webMod = require('./web');
_webMod(client, DATA_DIR, lapdTokens, _shopCb);

// ─── LOGIN (mit Retry) ───────────────────────────────────────────────────────
if (!process.env.DISCORD_TOKEN) {
  console.error('[FEHLER] DISCORD_TOKEN fehlt – Bot startet nicht.');
} else {
  (function loginWithRetry(attempt) {
    client.login(process.env.DISCORD_TOKEN)
      .then(() => console.log('[LOGIN] Erfolgreich eingeloggt (Versuch ' + attempt + ')'))
      .catch(err => {
        const wait = Math.min(30000, attempt * 5000);
        console.error('[LOGIN FEHLER] Versuch ' + attempt + ':', err.message || err);
        console.log('[LOGIN] Neuer Versuch in ' + (wait/1000) + 's...');
        setTimeout(() => loginWithRetry(attempt + 1), wait);
      });
  })(1);
}

// ─── PC BAY MARKETPLACE ───────────────────────────────────────────────────────
{
  const PCBAY_CHANNEL = '1492128730141954178';
  const PCBAY_MSG_FILE = path.join(DATA_DIR, 'pcbay_channel_msg.json');
  const PCBAY_TOKEN_FILE = path.join(DATA_DIR, 'pcbay_tokens.json');

  function _loadPcBayToks() { try { return JSON.parse(fs.readFileSync(PCBAY_TOKEN_FILE,'utf8')); } catch { return {}; } }
  function _savePcBayToks(d) { fs.writeFileSync(PCBAY_TOKEN_FILE, JSON.stringify(d,null,2),'utf8'); }
  function _getPcBayToken(userId, username) {
    const toks = _loadPcBayToks();
    for (const [tok, v] of Object.entries(toks)) {
      if (v.userId === userId) {
        if (username) { toks[tok].username = username; _savePcBayToks(toks); }
        return tok;
      }
    }
    const tok = require('crypto').randomBytes(24).toString('hex');
    toks[tok] = { userId, username: username||'Unbekannt', createdAt: Date.now() };
    _savePcBayToks(toks);
    return tok;
  }

  function _loadPcBayMsg() { try { return JSON.parse(fs.readFileSync(PCBAY_MSG_FILE,'utf8')); } catch { return {}; } }
  function _savePcBayMsg(d) { fs.writeFileSync(PCBAY_MSG_FILE, JSON.stringify(d,null,2),'utf8'); }

  async function sendPcBayEmbed() {
    const WEBAPP = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://'+process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/,'');
    try {
      const ch = await client.channels.fetch(PCBAY_CHANNEL).catch(()=>null);
      if (!ch) return;

      const embed = new EmbedBuilder()
        .setColor(0xC45700)
        .setTitle('🛒 PC Bay — Der Marktplatz von Paradise City')
        .setDescription(
          '**Kaufe und verkaufe Artikel, Fahrzeuge, Waffen und mehr!**\n\n' +
          '💵 Zahle mit **Bankgeld** oder **PC Coin**\n' +
          '🏪 Stelle eigene Angebote ein\n' +
          '🔍 Durchsuche hunderte Angebote\n' +
          '📦 Kategorien: Fahrzeuge, Waffen, Immobilien & mehr\n\n' +
          '> Klicke auf **PC Bay öffnen** um dich anzumelden.\n> Du erhältst deinen persönlichen Link per DM.'
        )
        .setThumbnail('attachment://pcbay_logo.jpeg')
        .setFooter({ text: 'PC Bay • Paradise City Roleplay' })
        .setTimestamp();

      const btn = new ButtonBuilder()
        .setCustomId('pcbay_open')
        .setLabel('🛒 PC Bay öffnen')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(btn);

      const pcbayMsg = _loadPcBayMsg();
      const logoPath = path.join(__dirname, 'assets', 'pcbay_logo.jpeg');
      const files = fs.existsSync(logoPath) ? [{ attachment: logoPath, name: 'pcbay_logo.jpeg' }] : [];

      // try edit existing message
      if (pcbayMsg.messageId) {
        try {
          const existing = await ch.messages.fetch(pcbayMsg.messageId).catch(()=>null);
          if (existing) {
            await existing.edit({ embeds: [embed], components: [row] });
            console.log('[PCBAY] Embed aktualisiert.');
            return;
          }
        } catch {}
      }

      // send new message
      const msg = await ch.send({ embeds: [embed], components: [row], files });
      _savePcBayMsg({ messageId: msg.id });
      console.log('[PCBAY] Embed gesendet.');
    } catch(e) {
      console.error('[PCBAY EMBED]', e.message);
    }
  }

  // send embed on ready
  client.once('ready', async () => {
    await new Promise(r => setTimeout(r, 4000)); // wait for bot to be fully ready
    await sendPcBayEmbed();
  });

  // handle button click
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'pcbay_open') return;

    await interaction.deferReply({ ephemeral: true });
    try {
      const WEBAPP = (process.env.WEBAPP_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? 'https://'+process.env.RAILWAY_PUBLIC_DOMAIN : 'http://localhost:8080')).replace(/\/$/,'');
      const token = _getPcBayToken(interaction.user.id, interaction.user.username);
      const loginUrl = `${WEBAPP}/pcbay/login/${token}`;

      // DM the user
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xC45700)
          .setTitle('🛒 Dein PC Bay Zugang')
          .setDescription(
            '**Willkommen bei PC Bay!**\n\n' +
            'Dein persönlicher Login-Link:\n' +
            `> 🔗 [PC Bay öffnen](${loginUrl})\n\n` +
            '📌 **Dieser Link gehört nur dir** — teile ihn nicht mit anderen.\n' +
            '🔄 Der Link bleibt dauerhaft gültig.'
          )
          .addFields(
            { name: '👤 Benutzername', value: interaction.user.username, inline: true },
            { name: '🌐 Marketplace', value: `[PC Bay](${loginUrl})`, inline: true }
          )
          .setFooter({ text: 'PC Bay • Paradise City Roleplay' })
          .setTimestamp();

        const openBtn = new ButtonBuilder()
          .setLabel('🛒 PC Bay öffnen')
          .setStyle(ButtonStyle.Link)
          .setURL(loginUrl);

        const dm = await interaction.user.createDM();
        await dm.send({ embeds: [dmEmbed], components: [new ActionRowBuilder().addComponents(openBtn)] });
        dmSent = true;
      } catch {}

      if (dmSent) {
        await interaction.editReply({ content: '✅ Ich habe dir deine **persönlichen Login-Daten** per DM geschickt! Schau in deine Direktnachrichten.' });
      } else {
        // DMs disabled — send link ephemerally
        const openBtn = new ButtonBuilder()
          .setLabel('🛒 PC Bay öffnen')
          .setStyle(ButtonStyle.Link)
          .setURL(loginUrl);
        await interaction.editReply({
          content: '⚠️ Ich konnte dir keine DM schicken (DMs deaktiviert).\nHier ist dein persönlicher Link:',
          components: [new ActionRowBuilder().addComponents(openBtn)]
        });
      }

      sendLog(CH.SERVER_LOG, new EmbedBuilder()
        .setColor(0xC45700)
        .setTitle('🛒 PC Bay Zugang angefordert')
        .addFields({ name: '👤 Nutzer', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true })
        .setTimestamp()
        .setFooter({ text: 'PC Bay • Paradise City Roleplay' })
      ).catch(()=>{});

    } catch(e) {
      console.error('[PCBAY BUTTON]', e.message);
      await interaction.editReply({ content: '❌ Fehler: '+e.message }).catch(()=>{});
    }
  });
}
// ─── END PC BAY MARKETPLACE ───────────────────────────────────────────────────
