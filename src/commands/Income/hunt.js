const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { calculateMultiplier } = require('../../utils/multiplier');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const levelManager = require('../../utils/levelManager');
const huntConfig = require('../../config/hunt.json');
const items = require('../../config/items.json');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hunt')
        .setDescription('Hunt for animals and items using a rifle.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // 1. Check for Hunting Rifle
        const rifleCount = db.getItemCount(userId, 'hunting_rifle');
        if (rifleCount <= 0) {
            const embed = new EmbedBuilder()
                .setTitle('Missing Item')
                .setDescription('You need a **🔫 Hunting Rifle** to hunt!')
                .setColor(0xFF0000)
                .setFooter({ text: 'Buy one from the shop or find one!' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // 2. Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'hunt');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('hunt', cooldown.readyAt, 25, 10)],
                flags: MessageFlags.Ephemeral
            });
        }

        // 3. Determine Outcome
        const roll = Math.random() * 100;
        let scenario = 'fail';

        // Probabilities:
        // Fail: 30%
        // Success Coin: 30%
        // Success Item: 25%
        // Success Both: 15%

        if (roll < 30) {
            scenario = 'fail';
        } else if (roll < 60) {
            scenario = 'success_coin';
        } else if (roll < 85) {
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
                const baseAmount = Math.floor(Math.random() * (3000 - 500 + 1)) + 500;
                const multipliers = calculateMultiplier(userId);
                multiTotal = multipliers.total;
                bonusAmount = Math.floor(baseAmount * (multiTotal / 100));
                amount = baseAmount + bonusAmount;
            }

            // Item Calculation
            if (scenario === 'success_item' || scenario === 'success_both') {
                const itemRoll = Math.random() * 100;
                let cumulativeChance = 0;
                for (const loot of huntConfig.loot_table) {
                    cumulativeChance += loot.chance;
                    if (itemRoll <= cumulativeChance) {
                        item = items.find(i => i.id === loot.id);
                        break;
                    }
                }
                // Fallback item if roll exceeds table (shouldn't happen if normalized, but safety first)
                if (!item) item = items.find(i => i.id === 'rabbit');
            }
        }

        // Select Message
        const messages = huntConfig[scenario];
        message = messages[Math.floor(Math.random() * messages.length)];

        // Format Message
        message = message.replace('{amount}', amount.toLocaleString());
        if (item) {
            message = message.replace('{item_emoji}', item.emoji).replace('{item_name}', item.name);
        } else {
            // Remove item placeholders if no item
            message = message.replace('{item_emoji}', '').replace('{item_name}', 'nothing');
        }

        // Apply Rewards
        if (amount > 0) db.addBalance(userId, amount);
        if (item) db.addItem(userId, item.id, 1);

        // Logging
        if (amount > 0 || item) {
            db.logTransaction(userId, 'hunt', {
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
        db.incrementStat(userId, 'hunt_count');
        await checkAndUnlockBadges(userId, interaction);

        if (amount > 0 || item) {
            await levelManager.grantXp(userId, 'profit', interaction);
        } else {
            await levelManager.grantXp(userId, 'loss', interaction);
        }

        // Set Cooldown
        setDurationCooldown(userId, 'hunt', 25, 10);

        // Rifle Break Logic (20%)
        const breakRoll = Math.random() * 100;
        let rifleBroken = false;
        if (breakRoll < 20) {
            rifleBroken = true;
            db.removeItem(userId, 'hunting_rifle', 1);
        }

        // Construct Embed
        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username} went hunting...`)
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
                embed.setFooter({ text: 'The hunt was a success!' });
            }
        }

        await interaction.reply({ embeds: [embed] });

        // Break Notification
        if (rifleBroken) {
            const breakEmbed = new EmbedBuilder()
                .setTitle('Bang... Crack!')
                .setDescription('Your **🔫 Hunting Rifle** misfired and exploded. RIP.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Safety first, kids.' });

            await interaction.followUp({ embeds: [breakEmbed], flags: MessageFlags.Ephemeral });
        }
    },
};
