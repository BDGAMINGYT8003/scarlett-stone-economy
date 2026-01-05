const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const badgesConfig = require('../config/badges.json');

/**
 * Checks and unlocks badges for a user, sending DMs for new unlocks.
 * @param {string} userId
 * @param {Object} interaction Discord interaction object (for user fetch)
 */
async function checkAndUnlockBadges(userId, interaction) {
    const user = db.getUser(userId);
    const netWorth = db.calculateNetWorth(userId);

    // Get currently stored badges
    const storedBadges = new Set(db.getUnlockedBadges(userId));
    const qualifiedBadges = new Set();
    const newUnlocks = [];

    // Calculate currently qualified badges
    badgesConfig.forEach(badge => {
        let currentValue = 0;

        // Determine Value
        if (badge.id === '2025_badge') {
            currentValue = user.used_2025_last_day ? 1 : 0;
        } else if (badge.is_computed && badge.stat_key === 'net_worth') {
            currentValue = netWorth;
        } else {
            currentValue = user[badge.stat_key] || 0;
        }

        // Check Requirements
        // 2025 Badge
        if (badge.id === '2025_badge') {
            if (currentValue >= 1) {
                qualifiedBadges.add(`${badge.id}:gold`); // Treating as gold/standard
            }
            return;
        }

        // Standard Badges
        if (currentValue >= badge.requirements.platinum) {
            qualifiedBadges.add(`${badge.id}:platinum`);
        } else if (currentValue >= badge.requirements.gold) {
            qualifiedBadges.add(`${badge.id}:gold`);
        }
    });

    // Determine New Unlocks
    qualifiedBadges.forEach(badgeKey => {
        if (!storedBadges.has(badgeKey)) {
            newUnlocks.push(badgeKey);
        }
    });

    // Update DB if changes
    // We treat 'qualifiedBadges' as the authoritative state (handling Upkeep removals automatically)
    // If set contents are different, update.
    let changed = false;
    if (storedBadges.size !== qualifiedBadges.size) changed = true;
    else {
        for (const b of qualifiedBadges) {
            if (!storedBadges.has(b)) {
                changed = true;
                break;
            }
        }
    }

    if (changed) {
        db.setUnlockedBadges(userId, Array.from(qualifiedBadges));
    }

    // Send Notifications for New Unlocks
    if (newUnlocks.length > 0) {
        try {
            const discordUser = interaction.user || await interaction.client.users.fetch(userId);

            for (const badgeKey of newUnlocks) {
                const [badgeId, tier] = badgeKey.split(':');
                const badgeConfig = badgesConfig.find(b => b.id === badgeId);

                if (!badgeConfig) continue;

                // Determine Emoji and Name
                let emoji = badgeConfig.emoji; // 2025 case
                let name = badgeConfig.name;

                if (badgeConfig.emojis) {
                    emoji = badgeConfig.emojis[tier];
                }

                // Format: Title with emoji, content with block quote
                const embed = new EmbedBuilder()
                    .setTitle(`${emoji} New Badge Unlocked`)
                    .setDescription(`> **${name}** - ${badgeConfig.description}`)
                    .setColor(tier === 'platinum' ? 0xE5E4E2 : 0xFFD700) // Platinum vs Gold color
                    .setFooter({ text: 'Dank Memer' });

                await discordUser.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (e) {
            console.error(`Failed to send badge notification to ${userId}:`, e);
        }
    }
}

module.exports = { checkAndUnlockBadges };
