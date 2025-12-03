const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly')
        .setDescription('Claim monthly rewards.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const now = Date.now();
        const cooldown = 30 * 24 * 60 * 60 * 1000; // 30 days (approx)

        if (now - userData.monthly_last_claimed < cooldown) {
            const remaining = cooldown - (now - userData.monthly_last_claimed);
            const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
            return interaction.reply({ content: `You can claim your monthly reward again in ${days} days.`, ephemeral: true });
        }

        const amount = 100000; // Example amount
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'monthly', now);

        const embed = new EmbedBuilder()
            .setColor(0x800080)
            .setTitle('Monthly Reward')
            .setDescription(`You claimed your monthly reward of **${amount} coins**!`)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
