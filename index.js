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

function loadWarns()   { try { return JSON.parse(fs.readFileSync(WARN_FILE,    'utf8')); } catch { return {}; } }
function saveWarns(d)  { fs.writeFileSync(WARN_FILE,    JSON.stringify(d, null, 2), 'utf8'); }
function loadInvites() { try { return JSON.parse(fs.readFileSync(INVITES_FILE, 'utf8')); } catch { return {}; } }
function saveInvites(d){ fs.writeFileSync(INVITES_FILE, JSON.stringify(d, null, 2), 'utf8'); }

// In-memory invite cache: guildId -> Collection<code, Invite>
const inviteCache = new Map();

// ─── Kanal-IDs ───────────────────────────────────────────────────────────────
const CH = {
  ACTIVITY:     '1497385121324732567',
  SERVER_LOG:   '1490878131240829028',
  MOD_LOG:      '1490878132230819840',
  RESTART_LOG:  '1490878133279264842',
  MEMBER_LOG:   '1490878134847930368',
  MSG_LOG:      '1490878135837917234',
  ROLE_LOG:     '1490878137385619598',
  TEAM_WARN:    '1490878144146833450',
  WELCOME:      '1490878151897911557',
  GOODBYE:      '1490878154733260951',
  INVITE_LOG:   '1490878153391083683',
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
function timestamp(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Invite-Cache befüllen ────────────────────────────────────────────────────
async function cacheInvites(guild) {
  try {
    const invites = await guild.invites.fetch();
    inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i])));
  } catch (e) { console.error('Invite-Cache Fehler:', e.message); }
}

// ─── READY ───────────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Bot online als ${client.user.tag}`);

  // Invite-Cache für alle Server befüllen
  for (const guild of client.guilds.cache.values()) {
    await cacheInvites(guild);
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
      .setDescription('Entfernt eine Team Warn eines Teammitglieds')
      .addUserOption(opt =>
        opt.setName('nutzer').setDescription('Das Teammitglied').setRequired(true))
      .addStringOption(opt =>
        opt.setName('verwarnung').setDescription('Verwarnung auswählen').setRequired(true).setAutocomplete(true))
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
    .setDescription(`Bot ${client.user.tag} ist wieder online.`)
    .addFields({ name: 'Zeitpunkt', value: `<t:${timestamp()}:F>` })
    .setTimestamp()
  );
});

// ─── INVITE EVENTS ────────────────────────────────────────────────────────────
client.on('inviteCreate', async (invite) => { await cacheInvites(invite.guild); });
client.on('inviteDelete', async (invite) => { await cacheInvites(invite.guild); });

// ─── MEMBER ADD ───────────────────────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  if (!member.user.bot) {
    // ── Auto-Rolle ──────────────────────────────────────────────────────────
    try { await member.roles.add('1490855725516460234'); }
    catch (e) { console.error('Auto-Rolle Fehler:', e.message); }

    // ── Invite erkennen ─────────────────────────────────────────────────────
    let inviterTag   = 'Unbekannt';
    let inviterMention = 'Unbekannt';
    let inviteCode   = '—';
    let inviterCount = 0;

    try {
      const oldInvites = inviteCache.get(member.guild.id) || new Map();
      await cacheInvites(member.guild);
      const newInvites = inviteCache.get(member.guild.id) || new Map();

      // Finde den benutzten Invite (uses erhöht)
      let usedInvite = null;
      for (const [code, invite] of newInvites) {
        const old = oldInvites.get(code);
        if (!old || invite.uses > old.uses) { usedInvite = invite; break; }
      }

      if (usedInvite) {
        inviteCode      = usedInvite.code;
        const inviter   = usedInvite.inviter;
        inviterTag      = inviter ? inviter.tag : 'Unbekannt';
        inviterMention  = inviter ? `<@${inviter.id}>` : 'Unbekannt';

        // Invite-Daten speichern
        const invData = loadInvites();
        if (!invData[member.guild.id]) invData[member.guild.id] = {};
        if (inviter) {
          if (!invData[member.guild.id][inviter.id]) {
            invData[member.guild.id][inviter.id] = { tag: inviter.tag, count: 0, users: {} };
          }
          invData[member.guild.id][inviter.id].count += 1;
          invData[member.guild.id][inviter.id].users[member.id] = {
            tag:       member.user.tag,
            joinedAt:  new Date().toISOString(),
            inviteCode,
          };
          inviterCount = invData[member.guild.id][inviter.id].count;
          saveInvites(invData);
        }
      }
    } catch (e) { console.error('Invite-Tracking Fehler:', e.message); }

    // ── Willkommens-Embed ───────────────────────────────────────────────────
    try {
      const welcomeCh = await client.channels.fetch(CH.WELCOME);
      if (welcomeCh) {
        await welcomeCh.send({ embeds: [new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('🎉  Willkommen bei Paradise City Roleplay!')
          .setDescription(
            `Hey ${member}, schön dass du da bist!\n` +
            `Du bist unser **${member.guild.memberCount}. Mitglied** — herzlich willkommen! 🚗`
          )
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
          .addFields(
            { name: '👤  Mitglied',       value: `${member.user.tag}`, inline: true },
            { name: '📅  Beigetreten',    value: `<t:${timestamp()}:R>`, inline: true },
            { name: '📨  Eingeladen von', value: inviterMention, inline: true },
          )
          .setImage('https://i.imgur.com/placeholder.png')
          .setFooter({ text: 'Paradise City Roleplay  •  Viel Spaß auf unserem Server!' })
          .setTimestamp()
        ]});
      }
    } catch (e) { console.error('Welcome-Embed Fehler:', e.message); }

    // ── Invite-Log ──────────────────────────────────────────────────────────
    try {
      const invLogCh = await client.channels.fetch(CH.INVITE_LOG);
      if (invLogCh) {
        await invLogCh.send({ embeds: [new EmbedBuilder()
          .setColor(DARK_ORANGE)
          .setTitle('📨  Neues Mitglied — Invite Tracker')
          .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
          .addFields(
            { name: '👤  Mitglied',         value: `${member.user.tag} (<@${member.id}>)`, inline: false },
            { name: '📨  Eingeladen von',    value: `${inviterTag} (${inviterMention})`,    inline: true  },
            { name: '🔗  Invite-Code',       value: `\`${inviteCode}\``,                    inline: true  },
            { name: '📅  Beigetreten',       value: `<t:${timestamp()}:F>`,                 inline: false },
            { name: '🏆  Einladungen gesamt', value: `**${inviterCount}** Einladung(en)`,   inline: true  },
          )
          .setTimestamp()
          .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
        ]});
      }
    } catch (e) { console.error('Invite-Log Fehler:', e.message); }

    // ── Member-Log ──────────────────────────────────────────────────────────
    await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('✅ Mitglied beigetreten')
      .setDescription(`${member.user.tag} hat den Server betreten.`)
      .addFields(
        { name: 'ID',               value: member.id, inline: true },
        { name: 'Account erstellt', value: `<t:${timestamp(member.user.createdAt)}:R>`, inline: true }
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
        { name: 'Bot',            value: `${member.user.tag} (${member.id})`, inline: true },
        { name: 'Hinzugefügt von', value: inviter ? `${inviter.tag} (${inviter.id})` : 'Unbekannt', inline: true },
        { name: 'Aktion',         value: '✅ Bot wurde permanent gebannt' },
        { name: 'Zeitpunkt',      value: `<t:${timestamp()}:F>` }
      ).setTimestamp()
    );
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🔨 Automatischer Bann — Bot')
      .addFields(
        { name: 'Bot',            value: `${member.user.tag} (${member.id})` },
        { name: 'Eingeladen von', value: inviter ? `${inviter.tag}` : 'Unbekannt' },
        { name: 'Grund',          value: 'Fremder Bot hinzugefügt' }
      ).setTimestamp()
    );
  } catch (e) { console.error('Bot-Bann Fehler:', e.message); }
});

// ─── MEMBER REMOVE ────────────────────────────────────────────────────────────
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;

  // ── Invite-Daten nachschlagen & aktualisieren ───────────────────────────────
  const invData      = loadInvites();
  const guildInvites = invData[member.guild.id] || {};
  let   inviterTag   = 'Unbekannt';
  let   inviterMention = 'Unbekannt';
  let   joinedAt     = null;
  let   inviteCode   = '—';
  let   newCount     = 0;

  for (const [inviterId, inviterData] of Object.entries(guildInvites)) {
    if (inviterData.users && inviterData.users[member.id]) {
      const userEntry  = inviterData.users[member.id];
      inviterTag       = inviterData.tag || 'Unbekannt';
      inviterMention   = `<@${inviterId}>`;
      joinedAt         = userEntry.joinedAt;
      inviteCode       = userEntry.inviteCode || '—';

      // Invite-Zähler verringern & Nutzer entfernen
      inviterData.count = Math.max(0, (inviterData.count || 1) - 1);
      newCount          = inviterData.count;
      delete inviterData.users[member.id];
      saveInvites(invData);
      break;
    }
  }

  // ── Aufwiedersehens-Embed ───────────────────────────────────────────────────
  try {
    const goodbyeCh = await client.channels.fetch(CH.GOODBYE);
    if (goodbyeCh) {
      await goodbyeCh.send({ embeds: [new EmbedBuilder()
        .setColor(DARK_ORANGE)
        .setTitle('👋  Auf Wiedersehen!')
        .setDescription(
          `**${member.user.tag}** hat den Server verlassen.\nWir hoffen, wir sehen dich bald wieder! 🚗`
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤  Mitglied',       value: member.user.tag,                                 inline: true },
          { name: '📅  Verlassen',      value: `<t:${timestamp()}:R>`,                          inline: true },
          { name: '📨  Eingeladen von', value: inviterMention,                                  inline: true },
          { name: '📅  Beigetreten am', value: joinedAt ? `<t:${timestamp(new Date(joinedAt))}:F>` : 'Unbekannt', inline: false },
        )
        .setFooter({ text: 'Paradise City Roleplay  •  Auf Wiedersehen!' })
        .setTimestamp()
      ]});
    }
  } catch (e) { console.error('Goodbye-Embed Fehler:', e.message); }

  // ── Invite-Log (Verlassen) ──────────────────────────────────────────────────
  try {
    const invLogCh = await client.channels.fetch(CH.INVITE_LOG);
    if (invLogCh) {
      await invLogCh.send({ embeds: [new EmbedBuilder()
        .setColor(0xFF5722)
        .setTitle('📤  Mitglied verlassen — Invite Tracker')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤  Mitglied',              value: `${member.user.tag} (<@${member.id}>)`, inline: false },
          { name: '📨  War eingeladen von',     value: `${inviterTag} (${inviterMention})`,    inline: true  },
          { name: '🔗  Invite-Code',            value: `\`${inviteCode}\``,                    inline: true  },
          { name: '📅  Beigetreten am',         value: joinedAt ? `<t:${timestamp(new Date(joinedAt))}:F>` : 'Unbekannt', inline: false },
          { name: '📉  Einladungen noch aktiv', value: `**${newCount}** Einladung(en)`,        inline: true  },
        )
        .setTimestamp()
        .setFooter({ text: 'Paradise City Roleplay  •  Invite Tracker' })
      ]});
    }
  } catch (e) { console.error('Invite-Log (Leave) Fehler:', e.message); }

  // ── Member-Log ──────────────────────────────────────────────────────────────
  await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
    .setColor(Colors.Orange).setTitle('👋 Mitglied verlassen')
    .setDescription(`${member.user.tag} hat den Server verlassen.`)
    .addFields({ name: 'ID', value: member.id })
    .setThumbnail(member.user.displayAvatarURL()).setTimestamp()
  );
});

// ─── MEMBER UPDATE ────────────────────────────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    await sendLog(CH.MEMBER_LOG, new EmbedBuilder()
      .setColor(Colors.Blue).setTitle('✏️ Nickname geändert')
      .addFields(
        { name: 'Mitglied',       value: `${newMember.user.tag} (${newMember.id})` },
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
        { name: 'Mitglied', value: `${newMember.user.tag} (${newMember.id})` },
        { name: 'Rollen',   value: addedRoles.map(r => r.name).join(', ') }
      ).setTimestamp()
    );
  }
  if (removedRoles.size > 0) {
    await sendLog(CH.ROLE_LOG, new EmbedBuilder()
      .setColor(Colors.Red).setTitle('🔴 Rolle(n) entfernt')
      .addFields(
        { name: 'Mitglied', value: `${newMember.user.tag} (${newMember.id})` },
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
        { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
        { name: 'Kanal',  value: `<#${message.channel.id}>` },
        { name: 'Inhalt', value: message.content.slice(0, 200) },
        { name: 'Aktion', value: '🗑️ Nachricht gelöscht, Team informiert' }
      ).setTimestamp()
    );
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Orange).setTitle('⚠️ Regelverstoß — Discord-Link')
      .addFields(
        { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
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
                { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
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
      { name: 'Autor',        value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unbekannt' },
      { name: 'Kanal',        value: `<#${message.channel.id}>` },
      { name: 'Inhalt',       value: message.content?.slice(0, 1000) || '_kein Text_' },
      { name: 'Gelöscht von', value: deleter ? `${deleter.tag}` : 'Nutzer selbst / unbekannt' }
    ).setTimestamp()
  );
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
  await sendLog(CH.MSG_LOG, new EmbedBuilder()
    .setColor(Colors.Yellow).setTitle('✏️ Nachricht bearbeitet')
    .addFields(
      { name: 'Nutzer',  value: `${newMsg.author.tag} (${newMsg.author.id})` },
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
      { name: 'Gelöscht von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
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
        { name: 'Nutzer', value: `${executor.tag} (${executor.id})` },
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
      { name: 'Erstellt von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
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
      { name: 'Bearbeitet von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' },
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
      { name: 'Erstellt von', value: executor ? `${executor.tag}` : 'Unbekannt' }
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
      { name: 'Gelöscht von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
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
        { name: 'Nutzer', value: `${executor.tag} (${executor.id})` },
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
      { name: 'Bearbeitet von', value: executor ? `${executor.tag}` : 'Unbekannt' },
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
          { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
          { name: 'Von',    value: `${entry.executor?.tag || 'Unbekannt'}` },
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
        { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
        { name: 'Von',    value: `${entry.executor?.tag || 'Unbekannt'}` },
        { name: 'Grund',  value: entry.reason || '_kein Grund_' }
      ).setTimestamp()
    );
  }
  if (entry.action === AuditLogEvent.MemberBanRemove) {
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('✅ Ban aufgehoben')
      .addFields(
        { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
        { name: 'Von',    value: `${entry.executor?.tag || 'Unbekannt'}` }
      ).setTimestamp()
    );
  }
  if ([AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete].includes(entry.action)) {
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Blurple).setTitle('🔒 Kanal-Rechte geändert')
      .addFields(
        { name: 'Kanal',        value: `<#${entry.targetId}>` },
        { name: 'Geändert von', value: `${entry.executor?.tag || 'Unbekannt'}` }
      ).setTimestamp()
    );
  }
});

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // Autocomplete
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'teamwarn-remove') {
      const target    = interaction.options.getUser('nutzer');
      const warnsData = loadWarns();
      const warns     = target ? (warnsData[target.id] || []) : [];
      const choices   = warns.map((w, i) => ({
        name:  `#${i + 1} — ${w.grund.slice(0, 80)}`,
        value: w.id,
      })).slice(0, 25);
      return interaction.respond(choices);
    }
    return;
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
        { name: 'Von',      value: `${user.tag} (${user.id})` },
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
    const warnEntry = {
      id:           generateId(),
      grund,
      konsequenz,
      moderator:    user.id,
      moderatorTag: user.tag,
      timestamp:    new Date().toISOString(),
    };
    warnsData[target.id].push(warnEntry);
    saveWarns(warnsData);
    const warnCount = warnsData[target.id].length;

    const warnEmbed = new EmbedBuilder()
      .setColor(0xD32F2F)
      .setTitle('🚨  Team Warn')
      .setDescription(
        `**Ein Teammitglied hat eine offizielle Verwarnung erhalten.**\n` +
        `${'━'.repeat(38)}`
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤  Verwarnt',           value: `<@${target.id}>\n\`${target.tag}\``, inline: true },
        { name: '🛡️  Ausgestellt von',   value: `<@${user.id}>\n\`${user.tag}\``,    inline: true },
        { name: '🔢  Verwarnung Nr.',     value: `\`${warnCount}\``,                  inline: true },
        { name: '\u200b', value: `${'━'.repeat(38)}`, inline: false },
        { name: '📋  Grund',             value: `> ${grund}`,                         inline: false },
        { name: '⚡  Konsequenz',        value: `> ${konsequenz}`,                    inline: false },
        { name: '\u200b', value: `${'━'.repeat(38)}`, inline: false },
      )
      .setTimestamp()
      .setFooter({ text: 'Paradise City Roleplay  •  Teamverwarnungssystem' });

    try {
      const warnCh = await client.channels.fetch(CH.TEAM_WARN);
      if (warnCh) await warnCh.send({ embeds: [warnEmbed] });
    } catch (e) { console.error('Team-Warn Kanal Fehler:', e.message); }

    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Orange).setTitle('📋 Team Warn ausgestellt')
      .addFields(
        { name: 'Mitglied',   value: `${target.tag} (${target.id})` },
        { name: 'Grund',      value: grund },
        { name: 'Konsequenz', value: konsequenz },
        { name: 'Von',        value: user.tag },
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
    const warnId    = interaction.options.getString('verwarnung');
    const warnsData = loadWarns();
    if (!warnsData[target.id] || warnsData[target.id].length === 0)
      return interaction.reply({ content: `⚠️ Keine Verwarnungen für ${target.tag} gefunden.`, ephemeral: true });
    const before = warnsData[target.id].length;
    warnsData[target.id] = warnsData[target.id].filter(w => w.id !== warnId);
    if (warnsData[target.id].length === before)
      return interaction.reply({ content: `❌ Verwarnung nicht gefunden.`, ephemeral: true });
    saveWarns(warnsData);
    await sendLog(CH.MOD_LOG, new EmbedBuilder()
      .setColor(Colors.Green).setTitle('🗑️ Team Warn entfernt')
      .addFields(
        { name: 'Mitglied',     value: `${target.tag} (${target.id})` },
        { name: 'Entfernt von', value: user.tag }
      ).setTimestamp()
    );
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Green)
        .setDescription(`✅ Team Warn von **${target.tag}** wurde entfernt.`)],
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
      `**${i + 1}.** 📋 **Grund:** ${w.grund}\n` +
      `⚡ **Konsequenz:** ${w.konsequenz}\n` +
      `🛡️ **Von:** ${w.moderatorTag} — <t:${Math.floor(new Date(w.timestamp).getTime() / 1000)}:R>`
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
