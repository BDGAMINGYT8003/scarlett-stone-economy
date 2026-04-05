const { Events } = require('discord.js');
const { log } = require('../utils/logger');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        log(`Ready! Logged in as ${client.user.tag}`, 'success');
        client.user.setActivity('Template Bot', { type: 4 });
    },
};
