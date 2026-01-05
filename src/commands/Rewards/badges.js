const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getProgressBar } = require('../../utils/progressBar');
const badgesConfig = require('../../config/badges.json');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('badges')
        .setDescription('View and manage your badges.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all available badges and your progress.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('manage')
                .setDescription('View your earned badges.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'list') {
            await this.handleList(interaction);
        } else if (subcommand === 'manage') {
            await this.handleManage(interaction);
        }
    },

    async handleList(interaction) {
        const userId = interaction.user.id;
        let currentPage = 0;
        const maxPages = Math.ceil(badgesConfig.length / ITEMS_PER_PAGE);

        const generateEmbed = () => {
            const userData = db.getUser(userId);
            const netWorth = db.calculateNetWorth(userId);

            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentBadges = badgesConfig.slice(start, end);

            let desc = '';

            currentBadges.forEach(badge => {
                let currentValue = 0;
                let maxValue = badge.requirements.gold; // Default target is Gold
                let isPlatinum = false;
                let isGold = false;

                // Determine Current Value
                if (badge.id === '2025_badge') {
                    currentValue = userData.used_2025_last_day ? 1 : 0;
                } else if (badge.is_computed && badge.stat_key === 'net_worth') {
                    currentValue = netWorth;
                } else {
                    currentValue = userData[badge.stat_key] || 0;
                }

                // Check Status
                if (currentValue >= badge.requirements.platinum) {
                    isPlatinum = true;
                    isGold = true;
                    maxValue = badge.requirements.platinum;
                } else if (currentValue >= badge.requirements.gold) {
                    isGold = true;
                    maxValue = badge.requirements.platinum; // Aiming for plat
                }

                // Special Case for 2025 Badge
                if (badge.id === '2025_badge') {
                    const statusEmoji = isGold ? badge.emoji : badge.emoji; // Same emoji? Config has one.
                    const percentage = isGold ? 100 : 0;
                    const bar = getProgressBar(currentValue, 1, 5);

                    desc += `**${badge.name}**\n-# ${badge.description}\n`;
                    desc += `${REPLY} ${statusEmoji} ${bar} \` ${percentage}% \` \` ${currentValue} / 1 \`\n\n`;
                    return;
                }

                // Normal Badges
                const goldEmoji = badge.emojis.gold;
                const platEmoji = badge.emojis.platinum;

                // Show Gold Progress
                const goldTarget = badge.requirements.gold;
                const goldPct = Math.min(Math.floor((currentValue / goldTarget) * 100), 100);
                const goldBar = getProgressBar(currentValue, goldTarget, 5);

                desc += `**${badge.name}**${badge.upkeep ? ' [(Upkeep Required)]' : ''}\n-# ${badge.description}\n`;

                // Line 1: Gold Status
                // If we have Gold, showing progress to Gold is kinda redundant visually but requested format shows two lines usually?
                // The prompt example shows two lines for "Daily Devotee": Gold line and Plat line.
                // It shows 0% 1/420 for Gold line, and 0% 1/666 for Plat line.
                // So we always show both lines.

                desc += `${REPLY_CONT} ${goldEmoji} ${goldBar} \` ${goldPct}% \` \` ${formatNumber(currentValue)} / ${formatNumber(goldTarget)} \`\n`;

                // Line 2: Platinum Status
                const platTarget = badge.requirements.platinum;
                const platPct = Math.min(Math.floor((currentValue / platTarget) * 100), 100);
                const platBar = getProgressBar(currentValue, platTarget, 5);

                desc += `${REPLY} ${platEmoji} ${platBar} \` ${platPct}% \` \` ${formatNumber(currentValue)} / ${formatNumber(platTarget)} \`\n\n`;
            });

            return new EmbedBuilder()
                .setTitle('Badges Progress')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('refresh_badges').setLabel('Refresh').setStyle(ButtonStyle.Success).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1),
                new ButtonBuilder().setCustomId('help_badges').setLabel('❓').setStyle(ButtonStyle.Secondary)
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
            if (i.customId === 'refresh_badges') {
                // Just re-render
            }
            if (i.customId === 'help_badges') {
                 const helpEmbed = new EmbedBuilder()
                    .setTitle('Badges System')
                    .setDescription('Badges are earned by completing various economic activities!\n\n**Rewards:**\n- Each **Gold Badge** grants a **+5%** Coin Multiplier.\n- Each **Platinum Badge** grants a **+10%** Coin Multiplier (Replaces Gold).\n\n**Upkeep:**\nSome badges require upkeep (like Streaks). If you fail to maintain the requirement, you lose the badge until you meet it again.')
                    .setColor(0x00FF00);
                return i.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },

    async handleManage(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const netWorth = db.calculateNetWorth(userId);

        let earnedBadges = '';

        badgesConfig.forEach(badge => {
            let currentValue = 0;
             if (badge.id === '2025_badge') {
                currentValue = userData.used_2025_last_day ? 1 : 0;
            } else if (badge.is_computed && badge.stat_key === 'net_worth') {
                currentValue = netWorth;
            } else {
                currentValue = userData[badge.stat_key] || 0;
            }

            if (badge.id === '2025_badge') {
                if (currentValue >= 1) earnedBadges += badge.emoji;
                return;
            }

            if (currentValue >= badge.requirements.platinum) {
                earnedBadges += badge.emojis.platinum;
            } else if (currentValue >= badge.requirements.gold) {
                earnedBadges += badge.emojis.gold;
            }
        });

        if (earnedBadges === '') earnedBadges = 'No badges earned yet.';

        const embed = new EmbedBuilder()
            .setTitle('Manage your Badges')
            .setDescription(`**Badges:**\n${earnedBadges}`)
            .setColor(0x0099FF)
            .setFooter({ text: 'Use /badges list to see progress!' });

        await interaction.reply({ embeds: [embed] });
    }
};

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}
