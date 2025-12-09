const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const items = require('../../config/items.json');
const db = require('../../utils/db.js');
const parseNumber = require('../../utils/numberParser.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grant')
        .setDescription('Developer tool to grant resources.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('money')
                .setDescription('Grant money to a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to grant to').setRequired(true))
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to grant').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('items')
                .setDescription('Grant items to a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to grant to').setRequired(true))
                .addStringOption(option =>
                    option.setName('item').setDescription('Item to grant').setRequired(true).setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('amount').setDescription('Amount to grant').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('premium')
                .setDescription('Grant premium status to a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to grant to').setRequired(true))),

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
            const amount = parseNumber(amountStr, userData.balance); // Fallback logic is handled inside parseNumber if balance is 0? Wait, previous code had custom fallback.

            // Re-implement robust parsing
            let finalAmount = amount;
            if (finalAmount <= 0 && amountStr.toLowerCase() !== '0') {
                 const direct = parseFloat(amountStr.replace(/,/g, ''));
                 if (!isNaN(direct) && direct > 0) finalAmount = Math.floor(direct);
            }
            if (finalAmount < 0) finalAmount = 0;

            confirmMessage = `Are you sure you want to grant **֍ ${finalAmount.toLocaleString()}** to ${targetUser}?`;
            executeAction = async () => {
                db.addBalance(targetUser.id, finalAmount);
                const newData = db.getUser(targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle('Money Granted')
                    .setDescription(`Successfully added **֍ ${finalAmount.toLocaleString()}** to ${targetUser}'s inventory.`)
                    .addFields({ name: 'Total Owned', value: `֍ ${newData.balance.toLocaleString()}` })
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Money Granted')
                    .setDescription(`You have been granted **֍ ${finalAmount.toLocaleString()}**!`)
                    .addFields({ name: 'Granted By', value: interaction.user.tag })
                    .setFooter({ text: 'Enjoy!' });
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

            confirmMessage = `Are you sure you want to grant **${finalAmount.toLocaleString()} ${item.emoji} ${item.name}** to ${targetUser}?`;
            executeAction = async () => {
                db.addItem(targetUser.id, item.id, finalAmount);
                const newCount = db.getItemCount(targetUser.id, item.id);

                const embed = new EmbedBuilder()
                    .setTitle('Items Granted')
                    .setDescription(`Successfully added **${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}** to ${targetUser}'s inventory.`)
                    .addFields({ name: 'Total Owned', value: `${newCount.toLocaleString()} ${item.name}` })
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Items Granted')
                    .setDescription(`You have been granted **${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}**!`)
                    .addFields({ name: 'Granted By', value: interaction.user.tag })
                    .setFooter({ text: 'Enjoy!' });
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };

        } else if (subcommand === 'premium') {
            confirmMessage = `Are you sure you want to grant **Premium Status** to ${targetUser}?`;
            executeAction = async () => {
                db.setPremium(targetUser.id, true);

                const embed = new EmbedBuilder()
                    .setTitle('Premium Granted')
                    .setDescription(`Successfully granted **Premium** status to ${targetUser}.`)
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Premium Granted')
                    .setDescription(`You have been granted **Premium Status**! Enjoy reduced cooldowns and other perks.`)
                    .addFields({ name: 'Granted By', value: interaction.user.tag })
                    .setFooter({ text: 'Thank you for your support!' });
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };
        }

        // Confirmation Interaction
        const embed = new EmbedBuilder()
            .setTitle('Confirmation Required')
            .setDescription(confirmMessage)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_grant').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_grant').setLabel('Cancel').setStyle(ButtonStyle.Danger)
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

            if (i.customId === 'confirm_grant') {
                const resultEmbed = await executeAction();
                resultEmbed.setColor(0x00FF00);
                await i.update({ embeds: [resultEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Cancelled')
                    .setDescription('Grant action cancelled.')
                    .setColor(0xFF0000);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    }
};
