const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getProgressBar } = require('../../utils/progressBar');
const achievementsConfig = require('../../config/achievements.json');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('achievements')
        .setDescription('View your achievements progress.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        let currentPage = 0;
        const maxPages = Math.ceil(achievementsConfig.length / ITEMS_PER_PAGE);

        const generateEmbed = () => {
            const userData = db.getUser(userId);
            const badges = db.getUnlockedBadges(userId);
            const totalWorkStars = db.getTotalWorkStars(userId);
            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentAchievements = achievementsConfig.slice(start, end);

            let desc = '-# Complete achievements to get rewards!\n\n';

            currentAchievements.forEach(ach => {
                let currentValue = 0;

                // Determine current value
                if (ach.stat_key === 'badges_count') {
                    currentValue = badges.length;
                } else if (ach.stat_key === 'stars') {
                    currentValue = totalWorkStars;
                } else {
                    currentValue = userData[ach.stat_key] || 0;
                }

                // Cap current value at target for display purposes (optional, but cleaner like "5/5")
                // Prompt shows "100M / 100M" or "12 / 12".
                const displayValue = Math.min(currentValue, ach.target);

                desc += `**${ach.name}**\n`;

                // Rewards Line(s)
                if (ach.rewards) {
                    if (ach.rewards.title) {
                        desc += `${REPLY_CONT} '${ach.rewards.title}' Title\n`;
                    }
                    if (ach.rewards.coins) {
                        desc += `${REPLY_CONT} ֍ ${ach.rewards.coins.toLocaleString()}\n`;
                    }
                    if (ach.rewards.items) {
                        ach.rewards.items.forEach(i => {
                            desc += `${REPLY_CONT} ${i.amount} ${i.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n`; // Fallback name
                        });
                    }
                }

                // Progress Line
                const bar = getProgressBar(displayValue, ach.target, 5);
                desc += `${REPLY} ${bar} \` ${formatNumber(displayValue)} / ${formatNumber(ach.target)} \`\n\n`;
            });

            return new EmbedBuilder()
                .setTitle('Achievements')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('refresh_achievements').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1),
                    new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
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
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your session!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'next_page') currentPage = Math.min(maxPages - 1, currentPage + 1);
            if (i.customId === 'first_page') currentPage = 0;
            if (i.customId === 'last_page') currentPage = maxPages - 1;
            if (i.customId === 'refresh_achievements') {
                // Just update
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },
};

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}
