const { Events, MessageFlags, ContainerBuilder, TextDisplayBuilder, Colors } = require('discord.js');
const { log } = require('../utils/logger');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
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
                        const errorContainer = new ContainerBuilder()
                            .setColor(Colors.Red)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent('Something went wrong processing this interaction.'));

                        if (!interaction.replied && !interaction.deferred) {
                             await interaction.reply({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                        }
                    }
                }
                return;
            }
        }

        // Handle Slash Commands
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

            const errorContainer = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('There was an error while executing this command!'));

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            } else {
                await interaction.reply({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }
        }
    },
};
