const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
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
            const embed = new EmbedBuilder()
                .setTitle('Invalid Amount')
                .setDescription('Invalid amount specified.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (amount > userData.balance) {
            const embed = new EmbedBuilder()
                .setTitle('Insufficient Funds')
                .setDescription(`You don't have that much money in your wallet! You only have **֍ ${userData.balance.toLocaleString()}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Check Bank Capacity
        const availableSpace = userData.bank_capacity - userData.bank;
        if (amount > availableSpace) {
             const embed = new EmbedBuilder()
                .setTitle('Bank Full')
                .setDescription(`You don't have enough bank space! You can only deposit **֍ ${availableSpace.toLocaleString()}** more.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        db.removeBalance(userId, amount);
        db.addBank(userId, amount);
        db.logTransaction(userId, 'deposit', { amount: -amount });

        const updatedUser = db.getUser(userId);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('Deposited to Bank')
            .setDescription(`**֍ ${amount.toLocaleString()}** deposited.\n\n**Wallet:** ֍ ${updatedUser.balance.toLocaleString()}\n**Bank:** ֍ ${updatedUser.bank.toLocaleString()}`);

        await interaction.reply({ embeds: [embed] });
    },
};
