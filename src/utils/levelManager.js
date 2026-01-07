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
    let targetLevel = currentLevel + amount;

    try {
        // Update DB first using helper
        db.setLevel(userId, targetLevel);
    } catch (e) {
        // Fallback: Calculate XP difference if direct level set fails
        console.error(`Failed to set level directly for user ${userId}, falling back to XP grant:`, e);

        // Calculate cumulative XP required to reach targetLevel from currentLevel
        // Formula: Req = 80 + (Level * 0.05) per level step
        // But since we want to reach targetLevel starting from current XP (assumed 0 after level up? No, current XP exists)
        // Actually, simplest fallback as requested: "fetch current level and XP... calculate total XP needed... grant that XP"
        // addXp handles level ups. So we just need to add enough XP to bridge the gap.

        // However, calculating exact XP for N levels with a dynamic formula is complex.
        // Formula: Req = ceil(80 + (L * 0.05))
        // We can loop to sum it up.

        let xpNeeded = 0;
        let tempLevel = currentLevel;
        // User already has `user.xp` towards the next level `tempLevel + 1`.
        // First step: Finish current level.
        let reqForNext = Math.ceil(80 + (tempLevel * 0.05));
        let remainingForNext = Math.max(0, reqForNext - (user.xp || 0));

        xpNeeded += remainingForNext;
        tempLevel++;

        // Subsequent steps
        while (tempLevel < targetLevel) {
            let req = Math.ceil(80 + (tempLevel * 0.05));
            xpNeeded += req;
            tempLevel++;
        }

        // Grant the XP
        db.addXp(userId, xpNeeded);

        // handleLevelUp is handled by addXp internal check?
        // No, addXp calls `db.prepare` but does NOT call `handleLevelUp`.
        // `grantXp` calls `addXp` then `handleLevelUp`.
        // `adminGrantXp` calls `addXp` then `handleLevelUp`.
        // So if we use `db.addXp`, we must manually call `handleLevelUp` OR use `adminGrantXp` (but recursively? No).
        // Since we are inside `adminGrantLevels`, we want to trigger the DMs.
        // `addXp` updates the DB state.
        // So after `db.addXp`, the user IS at `targetLevel`.
        // So we proceed to `await handleLevelUp` below.
    }

    // Call handler
    await handleLevelUp(userId, currentLevel, targetLevel, interaction);
}

async function adminRevokeXp(userId, amount) {
    db.prepare('UPDATE users SET xp = MAX(0, xp - ?) WHERE id = ?').run(amount, userId);
}

async function adminRevokeLevels(userId, amount) {
    db.prepare('UPDATE users SET level = MAX(0, level - ?) WHERE id = ?').run(amount, userId);
}

async function handleLevelUp(userId, oldLevel, newLevel, interaction) {
    // Loop through each level to send individual DMs
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        try {
            await processSingleLevelUp(userId, lvl - 1, lvl, interaction);
        } catch (err) {
            console.error(`Failed to process level up for user ${userId} at level ${lvl}:`, err);
            // Continue to next level despite error
        }
    }
}

async function processSingleLevelUp(userId, fromLevel, toLevel, interaction) {
    const rewardsList = [];

    // Bank Space
    const user = db.getUser(userId);
    const prestige = user.prestige || 0;
    const bankSpacePerLevel = 1000 + (prestige * 10);
    // Correct cumulative gain calculation for THIS SINGLE LEVEL step
    // The previous loop logic was confusing.
    // At Level X, the bonus gained *from reaching X* is `1000 + P*10 + (X-1)*100`.
    const currentLevelGain = bankSpacePerLevel + ((toLevel - 1) * 100);
    rewardsList.push(`+${currentLevelGain.toLocaleString()} Bank Space`);

    const config = levelsConfig.find(l => l.level === toLevel);
    if (config && config.rewards) {
        const r = config.rewards;

        if (r.coins) {
            db.addBalance(userId, r.coins);
            db.logTransaction(userId, 'level up reward', { amount: r.coins });
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
        // Humorous footer for DM fail
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
