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
            if (i.customId === 'multi_help') {
                 if (i.user.id !== interaction.user.id) {
                     const errorEmbed = new EmbedBuilder()
                        .setTitle('Error')
                        .setDescription('This is not your session.')
                        .setColor(0xFF0000)
                        .setFooter({ text: 'Run the command yourself!' });
                     return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                 }

                const helpEmbed = new EmbedBuilder()
                    .setTitle('Multiplier Sources')
                    .setDescription('Multipliers boost your earnings from commands like `/beg`, `/search`, and `/crime`. Here is how you can stack them:')
                    .addFields(
                        {
                            name: '💼 Jobs',
                            value: 'Earn **1% - 20%** based on your job role.\nHigh-tier jobs provide higher multipliers.',
                            inline: false
                        },
                        {
                            name: '📛 Badges',
                            value: 'Each badge grants **+15%**.\nCollect all badges for massive bonuses!',
                            inline: false
                        },
                        {
                            name: '🌟 Prestige',
                            value: 'Each Prestige level adds **+5%**.\nReset your progress to gain permanent multipliers.',
                            inline: false
                        },
                        {
                            name: '📈 Level',
                            value: 'Gain **+1%** for every level you advance.\nJust keep playing to level up!',
                            inline: false
                        },
                        {
                            name: '💎 Premium',
                            value: 'Premium members get a flat **+50%** bonus.\nSupport the bot to earn more!',
                            inline: false
                        }
                    )
                    .setColor(0xF1C40F) // Gold/Yellow color
                    .setFooter({ text: 'Stack these to maximize your income!' });

                return i.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Error')
                    .setDescription('This is not your session.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Run the command yourself!' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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
