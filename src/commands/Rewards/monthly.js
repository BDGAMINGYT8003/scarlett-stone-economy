const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly')
        .setDescription('Each month, receive a large amount of coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'monthly');
        if (check.onCooldown) {
            return interaction.reply({
                embeds: [getScheduleCooldownEmbed('monthly', check.readyAt)]
            });
        }

        const amount = 100000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'monthly', Date.now());

        const embed = new EmbedBuilder()
            .setColor(0x800080)
            .setTitle('Monthly Reward')
            .setDescription(`You claimed your monthly reward of **֍ ${amount.toLocaleString()}**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
