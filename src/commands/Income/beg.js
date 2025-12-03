const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Ask for coins; low payout but easy to spam.'),
    async execute(interaction) {
        const userId = interaction.user.id;
        // Simple cooldown logic without DB for simplicity, or we can add to DB.
        // For beg, usually short cooldown like 45s.
        // Implementing simple in-memory cooldown map for beg to avoid spamming DB calls for cooldown check?
        // Or just use DB for consistency. Let's add a quick column or just check timestamps.
        // For simplicity in this task, I'll use a random chance and small payout.

        const success = Math.random() > 0.3; // 70% chance to succeed
        if (!success) {
            const failMessages = [
                "Stop begging.",
                "Get a job.",
                "No coins for you.",
                "I don't have any change."
            ];
            const message = failMessages[Math.floor(Math.random() * failMessages.length)];
            return interaction.reply({ content: message });
        }

        const amount = Math.floor(Math.random() * 500) + 1;
        db.addBalance(userId, amount);

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setDescription(`You begged and received **֍ ${amount}**!`);

        await interaction.reply({ embeds: [embed] });
    },
};
