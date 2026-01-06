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
    const storedBadgesList = db.getUnlockedBadges(userId);
    const storedMap = new Map();
    storedBadgesList.forEach(k => {
        const [id, tier] = k.split(':');
        storedMap.set(id, tier);
    });

    // Calculate currently qualified badges
    const qualifiedMap = new Map();
    const qualifiedBadgesList = [];

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
        if (badge.id === '2025_badge') {
            if (currentValue >= 1) {
                qualifiedMap.set(badge.id, 'gold');
                qualifiedBadgesList.push(`${badge.id}:gold`);
            }
            return;
        }

        if (currentValue >= badge.requirements.platinum) {
            qualifiedMap.set(badge.id, 'platinum');
            qualifiedBadgesList.push(`${badge.id}:platinum`);
        } else if (currentValue >= badge.requirements.gold) {
            qualifiedMap.set(badge.id, 'gold');
            qualifiedBadgesList.push(`${badge.id}:gold`);
        }
    });

    // Update DB if changes (save qualified list)
    // Compare arrays sorted or sets to avoid DB thrashing?
    const storedSet = new Set(storedBadgesList);
    const qualifiedSet = new Set(qualifiedBadgesList);
    let changed = false;
    if (storedSet.size !== qualifiedSet.size) changed = true;
    else {
        for (const b of qualifiedSet) {
            if (!storedSet.has(b)) {
                changed = true;
                break;
            }
        }
    }

    if (changed) {
        db.setUnlockedBadges(userId, qualifiedBadgesList);
    }

    // Determine Notifications
    const tierValue = { undefined: 0, 'gold': 1, 'platinum': 2 };
    const allIds = new Set([...storedMap.keys(), ...qualifiedMap.keys()]);
    let discordUser = null;

    for (const id of allIds) {
        const oldTier = storedMap.get(id);
        const newTier = qualifiedMap.get(id);
        const oldVal = tierValue[oldTier];
        const newVal = tierValue[newTier];

        const badgeConfig = badgesConfig.find(b => b.id === id);
        if (!badgeConfig) continue;

        if (newVal === oldVal) continue; // No change

        // Helper to get user
        if (!discordUser) {
            try {
                discordUser = interaction.user || await interaction.client.users.fetch(userId);
            } catch (e) {
                console.error(`Failed to fetch user ${userId} for badge notification`);
                return;
            }
        }

        let name = badgeConfig.name;
        let emoji = badgeConfig.emoji;
        if (badgeConfig.emojis) {
            // Use emoji for the tier being discussed
            // If unlock/upgrade, use newTier emoji
            // If loss, use oldTier emoji
            // If downgrade, use oldTier (Platinum) or newTier (Gold)? Context dependent.
            emoji = badgeConfig.emojis[newTier || oldTier];
        }

        try {
            if (newVal > oldVal) {
                // Scenario 1 & 3: Unlock or Regain or Upgrade
                // Use newTier emoji
                if (badgeConfig.emojis) emoji = badgeConfig.emojis[newTier];

                const embed = new EmbedBuilder()
                    .setTitle(`${emoji} New Badge Unlocked`)
                    .setDescription(`> **${name}** - ${badgeConfig.description}`)
                    .setColor(newTier === 'platinum' ? 0xE5E4E2 : 0xFFD700)
                    .setFooter({ text: 'Dank Memer' });

                await discordUser.send({ embeds: [embed] });

            } else if (newVal < oldVal) {
                // Loss or Downgrade
                if (newVal === 0) {
                    // Scenario 2: Complete Removal
                    // Use oldTier emoji
                    if (badgeConfig.emojis) emoji = badgeConfig.emojis[oldTier];

                    const embed = new EmbedBuilder()
                        .setTitle('Easy come, easy go...')
                        .setDescription(`> **${name}** ${emoji}\n> You failed to maintain the requirements for this badge.\n> The associated coin multiplier has been removed.`)
                        .setColor(0xFF0000)
                        .setFooter({ text: 'Better luck next time' });

                    await discordUser.send({ embeds: [embed] });

                } else if (oldVal === 2 && newVal === 1) {
                    // Scenario 4: Downgrade (Plat -> Gold)
                    // Use Platinum emoji for "lost" context or Gold for "remaining"?
                    // User says: "explicitly mention that the Platinum badge was removed but they still possess the Gold version."
                    const platEmoji = badgeConfig.emojis.platinum;
                    const goldEmoji = badgeConfig.emojis.gold;

                    const embed = new EmbedBuilder()
                        .setTitle('Badge Downgraded')
                        .setDescription(`> **${name}**\n> You've lost the **Platinum** tier ${platEmoji} due to failing requirements, but you still kept the **Gold** tier ${goldEmoji}.\n> \n> **Note:** Your coin multiplier for this badge has dropped from **+10%** to **+5%**.`)
                        .setColor(0xFFA500) // Orange?
                        .setFooter({ text: 'Step it up!' });

                    await discordUser.send({ embeds: [embed] });
                }
            }
        } catch (e) {
            // Cannot DM user?
        }
    }
}

module.exports = { checkAndUnlockBadges };
