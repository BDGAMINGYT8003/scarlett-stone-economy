const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getProgressBar } = require('../../utils/progressBar');
const badgesConfig = require('../../config/badges.json');

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
        if (subcommand === 'list') await this.handleList(interaction);
        else if (subcommand === 'manage') await this.handleManage(interaction);
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
                let maxValue = badge.requirements.gold;
                let isPlatinum = false;
                let isGold = false;

                if (badge.id === '2025_badge') {
                    currentValue = userData.used_2025_last_day ? 1 : 0;
                } else if (badge.is_computed && badge.stat_key === 'net_worth') {
                    currentValue = netWorth;
                } else {
                    currentValue = userData[badge.stat_key] || 0;
                }

                if (currentValue >= badge.requirements.platinum) {
                    isPlatinum = true;
                    isGold = true;
                    maxValue = badge.requirements.platinum;
                } else if (currentValue >= badge.requirements.gold) {
                    isGold = true;
                    maxValue = badge.requirements.platinum;
                }

                if (badge.id === '2025_badge') {
                    const statusEmoji = isGold ? badge.emoji : badge.emoji;
                    const percentage = isGold ? 100 : 0;
                    const bar = getProgressBar(currentValue, 1, 5);

                    desc += `**${badge.name}**\n-# ${badge.description}\n`;
                    desc += `${REPLY} ${statusEmoji} ${bar} \` ${percentage}% \` \` ${currentValue} / 1 \`\n\n`;
                    return;
                }

                const goldEmoji = badge.emojis.gold;
                const platEmoji = badge.emojis.platinum;
                const goldTarget = badge.requirements.gold;
                const goldPct = Math.min(Math.floor((currentValue / goldTarget) * 100), 100);
                const goldBar = getProgressBar(currentValue, goldTarget, 5);
                const platTarget = badge.requirements.platinum;
                const platPct = Math.min(Math.floor((currentValue / platTarget) * 100), 100);
                const platBar = getProgressBar(currentValue, platTarget, 5);

                desc += `**${badge.name}**${badge.upkeep ? ' [(Upkeep Required)]' : ''}\n-# ${badge.description}\n`;
                desc += `${REPLY_CONT} ${goldEmoji} ${goldBar} \` ${goldPct}% \` \` ${formatNumber(currentValue)} / ${formatNumber(goldTarget)} \`\n`;
                desc += `${REPLY} ${platEmoji} ${platBar} \` ${platPct}% \` \` ${formatNumber(currentValue)} / ${formatNumber(platTarget)} \`\n\n`;
            });

            return new EmbedBuilder()
                .setTitle('Badges Progress')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('refresh_badges').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1),
                new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('help_badges').setLabel('❓').setStyle(ButtonStyle.Secondary)
            );

            return [row1, row2];
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
        // ... (Keep existing implementation)
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
