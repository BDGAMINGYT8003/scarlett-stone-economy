const { SlashCommandBuilder, MessageFlags, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Colors } = require('discord.js');
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
            const embed = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('# Permission Denied\nYou do not have permission to use this command.\n\nDeveloper Command')
                )
                .setColor(0xFF0000);
            return interaction.reply({
                components: [embed],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
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

            confirmMessage = `Are you sure you want to grant **֍ ${finalAmount.toLocaleString()}** to ${targetUser}?`;
            executeAction = async () => {
                db.addBalance(targetUser.id, finalAmount);
                const newData = db.getUser(targetUser.id);

                const embed = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# Money Granted\nSuccessfully added **֍ ${finalAmount.toLocaleString()}** to ${targetUser}'s inventory.`)
                    )
                    .addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Total Owned**\n֍ ${newData.balance.toLocaleString()}`))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`Developer Command | Today at ${new Date().toLocaleTimeString()}`)
                    );

                const notifyEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# Money Granted\nYou have been granted **֍ ${finalAmount.toLocaleString()}**!`)
                    )
                    .addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Granted By**\n${interaction.user.tag}`))
                    )
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Enjoy!'));
                try { await targetUser.send({ components: [notifyEmbed], flags: MessageFlags.IsComponentsV2 }); } catch (e) {}

                return embed;
            };

        } else if (subcommand === 'items') {
            const itemName = interaction.options.getString('item');
            const amountStr = interaction.options.getString('amount');
            const item = items.find(i => i.name === itemName);

            if (!item) {
                const errorContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Item not found.'));
                return interaction.reply({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
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

                const embed = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# Items Granted\nSuccessfully added **${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}** to ${targetUser}'s inventory.`)
                    )
                    .addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Total Owned**\n${newCount.toLocaleString()} ${item.name}`))
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`Developer Command | Today at ${new Date().toLocaleTimeString()}`)
                    );

                const notifyEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(
                         new TextDisplayBuilder().setContent(`# Items Granted\nYou have been granted **${finalAmount.toLocaleString()}** ${item.emoji} **${item.name}**!`)
                    )
                    .addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Granted By**\n${interaction.user.tag}`))
                    )
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Enjoy!'));
                try { await targetUser.send({ components: [notifyEmbed], flags: MessageFlags.IsComponentsV2 }); } catch (e) {}

                return embed;
            };

        } else if (subcommand === 'premium') {
            confirmMessage = `Are you sure you want to grant **Premium Status** to ${targetUser}?`;
            executeAction = async () => {
                db.setPremium(targetUser.id, true);

                const embed = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# Premium Granted\nSuccessfully granted **Premium** status to ${targetUser}.`)
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`Developer Command | Today at ${new Date().toLocaleTimeString()}`)
                    );

                const notifyEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(
                         new TextDisplayBuilder().setContent(`# Premium Granted\nYou have been granted **Premium Status**! Enjoy reduced cooldowns and other perks.`)
                    )
                    .addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Granted By**\n${interaction.user.tag}`))
                    )
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('Thank you for your support!'));
                try { await targetUser.send({ components: [notifyEmbed], flags: MessageFlags.IsComponentsV2 }); } catch (e) {}

                return embed;
            };
        }

        // Confirmation Interaction
        const embed = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Confirmation Required\n${confirmMessage}`))
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_grant').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_grant').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        embed.addActionRowComponents(row);

        const response = await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorContainer = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Not your command.'));
                return i.reply({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            if (i.customId === 'confirm_grant') {
                const resultEmbed = await executeAction();
                resultEmbed.setColor(0x00FF00);
                await i.update({ components: [resultEmbed] });
            } else {
                const cancelEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Cancelled\nGrant action cancelled.`))
                    .setColor(0xFF0000);
                await i.update({ components: [cancelEmbed] });
            }
            collector.stop();
        });
    }
};
