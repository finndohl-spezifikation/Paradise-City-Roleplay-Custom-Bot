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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  AttachmentBuilder,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Datenspeicherung ─────────────────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
const WARN_FILE     = path.join(DATA_DIR, 'teamwarns.json');
const PLAYER_WARN_FILE = path.join(DATA_DIR, 'player_warns.json');
const INVITES_FILE  = path.join(DATA_DIR, 'invites.json');
const SETUP_FILE    = path.join(DATA_DIR, 'setup.json');

if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WARN_FILE))    fs.writeFileSync(WARN_FILE,    '{}', 'utf8');
if (!fs.existsSync(PLAYER_WARN_FILE)) fs.writeFileSync(PLAYER_WARN_FILE, '{}', 'utf8');
if (!fs.existsSync(INVITES_FILE)) fs.writeFileSync(INVITES_FILE, '{}', 'utf8');
if (!fs.existsSync(SETUP_FILE))   fs.writeFileSync(SETUP_FILE,   '{}', 'utf8');

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

// Rollen die von ALLEN Filterregeln ausgenommen sind
const EXEMPT_ROLE = '1490855646558556282';

// Rollen die Links senden dürfen (zusätzlich zu EXEMPT_ROLE)
const LINK_EXEMPT_ROLES = ['1490855702225485936', '1490855703370534965'];

// Discord-Invite Regex

// ─── Ticket-System ────────────────────────────────────────────────────────────
const TICKET_TRANSCRIPT_CH = '1490878139306606743';
const TICKET_RATING_CH     = '1491788506404491336';
const TICKET_PANEL_CH      = '1490885002030874775';
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
client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);

  for (const guild of client.guilds.cache.values()) {
    await buildInviteCache(guild);
  }

  const commands = [
    new SlashCommandBuilder()
      .setName('delete')
      .setDescription('Löscht Nachrichten in diesem Kanal (max. 200)')
      .addIntegerOption(opt =>
        opt.setName('anzahl').setDescription('Anzahl (1–200)').setRequired(true).setMinValue(1).setMaxValue(200))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn')
      .setDescription('Erteilt einem Teammitglied eine offizielle Team Warn')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .addStringOption(opt => opt.setName('grund').setDescription('Grund').setRequired(true))
      .addStringOption(opt => opt.setName('konsequenz').setDescription('Konsequenz').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-remove')
      .setDescription('Entfernt die letzte Team Warn eines Teammitglieds')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-list')
      .setDescription('Zeigt alle Team Warns eines Nutzers')
      .addUserOption(opt => opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .toJSON(),

      new SlashCommandBuilder()
        .setName('einreise-code')
        .setDescription('Generiert deinen persönlichen Einreise-Code für das Webformular')
        .toJSON(),

      new SlashCommandBuilder()
        .setName('ausweis')
        .setDescription('Zeigt deinen Ausweis an (nur im Ausweis-Kanal)')
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
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ausweis-delete')
      .setDescription('Löscht den Ausweis eines Mitglieds')
      .addUserOption(opt => opt.setName('mitglied').setDescription('Mitglied dessen Ausweis gelöscht werden soll').setRequired(true))
      .toJSON(),

    new SlashCommandBuilder()
      .setName('ausweise')
      .setDescription('Zeigt den offiziellen Ausweis einer Person an')
      .addUserOption(opt => opt.setName('person').setDescription('Mitglied dessen Ausweis angezeigt werden soll').setRequired(true))
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

  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
    } catch (e) { console.error('Slash Command Fehler:', e.message); }
  }

  await sendLog(CH.RESTART_LOG, new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('🔄 Bot neugestartet')
    .setDescription(`**${client.user.tag}** ist wieder online.`)
    .addFields({ name: '🕐 Zeitpunkt', value: `<t:${ts()}:F>` })
    .setTimestamp()
  );

  // ── Einmalig: Einreise-Embed mit Button senden ─────────────────────────────
  const setup = loadSetup();
  if (!setup.einreiseEmbedV4Sent) {
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
        setup.einreiseEmbedV4Sent = true;
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
    });


    // ─── TICKET INTERAKTIONEN ─────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    try {

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
        const ticketCh = await guild.channels.create({ name, type: ChannelType.GuildText, parent: cfg.category, permissionOverwrites: permOverwrites });
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
          )
          .setFooter({ text: 'Paradise City Roleplay  •  Support' }).setTimestamp();
        const closeBtn  = new ButtonBuilder().setCustomId('ticket_close').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger);
        const assignBtn = new ButtonBuilder().setCustomId('ticket_assign').setLabel('Nutzer zuweisen').setEmoji('👤').setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(closeBtn, assignBtn);
        const pings = [...cfg.roles.map(r => `<@&${r}>`), ...cfg.pingRoles.map(r => `<@&${r}>`)].join(' ');
        await ticketCh.send({ content: pings, embeds: [welcomeEmbed], components: [row] });
        return interaction.editReply({ content: `✅ Ticket erstellt: <#${ticketCh.id}>` });
      }

      // ── Button: Ticket schließen anfordern ────────────────────────────────────
      if (interaction.isButton() && interaction.customId === 'ticket_close') {
        const tickets = loadTickets();
        const ticket  = tickets[interaction.channel?.id];
        if (!ticket) return interaction.reply({ content: '❌ Kein Ticket gefunden.', ephemeral: true });
        const canClose = hasTicketRights(interaction.member, ticket.type) || interaction.user.id === ticket.openerId;
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
        const ticket  = tickets[interaction.channel?.id];
        if (!ticket || ticket.closed) return interaction.reply({ content: '❌ Ticket bereits geschlossen.', ephemeral: true });
        const canClose = hasTicketRights(interaction.member, ticket.type) || interaction.user.id === ticket.openerId;
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
        const ticket = loadTickets()[interaction.channel?.id];
        if (!ticket) return interaction.reply({ content: '❌ Kein Ticket.', ephemeral: true });
        if (!hasTicketRights(interaction.member, ticket.type)) return interaction.reply({ content: '❌ Keine Berechtigung.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId('ticket_assign_modal').setTitle('Nutzer zuweisen');
        modal.addComponents(new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('assign_user_id').setLabel('Discord User ID').setStyle(TextInputStyle.Short).setPlaceholder('123456789012345678').setRequired(true)
        ));
        return interaction.showModal(modal);
      }

      // ── Modal: Nutzer zuweisen ────────────────────────────────────────────────
      if (interaction.isModalSubmit() && interaction.customId === 'ticket_assign_modal') {
        const userId = interaction.fields.getTextInputValue('assign_user_id').trim().replace(/[<@>]/g, '');
        if (!/^\d{17,20}$/.test(userId)) return interaction.reply({ content: '❌ Ungültige User ID.', ephemeral: true });
        const tickets = loadTickets();
        const ticket  = tickets[interaction.channel?.id];
        if (!ticket) return interaction.reply({ content: '❌ Kein Ticket.', ephemeral: true });
        try {
          await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
          if (!ticket.assignedUsers.includes(userId)) { ticket.assignedUsers.push(userId); saveTickets(tickets); }
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

    // Join-DM
    try {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('👋  Willkommen bei Paradise City Roleplay!')
        .setDescription(
          `Hey **${member.user.username}**, willkommen!\n\n` +
          `Nutze \`/\` im Chat um alle Befehle zu sehen.\n` +
          `Bei Fragen wende dich an unser Team. Viel Spaß! 🚗`
        )
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
        }
      }
    }
  
  if (message.author.bot || !message.guild) return;

    // ── 67 → 69 ──────────────────────────────────────────────────────────────
    if (message.content.includes('67')) {
      const newContent = message.content.replace(/67/g, '69');
      await message.delete().catch(() => {});
      await message.channel.send(`**${message.author.displayName}:** ${newContent}`).catch(() => {});
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
    if (warns[target.id].length >= 5)
      return interaction.reply({ content: '\u274C **' + target.username + '** hat bereits 5 Warns (Maximum).', ephemeral: true });
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
    const warnBars = ['\uD83D\uDFE5\u2B1B\u2B1B\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\u2B1B\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\u2B1B\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\u2B1B','\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5\uD83D\uDFE5'];
    try {
      const warnCh = await client.channels.fetch(PLAYER_WARN_CH).catch(() => null);
      if (warnCh) {
        const embed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('\uD83D\uDEA8  \u2501\u2501\u2501  V E R W A R N U N G  \u2501\u2501\u2501  \uD83D\uDEA8')
          .setDescription(
            '\u2501'.repeat(40) + '\n' +
            '**Ein Spieler hat eine offizielle Verwarnung erhalten.**\n' +
            '\u2501'.repeat(40)
          )
          .addFields(
            { name: '\uD83D\uDC64  Verwarnt',      value: '<@' + target.id + '>\n`' + target.username + '`', inline: true },
            { name: '\uD83D\uDEE1\uFE0F  Von',         value: '<@' + user.id + '>\n`' + user.tag + '`',       inline: true },
            { name: '\uD83D\uDD22  Warn ' + warnNum + ' / 5', value: warnBars[warnNum - 1],                        inline: true },
            { name: '\uD83D\uDCCB  Grund',          value: '```' + grund + '```',                           inline: false },
            { name: '\uD83C\uDFF7\uFE0F  Warn-Rolle',   value: '<@&' + roleId + '>',                              inline: true },
            { name: '\u23F0  Zeitpunkt',      value: '<t:' + Math.floor(Date.now()/1000) + ':f>',         inline: true },
          )
          .setFooter({ text: 'Paradise City Roleplay  \u2022  Verwarnungssystem' })
          .setTimestamp();
        await warnCh.send({ embeds: [embed] });
      }
    } catch (e) { console.error('Warn-Channel Fehler:', e.message); }
    return interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xFF0000)
        .setDescription('\uD83D\uDEA8 Warn **' + warnNum + '/5** f\u00FCr **' + target.username + '** ausgestellt.\n\uD83D\uDCCB Grund: ' + grund)],
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
      const ausweisData = loadAusweis();
      const eintrag     = ausweisData[user.id];
      if (!eintrag)
        return interaction.reply({ content: '❌ Du hast noch keinen Ausweis. Bitte reise zuerst legal ein.', ephemeral: true });
      const domain8 = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
        const viewLink = `https://${domain8}/ausweis/view/${user.id}`;
        return interaction.reply({
          content: `🆔 **Dein offizieller Ausweis:**
🔗 [${eintrag.vorname} ${eintrag.nachname} — Ausweis öffnen](${viewLink})
*Nur für dich sichtbar. Der Link ist dauerhaft gültig.*`,
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
      const target  = interaction.options.getUser('mitglied');
      const ausweise = loadAusweisData();
      if (ausweise[target.id]) {
        return interaction.reply({ content: `❌ **${target.tag}** hat bereits einen Ausweis. Erst mit `/ausweis-delete` löschen.`, ephemeral: true });
      }
      // Prüfe ob bereits ein Token aussteht
      const tokens = loadAusweisTokens();
      const pending = Object.values(tokens).find(t => t.userId === target.id && t.expiresAt > Date.now());
      if (pending) {
        return interaction.reply({ content: `❌ Für **${target.tag}** läuft bereits ein Erstellungslink. Token: \`${pending.token}\``, ephemeral: true });
      }
      const tok     = genToken();
      const domain  = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
      const link    = `https://${domain}/ausweis/create/${tok}`;
      tokens[tok]   = { token: tok, userId: target.id, userTag: target.tag, createdBy: interaction.user.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
      saveAusweisTokens(tokens);
      try {
        await target.send({
          embeds: [new EmbedBuilder()
            .setColor(DARK_ORANGE)
            .setTitle('🆔  Ausweis erstellen — Paradise City Roleplay')
            .setDescription('Du wurdest aufgefordert, deinen Charakter-Ausweis auszufüllen.')
            .addFields(
              { name: '🔗  Link', value: `[Hier klicken um Ausweis auszufüllen](${link})`, inline: false },
              { name: '⏱️  Gültig bis', value: `<t:${Math.floor((Date.now() + 86400000) / 1000)}:F>`, inline: false },
            )
            .setFooter({ text: 'Paradise City Roleplay  •  Ausweis-Erstellung' })
            .setTimestamp()]
        });
        return interaction.reply({ content: `✅ DM an **${target.tag}** gesendet mit dem Ausweis-Erstellungslink.`, ephemeral: true });
      } catch (e) {
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
      return interaction.reply({ content: `✅ Ausweis von **${target.tag}** wurde gelöscht.`, ephemeral: true });
    }
  

      // /ausweise
      if (commandName === 'ausweise') {
        const target = interaction.options.getUser('person');
        const ausweisData = loadAusweis();
        const eintrag     = ausweisData[target.id];
        if (!eintrag)
          return interaction.reply({ content: `❌ **${target.username}** hat noch keinen Ausweis.`, ephemeral: true });
        const domainAW = (process.env.REPLIT_DOMAINS || process.env.RAILWAY_PUBLIC_DOMAIN || 'localhost:8080').split(',')[0];
        const linkAW   = `https://${domainAW}/ausweis/view/${target.id}`;
        return interaction.reply({
          content: `🆔 **Ausweis von ${target.username}:**
🔗 [${eintrag.vorname} ${eintrag.nachname} — Ausweis öffnen](${linkAW})`,
          ephemeral: false
        });
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

});

// ─── ERROR HANDLERS ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

// ─── WEB SERVER ───────────────────────────────────────────────────────────────
require('./web')(client, DATA_DIR);

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
