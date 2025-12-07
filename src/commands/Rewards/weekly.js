const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Once per week, get a moderate amount of coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'weekly');
        if (check.onCooldown) {
            return interaction.reply({
                embeds: [getScheduleCooldownEmbed('weekly', check.readyAt)]
            });
        }

        const amount = 75000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'weekly', Date.now());

        const now = Date.now();
        // 7 days in seconds
        const nextWeeklyTimestamp = Math.floor((now + (7 * 24 * 60 * 60 * 1000)) / 1000);
        // 4 weeks in seconds
        const nextItemTimestamp = Math.floor((now + (4 * 7 * 24 * 60 * 60 * 1000)) / 1000);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Orange
            .setTitle(`${interaction.user.username}'s Weekly Coins`)
            .setDescription(`> **֍ ${amount.toLocaleString()}** was placed in your wallet!`)
            .addFields(
                { name: 'Base', value: `֍ ${amount.toLocaleString()}`, inline: true },
                { name: 'Donor Bonus', value: '֍ 0', inline: true },
                { name: 'Next Weekly', value: `<t:${nextWeeklyTimestamp}:R>`, inline: true },
                { name: 'Next Item Reward', value: `<a:WeeklyBoxClosed:861390900219478037> <t:${nextItemTimestamp}:R>`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
