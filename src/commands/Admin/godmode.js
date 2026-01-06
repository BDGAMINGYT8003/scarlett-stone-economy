const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db.js');
const { parseDuration } = require('../../utils/timeParser.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('godmode')
        .setDescription('Grant God Mode (No Cooldowns) to a user. Developer Only.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to grant God Mode to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Duration (e.g. 1h, 2d). Leave empty for permanent.')
                .setRequired(false)),

    async execute(interaction) {
        // Permissions Check
        if (interaction.user.id !== '794482283993235478') {
            const embed = new EmbedBuilder()
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Developer Command' });
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        const targetUser = interaction.options.getUser('user');
        const durationStr = interaction.options.getString('duration');
        let durationMs = 0;

        if (durationStr) {
            durationMs = parseDuration(durationStr);
            if (!durationMs) {
                return interaction.reply({ content: 'Invalid duration format.', flags: MessageFlags.Ephemeral });
            }
        }

        const durationText = durationMs ? durationStr : 'Permanent';

        // Confirmation UI
        const embed = new EmbedBuilder()
            .setTitle('God Mode Grant')
            .setDescription(`Are you sure you want to grant **God Mode** to ${targetUser}?\n\n**Duration:** ${durationText}\n**Effect:** Zero Cooldowns on ALL commands.`)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_godmode').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_godmode').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_godmode') {
                // Apply God Mode
                db.setGodMode(targetUser.id, durationMs);

                const successEmbed = new EmbedBuilder()
                    .setTitle('God Mode Activated')
                    .setDescription(`**God Mode** has been enabled for ${targetUser}.\n**Duration:** ${durationText}`)
                    .setColor(0x00FF00)
                    .setFooter({ text: 'With great power comes no cooldowns.' });

                // Notify User
                const notifyEmbed = new EmbedBuilder()
                    .setTitle('⚡ You are now a GOD ⚡')
                    .setDescription(`You have been granted **God Mode** by a developer!\n\n**What does this mean?**\nZero. Cooldowns. On. Everything.\n\n**Duration:** ${durationText}\n\nGo wild, but don't break the bot (please).`)
                    .setColor(0xFFD700) // Gold
                    .setFooter({ text: 'UNLIMITED POWER!' });

                try {
                    await targetUser.send({ embeds: [notifyEmbed] });
                } catch (e) {
                    // Ignore DM failures
                }

                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Cancelled')
                    .setDescription('God Mode grant cancelled.')
                    .setColor(0xFF0000);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    }
};
