const { Events } = require('discord.js');
const { log } = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            log(`No command matching ${interaction.commandName} was found.`, 'error');
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            log(`Error executing ${interaction.commandName}`, 'error');
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }
    },
};
