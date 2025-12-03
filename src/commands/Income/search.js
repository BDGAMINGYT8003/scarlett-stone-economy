const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const locations = require('../../config/locations.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search a location for coins or items.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'search', 25);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('search', cooldown.readyAt, 25, 10)]
            });
        }

        // Check Safety Lock
        if (!acquireLock(userId)) {
             const lockEmbed = new EmbedBuilder()
                .setTitle('Hold tight')
                .setDescription('You are unable to interact with this because there is an active ongoing command you are already using or a minor issue occurred. It should unlock itself in about 30 seconds. Please finish any open commands or try again after 30 seconds.\nIf you keep getting this message from the same interaction, please report it to our support server so we can fix it.');
            return interaction.reply({ embeds: [lockEmbed], ephemeral: true });
        }

        // Select 3 random unique locations
        const shuffled = [...locations].sort(() => 0.5 - Math.random());
        const selectedLocations = shuffled.slice(0, 3);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('**Where do you want to search?**')
            .setDescription('*Pick an option below to start searching that location!*');

        const buttons = selectedLocations.map(loc =>
            new ButtonBuilder()
                .setCustomId(`search_${loc.id}`)
                .setLabel(loc.name)
                .setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

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
                return i.reply({ content: 'This is not your search session!', ephemeral: true });
            }

            const locationId = i.customId.replace('search_', '');
            const location = selectedLocations.find(l => l.id === locationId);

            if (!location) return;

            // Determine Outcome
            const isSuccess = Math.random() * 100 < location.success_chance;
            let amount = 0;
            let message = "";
            let outcomeType = isSuccess ? 'success' : 'fail';

            // Select random outcome message
            const outcomes = location.outcomes[outcomeType];
            message = outcomes[Math.floor(Math.random() * outcomes.length)];

            if (isSuccess) {
                amount = Math.floor(Math.random() * (location.max_coins - location.min_coins + 1)) + location.min_coins;
                db.addBalance(userId, amount);
                message = message.replace('{amount}', amount.toLocaleString());
            }

            // Set Cooldown on successful interaction
            setDurationCooldown(userId, 'search', 25);

            // Update UI
            const updatedButtons = buttons.map(btn => {
                const isSelected = btn.data.custom_id === i.customId;
                btn.setDisabled(true);
                if (isSelected) {
                    btn.setStyle(isSuccess ? ButtonStyle.Success : ButtonStyle.Danger);
                }
                return btn;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            const resultEmbed = new EmbedBuilder()
                .setColor(isSuccess ? 0x00FF00 : 0xFF0000)
                .setTitle(`${interaction.user.username} searched the ${location.name}`)
                .setDescription(message)
                .setFooter({ text: isSuccess ? "Lucky you!" : "Better luck next time." });

            await i.update({
                embeds: [resultEmbed],
                components: [updatedRow]
            });

            collector.stop('user_interaction');
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'user_interaction' && reason !== 'messageDelete') {
                // Set Cooldown on timeout
                setDurationCooldown(userId, 'search', 25);

                // If timed out, disable buttons and show message
                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.map(btn => btn.setDisabled(true))
                );

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('So quiet...')
                    .setDescription(`Guess <@${userId}> did not want to search anywhere?`);

                try {
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [disabledRow]
                    });
                } catch (e) {
                    // Message might have been deleted
                }
            }

            // Release lock when collector ends (after setting cooldown if needed)
            releaseLock(userId);
        });
    },
};
