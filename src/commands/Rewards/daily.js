const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily free coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const now = Date.now();
        const cooldown = 24 * 60 * 60 * 1000; // 24 hours

        if (now - userData.daily_last_claimed < cooldown) {
            const remaining = cooldown - (now - userData.daily_last_claimed);
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
            return interaction.reply({ content: `You can claim your daily reward again in ${hours}h ${minutes}m.`, ephemeral: true });
        }

        const amount = 5000; // Example amount
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'daily', now);

        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('Daily Reward')
            .setDescription(`You claimed your daily reward of **${amount} coins**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
