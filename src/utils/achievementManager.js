const { EmbedBuilder } = require('discord.js');
const db = require('./db');
const achievementsConfig = require('../config/achievements.json');

/**
 * Checks and unlocks achievements for a user.
 * @param {string} userId
 * @param {Object} interaction Discord interaction object
 */
async function checkAndUnlockAchievements(userId, interaction) {
    const user = db.getUser(userId);
    const completedAchievements = db.getAchievements(userId).filter(a => a.completed).map(a => a.achievement_id);
    const newUnlocks = [];

    for (const achievement of achievementsConfig) {
        if (completedAchievements.includes(achievement.id)) continue;

        let currentValue = 0;

        // Determine value based on stat_key
        if (achievement.stat_key === 'badges_count') {
            const badges = db.getUnlockedBadges(userId);
            currentValue = badges.length;
        } else if (achievement.stat_key === 'stars') {
            currentValue = db.getTotalWorkStars(userId);
        } else {
            currentValue = user[achievement.stat_key] || 0;
        }

        // Update progress in DB (optional, but good for tracking partials if we wanted)
        // db.setAchievement(userId, achievement.id, false, currentValue);

        // Check Target
        if (currentValue >= achievement.target) {
            // Unlock
            db.setAchievement(userId, achievement.id, true, currentValue);
            newUnlocks.push(achievement);

            // Grant Rewards
            if (achievement.rewards) {
                const loggedItems = [];

                if (achievement.rewards.coins) {
                    db.addBalance(userId, achievement.rewards.coins);
                }
                if (achievement.rewards.items) {
                    achievement.rewards.items.forEach(item => {
                        db.addItem(userId, item.id, item.amount);
                        loggedItems.push({
                            id: item.id,
                            name: item.id.replace(/_/g, ' '), // Basic format since config isn't imported
                            emoji: '📦', // Placeholder or fetch if possible
                            quantity: item.amount
                        });
                    });
                }

                db.logTransaction(userId, 'achievement', {
                    amount: achievement.rewards.coins || 0,
                    items: loggedItems
                });

                if (achievement.rewards.title) {
                    // Need to find title ID? Or just use string?
                    // Titles logic: `unlocked_titles` table stores `title_id`.
                    // We'll treat the string as the ID for now.
                    db.addTitle(userId, achievement.rewards.title);
                }
            }
        }
    }

    // Notifications
    if (newUnlocks.length > 0) {
        try {
            const discordUser = interaction.user || await interaction.client.users.fetch(userId);

            for (const ach of newUnlocks) {
                let rewardStr = '';
                if (ach.rewards.coins) rewardStr += `- ֍ ${ach.rewards.coins.toLocaleString()}\n`;
                if (ach.rewards.items) {
                    ach.rewards.items.forEach(i => {
                        rewardStr += `- ${i.amount}x ${i.id.replace(/_/g, ' ')}\n`; // Pretty name?
                    });
                }
                if (ach.rewards.title) rewardStr += `- Title: **${ach.rewards.title}**\n`;

                const embed = new EmbedBuilder()
                    .setTitle('Achievement Unlocked! 🏆')
                    .setDescription(`**${ach.name}**\n${ach.description}\n\n**Rewards:**\n${rewardStr}`)
                    .setColor(0xFFFF00) // Gold
                    .setFooter({ text: 'Dank Memer Achievements' });

                await discordUser.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (e) {
            console.error(`Failed to send achievement notification to ${userId}:`, e);
        }
    }
}

module.exports = { checkAndUnlockAchievements };
