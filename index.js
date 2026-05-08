const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionFlagsBits,
  AuditLogEvent,
  SlashCommandBuilder,
  REST,
  Routes,
  Colors,
} = require('discord.js');
const fs   = require('fs');
const path = require('path');

// ─── Datenspeicherung ─────────────────────────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
const WARN_FILE     = path.join(DATA_DIR, 'teamwarns.json');
const INVITES_FILE  = path.join(DATA_DIR, 'invites.json');

if (!fs.existsSync(DATA_DIR))     fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(WARN_FILE))    fs.writeFileSync(WARN_FILE,    '{}', 'utf8');
if (!fs.existsSync(INVITES_FILE)) fs.writeFileSync(INVITES_FILE, '{}', 'utf8');

function loadWarns()    { try { return JSON.parse(fs.readFileSync(WARN_FILE,    'utf8')); } catch { return {}; } }
function saveWarns(d)   { fs.writeFileSync(WARN_FILE,    JSON.stringify(d, null, 2), 'utf8'); }
function loadInvites()  { try { return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8')); } catch { return {}; } }
function saveInvites(d) { fs.writeFileSync(INVITES_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// Invite-Cache: guildId -> Map<code, { uses, inviterId, inviterTag }>
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
};

const DARK_ORANGE  = 0xE65100;
const EXEMPT_ROLE  = '1490855646558556282';
const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9\-]+/gi;

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
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
function isExempt(member) {
  return member?.roles?.cache?.has(EXEMPT_ROLE) || member?.permissions?.has(PermissionFlagsBits.Administrator);
}
async function sendLog(channelId, embed) {
  try {
    const ch = await client.channels.fetch(channelId);
    if (ch) await ch.send({ embeds: [embed] });
  } catch (e) { console.error(`Log-Kanal ${channelId} nicht erreichbar:`, e.message); }
}
async function getAuditEntry(guild, actionType, delay = 1500) {
  await new Promise(r => setTimeout(r, delay));
  try {
    const logs = await guild.fetchAuditLogs({ type: actionType, limit: 1 });
    return logs.entries.first();
  } catch { return null; }
}
function ts(date = new Date()) { return Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function ordinal(n) { return `${n}.`; }

// ─── Invite-Cache ─────────────────────────────────────────────────────────────
// Stores a plain object per code so we can compare uses after a member joins
async function buildInviteCache(guild) {
  try {
    const fetched = await guild.invites.fetch();
    const map = new Map();
    for (const inv of fetched.values()) {
      map.set(inv.code, {
        uses:       inv.uses ?? 0,
        inviterId:  inv.inviter?.id   ?? null,
        inviterTag: inv.inviter?.tag  ?? 'Unbekannt',
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
        opt.setName('anzahl').setDescription('Anzahl der Nachrichten (1–200)')
          .setRequired(true).setMinValue(1).setMaxValue(200))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn')
      .setDescription('Erteilt einem Teammitglied eine offizielle Team Warn')
      .addUserOption(opt =>
        opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .addStringOption(opt =>
        opt.setName('grund').setDescription('Grund der Verwarnung').setRequired(true))
      .addStringOption(opt =>
        opt.setName('konsequenz').setDescription('Konsequenz bei Wiederholung').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-remove')
      .setDescription('Entfernt die letzte Team Warn eines Teammitglieds')
      .addUserOption(opt =>
        opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .toJSON(),

    new SlashCommandBuilder()
      .setName('teamwarn-list')
      .setDescription('Zeigt alle Team Warns eines Nutzers')
      .addUserOption(opt =>
        opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
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
});

// ─── INVITE EVENTS ────────────────────────────────────────────────────────────
client.on('inviteCreate', async (invite) => { await buildInviteCache(invite.guild); });
client.on('inviteDelete', async (invite) => { await buildInviteCache(invite.guild); });
client.on('guildCreate',  async (guild)  => { await buildInviteCache(guild); });

// ─── MEMBER ADD ───────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (!member.user.bot) {

    // ── Auto-Rolle ──────────────────────────────────────────────────────────
    try { await member.roles.add('1490855725516460234'); }
    catch (e) { console.error('Auto-Rolle Fehler:', e.message); }

    // ── Invite-Tracking ─────────────────────────────────────────────────────
    // Snapshot the OLD cache before refreshing
    const oldCache = inviteCache.get(member.guild.id) ?? new Map();
    const newCache = await buildInviteCache(member.guild);

    let inviterId   = null;
    let inviterTag  = 'Unbekannt';
    let inviteCode  = '—';
    let totalInvites = 0;

    // Find the invite whose uses count increased
    for (const [code, newInv] of newCache) {
      const oldInv = oldCache.get(code);
      const oldUses = oldInv?.uses ?? 0;
      if (newInv.uses > oldUses) {
        inviteCode  = code;
        inviterId   = newInv.inviterId;
        inviterTag  = newInv.inviterTag;
        break;
      }
    }

    // Persist and count
    if (inviterId) {
      const invData = loadInvites();
      if (!invData[member.guild.id])              invData[member.guild.id] = {};
      if (!invData[member.guild.id][inviterId])   invData[member.guild.id][inviterId] = { tag: inviterTag, count: 0, users: {} };
      invData[member.guild.id][inviterId].count += 1;
      invData[member.guild.id][inviterId].users[member.id] = {
        tag:       member.user.tag,
        joinedAt:  new Date().toISOString(),
        inviteCode,
      };
      totalInvites = invData[member.guild.id][inviterId].count;
      saveInvites(invData);
    }

    const inviterMention = inviterId ? `<@${inviterId}>` : 'Unbekannt';
    const memberCount    = member.guild.memberCount;

    // ── Willkommens-Embed ───────────────────────────────────────────────────
    const welcomeEmbed = new EmbedBuilder()
      .setColor(DARK_ORANGE)
      .setAuthor({ name: 'Paradise City Roleplay — Willkommen!' })
      .setTitle(`🎉  Willkommen, ${member.user.username}!`)
      .setDescription(
        `Hey <@${member.id}>, schön dass du dabei bist!\n` +
        `Du bist unser **${memberCount}. Mitglied** auf dem Server. 🚗\n\n` +
        `Schau dir die Regeln an und viel Spaß bei uns!`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '👤  Nutzer',          value: `<@${member.id}>`,  inline: true  },
        { name: '📅  Beigetreten',     value: `<t:${ts()}:R>`,    inline: true  },
        { name: '📨  Eingeladen von',  value: inviterMention,     inline: true  },
        { name: '🏅  Mitglied Nr.',    value: `**${memberCount}**`, inline: true },
        { name: '📆  Account seit',    value: `<t:${ts(member.user.createdAt)}:D>`, inline: true },
        { name: '\u200b',              value: '\u200b',           inline: true  },
      )
      .setFooter({ text: 'Paradise City Roleplay  •  Viel Spaß auf dem Server!' })
      .setTimestamp();

    try {
      const welcomeCh = await client.channels.fetch(CH.WELCOME);
      if (welcomeCh) await welcomeCh.send({ embeds: [welcomeEmbed] });
    } catch (e) { console.error('Welcome Fehler:', e.message); }

    // ── Join-DM ─────────────────────────────────────────────────────────────
    try {
      await member.send({ embeds: [new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('👋  Willkommen bei Paradise City Roleplay!')
        .setDescription(
          `Hey **${member.user.username}**, schön dass du unserem Server beigetreten bist!\n\n` +
          `**Wichtige Info:**\n` +
          `Auf unserem Server werden **Slash-Commands** verwendet.\n` +
          `Tippe einfach \`/\` in den Chat um alle verfügbaren Befehle zu sehen.\n\n` +
          `Bei Fragen kannst du dich gerne an unser Team wenden. Viel Spaß! 🚗`
        )
        .setThumbnail(member.guild.iconURL({ dynamic: true }))
        .setFooter({ text: 'Paradise City Roleplay' })
        .setTimestamp()
      ]});
    } catch { /* DMs deaktiviert */ }

    // ── Invite-Log ──────────────────────────────────────────────────────────
    try {
      const invLogCh = await client.channels.fetch(CH.INVITE_LOG);
      if (invLogCh) await invLogCh.send({ embeds: [new EmbedBuilder()
        .setColor(0x43A047)
        .setAuthor({ name: '➕  Mitglied beigetreten' })
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤  Mitglied',             value: `<@${member.id}>\n\`${member.user.tag}\``, inline: true },
          { name: '📨  Eingeladen von',        value: inviterId ? `<@${inviterId}>\n\`${inviterTag}\`` : 'Unbekannt',       inline: true },
          { name: '🔗  Code',                  value: `\`${inviteCode}\``,   inline: true },
          { name: '📅  Beigetreten',           value: `<t:${ts()}:F>`,       inline: false },
          { name: '🏆  Einladungen (gesamt)',  value: inviterId ? `**${totalInvites}**` : '—', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
      ]});
    } catch (e) { console.error('Invite-Log Fehler:', e.message); }

    // ── Member-Log ──────────────────────────────────────────────────────────
    await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('✅ Mitglied beigetreten')
      .setDescription(`<@${member.id}> (${member.user.tag}) hat den Server betreten.`)
      .addFields(
        { name: 'Mitglied',         value: `<@${member.id}>`, inline: true },
        { name: 'Account erstellt', value: `<t:${ts(member.user.createdAt)}:R>`, inline: true }
      )
      .setThumbnail(member.user.displayAvatarURL()).setTimestamp()
    );
    return;
  }

  // ── Fremder Bot ─────────────────────────────────────────────────────────────
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
        { name: 'Bot',             value: `${member.user.tag} (${member.id})`, inline: true },
        { name: 'Hinzugefügt von', value: inviter ? `${inviter.tag} (${inviter.id})` : 'Unbekannt', inline: true },
        { name: 'Aktion',          value: '✅ Bot wurde permanent gebannt' },
        { name: 'Zeitpunkt',       value: `<t:${ts()}:F>` }
      ).setTimestamp()
    );
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🔨 Automatischer Bann — Bot')
      .addFields(
        { name: 'Bot',             value: `${member.user.tag} (${member.id})` },
        { name: 'Eingeladen von',  value: inviter ? `${inviter.tag}` : 'Unbekannt' },
        { name: 'Grund',           value: 'Fremder Bot hinzugefügt' }
      ).setTimestamp()
    );
  } catch (e) { console.error('Bot-Bann Fehler:', e.message); }
});

// ─── MEMBER REMOVE ────────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;

  // Invite-Daten nachschlagen
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

  // ── Aufwiedersehens-Embed ───────────────────────────────────────────────────
  const goodbyeEmbed = new EmbedBuilder()
    .setColor(DARK_ORANGE)
    .setAuthor({ name: 'Paradise City Roleplay — Auf Wiedersehen!' })
    .setTitle(`👋  Tschüss, ${member.user.username}!`)
    .setDescription(
      `**${member.user.tag}** hat den Server verlassen.\nWir hoffen dich bald wieder zu sehen! 🚗`
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
    .addFields(
      { name: '👤  Nutzer',          value: `${member.user.tag}`,                                          inline: true  },
      { name: '🚪  Verlassen',       value: `<t:${ts()}:R>`,                                               inline: true  },
      { name: '📨  Eingeladen von',  value: inviterMention,                                                inline: true  },
      { name: '📅  Beigetreten am',  value: joinedAt ? `<t:${ts(joinedAt)}:D>` : 'Unbekannt',             inline: true  },
      { name: '⏱️  War dabei für',   value: joinedAt ? `<t:${ts(joinedAt)}:R>` : 'Unbekannt',             inline: true  },
      { name: '\u200b',              value: '\u200b',                                                      inline: true  },
    )
    .setFooter({ text: 'Paradise City Roleplay  •  Auf Wiedersehen!' })
    .setTimestamp();

  try {
    const goodbyeCh = await client.channels.fetch(CH.GOODBYE);
    if (goodbyeCh) await goodbyeCh.send({ embeds: [goodbyeEmbed] });
  } catch (e) { console.error('Goodbye Fehler:', e.message); }

  // ── Invite-Log (Verlassen) ──────────────────────────────────────────────────
  try {
    const invLogCh = await client.channels.fetch(CH.INVITE_LOG);
    if (invLogCh) await invLogCh.send({ embeds: [new EmbedBuilder()
      .setColor(0xE53935)
      .setAuthor({ name: '➖  Mitglied verlassen' })
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤  Mitglied',              value: `${member.user.tag}`,                                  inline: true },
        { name: '📨  War eingeladen von',    value: inviterId ? `<@${inviterId}>\n\`${inviterTag}\`` : 'Unbekannt', inline: true },
        { name: '🔗  Code',                  value: `\`${inviteCode}\``,                                   inline: true },
        { name: '📅  Beigetreten am',        value: joinedAt ? `<t:${ts(joinedAt)}:F>` : 'Unbekannt',     inline: false },
        { name: '📉  Einladungen verbleibend', value: inviterId ? `**${remainingCount}**` : '—',           inline: true },
      )
      .setTimestamp()
      .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
    ]});
  } catch (e) { console.error('Invite-Log (Leave) Fehler:', e.message); }

  // ── Member-Log ──────────────────────────────────────────────────────────────
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
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;
  const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);

  if (message.content.toLowerCase() === '!hallo') {
    await message.reply(`👋 Hallo ${message.author.username}! Willkommen bei **Paradise City Roleplay**!`);
    return;
  }

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

  if (!isExempt(member)) {
    const userId = message.author.id;
    if (!spamTracker.has(userId)) spamTracker.set(userId, { msgs: [], violations: 0, windowTimer: null });
    const tracker = spamTracker.get(userId);
    tracker.msgs.push(message);
    if (tracker.windowTimer) clearTimeout(tracker.windowTimer);
    tracker.windowTimer = setTimeout(() => {
      if (spamTracker.has(userId)) spamTracker.get(userId).msgs = [];
    }, SPAM_WINDOW_MS);
    if (tracker.msgs.length >= SPAM_LIMIT) {
      const toDelete = [...tracker.msgs];
      tracker.msgs = [];
      tracker.violations += 1;
      for (const msg of toDelete) await msg.delete().catch(() => {});
      const warn = await message.channel.send({ content: `<@${userId}> ⚠️ Zu viele Nachrichten auf einmal!` });
      setTimeout(() => warn.delete().catch(() => {}), 5000);
      if (tracker.violations >= SPAM_TIMEOUT_VIOLATIONS) {
        tracker.violations = 0;
        if (member) {
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
  }
});

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
        { name: '👤  Verwarnt',          value: `<@${target.id}>\n\`${target.tag}\``, inline: true },
        { name: '🛡️  Ausgestellt von',  value: `<@${user.id}>\n\`${user.tag}\``,    inline: true },
        { name: '🔢  Verwarnung Nr.',    value: `\`${warnCount}\``,                  inline: true },
        { name: '\u200b', value: `${'━'.repeat(38)}`, inline: false },
        { name: '📋  Grund',            value: `> ${grund}`,                         inline: false },
        { name: '⚡  Konsequenz',       value: `> ${konsequenz}`,                    inline: false },
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
        .setDescription(`✅ Letzte Team Warn von **${target.tag}** wurde entfernt.\n📋 Grund war: ${removed.grund}`)],
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
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
client.login(process.env.DISCORD_TOKEN);
