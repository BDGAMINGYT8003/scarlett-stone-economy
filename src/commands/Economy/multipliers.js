const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const { getMultipliers } = require('../../utils/multiplier');

const ITEMS_PER_PAGE = 10;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multipliers')
        .setDescription('Check your current coin multipliers.'),
    async execute(interaction) {
        const { total, breakdown } = getMultipliers(interaction.user.id);

        let currentPage = 0;
        const maxPages = Math.ceil(breakdown.length / ITEMS_PER_PAGE) || 1;

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentItems = breakdown.slice(start, end);

            let desc = `> Total: **+${total}%**\n\n`;

            if (currentItems.length === 0) {
                desc += 'No active multipliers.';
            } else {
                currentItems.forEach(item => {
                    // Format: ` +135% ` 9 Badges
                    // Pad with spaces for alignment if needed, but simple backticks work
                    const percentStr = `+${item.amount}%`;
                    const paddedPercent = percentStr.padStart(5, ' ');
                    // Actually, let's just center or pad it reasonably.
                    // The prompt example: ` +135% `
                    desc += `\` ${percentStr} \` ${item.name}\n`;
                });
            }

            return new EmbedBuilder()
                .setTitle('Your Coin Multipliers')
                .setDescription(desc)
                .setColor(0x00FF00) // Green
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });
        };

        const getComponents = (page) => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1)
            );
            return maxPages > 1 ? [row] : [];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: getComponents(currentPage),
            fetchReply: true
        });

        if (maxPages > 1) {
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'This is not your menu!', flags: MessageFlags.Ephemeral });
                }

                if (i.customId === 'prev_page') currentPage--;
                if (i.customId === 'next_page') currentPage++;

                await i.update({
                    embeds: [generateEmbed(currentPage)],
                    components: getComponents(currentPage)
                });
            });
        }
    },
};
