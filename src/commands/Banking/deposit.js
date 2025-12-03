const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const parseAmount = require('../../utils/numberParser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit coins into your bank from your pocket.')
        .addStringOption(option =>
            option.setName('amount')
                .setDescription('Amount to deposit (e.g. 100, 2k, 50%, all)')
                .setRequired(true)),
    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = db.getUser(userId);
        const amountStr = interaction.options.getString('amount');

        const amount = parseAmount(amountStr, userData.balance);

        if (amount <= 0) {
            return interaction.reply({ content: 'Invalid amount specified.', ephemeral: true });
        }

        if (amount > userData.balance) {
            return interaction.reply({ content: `You don't have that much money in your wallet! You only have **֍ ${userData.balance.toLocaleString()}**.`, ephemeral: true });
        }

        db.removeBalance(userId, amount);
        db.addBank(userId, amount);

        // Fetch updated data for the embed
        const updatedUser = db.getUser(userId);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Deposited to Bank')
            .setDescription(`**֍ ${amount.toLocaleString()}** deposited.\n\n**Wallet:** ֍ ${updatedUser.balance.toLocaleString()}\n**Bank:** ֍ ${updatedUser.bank.toLocaleString()}`);

        await interaction.reply({ embeds: [embed] });
    },
};
