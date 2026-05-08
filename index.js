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

  // ─── Kanal-IDs ───────────────────────────────────────────────────────────────
  const CH = {
    ACTIVITY:    '1497385121324732567', // Bot-Warnungen & Regelverstoß-Embeds
    SERVER_LOG:  '1490878131240829028', // Kanal/Rollen/Rechte Änderungen
    MOD_LOG:     '1490878132230819840', // Timeouts, Bans, Verstöße
    RESTART_LOG: '1490878133279264842', // Bot-Neustarts
    MEMBER_LOG:  '1490878134847930368', // Beitritt, Verlassen, Nickänderung
    MSG_LOG:     '1490878135837917234', // Nachrichten gelöscht/bearbeitet
    ROLE_LOG:    '1490878137385619598', // Rollen vergeben/entfernt
  };

  // Ausgenommene Rolle (z.B. Admins)
  const EXEMPT_ROLE = '1490855646558556282';

  // Discord Invite Regex
  const INVITE_REGEX = /(discord\.(gg|io|me|li)|discordapp\.com\/invite)\/[a-zA-Z0-9\-]+/gi;

  // Spam-Tracker: userId -> { msgs: Message[], violations: number, windowTimer }
  const spamTracker = new Map();
  const SPAM_LIMIT     = 10;  // Nachrichten bevor Spam
  const SPAM_WINDOW_MS = 6000; // Zeitfenster in ms
  const SPAM_TIMEOUT_VIOLATIONS = 3; // Verstöße bis Timeout
  const SPAM_TIMEOUT_DURATION   = 10 * 60 * 1000; // 10 Minuten

  // ─── Client ──────────────────────────────────────────────────────────────────
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildIntegrations,
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
    } catch (e) {
      console.error(`Log-Kanal ${channelId} nicht erreichbar:`, e.message);
    }
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

  // ─── READY ───────────────────────────────────────────────────────────────────
  client.once('ready', async () => {
    console.log(`✅ Bot online als ${client.user.tag}`);

    // Slash Command /delete registrieren
    const commands = [
      new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Löscht Nachrichten in diesem Kanal (max. 200)')
        .addIntegerOption(opt =>
          opt.setName('anzahl')
            .setDescription('Anzahl der Nachrichten (1–200)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(200)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .toJSON()
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    for (const guild of client.guilds.cache.values()) {
      try {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands });
      } catch (e) {
        console.error('Slash Command Fehler:', e.message);
      }
    }

    // Bot-Neustart loggen
    const embed = new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('🔄 Bot neugestartet')
      .setDescription(`Bot ${client.user.tag} ist wieder online.`)
      .addFields({ name: 'Zeitpunkt', value: `<t:${timestamp()}:F>` })
      .setTimestamp();
    await sendLog(CH.RESTART_LOG, embed);
  });

  // ─── NEUER BOT BEIGETRETEN ────────────────────────────────────────────────────
  client.on('guildMemberAdd', async (member) => {
    if (!member.user.bot) {
      // Normales Mitglied beigetreten
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Mitglied beigetreten')
        .setDescription(`${member.user.tag} hat den Server betreten.`)
        .addFields(
          { name: 'ID', value: member.id, inline: true },
          { name: 'Account erstellt', value: `<t:${timestamp(member.user.createdAt)}:R>`, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();
      await sendLog(CH.MEMBER_LOG, embed);
      return;
    }

    // Bot beigetreten → Audit Log prüfen
    const entry = await getAuditEntry(member.guild, AuditLogEvent.BotAdd);
    const inviter = entry?.executor;

    try {
      // Bot perma-bannen
      await member.ban({ reason: '⛔ Unerlaubter Bot-Beitritt (automatisch gebannt)' });

      // DM an den Einlader
      if (inviter) {
        try {
          await inviter.send({
            embeds: [new EmbedBuilder()
              .setColor(Colors.Red)
              .setTitle('⛔ Aktion nicht erlaubt')
              .setDescription(
                'Du hast versucht einen fremden Bot auf **Paradise City Roleplay** hinzuzufügen.\n' +
                'Dies ist **nicht gestattet**. Der Bot wurde automatisch gebannt.'
              )
              .setTimestamp()
            ]
          });
        } catch {}
      }

      // Aktivitätswarnung
      const warnEmbed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🚨 Aktivitätswarnung — Fremder Bot')
        .addFields(
          { name: 'Bot', value: `${member.user.tag} (${member.id})`, inline: true },
          { name: 'Hinzugefügt von', value: inviter ? `${inviter.tag} (${inviter.id})` : 'Unbekannt', inline: true },
          { name: 'Aktion', value: '✅ Bot wurde permanent gebannt', inline: false },
          { name: 'Zeitpunkt', value: `<t:${timestamp()}:F>` }
        )
        .setTimestamp();
      await sendLog(CH.ACTIVITY, warnEmbed);

      // Mod-Log
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🔨 Automatischer Bann — Bot')
        .addFields(
          { name: 'Bot', value: `${member.user.tag} (${member.id})` },
          { name: 'Eingeladen von', value: inviter ? `${inviter.tag}` : 'Unbekannt' },
          { name: 'Grund', value: 'Fremder Bot hinzugefügt' }
        )
        .setTimestamp()
      );
    } catch (e) {
      console.error('Bot-Bann Fehler:', e.message);
    }
  });

  // ─── MITGLIED VERLASSEN ───────────────────────────────────────────────────────
  client.on('guildMemberRemove', async (member) => {
    if (member.user.bot) return;
    const embed = new EmbedBuilder()
      .setColor(Colors.Orange)
      .setTitle('👋 Mitglied verlassen')
      .setDescription(`${member.user.tag} hat den Server verlassen.`)
      .addFields({ name: 'ID', value: member.id })
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();
    await sendLog(CH.MEMBER_LOG, embed);
  });

  // ─── MITGLIED AKTUALISIERT (Nickname) ────────────────────────────────────────
  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    if (oldMember.nickname !== newMember.nickname) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Blue)
        .setTitle('✏️ Nickname geändert')
        .addFields(
          { name: 'Mitglied', value: `${newMember.user.tag} (${newMember.id})` },
          { name: 'Alter Nickname', value: oldMember.nickname || '_keiner_', inline: true },
          { name: 'Neuer Nickname', value: newMember.nickname || '_keiner_', inline: true }
        )
        .setTimestamp();
      await sendLog(CH.MEMBER_LOG, embed);
    }

    // Rollen-Änderungen
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('🟢 Rolle(n) vergeben')
        .addFields(
          { name: 'Mitglied', value: `${newMember.user.tag} (${newMember.id})` },
          { name: 'Rollen', value: addedRoles.map(r => r.name).join(', ') }
        )
        .setTimestamp();
      await sendLog(CH.ROLE_LOG, embed);
    }
    if (removedRoles.size > 0) {
      const embed = new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🔴 Rolle(n) entfernt')
        .addFields(
          { name: 'Mitglied', value: `${newMember.user.tag} (${newMember.id})` },
          { name: 'Rollen', value: removedRoles.map(r => r.name).join(', ') }
        )
        .setTimestamp();
      await sendLog(CH.ROLE_LOG, embed);
    }
  });

  // ─── NACHRICHTEN ─────────────────────────────────────────────────────────────
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const member = message.member || await message.guild.members.fetch(message.author.id).catch(() => null);

    // 1. !hallo Befehl
    if (message.content.toLowerCase() === '!hallo') {
      await message.reply(`👋 Hallo ${message.author.username}! Willkommen bei **Paradise City Roleplay**!`);
      return;
    }

    // 2. Discord-Invite-Link erkennen
    if (!isExempt(member) && INVITE_REGEX.test(message.content)) {
      INVITE_REGEX.lastIndex = 0;
      await message.delete().catch(() => {});

      // DM an den Nutzer
      try {
        await message.author.send({
          embeds: [new EmbedBuilder()
            .setColor(Colors.Red)
            .setTitle('⛔ Regelverstoß — Discord-Einladung')
            .setDescription(
              'Das Senden von Discord-Server-Einladungen ist auf **Paradise City Roleplay** nicht erlaubt.\n\n' +
              '⚠️ **Dein Verstoß wurde an das Serverteam weitergeleitet und wird sanktioniert.**'
            )
            .setTimestamp()
          ]
        });
      } catch {}

      // Aktivitätswarnung
      await sendLog(CH.ACTIVITY, new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('🚨 Aktivitätswarnung — Discord-Link')
        .addFields(
          { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
          { name: 'Kanal', value: `<#${message.channel.id}>` },
          { name: 'Inhalt (gekürzt)', value: message.content.slice(0, 200) },
          { name: 'Aktion', value: '🗑️ Nachricht gelöscht, Team informiert' }
        )
        .setTimestamp()
      );

      // Mod-Log
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('⚠️ Regelverstoß — Discord-Einladungslink')
        .addFields(
          { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
          { name: 'Kanal', value: `<#${message.channel.id}>` }
        )
        .setTimestamp()
      );
      return;
    }

    // 3. Spam-Erkennung
    if (!isExempt(member)) {
      const userId = message.author.id;
      if (!spamTracker.has(userId)) {
        spamTracker.set(userId, { msgs: [], violations: 0, windowTimer: null });
      }
      const tracker = spamTracker.get(userId);
      tracker.msgs.push(message);

      // Fenster-Timer zurücksetzen
      if (tracker.windowTimer) clearTimeout(tracker.windowTimer);
      tracker.windowTimer = setTimeout(() => {
        if (spamTracker.has(userId)) {
          spamTracker.get(userId).msgs = [];
        }
      }, SPAM_WINDOW_MS);

      if (tracker.msgs.length >= SPAM_LIMIT) {
        // Alle gespeicherten Nachrichten löschen
        const toDelete = [...tracker.msgs];
        tracker.msgs = [];
        tracker.violations += 1;

        for (const msg of toDelete) {
          await msg.delete().catch(() => {});
        }

        // Ephemere Warnung (nur für den Nutzer sichtbar)
        await message.channel.send({
          content: `<@${userId}> ⚠️ Zu viele Nachrichten auf einmal! Bitte sende nicht so schnell.`
        }).then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000));

        // Bei 3 Verstößen: 10min Timeout
        if (tracker.violations >= SPAM_TIMEOUT_VIOLATIONS) {
          tracker.violations = 0;
          if (member) {
            try {
              await member.timeout(SPAM_TIMEOUT_DURATION, 'Spam (3 Wiederholungen)');
              await sendLog(CH.MOD_LOG, new EmbedBuilder()
                .setColor(Colors.Red)
                .setTitle('⏱️ Timeout — Spam')
                .addFields(
                  { name: 'Nutzer', value: `${message.author.tag} (${message.author.id})` },
                  { name: 'Dauer', value: '10 Minuten' },
                  { name: 'Grund', value: '3x Spam-Verstöße' }
                )
                .setTimestamp()
              );
            } catch (e) {
              console.error('Timeout Fehler:', e.message);
            }
          }
        }
      }
    }
  });

  // ─── NACHRICHT GELÖSCHT ───────────────────────────────────────────────────────
  client.on('messageDelete', async (message) => {
    if (message.author?.bot) return;
    const entry = await getAuditEntry(message.guild, AuditLogEvent.MessageDelete);
    const deleter = entry?.executor;
    const embed = new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('🗑️ Nachricht gelöscht')
      .addFields(
        { name: 'Autor', value: message.author ? `${message.author.tag} (${message.author.id})` : 'Unbekannt' },
        { name: 'Kanal', value: `<#${message.channel.id}>` },
        { name: 'Inhalt', value: message.content?.slice(0, 1000) || '_kein Text_' },
        { name: 'Gelöscht von', value: deleter ? `${deleter.tag}` : 'Nutzer selbst / unbekannt' }
      )
      .setTimestamp();
    await sendLog(CH.MSG_LOG, embed);
  });

  // ─── NACHRICHT BEARBEITET ─────────────────────────────────────────────────────
  client.on('messageUpdate', async (oldMsg, newMsg) => {
    if (newMsg.author?.bot) return;
    if (oldMsg.content === newMsg.content) return;
    const embed = new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('✏️ Nachricht bearbeitet')
      .addFields(
        { name: 'Nutzer', value: `${newMsg.author.tag} (${newMsg.author.id})` },
        { name: 'Kanal', value: `<#${newMsg.channel.id}>` },
        { name: 'Vorher', value: oldMsg.content?.slice(0, 500) || '_unbekannt_' },
        { name: 'Nachher', value: newMsg.content?.slice(0, 500) || '_leer_' }
      )
      .setTimestamp();
    await sendLog(CH.MSG_LOG, embed);
  });

  // ─── KANAL GELÖSCHT ───────────────────────────────────────────────────────────
  client.on('channelDelete', async (channel) => {
    const entry = await getAuditEntry(channel.guild, AuditLogEvent.ChannelDelete);
    const executor = entry?.executor;

    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('🗑️ Kanal gelöscht')
      .addFields(
        { name: 'Kanal', value: channel.name },
        { name: 'Gelöscht von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
      )
      .setTimestamp()
    );

    if (!executor) return;
    const member = await channel.guild.members.fetch(executor.id).catch(() => null);
    if (!member || isExempt(member)) return;

    try {
      await member.timeout(20 * 60 * 1000, 'Kanal gelöscht (automatischer Timeout)');
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('⏱️ Timeout — Kanal gelöscht')
        .addFields(
          { name: 'Nutzer', value: `${executor.tag} (${executor.id})` },
          { name: 'Dauer', value: '20 Minuten' },
          { name: 'Grund', value: `Kanal **${channel.name}** gelöscht` }
        )
        .setTimestamp()
      );
    } catch (e) {
      console.error('Timeout Fehler (channelDelete):', e.message);
    }
  });

  // ─── KANAL ERSTELLT ───────────────────────────────────────────────────────────
  client.on('channelCreate', async (channel) => {
    const entry = await getAuditEntry(channel.guild, AuditLogEvent.ChannelCreate);
    const executor = entry?.executor;
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('➕ Kanal erstellt')
      .addFields(
        { name: 'Kanal', value: `<#${channel.id}> (${channel.name})` },
        { name: 'Erstellt von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
      )
      .setTimestamp()
    );
  });

  // ─── KANAL BEARBEITET ─────────────────────────────────────────────────────────
  client.on('channelUpdate', async (oldCh, newCh) => {
    const entry = await getAuditEntry(newCh.guild, AuditLogEvent.ChannelUpdate);
    const executor = entry?.executor;
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('✏️ Kanal bearbeitet')
      .addFields(
        { name: 'Kanal', value: `<#${newCh.id}>` },
        { name: 'Bearbeitet von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' },
        { name: 'Alter Name', value: oldCh.name, inline: true },
        { name: 'Neuer Name', value: newCh.name, inline: true }
      )
      .setTimestamp()
    );
  });

  // ─── ROLLE ERSTELLT ───────────────────────────────────────────────────────────
  client.on('roleCreate', async (role) => {
    const entry = await getAuditEntry(role.guild, AuditLogEvent.RoleCreate);
    const executor = entry?.executor;
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('➕ Rolle erstellt')
      .addFields(
        { name: 'Rolle', value: `${role.name} (${role.id})` },
        { name: 'Erstellt von', value: executor ? `${executor.tag}` : 'Unbekannt' }
      )
      .setTimestamp()
    );
  });

  // ─── ROLLE GELÖSCHT ───────────────────────────────────────────────────────────
  client.on('roleDelete', async (role) => {
    const entry = await getAuditEntry(role.guild, AuditLogEvent.RoleDelete);
    const executor = entry?.executor;

    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Red)
      .setTitle('🗑️ Rolle gelöscht')
      .addFields(
        { name: 'Rolle', value: role.name },
        { name: 'Gelöscht von', value: executor ? `${executor.tag} (${executor.id})` : 'Unbekannt' }
      )
      .setTimestamp()
    );

    if (!executor) return;
    const member = await role.guild.members.fetch(executor.id).catch(() => null);
    if (!member || isExempt(member)) return;

    try {
      await member.timeout(20 * 60 * 1000, 'Rolle gelöscht (automatischer Timeout)');
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Red)
        .setTitle('⏱️ Timeout — Rolle gelöscht')
        .addFields(
          { name: 'Nutzer', value: `${executor.tag} (${executor.id})` },
          { name: 'Dauer', value: '20 Minuten' },
          { name: 'Grund', value: `Rolle **${role.name}** gelöscht` }
        )
        .setTimestamp()
      );
    } catch (e) {
      console.error('Timeout Fehler (roleDelete):', e.message);
    }
  });

  // ─── ROLLE BEARBEITET ─────────────────────────────────────────────────────────
  client.on('roleUpdate', async (oldRole, newRole) => {
    const entry = await getAuditEntry(newRole.guild, AuditLogEvent.RoleUpdate);
    const executor = entry?.executor;
    await sendLog(CH.SERVER_LOG, new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('✏️ Rolle bearbeitet')
      .addFields(
        { name: 'Rolle', value: `${newRole.name} (${newRole.id})` },
        { name: 'Bearbeitet von', value: executor ? `${executor.tag}` : 'Unbekannt' },
        { name: 'Alter Name', value: oldRole.name, inline: true },
        { name: 'Neuer Name', value: newRole.name, inline: true }
      )
      .setTimestamp()
    );
  });

  // ─── TIMEOUT / BAN AUDIT LOG ──────────────────────────────────────────────────
  client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    if (entry.action === AuditLogEvent.MemberUpdate) {
      const timeoutChange = entry.changes?.find(c => c.key === 'communication_disabled_until');
      if (timeoutChange && timeoutChange.newValue) {
        await sendLog(CH.MOD_LOG, new EmbedBuilder()
          .setColor(Colors.Orange)
          .setTitle('⏱️ Timeout vergeben')
          .addFields(
            { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
            { name: 'Von', value: `${entry.executor?.tag || 'Unbekannt'}` },
            { name: 'Bis', value: `<t:${Math.floor(new Date(timeoutChange.newValue).getTime() / 1000)}:F>` },
            { name: 'Grund', value: entry.reason || '_kein Grund_' }
          )
          .setTimestamp()
        );
      }
    }

    if (entry.action === AuditLogEvent.MemberBanAdd) {
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.DarkRed)
        .setTitle('🔨 Ban vergeben')
        .addFields(
          { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
          { name: 'Von', value: `${entry.executor?.tag || 'Unbekannt'}` },
          { name: 'Grund', value: entry.reason || '_kein Grund_' }
        )
        .setTimestamp()
      );
    }

    if (entry.action === AuditLogEvent.MemberBanRemove) {
      await sendLog(CH.MOD_LOG, new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle('✅ Ban aufgehoben')
        .addFields(
          { name: 'Nutzer', value: `${entry.target?.tag || entry.targetId}` },
          { name: 'Von', value: `${entry.executor?.tag || 'Unbekannt'}` }
        )
        .setTimestamp()
      );
    }

    // Rechte-Änderungen loggen
    if ([AuditLogEvent.ChannelOverwriteCreate, AuditLogEvent.ChannelOverwriteUpdate, AuditLogEvent.ChannelOverwriteDelete].includes(entry.action)) {
      await sendLog(CH.SERVER_LOG, new EmbedBuilder()
        .setColor(Colors.Blurple)
        .setTitle('🔒 Kanal-Rechte geändert')
        .addFields(
          { name: 'Kanal', value: `<#${entry.targetId}>` },
          { name: 'Geändert von', value: `${entry.executor?.tag || 'Unbekannt'}` }
        )
        .setTimestamp()
      );
    }
  });

  // ─── SLASH COMMAND /delete ────────────────────────────────────────────────────
  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'delete') {
      const anzahl = interaction.options.getInteger('anzahl');
      const member = interaction.member;

      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '⛔ Du hast keine Berechtigung dafür.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      let deleted = 0;
      let remaining = anzahl;

      while (remaining > 0) {
        const batch = Math.min(remaining, 100);
        const msgs = await interaction.channel.bulkDelete(batch, true).catch(() => null);
        if (!msgs || msgs.size === 0) break;
        deleted += msgs.size;
        remaining -= msgs.size;
        if (msgs.size < batch) break;
      }

      await interaction.editReply({ content: `✅ ${deleted} Nachrichten wurden gelöscht.` });

      await sendLog(CH.SERVER_LOG, new EmbedBuilder()
        .setColor(Colors.Orange)
        .setTitle('🗑️ /delete Befehl ausgeführt')
        .addFields(
          { name: 'Von', value: `${interaction.user.tag} (${interaction.user.id})` },
          { name: 'Kanal', value: `<#${interaction.channel.id}>` },
          { name: 'Gelöscht', value: `${deleted} Nachrichten` }
        )
        .setTimestamp()
      );
    }
  });

  // ─── LOGIN ────────────────────────────────────────────────────────────────────
  client.login(process.env.DISCORD_TOKEN);
  