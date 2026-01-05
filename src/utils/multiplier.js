const db = require('./db');
const items = require('../config/items.json');
const jobs = require('../config/jobs.json');
const badgesConfig = require('../config/badges.json');

/**
 * Calculates the user's total multiplier and returns a breakdown.
 * @param {string} userId
 * @returns {Object} { total: number, breakdown: Array<{name: string, amount: number}> }
 */
function getMultipliers(userId) {
    const user = db.getUser(userId);
    if (!user) {
        return { total: 0, breakdown: [] };
    }

    let breakdown = [];
    let total = 0;

    // 1. Premium Status
    if (user.is_premium) {
        const amount = 50;
        breakdown.push({ name: 'Premium Status', amount });
        total += amount;
    }

    // 2. Promotions (Prestige Proxy)
    if (user.promotions > 0) {
        const amount = user.promotions * 5;
        breakdown.push({ name: `Prestige ${user.promotions}`, amount });
        total += amount;
    }

    // 3. Level Up Rewards (Shifts Proxy)
    if (user.total_shifts_completed > 0) {
        const amount = Math.floor(user.total_shifts_completed * 0.1);
        if (amount > 0) {
            breakdown.push({ name: 'Level Up Rewards', amount });
            total += amount;
        }
    }

    // 4. Daily Streak
    if (user.daily_streak > 0) {
        const amount = Math.min(user.daily_streak, 100);
        breakdown.push({ name: `${user.daily_streak} Day Streak`, amount });
        total += amount;
    }

    // 5. Job
    if (user.job_id) {
        const job = jobs.find(j => j.id === user.job_id);
        if (job) {
            const amount = job.multiplier || 1;
            breakdown.push({ name: `Working as ${job.name}`, amount });
            total += amount;
        }
    }

    // 6. Badges (Real System)
    const netWorth = db.calculateNetWorth(userId);
    let earnedBadges = 0;
    let badgeMultiplier = 0;

    badgesConfig.forEach(badge => {
        let currentValue = 0;
        if (badge.id === '2025_badge') {
            currentValue = user.used_2025_last_day ? 1 : 0;
        } else if (badge.is_computed && badge.stat_key === 'net_worth') {
            currentValue = netWorth;
        } else {
            currentValue = user[badge.stat_key] || 0;
        }

        if (badge.id === '2025_badge') {
             // 2025 badge has no platinum/gold distinction in config, but requirements says 'gold: 1'.
             if (currentValue >= 1) {
                 earnedBadges++;
                 badgeMultiplier += 5; // Assuming normal badge value
             }
        } else {
            if (currentValue >= badge.requirements.platinum) {
                earnedBadges++;
                badgeMultiplier += 10;
            } else if (currentValue >= badge.requirements.gold) {
                earnedBadges++;
                badgeMultiplier += 5;
            }
        }
    });

    if (earnedBadges > 0) {
        breakdown.push({ name: `${earnedBadges} Badges`, amount: badgeMultiplier });
        total += badgeMultiplier;
    }

    // 7. Inventory Items (Tips)
    const diamond = items.find(i => i.id === 'diamond');
    if (diamond) {
        const count = db.getItemCount(userId, 'diamond');
        if (count > 0) {
            const amount = Math.min(count * 2, 20); // 2% each, cap at 20%
            breakdown.push({ name: 'Diamonds', amount });
            total += amount;
        }
    }

    const bowl = items.find(i => i.id === 'beggars_bowl');
    if (bowl) {
        const count = db.getItemCount(userId, 'beggars_bowl');
        if (count > 0) {
            const amount = 5;
            breakdown.push({ name: 'Beggars Bowl', amount });
            total += amount;
        }
    }

    // Sort breakdown by amount descending
    breakdown.sort((a, b) => b.amount - a.amount);

    return { total, breakdown };
}

module.exports = { getMultipliers };
