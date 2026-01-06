const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Each day you can get a small amount of coins and maintain a streak.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'daily');
        if (check.onCooldown) {
            return interaction.reply({
                embeds: [getScheduleCooldownEmbed('daily', check.readyAt)]
            });
        }

        const userData = db.getUser(userId);
        const lastClaimed = userData.daily_last_claimed || 0;
        const currentStreak = userData.daily_streak || 0;
        const now = Date.now();

        // 24 hours in ms = 86400000
        // 48 hours in ms = 172800000
        const MS_IN_DAY = 86400000;
        const timeSinceLastClaim = now - lastClaimed;

        let newStreak = currentStreak;
        let streakReset = false;
        let oldStreak = currentStreak;

        // If it's been more than 48 hours, reset streak (unless first time claiming)
        if (lastClaimed > 0 && timeSinceLastClaim > (MS_IN_DAY * 2)) {
            newStreak = 0;
            streakReset = true;
        }

        // Increment streak (streaks start at 0, so first claim makes it 1 if logic implies counter,
        // but prompt says "Streaks start at 0" and "bonus = Streak Count * 500".
        // If I claim today, streak should probably go up.
        // "If the user claims their daily reward ... increment the streak."

        // If resetting, we reset to 0, then claim increments to 1? Or reset means we start over?
        // Typically daily streaks: Day 1 = 1.
        // Prompt: "Streaks start at 0".
        // Let's assume on successful claim we increment.

        if (!streakReset) {
            newStreak += 1;
        } else {
            newStreak = 1; // Reset then increment for today
        }

        const baseReward = 5000;
        const streakBonus = newStreak * 500;
        const totalAmount = baseReward + streakBonus;

        db.addBalance(userId, totalAmount);
        db.setLastClaimed(userId, 'daily', now);
        db.setStreak(userId, newStreak);
        await checkAndUnlockBadges(userId, interaction);

        // Timestamps
        const nextDailyTimestamp = Math.floor((now + MS_IN_DAY) / 1000);
        // Next item reward (placeholder 7 days) logic as per prompt
        const nextItemTimestamp = Math.floor((now + (MS_IN_DAY * 7)) / 1000);

        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Daily Coins`)
            .setDescription(`> **֍ ${totalAmount.toLocaleString()}** was placed in your wallet!`)
            .addFields(
                { name: 'Base', value: '֍ 5,000', inline: true },
                { name: 'Streak Bonus', value: `֍ ${streakBonus.toLocaleString()}`, inline: true },
                { name: 'Donor Bonus', value: '֍ 0', inline: true },
                { name: 'Next Daily', value: `<t:${nextDailyTimestamp}:R>`, inline: true },
                { name: 'Next Item Reward', value: `<a:DailyBoxClosed:861390900219478037> <t:${nextItemTimestamp}:R>`, inline: true },
                { name: 'Streak', value: `${newStreak.toLocaleString()}`, inline: true }
            )
            .setColor(0xFFFF00); // Yellow/Gold

        const embeds = [embed];

        if (streakReset) {
            // Calculate days missed roughly
            const daysMissed = Math.floor(timeSinceLastClaim / MS_IN_DAY);
            const lastDailyTimestamp = Math.floor(lastClaimed / 1000);

            const lostEmbed = new EmbedBuilder()
                .setTitle('Streak Lost!')
                .setDescription(`You forgot to claim your daily for **${daysMissed}** days, so you lost your **${oldStreak.toLocaleString()}**-day streak.\nYou last claimed your daily <t:${lastDailyTimestamp}:R>.`)
                .setFooter({ text: "Streaks reset if you don't claim within 48 hours!" })
                .setColor(0xFF0000); // Red

            embeds.push(lostEmbed);
        }

        await interaction.reply({ embeds: embeds });
    },
};
