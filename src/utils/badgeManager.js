const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const badgesConfig = require('../config/badges.json');

/**
 * Checks and unlocks badges for a user, sending DMs for new unlocks and losses.
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
    const lostBadges = [];

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

    // Determine Lost Badges (Upkeep)
    storedBadges.forEach(badgeKey => {
        if (!qualifiedBadges.has(badgeKey)) {
            // Check if user has a better version (e.g., lost Gold but gained Platinum, or vice versa if handled differently)
            // But here "qualified" contains the BEST single version.
            // If I had Platinum, and now I have Gold.
            // "qualified" has Gold. "stored" has Platinum.
            // "new" has Gold. "lost" has Platinum.
            // This is correct. Notification will say "New Badge: Gold" and "Lost Badge: Platinum"?
            // Wait, if I downgrade, "New Badge: Gold" might be weird if I treat it as 'unlocked'.
            // But technically I *did* lose the Platinum status.

            // However, typically you only notify LOSS if you lose the badge entirely or drop a tier?
            // The prompt says "If a badge is lost... mention that the associated coin multiplier has been removed."
            // If I drop Platinum -> Gold, I lose 10% but gain 5%.

            lostBadges.push(badgeKey);
        }
    });

    // Update DB if changes
    let changed = false;
    if (storedBadges.size !== qualifiedBadges.size) changed = true;
    else {
        // If sizes equal, check content
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

    // Send Notifications
    if (newUnlocks.length > 0 || lostBadges.length > 0) {
        try {
            const discordUser = interaction.user || await interaction.client.users.fetch(userId);

            // Unlocks
            for (const badgeKey of newUnlocks) {
                const [badgeId, tier] = badgeKey.split(':');
                const badgeConfig = badgesConfig.find(b => b.id === badgeId);

                if (!badgeConfig) continue;

                let emoji = badgeConfig.emoji;
                let name = badgeConfig.name;

                if (badgeConfig.emojis) {
                    emoji = badgeConfig.emojis[tier];
                }

                // If this is a "downgrade unlock" (e.g. gained Gold because lost Platinum),
                // we might want to suppress "New Badge" if we are also sending "Lost Badge" for the same ID.
                // But let's follow the prompt strictly: "If a badge is lost... send notification".
                // "New badge unlocked" -> "New Badge Unlocked".
                // If I downgrade, I theoretically unlocked Gold again.
                // I will allow both notifications as it explains the state change fully.

                const embed = new EmbedBuilder()
                    .setTitle(`${emoji} New Badge Unlocked`)
                    .setDescription(`> **${name}** - ${badgeConfig.description}`)
                    .setColor(tier === 'platinum' ? 0xE5E4E2 : 0xFFD700)
                    .setFooter({ text: 'Dank Memer' });

                await discordUser.send({ embeds: [embed] }).catch(() => {});
            }

            // Losses
            for (const badgeKey of lostBadges) {
                const [badgeId, tier] = badgeKey.split(':');
                const badgeConfig = badgesConfig.find(b => b.id === badgeId);

                if (!badgeConfig) continue;

                let emoji = badgeConfig.emoji;
                let name = badgeConfig.name;

                if (badgeConfig.emojis) {
                    emoji = badgeConfig.emojis[tier];
                }

                // Check if we gained a different tier of the same badge
                // If we did, maybe phrase it as a "Downgrade"?
                // But prompt asks for "Badge Lost".

                const embed = new EmbedBuilder()
                    .setTitle('Easy come, easy go...')
                    .setDescription(`> **${name}** ${emoji}\n> You failed to maintain the requirements for this badge.\n> The associated coin multiplier has been removed.`)
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Better luck next time' });

                await discordUser.send({ embeds: [embed] }).catch(() => {});
            }

        } catch (e) {
            console.error(`Failed to send badge notification to ${userId}:`, e);
        }
    }
}

module.exports = { checkAndUnlockBadges };
