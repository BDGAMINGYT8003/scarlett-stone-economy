const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const locations = require('../../config/locations.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search a location for coins or items.'),
    async execute(interaction) {
        const userId = interaction.user.id;

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
                message = message.replace('{amount}', `֍ ${amount.toLocaleString()}`);
            }

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

            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time' && collected.size === 0) {
                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.map(btn => btn.setDisabled(true))
                );
                await interaction.editReply({
                    content: 'Search timed out.',
                    components: [disabledRow]
                });
            }
        });
    },
};
