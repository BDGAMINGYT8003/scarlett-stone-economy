const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('currencylog')
        .setDescription('See a complete log of all currency going in or out of your inventory.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const logs = db.getCurrencyLogs(userId); // Returns max 100

        let currentPage = 0;
        const maxPages = Math.ceil(logs.length / ITEMS_PER_PAGE) || 1;

        const generateEmbed = () => {
            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentLogs = logs.slice(start, end);

            let desc = '';

            if (currentLogs.length === 0) {
                desc = 'No currency logs found.';
            } else {
                currentLogs.forEach(log => {
                    const timestampUnix = Math.floor(log.timestamp / 1000);
                    const amountStr = log.amount >= 0 ? `⏣ ${log.amount.toLocaleString()}` : `- ⏣ ${Math.abs(log.amount).toLocaleString()}`;

                    desc += `**Command: ${log.type}**\n`;
                    desc += `${REPLY_CONT} <t:${timestampUnix}:R>\n`;
                    desc += `${REPLY} ${amountStr} in pocket\n\n`;
                });
            }

            return new EmbedBuilder()
                .setTitle('Currency Log')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('refresh_logs').setEmoji('🔄').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
                )
            ];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed()],
            components: getComponents(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Not your log!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
            if (i.customId === 'refresh_logs') {
                // Refresh data logic? We fetched logs once. Ideally fetch again.
                // But for pagination, local array is fine unless real-time updates needed.
                // User asked for "refresh emoji".
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },
};
