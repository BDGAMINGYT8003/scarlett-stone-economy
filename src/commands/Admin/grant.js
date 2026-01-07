const { SlashCommandBuilder, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const items = require('../../config/items.json');
const db = require('../../utils/db.js');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const parseNumber = require('../../utils/numberParser.js');
const { parseDuration } = require('../../utils/timeParser.js');
const levelManager = require('../../utils/levelManager');

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
                    option.setName('user').setDescription('The user to grant to').setRequired(true))
                .addStringOption(option =>
                    option.setName('duration').setDescription('Duration (e.g. 7d, 1mo). Leave empty for permanent.').setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('progress')
                .setDescription('Grant Level or XP to a user.')
                .addUserOption(option =>
                    option.setName('user').setDescription('The user to grant to').setRequired(true))
                .addStringOption(option =>
                    option.setName('type').setDescription('Level or XP').setRequired(true).addChoices({ name: 'Level', value: 'level' }, { name: 'XP', value: 'xp' }))
                .addIntegerOption(option =>
                    option.setName('amount').setDescription('Amount to grant').setRequired(true)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = items.map(i => i.name);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && interaction.user.id !== '794482283993235478') {
            const embed = new EmbedBuilder()
                .setTitle('Permission Denied')
                .setDescription('You do not have permission to use this command.')
                .setColor(0xFF0000)
                .setFooter({ text: 'Admin Command' });
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

            confirmMessage = `Are you sure you want to grant **֍ ${finalAmount.toLocaleString()}** to ${targetUser}?`;
            executeAction = async () => {
                db.addBalance(targetUser.id, finalAmount);
                db.logTransaction(targetUser.id, 'grant money', { amount: finalAmount });
                await checkAndUnlockBadges(targetUser.id, interaction);
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
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Item not found.").setColor(0xFF0000).setFooter({ text: 'Check spelling' });
                return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
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
            const durationStr = interaction.options.getString('duration');
            let durationMs = null;
            if (durationStr) {
                durationMs = parseDuration(durationStr);
                if (!durationMs) {
                    const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Invalid duration format.").setColor(0xFF0000).setFooter({ text: 'Try again' });
                    return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                }
            }

            const durationText = durationMs ? durationStr : 'Permanent';
            confirmMessage = `Are you sure you want to grant **Premium Status** (${durationText}) to ${targetUser}?`;

            executeAction = async () => {
                if (durationMs) {
                    db.addPremiumDuration(targetUser.id, durationMs, durationStr);
                } else {
                    db.setPremium(targetUser.id, true);
                }

                const embed = new EmbedBuilder()
                    .setTitle('Premium Granted')
                    .setDescription(`Successfully granted **Premium** status (${durationText}) to ${targetUser}.`)
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

                const notifyEmbed = new EmbedBuilder()
                    .setTitle('Premium Granted')
                    .setDescription(`You have been granted **Premium Status** for **${durationText}**! Enjoy reduced cooldowns and other perks.`)
                    .addFields({ name: 'Granted By', value: interaction.user.tag })
                    .setFooter({ text: 'Thank you for your support!' });
                try { await targetUser.send({ embeds: [notifyEmbed] }); } catch (e) {}

                return embed;
            };
        } else if (subcommand === 'progress') {
            const type = interaction.options.getString('type');
            const amount = interaction.options.getInteger('amount');

            if (type === 'level' && amount > 100) {
                 const embed = new EmbedBuilder()
                    .setTitle('Limit Exceeded')
                    .setDescription('You can only grant up to **100 Levels** at a time.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'System Limit' });
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (type === 'xp' && amount > 5000) {
                 const embed = new EmbedBuilder()
                    .setTitle('Limit Exceeded')
                    .setDescription('You can only grant up to **5,000 XP** at a time.')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'System Limit' });
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            confirmMessage = `Are you sure you want to grant **${amount} ${type}** to ${targetUser}?`;

            executeAction = async () => {
                // Fixed: Use targetUser.id explicitly
                if (type === 'xp') {
                     await levelManager.adminGrantXp(targetUser.id, amount, interaction);

                } else if (type === 'level') {
                     await levelManager.adminGrantLevels(targetUser.id, amount, interaction);
                }

                const newData = db.getUser(targetUser.id);

                const embed = new EmbedBuilder()
                    .setTitle('Progress Granted')
                    .setDescription(`Successfully granted **${amount} ${type}** to ${targetUser}.`)
                    .addFields({ name: 'New Stats', value: `Level: ${newData.level} | XP: ${newData.xp}` })
                    .setColor(0x00FF00)
                    .setFooter({ text: `Developer Command | Today at ${new Date().toLocaleTimeString()}` });

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

        // Use withResponse to avoid warning
        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            withResponse: true
        });

        // Collect from the response message
        const collector = response.resource.message.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command.").setColor(0xFF0000).setFooter({ text: 'Go away' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_grant') {
                // Defer immediately to prevent timeout during heavy processing
                await i.deferUpdate();

                try {
                    const resultEmbed = await executeAction();
                    await i.editReply({ embeds: [resultEmbed], components: [] });
                } catch (error) {
                    console.error('Grant execution failed:', error);
                    const errorEmbed = new EmbedBuilder()
                        .setTitle('Error')
                        .setDescription('An error occurred while processing the grant.')
                        .setColor(0xFF0000)
                        .setFooter({ text: 'Check console for details' });
                    await i.editReply({ embeds: [errorEmbed], components: [] });
                }
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
