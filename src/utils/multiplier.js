const db = require('./db');
const badgesConfig = require('../config/badges.json');
const jobsConfig = require('../config/jobs.json');

const calculateMultiplier = (userId) => {
    const user = db.getUser(userId);
    const unlockedBadges = db.getUnlockedBadges(userId); // Returns array of strings like "badge_id:gold" or "badge_id:platinum"

    let total = 0;
    const breakdown = [];

    // Job Multiplier
    if (user.job_id) {
        const job = jobsConfig.find(j => j.id === user.job_id);
        if (job && job.multiplier > 0) {
            total += job.multiplier;
            breakdown.push({
                name: `Job: ${job.name}`,
                amount: job.multiplier,
                prefix: ' '
            });
        }
    }

    // Badges
    if (unlockedBadges.length > 0) {
        let badgeMulti = 0;
        let goldCount = 0;
        let platCount = 0;

        unlockedBadges.forEach(badgeString => {
            const [id, tier] = badgeString.split(':');

            // Logic: Platinum replaces Gold.
            // The database storage (from badgeManager.js) seems to store EITHER gold OR platinum for a specific badge ID, not both.
            // "qualifiedBadgesList.push(`${badge.id}:platinum`);" OR "...gold".
            // So we can just sum them up based on the tier tag.

            if (tier === 'platinum') {
                badgeMulti += 10;
                platCount++;
            } else {
                // Default to gold if just "id" or "gold"
                // 2025 badge stores as "2025_badge:gold" in manager logic
                badgeMulti += 5;
                goldCount++;
            }
        });

        if (badgeMulti > 0) {
            total += badgeMulti;
            // Grouping for display? Or just "X Badges"?
            // Request said "9 Badges +135%" (old example).
            // New logic might vary. Let's just say "X Badges".
            breakdown.push({
                name: `${unlockedBadges.length} Badges`,
                amount: badgeMulti,
                prefix: '+'
            });
        }
    }

    // Prestige
    if (user.prestige > 0) {
        const prestigeMulti = user.prestige * 5;
        total += prestigeMulti;
        breakdown.push({
            name: `Prestige ${user.prestige}`,
            amount: prestigeMulti,
            prefix: ' '
        });
    }

    // Level Up Rewards
    if (user.level > 0) {
        const levelMulti = user.level * 1; // 1% per level
        total += levelMulti;
        breakdown.push({
            name: 'Level Up Rewards',
            amount: levelMulti,
            prefix: '  ' // Padding for alignment
        });
    }

    // Premium
    if (user.is_premium || (user.premium_expires_at > Date.now())) {
        const premiumMulti = 50;
        total += premiumMulti;
        breakdown.push({
            name: 'Premium Member',
            amount: premiumMulti,
            prefix: ' '
        });
    }

    return {
        total,
        breakdown
    };
};

module.exports = { calculateMultiplier };
