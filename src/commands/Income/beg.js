const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Ask for coins; low payout but easy to spam.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'beg', 20);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('beg', cooldown.readyAt, 20, 8)]
            });
        }

        const success = Math.random() > 0.3; // 70% chance to succeed
        if (!success) {
            setDurationCooldown(userId, 'beg', 20); // Cooldown applies on fail too? Usually yes.
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
        setDurationCooldown(userId, 'beg', 20);

        const embed = new EmbedBuilder()
            .setColor(0x00FFFF)
            .setDescription(`You begged and received **֍ ${amount}**!`);

        await interaction.reply({ embeds: [embed] });
    },
};
