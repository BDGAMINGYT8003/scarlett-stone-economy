const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly premium rewards.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'weekly');
        if (check.onCooldown) {
            return interaction.reply({
                embeds: [getScheduleCooldownEmbed('weekly', check.readyAt)]
            });
        }

        const amount = 25000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'weekly', Date.now());

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Weekly Reward')
            .setDescription(`You claimed your weekly reward of **֍ ${amount.toLocaleString()}**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
