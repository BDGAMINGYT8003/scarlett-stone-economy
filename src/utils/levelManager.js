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

    // Use db.addXp which now encapsulates the new formula and loop logic
    db.addXp(userId, xpAmount);

    // Check if level changed
    const newUser = db.getUser(userId);
    if (newUser.level > oldLevel) {
        await handleLevelUp(userId, oldLevel, newUser.level, interaction);
    }
}

async function handleLevelUp(userId, oldLevel, newLevel, interaction) {
    const rewardsList = [];

    for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        const config = levelsConfig.find(l => l.level === lvl);
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
    }

    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)].replace('{user}', interaction.user.username);
    const dateFooter = new Date().toLocaleString('en-US', { hour12: false });

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
    // Deprecated by grantXp internal check
}

function getLevelRewards(level) {
    return levelsConfig.find(l => l.level === level);
}

module.exports = { grantXp, checkLevelUp, getLevelRewards };
