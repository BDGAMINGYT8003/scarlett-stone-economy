const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ModalBuilder, TextInputBuilder, TextInputStyle, Colors } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('See someone’s balance, including pocket, bank, net worth, and more.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check balance for.')),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        const generateBalanceEmbed = (user) => {
            const userData = db.getUser(user.id);
            const netWorth = (userData.balance ?? 0) + (userData.bank ?? 0);

            const container = new ContainerBuilder()
                .setColor(0x00FF00) // Green
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# ${user.username}'s Balance`)
                )
                .addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Pocket**\n֍ ${(userData.balance ?? 0).toLocaleString()}`),
                        new TextDisplayBuilder().setContent(`**Bank**\n֍ ${(userData.bank ?? 0).toLocaleString()} / ${(userData.bank_capacity ?? 5000).toLocaleString()}`)
                    ),
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Net Worth**\n֍ ${netWorth.toLocaleString()}`)
                    )
                );
            return container;
        };

        const generateButtons = (isSelf) => {
             const row = new ActionRowBuilder();
             if (isSelf) {
                 row.addComponents(
                     new ButtonBuilder().setCustomId('deposit_btn').setLabel('Deposit').setStyle(ButtonStyle.Success),
                     new ButtonBuilder().setCustomId('withdraw_btn').setLabel('Withdraw').setStyle(ButtonStyle.Danger)
                 );
             }
             row.addComponents(
                 new ButtonBuilder().setCustomId('refresh_balance').setLabel('Refresh').setStyle(ButtonStyle.Secondary)
             );
             return row;
        };

        const isSelf = targetUser.id === interaction.user.id;
        const container = generateBalanceEmbed(targetUser);
        container.addActionRowComponents(generateButtons(isSelf));

        const response = await interaction.reply({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
             componentType: ComponentType.Button,
             time: 60000
        });

        collector.on('collect', async i => {
             if (i.user.id !== interaction.user.id) {
                 const error = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('These buttons are not for you.'));
                 return i.reply({ components: [error], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
             }

             if (i.customId === 'refresh_balance') {
                 // Re-fetch
                 const newContainer = generateBalanceEmbed(targetUser);
                 newContainer.addActionRowComponents(generateButtons(isSelf));
                 await i.update({ components: [newContainer] });
             } else if (i.customId === 'deposit_btn') {
                 const modal = new ModalBuilder()
                     .setCustomId('deposit_modal')
                     .setTitle('Deposit Coins');

                 const amountInput = new TextInputBuilder()
                     .setCustomId('amount')
                     .setLabel('Amount to deposit (or "max", "all")')
                     .setStyle(TextInputStyle.Short)
                     .setRequired(true);

                 const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
                 modal.addComponents(firstActionRow);

                 await i.showModal(modal);
             } else if (i.customId === 'withdraw_btn') {
                  const modal = new ModalBuilder()
                     .setCustomId('withdraw_modal')
                     .setTitle('Withdraw Coins');

                 const amountInput = new TextInputBuilder()
                     .setCustomId('amount')
                     .setLabel('Amount to withdraw (or "max", "all")')
                     .setStyle(TextInputStyle.Short)
                     .setRequired(true);

                 const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
                 modal.addComponents(firstActionRow);

                 await i.showModal(modal);
             }
        });

        collector.on('end', async () => {
             // Disable buttons
             const finalContainer = generateBalanceEmbed(targetUser);
             const buttons = generateButtons(isSelf);
             buttons.components.forEach(b => b.setDisabled(true));
             finalContainer.addActionRowComponents(buttons);

             try {
                await interaction.editReply({ components: [finalContainer] });
             } catch (e) {}
        });
    },
};
