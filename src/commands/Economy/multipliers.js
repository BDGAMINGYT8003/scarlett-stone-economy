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
                    const percentStr = `+${item.amount}%`;
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
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1),
                new ButtonBuilder().setCustomId('help_multipliers').setLabel('❓').setStyle(ButtonStyle.Secondary)
            );
            return [row];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: getComponents(currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not your menu!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'help_multipliers') {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('Multiplier Sources')
                    .setDescription('Here are all the ways you can increase your coin multiplier:')
                    .addFields(
                        { name: '💎 Premium Status', value: '` +50% ` for being a Premium subscriber.' },
                        { name: '🔥 Daily Streak', value: '` +1% ` per day of streak (max 100%).' },
                        { name: '🏆 Prestige', value: '` +5% ` per Prestige/Promotion level.' },
                        { name: '💼 Job', value: '` +1% ` to ` +20% ` depending on your job.' },
                        { name: '📈 Level Up Rewards', value: '` +0.1% ` per shift completed (grind reward).' },
                        { name: '💰 Net Worth Badges', value: '` +15% ` for each net worth milestone hit (1M, 5M, 10M, etc.).' },
                        { name: '🎒 Inventory Items', value: 'Certain rare items like **Diamonds** or **Beggars Bowl** give small boosts.' }
                    )
                    .setColor(0x0099FF)
                    .setFooter({ text: 'Multipliers stack!' });

                return i.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: getComponents(currentPage)
            });
        });
    },
};
