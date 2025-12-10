const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
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
                components: [getScheduleCooldownEmbed('daily', check.readyAt)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const userData = db.getUser(userId);
        const lastClaimed = userData.daily_last_claimed || 0;
        const currentStreak = userData.daily_streak || 0;
        const now = Date.now();

        const MS_IN_DAY = 86400000;
        const timeSinceLastClaim = now - lastClaimed;

        let newStreak = currentStreak;
        let streakReset = false;
        let oldStreak = currentStreak;

        if (lastClaimed > 0 && timeSinceLastClaim > (MS_IN_DAY * 2)) {
            newStreak = 0;
            streakReset = true;
        }

        if (!streakReset) {
            newStreak += 1;
        } else {
            newStreak = 1;
        }

        const baseReward = 5000;
        const streakBonus = newStreak * 500;
        const totalAmount = baseReward + streakBonus;

        db.addBalance(userId, totalAmount);
        db.setLastClaimed(userId, 'daily', now);
        db.setStreak(userId, newStreak);

        const nextDailyTimestamp = Math.floor((now + MS_IN_DAY) / 1000);
        const nextItemTimestamp = Math.floor((now + (MS_IN_DAY * 7)) / 1000);

        const embed = new ContainerBuilder()
            .setColor(0xFFFF00) // Yellow/Gold
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Daily Coins\n> **֍ ${totalAmount.toLocaleString()}** was placed in your wallet!`)
            )
            .addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Base**\n֍ 5,000`),
                    new TextDisplayBuilder().setContent(`**Streak Bonus**\n֍ ${streakBonus.toLocaleString()}`),
                    new TextDisplayBuilder().setContent(`**Donor Bonus**\n֍ 0`)
                ),
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Next Daily**\n<t:${nextDailyTimestamp}:R>`),
                    new TextDisplayBuilder().setContent(`**Next Item Reward**\n<a:DailyBoxClosed:861390900219478037> <t:${nextItemTimestamp}:R>`),
                    new TextDisplayBuilder().setContent(`**Streak**\n${newStreak.toLocaleString()}`)
                )
            );

        const components = [embed];

        if (streakReset) {
            const daysMissed = Math.floor(timeSinceLastClaim / MS_IN_DAY);
            const lastDailyTimestamp = Math.floor(lastClaimed / 1000);

            const lostEmbed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# Streak Lost!\nYou forgot to claim your daily for **${daysMissed}** days, so you lost your **${oldStreak.toLocaleString()}**-day streak.\nYou last claimed your daily <t:${lastDailyTimestamp}:R>.`),
                    new TextDisplayBuilder().setContent("Streaks reset if you don't claim within 48 hours!")
                );

            components.push(lostEmbed);
        }

        await interaction.reply({ components: components, flags: MessageFlags.IsComponentsV2 });
    },
};
