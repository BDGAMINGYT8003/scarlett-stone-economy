const { EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('./db');
const levelsConfig = require('../config/levels.json');
const itemsConfig = require('../config/items.json');

const GREETINGS = [
    "Poggers, {user}!",
    "You're on fire, {user}!",
    "Absolute legend, {user}!",
    "Look at you go, {user}!",
    "Unstoppable, {user}!",
    "Level up hype, {user}!",
    "Way to go, {user}!",
    "You're crushing it, {user}!",
    "Another one bites the dust, {user}!",
    "Top tier performance, {user}!"
];

/**
 * Grants XP to a user and checks for level up.
 * @param {string} userId - The Discord User ID.
 * @param {string} outcomeType - 'profit' (2 XP) or 'loss'/'neutral' (1 XP).
 * @param {Object} interaction - The interaction object for context and DMing.
 */
async function grantXp(userId, outcomeType, interaction) {
    if (!interaction) return;

    const xpAmount = outcomeType === 'profit' ? 2 : 1;
    const user = db.getUser(userId);
    const oldLevel = user.level || 0;

    db.addXp(userId, xpAmount);

    const newUser = db.getUser(userId);
    if (newUser.level > oldLevel) {
        await handleLevelUp(userId, oldLevel, newUser.level, interaction);
    }
}

/**
 * Admin helper to grant raw XP.
 */
async function adminGrantXp(userId, amount, interaction) {
    const user = db.getUser(userId);
    const oldLevel = user.level || 0;

    db.addXp(userId, amount);

    const newUser = db.getUser(userId);
    if (newUser.level > oldLevel) {
        await handleLevelUp(userId, oldLevel, newUser.level, interaction);
    }
}

/**
 * Admin helper to grant Levels directly.
 * Logic: Calculate how much XP needed to reach (Current + Amount) and add it?
 * Or set level directly?
 * Setting level directly skips XP calculation consistency if we don't adjust XP.
 * Better to add XP equivalent to the levels.
 * But formula is dynamic.
 * Simplest: Loop and fill XP.
 */
async function adminGrantLevels(userId, amount, interaction) {
    const user = db.getUser(userId);
    let currentLevel = user.level || 0;
    let currentXp = user.xp || 0;
    let targetLevel = currentLevel + amount;

    // We can manually update DB to target level and set XP to 0 (or keep partial?).
    // Usually leveling up resets XP in this system (addXp consumes it).
    // So let's just set Level to Target, XP to 0, and trigger notifications.
    // BUT we need to trigger notifications for EACH level.

    // We can just loop `handleLevelUp` calls?
    // `handleLevelUp` sends notifications.
    // But it expects DB state to be updated?
    // `handleLevelUp` reads config and adds rewards to DB. It doesn't check user DB level state for validation, just assumes it happened.
    // So we can update DB once to final state, then call handleLevelUp.
    // Wait, requirement 4: "If an admin grants multiple levels... send an individual DM for **every single level earned**".
    // My previous `handleLevelUp` batched them.
    // I need to refactor `handleLevelUp` to support single level or be called in a loop.

    // Let's refactor handleLevelUp to be single-level focused or loop inside it generating multiple DMs.
    // Loop inside seems safer to avoid race conditions with DB if we did async calls.

    // Update DB first
    db.prepare('UPDATE users SET level = ?, xp = 0 WHERE id = ?').run(targetLevel, userId);

    // Call handler
    await handleLevelUp(userId, currentLevel, targetLevel, interaction);
}

async function adminRevokeXp(userId, amount) {
    // Revoking XP is tricky if it causes level down.
    // db.addXp doesn't support negative logic well (it loops up).
    // Simple implementation: Subtract raw XP. If < 0, handle level down?
    // Prompt just says "Revoke ... value".
    // I will just subtract from `xp`. If it goes negative, I won't de-level automatically unless requested.
    // Usually games don't de-level on XP loss unless specific.
    // But `grant/revoke progress` implies moving bar.
    // Let's just `UPDATE users SET xp = xp - amount`.
    db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?').run(amount, userId);
}

async function adminRevokeLevels(userId, amount) {
    db.prepare('UPDATE users SET level = MAX(0, level - ?) WHERE id = ?').run(amount, userId);
}

async function handleLevelUp(userId, oldLevel, newLevel, interaction) {
    // Loop through each level to send individual DMs
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        await processSingleLevelUp(userId, lvl - 1, lvl, interaction);
    }
}

async function processSingleLevelUp(userId, fromLevel, toLevel, interaction) {
    const rewardsList = [];

    // Bank Space
    const user = db.getUser(userId);
    const prestige = user.prestige || 0;
    const bankSpacePerLevel = 1000 + (prestige * 10);
    const currentLevelGain = bankSpacePerLevel + ((toLevel - 1) * 100);
    rewardsList.push(`+${currentLevelGain.toLocaleString()} Bank Space`);

    const config = levelsConfig.find(l => l.level === toLevel);
    if (config && config.rewards) {
        const r = config.rewards;

        if (r.coins) {
            db.addBalance(userId, r.coins);
            rewardsList.push(`֍ ${r.coins.toLocaleString()}`);
        }

        if (r.items) {
            for (const item of r.items) {
                const itemRef = itemsConfig.find(i => i.id === item.id);
                if (itemRef) {
                    db.addItem(userId, item.id, item.amount);
                    rewardsList.push(`${item.amount}x ${itemRef.emoji} ${itemRef.name}`);
                }
            }
        }

        if (r.title) {
            db.addTitle(userId, r.title);
            rewardsList.push(`Title: **${r.title}**`);
        }

        if (r.multiplier_bonus) {
            rewardsList.push(`+${r.multiplier_bonus}% Coin Multiplier`);
        }
    }

    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace('{user}', interaction.user.username);
    const dateFooter = new Date().toLocaleString('en-US', { hour12: false });

    const embed = new EmbedBuilder()
        .setTitle('Level up!')
        .setDescription(`${greeting} You leveled up from level **${fromLevel}** to **${toLevel}**`)
        .setColor(0x00FF00)
        .setFooter({ text: dateFooter });

    if (rewardsList.length > 0) {
        embed.addFields({ name: 'Rewards', value: rewardsList.map(r => `- ${r}`).join('\n') });
    }

    try {
        await interaction.user.send({ embeds: [embed] });
    } catch (e) {
        // Fallback to Ephemeral
        const failEmbed = new EmbedBuilder(embed.toJSON());
        failEmbed.setFooter({ text: `${dateFooter}\n(I tried to DM you but you blocked me. Rude.)` });

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [failEmbed], flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ embeds: [failEmbed], flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.error('Failed to send level up fallback', err);
        }
    }
}

function checkLevelUp(userId, interaction) {
    // Deprecated
}

function getLevelRewards(level) {
    return levelsConfig.find(l => l.level === level);
}

module.exports = { grantXp, adminGrantXp, adminGrantLevels, adminRevokeXp, adminRevokeLevels, checkLevelUp, getLevelRewards };
