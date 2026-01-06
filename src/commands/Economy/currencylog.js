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
        let logs = db.getCurrencyLogs(userId); // Returns max 500 (updated in db.js)

        let currentPage = 0;
        let maxPages = Math.ceil(logs.length / ITEMS_PER_PAGE) || 1;

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

                    desc += `**Type: ${log.type}**\n`;
                    desc += `${REPLY_CONT} <t:${timestampUnix}:R>\n`;
                    desc += `${REPLY} ${amountStr}\n\n`;
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
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Error')
                    .setDescription('This is not your log interaction.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Run the command yourself!' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
            if (i.customId === 'refresh_logs') {
                logs = db.getCurrencyLogs(userId);
                maxPages = Math.ceil(logs.length / ITEMS_PER_PAGE) || 1;
                currentPage = 0; // Reset to start to see new logs
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },
};
