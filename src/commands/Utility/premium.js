const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Manage or check premium status.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your premium status.')),
    async execute(interaction) {
        const userId = interaction.user.id;
        const isPremium = db.isPremium(userId);

        const embed = new EmbedBuilder();

        if (isPremium) {
            embed
                .setTitle('Premium Status: Active')
                .setDescription('You are a **Premium User**!\nEnjoy your perks:\n- Reduced cooldowns on economy commands\n- Shorter work shifts\n- And more!')
                .setColor(0x00FF00) // Green
                .setFooter({ text: 'Thank you for supporting the bot!' });
        } else {
            embed
                .setTitle('Premium Status: Inactive')
                .setDescription('You are currently **NOT** a Premium User.\n\n**Perks you are missing:**\n- 50% reduced cooldowns\n- Special access\n\n*Contact the developer to support the bot!*')
                .setColor(0xFF0000) // Red
                .setFooter({ text: 'Become a supporter today!' });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
