const db = require('./db');
const badgesConfig = require('../config/badges.json');
const jobsConfig = require('../config/jobs.json');
const levelsConfig = require('../config/levels.json');

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
        const badgeMap = new Map();

        // Group by Badge ID and find highest tier
        unlockedBadges.forEach(badgeString => {
            const [id, tier] = badgeString.split(':');
            const currentTierVal = tier === 'platinum' ? 2 : 1;

            if (!badgeMap.has(id) || currentTierVal > badgeMap.get(id)) {
                badgeMap.set(id, currentTierVal);
            }
        });

        let badgeMulti = 0;
        let count = 0;

        badgeMap.forEach((tierVal) => {
            if (tierVal === 2) badgeMulti += 10; // Platinum
            else badgeMulti += 5; // Gold
            count++;
        });

        if (badgeMulti > 0) {
            total += badgeMulti;
            breakdown.push({
                name: `${count} Badges`,
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
    // Base 1% per level
    let levelMulti = user.level * 1;

    // Milestone Bonuses from levels.json
    // Iterate all levels up to current level
    levelsConfig.forEach(lvl => {
        if (user.level >= lvl.level && lvl.rewards && lvl.rewards.multiplier_bonus) {
            levelMulti += lvl.rewards.multiplier_bonus;
        }
    });

    if (levelMulti > 0) {
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
