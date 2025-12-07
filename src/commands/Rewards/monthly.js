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

        const amount = 500000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'monthly', Date.now());

        const now = Date.now();
        // 30 days in seconds
        const nextMonthlyTimestamp = Math.floor((now + (30 * 24 * 60 * 60 * 1000)) / 1000);

        const embed = new EmbedBuilder()
            .setColor(0x800080) // Purple
            .setTitle(`${interaction.user.username}'s Monthly Coins`)
            .setDescription(`> **֍ ${amount.toLocaleString()}** was placed in your wallet!`)
            .addFields(
                { name: 'Base', value: `֍ ${amount.toLocaleString()}`, inline: true },
                { name: 'Donor Bonus', value: '֍ 0', inline: true },
                { name: 'Next Monthly', value: `<t:${nextMonthlyTimestamp}:R>`, inline: true },
                { name: 'Next Item Reward', value: `<a:MonthlyBoxClosed:861390900219478037> <t:${nextMonthlyTimestamp}:R>`, inline: true }
            );

        await interaction.reply({ embeds: [embed] });
    },
};
