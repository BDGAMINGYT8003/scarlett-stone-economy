const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { calculateMultiplier } = require('../../utils/multiplier');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const levelManager = require('../../utils/levelManager');
const fishConfig = require('../../config/fish.json');
const items = require('../../config/items.json');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Cast your line to catch fish and coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // 1. Check for Fishing Pole
        const poleCount = db.getItemCount(userId, 'fishing_pole');
        if (poleCount <= 0) {
            const embed = new EmbedBuilder()
                .setTitle('Missing Item')
                .setDescription('You need a **🎣 Fishing Pole** to fish!')
                .setColor(0xFF0000)
                .setFooter({ text: 'Buy one from the shop or find one!' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // 2. Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'fish');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('fish', cooldown.readyAt, 25, 10)],
                flags: MessageFlags.Ephemeral
            });
        }

        // 3. Determine Outcome
        const roll = Math.random() * 100;
        let scenario = 'fail';

        // Probabilities:
        // Fail: 35%
        // Success Coin: 30%
        // Success Item: 25%
        // Success Both: 10%

        if (roll < 35) {
            scenario = 'fail';
        } else if (roll < 65) {
            scenario = 'success_coin';
        } else if (roll < 90) {
            scenario = 'success_item';
        } else {
            scenario = 'success_both';
        }

        let amount = 0;
        let item = null;
        let message = '';
        let multiTotal = 0;
        let bonusAmount = 0;

        // Calculate Rewards
        if (scenario !== 'fail') {
            // Coin Calculation
            if (scenario === 'success_coin' || scenario === 'success_both') {
                const baseAmount = Math.floor(Math.random() * (2500 - 500 + 1)) + 500;
                const multipliers = calculateMultiplier(userId);
                multiTotal = multipliers.total;
                bonusAmount = Math.floor(baseAmount * (multiTotal / 100));
                amount = baseAmount + bonusAmount;
            }

            // Item Calculation
            if (scenario === 'success_item' || scenario === 'success_both') {
                const itemRoll = Math.random() * 100;
                let cumulativeChance = 0;
                for (const loot of fishConfig.loot_table) {
                    cumulativeChance += loot.chance;
                    if (itemRoll <= cumulativeChance) {
                        item = items.find(i => i.id === loot.id);
                        break;
                    }
                }
                // Fallback
                if (!item) item = items.find(i => i.id === 'common_fish');
            }
        }

        // Select Message
        const messages = fishConfig[scenario];
        message = messages[Math.floor(Math.random() * messages.length)];

        // Format Message
        message = message.replace('{amount}', amount.toLocaleString());
        if (item) {
            message = message.replace('{item_emoji}', item.emoji).replace('{item_name}', item.name);
        } else {
            message = message.replace('{item_emoji}', '').replace('{item_name}', 'nothing');
        }

        // Apply Rewards
        if (amount > 0) db.addBalance(userId, amount);
        if (item) db.addItem(userId, item.id, 1);

        // Logging
        if (amount > 0 || item) {
            db.logTransaction(userId, 'fish', {
                amount: amount,
                items: item ? [{
                    id: item.id,
                    name: item.name,
                    emoji: item.emoji,
                    quantity: 1
                }] : []
            });
        }

        // Stats & XP
        db.incrementStat(userId, 'fish_count');
        await checkAndUnlockBadges(userId, interaction);

        if (amount > 0 || item) {
            await levelManager.grantXp(userId, 'profit', interaction);
        } else {
            await levelManager.grantXp(userId, 'loss', interaction);
        }

        // Set Cooldown
        setDurationCooldown(userId, 'fish', 25, 10);

        // Pole Break Logic (20%)
        const breakRoll = Math.random() * 100;
        let poleBroken = false;
        if (breakRoll < 20) {
            poleBroken = true;
            db.removeItem(userId, 'fishing_pole', 1);
        }

        // Construct Embed
        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username} went fishing...`)
            .setDescription(message);

        if (scenario === 'fail') {
            embed.setColor(0xFF0000); // Red
            embed.setFooter({ text: 'Better luck next time.' });
        } else {
            embed.setColor(0x00FF00); // Green
            if (multiTotal > 0 && amount > 0) {
                const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                embed.setFooter({ text: `Multi Bonus: +${multiTotal}% (+ ֍ ${bonusAmount.toLocaleString()}) | Today at ${timeString}` });
            } else {
                embed.setFooter({ text: 'Something smells fishy...' });
            }
        }

        await interaction.reply({ embeds: [embed] });

        // Break Notification
        if (poleBroken) {
            const breakEmbed = new EmbedBuilder()
                .setTitle('Snap!')
                .setDescription('Your **🎣 Fishing Pole** snagged on a rock and snapped. RIP.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Plenty more fish (and poles) in the sea.' });

            await interaction.followUp({ embeds: [breakEmbed], flags: MessageFlags.Ephemeral });
        }
    },
};
