const db = require('./db');
const { EmbedBuilder } = require('discord.js');

// Helper to get time until next occurrence of a specific schedule
// Timezone: America/New_York (US Eastern Time is commonly used for "US time")
const getNextReset = (type) => {
    const now = new Date();
    // Use UTC for internal logic, but shift to simulate US Eastern (-5 or -4)
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

    const now = Date.now();

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

// Check if a duration cooldown is active. Does NOT check DB/User status, simply checks the map.
// The expiry time is set in setDurationCooldown.
const checkDurationCooldown = (userId, commandName) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();
    const expireTime = durationCooldowns.get(key);

    if (expireTime && now < expireTime) {
        return { onCooldown: true, readyAt: expireTime };
    }
    return { onCooldown: false };
};

// Set cooldown based on user premium status
const setDurationCooldown = (userId, commandName, defaultSeconds, premiumSeconds) => {
    const key = `${userId}-${commandName}`;
    const now = Date.now();

    // Determine duration
    let duration = defaultSeconds;
    if (db.isPremium(userId)) {
        duration = premiumSeconds;
    }

    durationCooldowns.set(key, now + (duration * 1000));
};

const getCooldownEmbed = (commandName, readyAt, defaultSeconds, premiumSeconds) => {
    const readyUnix = Math.floor(readyAt / 1000);
    return new EmbedBuilder()
        .setTitle("Easy tiger, let's not rush")
        .setDescription(`### This command can be used again <t:${readyUnix}:R>\nThe __default__ cooldown is **${defaultSeconds} seconds**\nThe __premium__ cooldown is **${premiumSeconds} seconds**`);
};

const getAllCooldowns = (userId) => {
    const active = [];
    const now = Date.now();

    // Duration Cooldowns
    for (const [key, expireTime] of durationCooldowns.entries()) {
        if (key.startsWith(`${userId}-`)) {
            if (now < expireTime) {
                const command = key.split('-')[1];
                active.push({ command, readyAt: expireTime });
            }
        }
    }

    // Schedule Cooldowns (Daily, Weekly, Monthly)
    ['daily', 'weekly', 'monthly'].forEach(type => {
        const check = checkScheduledCooldown(userId, type);
        if (check.onCooldown) {
            active.push({ command: type, readyAt: check.readyAt });
        }
    });

    return active;
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
    getScheduleCooldownEmbed,
    getAllCooldowns
};
