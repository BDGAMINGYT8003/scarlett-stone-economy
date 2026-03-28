const { Events, MessageFlags } = require('discord.js');
const { log } = require('../utils/logger');
const db = require('../utils/db');
const { checkAndUnlockBadges } = require('../utils/badgeManager');
const { checkAndUnlockAchievements } = require('../utils/achievementManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // 2025 Badge Tracking
        if (interaction.isChatInputCommand()) {
            const today = new Date();
            if (today.getFullYear() === 2025 && today.getMonth() === 11 && today.getDate() === 31) {
                // Ensure user row exists and set flag
                const user = db.getUser(interaction.user.id);
                if (!user.used_2025_last_day) {
                    db.setStat(interaction.user.id, 'used_2025_last_day', 1);
                    await checkAndUnlockBadges(interaction.user.id, interaction);
                }
            }
        }

        // Handle Autocomplete
        if (interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.autocomplete(interaction);
            } catch (error) {
                console.error(error);
            }
            return;
        }

        // Handle Buttons and Modals for Slots, SnakeEyes, etc.
        if (interaction.isButton() || interaction.isModalSubmit()) {
            let commandName = null;

            if (interaction.customId.startsWith('slots_')) {
                commandName = 'slots';
            } else if (interaction.customId.startsWith('snakeeyes_')) {
                commandName = 'snakeeyes';
            }

            if (commandName) {
                const command = interaction.client.commands.get(commandName);
                if (command) {
                    try {
                        if (interaction.isButton()) {
                            await command.handleButton(interaction);
                        } else {
                            await command.handleModal(interaction);
                        }
                    } catch (error) {
                        console.error(error);
                        if (!interaction.replied && !interaction.deferred) {
                             await interaction.reply({ content: 'Something went wrong processing this interaction.', flags: MessageFlags.Ephemeral });
                        }
                    }
                }
                return;
            }
        }

        // Handle Slash Commands
        if (!interaction.isChatInputCommand()) return;

        // Increment Commands Run Stat
        db.incrementStat(interaction.user.id, 'commands_ran');
        db.incrementCommandUsage(interaction.user.id, interaction.commandName);
        await checkAndUnlockAchievements(interaction.user.id, interaction);

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
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
    },
};
