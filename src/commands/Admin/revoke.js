const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const items = require('../../config/items.json');
const db = require('../../utils/db.js');
const parseNumber = require('../../utils/numberParser.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('revoke')
        .setDescription('Developer tool to revoke resources.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('money')
                .setDescription('Revoke money from a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to revoke from').setRequired(true))
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to revoke').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('items')
                .setDescription('Revoke items from a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to revoke from').setRequired(true))
                .addStringOption(option =>
                    option.setName('item').setDescription('Item to revoke').setRequired(true).setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to revoke').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('premium')
                .setDescription('Revoke premium status from a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to revoke from').setRequired(true))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = items.map(i => i.name);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        if (interaction.user.id !== '794482283993235478') {
            const embed = new EmbedBuilder()
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Developer Command' });
            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');

        let confirmMessage = '';
        let executeAction = null;

        if (subcommand === 'money') {
            const amountStr = interaction.options.getString('amount');
            const userData = db.getUser(targetUser.id);
            const amount = parseNumber(amountStr, userData.balance);

            let finalAmount = amount;
            if (finalAmount <= 0 && amountStr.toLowerCase() !== '0') {
                 const direct = parseFloat(amountStr.replace(/,/g, ''));
                 if (!isNaN(direct) && direct > 0) finalAmount = Math.floor(direct);
            }
            if (finalAmount < 0) finalAmount = 0;

            confirmMessage = `Are you sure you want to revoke **֍ ${finalAmount.toLocaleString()}** from ${targetUser}?`;
            executeAction = async () => {
                db.removeBalance(targetUser.id, finalAmount);
                const newData = db.getUser(targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle('Money Revoked')
                    .setDescription(`Successfully removed **֍ ${finalAmount.toLocaleString()}** from ${targetUser}'s inventory.`)
                    .addFields({ name: 'Remaining Balance', value: `֍ ${(newData.balance ?? 0).toLocaleString()}` })
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Money Revoked')
                    .setDescription(`**֍ ${finalAmount.toLocaleString()}** has been removed from your account.`)
                    .addFields({ name: 'Revoked By', value: interaction.user.tag })
                    .setFooter({ text: 'Contact support if this is a mistake.' })
                    .setColor(0xFF0000);
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };

        } else if (subcommand === 'items') {
            const itemName = interaction.options.getString('item');
            const amountStr = interaction.options.getString('amount');
            const item = items.find(i => i.name === itemName);

            if (!item) {
                return interaction.reply({ content: 'Item not found.', flags: MessageFlags.Ephemeral });
            }

            const currentCount = db.getItemCount(targetUser.id, item.id);
            let finalAmount = parseNumber(amountStr, currentCount);
             if (finalAmount <= 0 && amountStr.toLowerCase() !== '0') {
                 const direct = parseFloat(amountStr.replace(/,/g, ''));
                 if (!isNaN(direct) && direct > 0) finalAmount = Math.floor(direct);
            }
            if (finalAmount < 0) finalAmount = 0;

            confirmMessage = `Are you sure you want to revoke **${finalAmount.toLocaleString()} ${item.emoji} ${item.name}** from ${targetUser}?`;
            executeAction = async () => {
                db.removeItem(targetUser.id, item.id, finalAmount);
                const newCount = db.getItemCount(targetUser.id, item.id);

                const embed = new EmbedBuilder()
                    .setTitle('Items Revoked')
                    .setDescription(`Successfully removed **${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}** from ${targetUser}'s inventory.`)
                    .addFields({ name: 'Remaining', value: `${newCount.toLocaleString()} ${item.name}` })
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Items Revoked')
                    .setDescription(`**${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}** has been removed from your inventory.`)
                    .addFields({ name: 'Revoked By', value: interaction.user.tag })
                    .setFooter({ text: 'Contact support if this is a mistake.' })
                    .setColor(0xFF0000);
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };

        } else if (subcommand === 'premium') {
            confirmMessage = `Are you sure you want to completely remove **Premium Status** from ${targetUser}?`;
            executeAction = async () => {
                db.setPremium(targetUser.id, false);

                const embed = new EmbedBuilder()
                    .setTitle('Premium Revoked')
                    .setDescription(`Successfully removed **Premium** status from ${targetUser}.`)
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Premium Revoked')
                    .setDescription(`Your **Premium Status** has been revoked by an administrator.`)
                    .addFields({ name: 'Revoked By', value: interaction.user.tag })
                    .setFooter({ text: 'Contact support if this is a mistake.' })
                    .setColor(0xFF0000);
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };
        }

        // Confirmation Interaction
        const embed = new EmbedBuilder()
            .setTitle('Confirmation Required')
            .setDescription(confirmMessage)
            .setColor(0xFF0000); // Red for revoke

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_revoke').setLabel('Confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_revoke').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_revoke') {
                const resultEmbed = await executeAction();
                resultEmbed.setColor(0xFF0000);
                await i.update({ embeds: [resultEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Cancelled')
                    .setDescription('Revoke action cancelled.')
                    .setColor(0x00FF00);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    }
};
