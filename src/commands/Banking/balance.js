const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const parseAmount = require('../../utils/numberParser');

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
        const isSelf = targetUser.id === interaction.user.id;

        const getEmbed = () => {
            const userData = db.getUser(targetUser.id);
            const balance = userData.balance ?? 0;
            const bank = userData.bank ?? 0;
            const bankCapacity = db.getEffectiveBankCapacity(targetUser.id);
            const freeSpace = bankCapacity - bank;

            return new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`${targetUser.username}'s Balance`)
                .addFields(
                    { name: 'Wallet', value: `֍ ${balance.toLocaleString()}`, inline: false },
                    { name: 'Bank', value: `Total: ֍ ${bank.toLocaleString()} / ֍ ${bankCapacity.toLocaleString()}\nFree space: ֍ ${freeSpace.toLocaleString()}`, inline: false }
                )
                .setTimestamp();
        };

        const getComponents = () => {
            if (!isSelf) return [];

            const withdrawBtn = new ButtonBuilder()
                .setCustomId('balance_withdraw')
                .setLabel('Withdraw')
                .setStyle(ButtonStyle.Secondary);

            const depositBtn = new ButtonBuilder()
                .setCustomId('balance_deposit')
                .setLabel('Deposit')
                .setStyle(ButtonStyle.Secondary);

            const refreshBtn = new ButtonBuilder()
                .setCustomId('balance_refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary);

            const row = new ActionRowBuilder().addComponents(withdrawBtn, depositBtn, refreshBtn);
            return [row];
        };

        const response = await interaction.reply({
            embeds: [getEmbed()],
            components: getComponents(),
            fetchReply: true
        });

        if (!isSelf) return;

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 300000 // 5 minutes
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission Denied')
                    .setDescription('This is not your balance session!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'balance_refresh') {
                await i.update({ embeds: [getEmbed()] });
                return;
            }

            // Handle Modal Triggers
            if (i.customId === 'balance_deposit' || i.customId === 'balance_withdraw') {
                const action = i.customId === 'balance_deposit' ? 'Deposit' : 'Withdraw';
                const modalId = i.customId === 'balance_deposit' ? 'modal_deposit' : 'modal_withdraw';

                const modal = new ModalBuilder()
                    .setCustomId(modalId)
                    .setTitle(`${action} Currency`);

                const amountInput = new TextInputBuilder()
                    .setCustomId('amountInput')
                    .setLabel(`Amount to ${action.toLowerCase()}`)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g. 100, 2k, all')
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(amountInput);
                modal.addComponents(firstActionRow);

                await i.showModal(modal);

                // Wait for modal submit
                try {
                    const submission = await i.awaitModalSubmit({
                        time: 60000,
                        filter: modalInteraction => modalInteraction.user.id === interaction.user.id && modalInteraction.customId === modalId
                    });
                    const amountStr = submission.fields.getTextInputValue('amountInput');
                    const userData = db.getUser(targetUser.id);

                    // Safe defaults
                    const userBalance = userData.balance ?? 0;
                    const userBank = userData.bank ?? 0;
                    const userBankCapacity = db.getEffectiveBankCapacity(targetUser.id);

                    let amount = 0;
                    let embed = null;

                    if (action === 'Deposit') {
                        amount = parseAmount(amountStr, userBalance);
                        if (amount <= 0) {
                            const errorEmbed = new EmbedBuilder()
                                .setTitle('Invalid Amount')
                                .setDescription('Invalid amount specified.')
                                .setColor(0xFF0000);
                            await submission.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                            return;
                        }
                        if (amount > userBalance) {
                            const errorEmbed = new EmbedBuilder()
                                .setTitle('Insufficient Funds')
                                .setDescription(`You don't have that much money in your wallet! You only have **֍ ${userBalance.toLocaleString()}**.`)
                                .setColor(0xFF0000);
                            await submission.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                            return;
                        }
                        const availableSpace = userBankCapacity - userBank;
                        if (amount > availableSpace) {
                            const errorEmbed = new EmbedBuilder()
                                .setTitle('Bank Full')
                                .setDescription(`You don't have enough bank space! You can only deposit **֍ ${availableSpace.toLocaleString()}** more.`)
                                .setColor(0xFF0000);
                            await submission.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                            return;
                        }

                        db.removeBalance(targetUser.id, amount);
                        db.addBank(targetUser.id, amount);

                        const updatedUser = db.getUser(targetUser.id);
                        const newBalance = updatedUser.balance ?? 0;
                        const newBank = updatedUser.bank ?? 0;

                        embed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('Deposited to Bank')
                            .setDescription(`**֍ ${amount.toLocaleString()}** deposited.\n\n**Wallet:** ֍ ${newBalance.toLocaleString()}\n**Bank:** ֍ ${newBank.toLocaleString()}`);

                    } else { // Withdraw
                        amount = parseAmount(amountStr, userBank);
                        if (amount <= 0) {
                            const errorEmbed = new EmbedBuilder()
                                .setTitle('Invalid Amount')
                                .setDescription('Invalid amount specified.')
                                .setColor(0xFF0000);
                            await submission.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                            return;
                        }
                        if (amount > userBank) {
                             const errorEmbed = new EmbedBuilder()
                                .setTitle('Insufficient Funds')
                                .setDescription(`You don't have that much money in your bank! You only have **֍ ${userBank.toLocaleString()}**.`)
                                .setColor(0xFF0000);
                            await submission.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                            return;
                        }

                        db.removeBank(targetUser.id, amount);
                        db.addBalance(targetUser.id, amount);

                        const updatedUser = db.getUser(targetUser.id);
                        const newBalance = updatedUser.balance ?? 0;
                        const newBank = updatedUser.bank ?? 0;

                        embed = new EmbedBuilder()
                            .setColor(0x00FF00)
                            .setTitle('Withdrawn from Bank')
                            .setDescription(`**֍ ${amount.toLocaleString()}** withdrawn.\n\n**Wallet:** ֍ ${newBalance.toLocaleString()}\n**Bank:** ֍ ${newBank.toLocaleString()}`);
                    }

                    await submission.reply({ embeds: [embed] });

                    // Refresh main embed too
                    await interaction.editReply({ embeds: [getEmbed()] });

                } catch (e) {
                    // Modal timed out or other error
                    console.log(e);
                }
            }
        });

        collector.on('end', async () => {
             // Disable buttons
            if (isSelf) {
                 const disabledRow = new ActionRowBuilder().addComponents(
                    getComponents()[0].components.map(btn => btn.setDisabled(true))
                );
                try {
                    await interaction.editReply({ components: [disabledRow] });
                } catch (e) {
                    // Ignore
                }
            }
        });
    },
};
