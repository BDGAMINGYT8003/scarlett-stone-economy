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
    if (!interaction) return; // Safety

    // Basic Validation: Ensure command interaction (or button which is part of command flow)
    // Friends commands are excluded by caller logic (not calling this function).
    // Pagination buttons are excluded by caller logic.

    const xpAmount = outcomeType === 'profit' ? 2 : 1;
    const user = db.getUser(userId);

    let currentXp = user.xp || 0;
    let currentLevel = user.level || 0;

    currentXp += xpAmount;

    let required = (currentLevel + 1) * 250;
    let leveledUp = false;
    let oldLevel = currentLevel;

    // Check Level Up
    if (currentXp >= required) {
        currentXp -= required;
        currentLevel++;
        leveledUp = true;

        // Handle multi-level jump? Usually 1 step at a time with low XP gain.
        // But loop just in case.
        required = (currentLevel + 1) * 250;
        while (currentXp >= required) {
            currentXp -= required;
            currentLevel++;
            required = (currentLevel + 1) * 250;
        }
    }

    // Update DB directly (bypass db.addXp to avoid redundancy if we implement logic here, or update db.addXp to be dumb setter)
    // To respect existing db.js, we can use `db.prepare('UPDATE ...')` but db.js is the interface.
    // However, db.addXp logic loops. I implemented the loop here to know IF we leveled up.
    // So I will perform the update query manually to have control.
    // Actually, I should use `db.prepare` from `db.js`? `db.js` exports `getUser` etc. but not `db` object usually.
    // `db.js` exports `addXp` which handles logic.
    // If I use `db.addXp`, I don't know if level up happened easily without querying before/after.
    // Efficient way:
    // 1. Calculate locally.
    // 2. Update DB.
    // 3. If leveled up, process rewards.

    // We need to execute SQL. `db.js` uses `better-sqlite3`.
    // `db.js` exports specific functions. I should add `setLevel(userId, level, xp)` to db.js or use raw query if I can access db instance.
    // `db.js` DOES NOT export `db` instance.
    // So I must rely on `db.addXp` or add a new helper.
    // `db.addXp` does the math.
    // Let's use `db.addXp` and check level after.

    db.addXp(userId, xpAmount);

    // Check if level changed
    const newUser = db.getUser(userId);
    if (newUser.level > oldLevel) {
        // Leveled Up!
        await handleLevelUp(userId, oldLevel, newUser.level, interaction);
    }
}

async function handleLevelUp(userId, oldLevel, newLevel, interaction) {
    const rewardsList = [];

    // Iterate through all levels passed (in case of multi-level jump, though rare)
    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        const config = levelsConfig.find(l => l.level === lvl);
        if (config && config.rewards) {
            const r = config.rewards;

            // Coins
            if (r.coins) {
                db.addBalance(userId, r.coins);
                rewardsList.push(`֍ ${r.coins.toLocaleString()}`);
            }

            // Items
            if (r.items) {
                for (const item of r.items) {
                    // Check if item exists in config to get name/emoji
                    const itemRef = itemsConfig.find(i => i.id === item.id);
                    if (itemRef) {
                        db.addItem(userId, item.id, item.amount);
                        rewardsList.push(`${item.amount}x ${itemRef.emoji} ${itemRef.name}`);
                    } else {
                        // Fallback or skip
                        console.warn(`Level reward item ${item.id} not found in items.json`);
                    }
                }
            }

            // Title
            if (r.title) {
                // Determine Title ID? Or is title a string stored directly?
                // `unlocked_titles` table stores title_id.
                // The chart gives "Name".
                // Assuming `r.title` IS the ID or Name.
                // db.addTitle expects titleId.
                // Let's treat the string in levels.json as the ID/Name.
                db.addTitle(userId, r.title);
                rewardsList.push(`Title: **${r.title}**`);
            }

            // Multiplier Bonus
            // logic in multiplier.js handles calculation if we look up levels.json
            if (r.multiplier_bonus) {
                rewardsList.push(`+${r.multiplier_bonus}% Coin Multiplier`);
            }
        }
    }

    if (rewardsList.length === 0) {
        // Just notification
        // return;
        // User always wants notification? "Every time a user levels up..."
        // If no rewards, maybe just say "Level Up".
        // But practically, levels without rewards might just be silent or generic.
        // Prompt implies rewards chart is full.
        // Let's send DM anyway.
    }

    // Prepare Notification
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace('{user}', interaction.user.username);
    const dateFooter = new Date().toLocaleString('en-US', { hour12: false }); // "03/01/2024 15:21" format approximation

    const embed = new EmbedBuilder()
        .setTitle('Level up!')
        .setDescription(`${greeting} You leveled up from level **${oldLevel}** to **${newLevel}**`)
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
        failEmbed.setFooter({ text: `${dateFooter}\n(DM failed because your DMs are locked. Unblock to receive these privately!)` });

        // We need to send this to the channel/interaction
        // Since the original interaction might have been replied to already (it's "successful command"), we usually use followUp
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ embeds: [failEmbed], flags: MessageFlags.Ephemeral });
            } else {
                // Should not happen for successful commands usually
                await interaction.reply({ embeds: [failEmbed], flags: MessageFlags.Ephemeral });
            }
        } catch (err) {
            console.error('Failed to send level up fallback', err);
        }
    }
}

function checkLevelUp(userId, interaction) {
    // Helper if needed externally, but grantXp handles it.
}

function getLevelRewards(level) {
    return levelsConfig.find(l => l.level === level);
}

module.exports = { grantXp, checkLevelUp, getLevelRewards };
