require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { log } = require('./utils/logger');
const commandHandler = require('./handlers/commandHandler');
const eventHandler = require('./handlers/eventHandler');
const { startCron } = require('./utils/cron');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Load Events
eventHandler(client);

// Login and Load Commands
(async () => {
    try {
        if (!process.env.DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN is missing in environment variables.');
        }
        await client.login(process.env.DISCORD_TOKEN);

        // Register commands after login so we have access to client.application if needed,
        // though REST uses process.env.CLIENT_ID usually.
        // But here I passed client to commandHandler to set client.commands.
        // It's safer to call commandHandler here.
        await commandHandler(client);

        // Start Cron Jobs
        startCron();

    } catch (error) {
        log(error.message, 'error');
    }
})();
