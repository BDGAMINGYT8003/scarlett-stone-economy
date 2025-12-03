const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('See someone’s balance, including pocket, bank, net worth, and more.')
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
                { name: 'Wallet', value: `֍ ${userData.balance.toLocaleString()}`, inline: true },
                { name: 'Bank', value: `֍ ${userData.bank.toLocaleString()}`, inline: true },
                { name: 'Total', value: `֍ ${(userData.balance + userData.bank).toLocaleString()}`, inline: true }
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
