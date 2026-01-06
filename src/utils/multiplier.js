const db = require('./db');
const badgesConfig = require('../config/badges.json');
const jobsConfig = require('../config/jobs.json');

const calculateMultiplier = (userId) => {
    const user = db.getUser(userId);
    const unlockedBadges = db.getUnlockedBadges(userId);

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
        const badgeCount = unlockedBadges.length;
        const badgeMulti = badgeCount * 15;
        total += badgeMulti;
        breakdown.push({
            name: `${badgeCount} Badges`,
            amount: badgeMulti,
            prefix: '+'
        });
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
