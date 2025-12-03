const db = require('./db');
const { EmbedBuilder } = require('discord.js');

// Helper to get time until next occurrence of a specific schedule
// Timezone: America/New_York (US Eastern Time is commonly used for "US time")
const getNextReset = (type) => {
    const now = new Date();
    // Use UTC for internal logic, but shift to simulate US Eastern (-5 or -4)
    // Actually, let's keep it simple and use a fixed offset or library if needed.
    // Replit environment might be UTC.
    // "6 AM US Time" -> Let's assume EST (UTC-5) -> 11 AM UTC.
    // Or EDT (UTC-4) -> 10 AM UTC.
    // Let's stick to a fixed offset for simplicity: UTC-5 (EST)

    // Convert current time to target timezone (EST)
    const targetTime = new Date(now.getTime() - (5 * 60 * 60 * 1000));

    let resetTime = new Date(targetTime);
    resetTime.setUTCHours(6, 0, 0, 0); // 6 AM

    if (type === 'daily') {
        if (targetTime >= resetTime) {
            resetTime.setUTCDate(resetTime.getUTCDate() + 1);
        }
    } else if (type === 'weekly') {
        // Monday = 1
        const day = targetTime.getUTCDay();
        const diff = (day === 0 ? 6 : day - 1); // Days past monday
        // If today is Monday and it's past 6am, or it's later in week
        if (day === 1 && targetTime < resetTime) {
            // It is monday, before 6am, so reset is today 6am (which is resetTime)
        } else {
            // Add days to reach next Monday
            resetTime.setUTCDate(resetTime.getUTCDate() + (7 - day + 1));
        }
    } else if (type === 'monthly') {
        // 1st of month
        resetTime.setUTCDate(1);
        if (targetTime >= resetTime) {
            resetTime.setUTCMonth(resetTime.getUTCMonth() + 1);
        }
    }

    // Convert back to UTC timestamp
    return resetTime.getTime() + (5 * 60 * 60 * 1000);
};

// Check if a "scheduled" cooldown is active
const checkScheduledCooldown = (userId, type) => {
    const userData = db.getUser(userId);
    const lastClaimed = userData[`${type}_last_claimed`];

    if (!lastClaimed) return { onCooldown: false };

    // Calculate when the "next" reset was relative to the last claim
    // Actually, simpler logic:
    // Calculate the most recent reset time that has passed.
    // If lastClaimed > recentReset, then they already claimed for this period.

    // Let's re-evaluate "getNextReset".
    // We want to know if the user claimed *since the last reset*.

    const now = Date.now();
    const resetTimestamp = getNextReset(type); // This returns the FUTURE reset.

    // If it's daily, the "period" is [resetTimestamp - 24h, resetTimestamp).
    // If lastClaimed is in this period, they are on cooldown.

    // Wait, simpler approach:
    // If I claim at 7 AM. Reset is tomorrow 6 AM.
    // getNextReset returns tomorrow 6 AM.
    // If now < tomorrow 6 AM, I might be on cooldown IF I claimed after Today 6 AM.

    // Let's look at the "Previous Reset".
    // Previous Reset = Next Reset - Period.
    let periodMs = 0;
    if (type === 'daily') periodMs = 24 * 3600 * 1000;
    if (type === 'weekly') periodMs = 7 * 24 * 3600 * 1000;
    // Monthly is variable, so we can't just subtract.

    // Alternative: Just store the "next reset time" in the DB when they claim?
    // No, instructions say "should be available to claim each day at 6 AM".
    // So if I claim at 5:59 AM, I can claim again at 6:01 AM.
    // If I claim at 6:01 AM, I must wait until tomorrow 6:00 AM.

    // So, we just need to check if `lastClaimed` > `mostRecentReset`.

    // Re-implement getMostRecentReset logic
    const currentEST = new Date(now - (5 * 60 * 60 * 1000));
    let recentReset = new Date(currentEST);
    recentReset.setUTCHours(6, 0, 0, 0);

    if (type === 'daily') {
        if (currentEST < recentReset) {
            recentReset.setUTCDate(recentReset.getUTCDate() - 1);
        }
    } else if (type === 'weekly') {
        const day = currentEST.getUTCDay(); // 0 Sun, 1 Mon...
        // We want Monday 6 AM.
        // If today is Monday:
        if (day === 1) {
            if (currentEST < recentReset) {
                 // Before 6 AM Monday, so recent reset was last Monday.
                 recentReset.setUTCDate(recentReset.getUTCDate() - 7);
            }
            // else recentReset is today 6 AM.
        } else {
            // Go back to Monday
            const dist = (day + 6) % 7; // distance from Monday (Mon=0, Tue=1... Sun=6)
            // Wait, (day - 1) handles 1..6. 0 (Sun) -> -1.
            // (day + 6) % 7: Mon(1)->0, Tue(2)->1, Sun(0)->6. Correct.
            recentReset.setUTCDate(recentReset.getUTCDate() - dist);
        }
    } else if (type === 'monthly') {
        recentReset.setUTCDate(1);
        if (currentEST < recentReset) {
            recentReset.setUTCMonth(recentReset.getUTCMonth() - 1);
        }
    }

    const recentResetTimestamp = recentReset.getTime() + (5 * 60 * 60 * 1000);

    if (lastClaimed > recentResetTimestamp) {
        // They claimed after the most recent reset. They must wait for next reset.
        const nextResetTimestamp = getNextReset(type);
        return {
            onCooldown: true,
            readyAt: nextResetTimestamp
        };
    }

    return { onCooldown: false };
};

// Map for short-term "duration" cooldowns (beg, search)
const durationCooldowns = new Map();

const checkDurationCooldown = (userId, commandName, durationSeconds) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    const expireTime = durationCooldowns.get(key);

    if (expireTime && now < expireTime) {
        return { onCooldown: true, readyAt: expireTime };
    }
    return { onCooldown: false };
};

const setDurationCooldown = (userId, commandName, durationSeconds) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    durationCooldowns.set(key, now + (durationSeconds * 1000));
};

const getCooldownEmbed = (commandName, readyAt, defaultSeconds, premiumSeconds) => {
    const readyUnix = Math.floor(readyAt / 1000);
    return new EmbedBuilder()
        .setTitle("### Easy tiger, let's not rush")
        .setDescription(`# This command can be used again <t:${readyUnix}:R>\nThe __default__ cooldown is **${defaultSeconds} seconds**\nThe __premium__ cooldown is **${premiumSeconds} seconds**`);
};

const getScheduleCooldownEmbed = (commandName, readyAt) => {
    const readyUnix = Math.floor(readyAt / 1000);
    // Title flavor text based on bot theme (Economy/Fun)
    const flavorTitles = [
        "Hold your horses!",
        "Patience is a virtue",
        "Not so fast!",
        "Greedy, aren't we?",
        "Time flies... but not that fast"
    ];
    const title = flavorTitles[Math.floor(Math.random() * flavorTitles.length)];

    // Command mapping for nice names
    const prettyNames = {
        'daily': 'daily coins',
        'weekly': 'weekly coins',
        'monthly': 'monthly coins'
    };

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(`You already got your ${prettyNames[commandName] || commandName}. Try again <t:${readyUnix}:R>.`);
};

module.exports = {
    checkScheduledCooldown,
    checkDurationCooldown,
    setDurationCooldown,
    getCooldownEmbed,
    getScheduleCooldownEmbed
};
