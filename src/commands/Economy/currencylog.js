const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';
const ITEMS_EMOJI = '📦'; // Fallback if needed, but we use specific item emojis

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('currencylog')
        .setDescription('See a complete log of all currency going in or out of your inventory.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Dynamic fetch function
        const fetchLogs = () => db.getCurrencyLogs(userId);

        // Initial Fetch
        let logs = fetchLogs();
        let currentPage = 0;

        // Helper to recalculate max pages based on current data
        const getMaxPages = () => Math.max(1, Math.ceil(logs.length / ITEMS_PER_PAGE));

        const generateEmbed = () => {
            const maxPages = getMaxPages();
            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentLogs = logs.slice(start, end);

            let desc = '';

            if (currentLogs.length === 0) {
                desc = 'No currency logs found.';
            } else {
                currentLogs.forEach(log => {
                    const timestampUnix = Math.floor(log.timestamp / 1000);
                    const hasAmount = log.amount !== 0;

                    // Parse items
                    let logItems = [];
                    try {
                        logItems = JSON.parse(log.items || '[]');
                    } catch (e) {
                        logItems = [];
                    }

                    const hasItems = logItems.length > 0;

                    desc += `**Type: ${log.type}**\n`;
                    desc += `${REPLY_CONT} <t:${timestampUnix}:R>\n`;

                    if (hasAmount) {
                        const amountVal = log.amount ?? 0;
                        const finalAmountStr = amountVal >= 0 ? `֍ ${amountVal.toLocaleString()}` : `- ֍ ${Math.abs(amountVal).toLocaleString()}`;
                        // Use REPLY_CONT if items follow, else REPLY
                        const amountEmoji = hasItems ? REPLY_CONT : REPLY;
                        desc += `${amountEmoji} ${finalAmountStr}\n`;
                    }

                    if (hasItems) {
                        logItems.forEach((item, index) => {
                            // Use REPLY if it's the last item, else REPLY_CONT
                            const itemEmoji = index === logItems.length - 1 ? REPLY : REPLY_CONT;

                            const displayEmoji = item.emoji || '📦';
                            const qty = item.quantity ?? 1;
                            desc += `${itemEmoji} ${qty.toLocaleString()}x ${displayEmoji} **${item.name}**\n`;
                        });
                    }

                    // Add spacing
                    desc += '\n';
                });
            }

            return new EmbedBuilder()
                .setTitle('Currency Log')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            const maxPages = getMaxPages();

            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('refresh_logs').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1),
                    new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
                )
            ];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed()],
            components: getComponents(),
            withResponse: true
        });

        const collector = response.resource.message.createMessageComponentCollector({
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

            // CRITICAL LOGIC FIX: Always fetch fresh data on navigation
            logs = fetchLogs();
            const maxPages = getMaxPages();

            if (i.customId === 'first_page') {
                currentPage = 0;
            } else if (i.customId === 'prev_page') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'next_page') {
                currentPage = Math.min(maxPages - 1, currentPage + 1);
            } else if (i.customId === 'last_page') {
                currentPage = maxPages - 1;
            } else if (i.customId === 'refresh_logs') {
                // Already fetched above
                // Ensure page is still valid
                if (currentPage >= maxPages) currentPage = maxPages - 1;
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },
};
