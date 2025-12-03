const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
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
                embeds: [getScheduleCooldownEmbed('daily', check.readyAt)]
            });
        }

        const amount = 5000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'daily', Date.now());

        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('Daily Reward')
            .setDescription(`You claimed your daily reward of **֍ ${amount.toLocaleString()}**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
