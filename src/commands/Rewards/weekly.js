const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Claim your weekly premium rewards.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const now = Date.now();
        const cooldown = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (now - userData.weekly_last_claimed < cooldown) {
            const remaining = cooldown - (now - userData.weekly_last_claimed);
            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
            return interaction.reply({ content: `You can claim your weekly reward again in ${days}d ${hours}h.`, ephemeral: true });
        }

        const amount = 25000; // Example amount
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'weekly', now);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('Weekly Reward')
            .setDescription(`You claimed your weekly reward of **֍ ${amount}**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
