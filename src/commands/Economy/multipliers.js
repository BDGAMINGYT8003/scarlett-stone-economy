const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, MessageFlags, ComponentType } = require('discord.js');
const { calculateMultiplier } = require('../../utils/multiplier');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('multipliers')
        .setDescription('Check your coin multipliers and sources'),
    async execute(interaction) {
        const { total, breakdown } = calculateMultiplier(interaction.user.id);

        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(breakdown.length / ITEMS_PER_PAGE) || 1;
        let currentPage = 1;

        const generateEmbed = (page) => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentItems = breakdown.slice(start, end);

            let description = `> Total: **+${total}%**\n\n`;

            if (currentItems.length === 0) {
                description += "No active multipliers.";
            } else {
                currentItems.forEach(item => {
                    // Example format: ` +135% ` 9 Badges
                    const amountStr = `+${item.amount}%`;
                    const paddedAmount = amountStr.padStart(5, ' ');
                    description += `\` ${paddedAmount} \` ${item.name}\n`;
                });
            }

            const embed = new EmbedBuilder()
                .setTitle('Your Coin Multipliers')
                .setDescription(description)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${page} of ${totalPages}` });

            return embed;
        };

        const getRow = (page) => {
            const row = new ActionRowBuilder();

            const prevButton = new ButtonBuilder()
                .setCustomId('multi_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1);

            const nextButton = new ButtonBuilder()
                .setCustomId('multi_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages);

            const helpButton = new ButtonBuilder()
                .setCustomId('multi_help')
                .setLabel('❓')
                .setStyle(ButtonStyle.Secondary);

            row.addComponents(prevButton, nextButton, helpButton);
            return row;
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: totalPages > 1 ? [getRow(currentPage)] : [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('multi_help').setLabel('❓').setStyle(ButtonStyle.Secondary)
            )],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Not your session!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'multi_help') {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('Multiplier System')
                    .setDescription('Multipliers increase the amount of coins you get from commands like `/beg`, `/search`, and `/crime`.\n\n**Sources:**\n- **Badges:** +15% per badge\n- **Prestige:** +5% per prestige level\n- **Level:** +1% per level\n- **Premium:** +50% bonus')
                    .setColor(0x00FF00);
                return i.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'multi_prev') {
                currentPage--;
            } else if (i.customId === 'multi_next') {
                currentPage++;
            }

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: totalPages > 1 ? [getRow(currentPage)] : [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('multi_help').setLabel('❓').setStyle(ButtonStyle.Secondary)
                )]
            });
        });
    }
};
