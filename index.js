const { Client, GatewayIntentBits, Partials } = require('discord.js');

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', () => {
    console.log(`✅ Bot ist online als ${client.user.tag}`);
  });

  client.on('messageCreate', async (message) => {
    // Nachrichten von Bots ignorieren
    if (message.author.bot) return;

    if (message.content.toLowerCase() === '!hallo') {
      await message.reply(
        `👋 Hallo ${message.author.username}! Willkommen bei **Paradise City Roleplay**!`
      );
    }
  });

  client.login(process.env.DISCORD_TOKEN);
  