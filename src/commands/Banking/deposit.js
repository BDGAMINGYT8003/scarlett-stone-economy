const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
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
            const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Invalid Amount\nInvalid amount specified.'));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        if (amount > userData.balance) {
            const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# Insufficient Funds\nYou don't have that much money in your wallet! You only have **֍ ${userData.balance.toLocaleString()}**.`)
                );
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        // Check Bank Capacity
        const availableSpace = userData.bank_capacity - userData.bank;
        if (amount > availableSpace) {
             const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# Bank Full\nYou don't have enough bank space! You can only deposit **֍ ${availableSpace.toLocaleString()}** more.`)
                );
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        db.removeBalance(userId, amount);
        db.addBank(userId, amount);

        const updatedUser = db.getUser(userId);

        const embed = new ContainerBuilder()
            .setColor(0x00FF00) // Green
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# Deposited to Bank\n**֍ ${amount.toLocaleString()}** deposited.`)
            )
            .addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Wallet**\n֍ ${updatedUser.balance.toLocaleString()}`),
                    new TextDisplayBuilder().setContent(`**Bank**\n֍ ${updatedUser.bank.toLocaleString()}`)
                )
            );

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
