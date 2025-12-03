const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your wallet and bank balance.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check balance for')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = db.getUser(targetUser.id);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle(`${targetUser.username}'s Balance`)
            .addFields(
                { name: 'Wallet', value: `${userData.balance} coins`, inline: true },
                { name: 'Bank', value: `${userData.bank} coins`, inline: true },
                { name: 'Total', value: `${userData.balance + userData.bank} coins`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
