const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const parseAmount = require('../../utils/numberParser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw money from your bank into your pocket.')
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to withdraw (e.g. 100, 2k, 50%, all)')
                .setRequired(true)),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const amountStr = interaction.options.getString('amount');

        const amount = parseAmount(amountStr, userData.bank);

        if (amount <= 0) {
            const embed = new EmbedBuilder()
                .setTitle('Invalid Amount')
                .setDescription('Invalid amount specified.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (amount > userData.bank) {
             const embed = new EmbedBuilder()
                .setTitle('Insufficient Funds')
                .setDescription(`You don't have that much money in your bank! You only have **֍ ${userData.bank.toLocaleString()}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        db.removeBank(userId, amount);
        db.addBalance(userId, amount);

        // Fetch updated data for the embed
        const updatedUser = db.getUser(userId);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Withdrawn from Bank')
            .setDescription(`**֍ ${amount.toLocaleString()}** withdrawn.\n\n**Wallet:** ֍ ${updatedUser.balance.toLocaleString()}\n**Bank:** ֍ ${updatedUser.bank.toLocaleString()}`);

        await interaction.reply({ embeds: [embed] });
    },
};
