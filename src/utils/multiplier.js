const db = require('./db');
const items = require('../config/items.json');
const jobs = require('../config/jobs.json');

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
    // The prompt mentions "Prestige 6" -> +30%. So 5% per level.
    // We use 'promotions' column as a proxy for Prestige/Promotion level.
    if (user.promotions > 0) {
        const amount = user.promotions * 5;
        breakdown.push({ name: `Prestige ${user.promotions}`, amount });
        total += amount;
    }

    // 3. Level Up Rewards (Shifts Proxy)
    // Prompt: "+6% Level Up Rewards".
    // We can use total_shifts_completed as "Level".
    // Let's say 1 level per 10 shifts? Or just 1% per 20 shifts?
    // Let's go with 0.1% per shift to reward grinding.
    if (user.total_shifts_completed > 0) {
        // Cap at some reasonable amount if needed, or let it scale.
        // For 6%, that would be 60 shifts.
        const amount = Math.floor(user.total_shifts_completed * 0.1);
        if (amount > 0) {
            breakdown.push({ name: 'Level Up Rewards', amount });
            total += amount;
        }
    }

    // 4. Daily Streak
    if (user.daily_streak > 0) {
        const amount = Math.min(user.daily_streak, 100); // 1% per day, cap at 100%
        breakdown.push({ name: `${user.daily_streak} Day Streak`, amount });
        total += amount;
    }

    // 5. Job
    if (user.job_id) {
        const job = jobs.find(j => j.id === user.job_id);
        if (job) {
            const amount = 10;
            breakdown.push({ name: `Working as ${job.name}`, amount });
            total += amount;
        }
    }

    // 6. Badges (Mock based on net worth?)
    // Prompt: "9 Badges -> +135%". 15% per badge.
    // We don't have badges. Let's create pseudo-badges based on net worth milestones.
    // 1M, 5M, 10M, 50M, 100M, 500M, 1B...
    const netWorth = db.calculateNetWorth(userId);
    let badgeCount = 0;
    if (netWorth >= 1000000) badgeCount++;
    if (netWorth >= 5000000) badgeCount++;
    if (netWorth >= 10000000) badgeCount++;
    if (netWorth >= 50000000) badgeCount++;
    if (netWorth >= 100000000) badgeCount++;
    if (netWorth >= 500000000) badgeCount++;
    if (netWorth >= 1000000000) badgeCount++;

    if (badgeCount > 0) {
        const amount = badgeCount * 15;
        breakdown.push({ name: `${badgeCount} Badges`, amount });
        total += amount;
    }

    // 7. Inventory Items (Tips)
    // Check for specific items that might give multiplier
    // "Fidget Spinner" was referenced in archive but not in items.json currently.
    // Let's use "Diamond" as a multiplier item (+2% per diamond, max 20%)
    const diamond = items.find(i => i.id === 'diamond');
    if (diamond) {
        const count = db.getItemCount(userId, 'diamond');
        if (count > 0) {
            const amount = Math.min(count * 2, 20); // 2% each, cap at 20%
            breakdown.push({ name: 'Diamonds', amount });
            total += amount;
        }
    }

    // "Beggars Bowl" -> +5% multiplier (it's Rare)
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
