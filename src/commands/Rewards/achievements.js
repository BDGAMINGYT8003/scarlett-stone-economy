const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getProgressBar } = require('../../utils/progressBar');
const achievementsConfig = require('../../config/achievements.json');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

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
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('refresh_achievements').setLabel('🔄').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
            );
            return [row];
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
                return i.reply({ content: 'Not your session!', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage--;
            if (i.customId === 'next_page') currentPage++;
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
