const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const parseNumber = require('../../utils/numberParser');
const items = require('../../config/items.json');
const { checkAndUnlockAchievements } = require('../../utils/achievementManager');

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friends')
        .setDescription('Manage your friends.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a friend.')
                .addUserOption(option => option.setName('user').setDescription('User to add').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a friend.')
                .addUserOption(option => option.setName('user').setDescription('User to remove').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your current friends.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('inspect')
                .setDescription('Inspect a friendship.')
                .addUserOption(option => option.setName('user').setDescription('User to inspect').setRequired(true)))
        .addSubcommandGroup(group =>
            group
                .setName('share')
                .setDescription('Share resources.')
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('coins')
                        .setDescription('Share coins with a friend.')
                        .addUserOption(option => option.setName('user').setDescription('Friend to share with').setRequired(true))
                        .addStringOption(option => option.setName('quantity').setDescription('Amount to share').setRequired(true))
                        .addStringOption(option => option.setName('message').setDescription('Optional message')))
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('items')
                        .setDescription('Share items with a friend.')
                        .addUserOption(option => option.setName('user').setDescription('Friend to share with').setRequired(true))
                        .addStringOption(option => option.setName('item').setDescription('Item to share').setRequired(true).setAutocomplete(true))
                        .addStringOption(option => option.setName('quantity').setDescription('Quantity to share').setRequired(true))
                        .addStringOption(option => option.setName('message').setDescription('Optional message')))
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;
        const inventory = db.getInventory(userId);
        const choices = inventory.map(inv => {
            const i = items.find(it => it.id === inv.item_id);
            return i ? i.name : null;
        }).filter(n => n && n.toLowerCase().includes(focusedValue));

        await interaction.respond(
            choices.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup();

        if (group === 'share') {
            if (subcommand === 'coins') await this.handleShareCoins(interaction);
            if (subcommand === 'items') await this.handleShareItems(interaction);
        } else {
            if (subcommand === 'add') await this.handleAdd(interaction);
            if (subcommand === 'remove') await this.handleRemove(interaction);
            if (subcommand === 'list') await this.handleList(interaction);
            if (subcommand === 'inspect') await this.handleInspect(interaction);
        }
    },

    async handleAdd(interaction) {
        // ... (Keep existing implementation logic)
        // Since I'm overwriting the file, I must copy the content correctly.
        // I will focus on modifying `handleList` which has pagination.
        // I need to reconstruct the file.
        // To be safe and concise in this plan step, I'll copy the existing `handleAdd` etc. logic from previous reads.

        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;

        if (targetUser.id === userId) {
            const errorEmbed = new EmbedBuilder().setTitle('Oh?').setDescription("You can't add yourself!").setColor(0xFF0000).setFooter({ text: 'Nice try' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        if (targetUser.bot) {
            const errorEmbed = new EmbedBuilder().setTitle('Beep Boop').setDescription("You can't add bots!").setColor(0xFF0000).setFooter({ text: 'They don\'t have feelings' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        if (db.isFriend(userId, targetUser.id)) {
            const errorEmbed = new EmbedBuilder().setTitle('Already Friends').setDescription("You are already friends!").setColor(0xFF0000).setFooter({ text: 'Check your list' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const friends = db.getFriends(userId);
        if (friends.length >= 10) {
            const errorEmbed = new EmbedBuilder().setTitle('Limit Reached').setDescription("You have reached the maximum of 10 friends!").setColor(0xFF0000).setFooter({ text: 'Time to prune the list?' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const embed1 = new EmbedBuilder()
            .setTitle('Pending Confirmation')
            .setDescription(`Are you sure you want to add ${targetUser} as a friend?\n\n- You will have no tax in /wager against each other\n- You can share items and coins with each other tax free\n**WARNING**: Do not add people you don't trust, scams WILL happen.\nBecoming friends just to trade is against [bot rules](https://dankmemer.lol/rules) in addition to the risk of scams.`)
            .setFooter({ text: 'Accept the risk to proceed' })
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_add').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_add').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({
            embeds: [embed1],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'cancel_add') {
                const strikeEmbed = new EmbedBuilder(embed1.toJSON());
                strikeEmbed.setDescription(`~~${embed1.data.description}~~`);
                strikeEmbed.setTitle('Action Cancelled');
                strikeEmbed.setFooter({ text: 'Request cancelled' });
                strikeEmbed.setColor(0xFF0000);
                await i.update({ embeds: [strikeEmbed], components: [] });
                collector.stop();
                return;
            }

            if (i.customId === 'confirm_add') {
                const embed2 = new EmbedBuilder()
                    .setTitle('Pending Confirmation')
                    .setDescription(`-# ${targetUser}, ${interaction.user} wants to add you as a friend!\n\n- You can share items, coins, and pets with each other tax free\n**WARNING**: Do not add people you don't trust, scams WILL happen.\nBecoming friends just to trade is against [bot rules](https://dankmemer.lol/rules) in addition to the risk of scams.`)
                    .setFooter({ text: 'Do you accept?' })
                    .setColor(0xFFFF00);

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('target_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('target_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [embed1, embed2], components: [row2] });

                const targetCollector = response.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 30000
                });

                targetCollector.on('collect', async ti => {
                    if (ti.user.id !== targetUser.id) {
                         const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not for you!").setColor(0xFF0000).setFooter({ text: 'Wait your turn' });
                        return ti.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                    }

                    if (ti.customId === 'target_cancel') {
                        const strikeEmbed = new EmbedBuilder(embed2.toJSON());
                        strikeEmbed.setDescription(`~~${embed2.data.description}~~`);
                        strikeEmbed.setTitle('Action Cancelled');
                        strikeEmbed.setFooter({ text: 'Request denied' });
                        strikeEmbed.setColor(0xFF0000);
                        await ti.update({ embeds: [embed1, strikeEmbed], components: [] });
                        targetCollector.stop();
                    } else {
                        db.addFriend(userId, targetUser.id);
                        const successEmbed = new EmbedBuilder()
                            .setTitle('Action Confirmed')
                            .setDescription(`You are now friends with ${targetUser}!`)
                            .setColor(0x00FF00);
                        await ti.update({ embeds: [embed1, successEmbed], components: [] });
                        targetCollector.stop();
                    }
                });

                targetCollector.on('end', async (c, reason) => {
                    if (reason === 'time') {
                        const strikeEmbed = new EmbedBuilder(embed2.toJSON());
                        strikeEmbed.setDescription(`~~${embed2.data.description}~~`);
                        strikeEmbed.setTitle('Timed Out');
                        strikeEmbed.setFooter({ text: 'Request timed out' });
                        strikeEmbed.setColor(0xFF0000);
                        try { await interaction.editReply({ embeds: [embed1, strikeEmbed], components: [] }); } catch(e){}
                    }
                });
                collector.stop();
            }
        });

        collector.on('end', async (c, reason) => {
            if (reason === 'time') {
                const strikeEmbed = new EmbedBuilder(embed1.toJSON());
                strikeEmbed.setDescription(`~~${embed1.data.description}~~`);
                strikeEmbed.setTitle('Timed Out');
                strikeEmbed.setFooter({ text: 'Request timed out' });
                strikeEmbed.setColor(0xFF0000);
                try { await interaction.editReply({ embeds: [strikeEmbed], components: [] }); } catch(e){}
            }
        });
    },

    async handleRemove(interaction) {
        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;

        if (!db.isFriend(userId, targetUser.id)) {
            const errorEmbed = new EmbedBuilder().setTitle('Stranger Danger').setDescription("You are not friends with this user.").setColor(0xFF0000).setFooter({ text: 'Maybe add them first?' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('Pending Confirmation')
            .setDescription(`Are you sure you want to remove ${targetUser} as a friend? You won't be able to add him/her as your new friend for a day.`)
            .setFooter({ text: 'Think about the memories...' })
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_remove').setLabel('Confirm').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('cancel_remove').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                 const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command.").setColor(0xFF0000).setFooter({ text: 'Go away' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_remove') {
                db.removeFriend(userId, targetUser.id);
                const successEmbed = new EmbedBuilder()
                    .setTitle('Friend Removed')
                    .setDescription(`Removed ${targetUser} from your friends list.`)
                    .setColor(0x00FF00);
                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('Action Cancelled')
                    .setDescription('Friend removal cancelled.')
                    .setColor(0x00FF00);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    },

    async handleList(interaction) {
        const userId = interaction.user.id;
        let friends = db.getFriends(userId);

        let currentPage = 0;
        const ITEMS_PER_PAGE = 5;
        const getMaxPages = () => Math.ceil(friends.length / ITEMS_PER_PAGE) || 1;

        const generateEmbed = async (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentFriends = friends.slice(start, end);

            let desc = '';

            for (const f of currentFriends) {
                const fid = f.user1 === userId ? f.user2 : f.user1;
                const sinceUnix = Math.floor(f.since / 1000);
                desc += `> <@${fid}> (${fid})\n-# - Friends since <t:${sinceUnix}:D> (<t:${sinceUnix}:R>)\n`;
            }

            if (desc === '') desc = 'No friends added.';

            const slotsLeft = 10 - friends.length;
            const maxPages = getMaxPages();

            return new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Friends`)
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `${slotsLeft} slots left ─ Page ${page + 1} of ${maxPages}` });
        };

        const getComponents = (page) => {
            const maxPages = getMaxPages();

            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('refresh').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1),
                    new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1)
                )
            ];
        };

        const response = await interaction.reply({
            embeds: [await generateEmbed(currentPage)],
            components: getComponents(currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                 const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            // Refresh data
            friends = db.getFriends(userId);
            const maxPages = getMaxPages();

            if (i.customId === 'prev_page') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'next_page') currentPage = Math.min(maxPages - 1, currentPage + 1);
            if (i.customId === 'first_page') currentPage = 0;
            if (i.customId === 'last_page') currentPage = maxPages - 1;
            if (i.customId === 'refresh') {
                if (currentPage >= maxPages) currentPage = maxPages - 1;
            }

            await i.update({
                embeds: [await generateEmbed(currentPage)],
                components: getComponents(currentPage)
            });
        });
    },

    async handleInspect(interaction) {
        const errorEmbed = new EmbedBuilder().setTitle('Not Implemented').setDescription("Friendship inspection not implemented yet.").setColor(0xFFA500).setFooter({ text: 'Coming soon' });
        interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
    },

    async handleShareCoins(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amountStr = interaction.options.getString('quantity');
        const message = interaction.options.getString('message') || 'None';
        const userId = interaction.user.id;

        if (!db.isFriend(userId, targetUser.id)) {
            const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("You can only share coins with friends.").setColor(0xFF0000).setFooter({ text: 'Make some friends first' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const userData = db.getUser(userId);
        const amount = parseNumber(amountStr, userData.balance);

        if (amount <= 0 || amount > userData.balance) {
             const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Invalid amount or insufficient funds.").setColor(0xFF0000).setFooter({ text: 'Math is hard' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('Confirm Share')
            .setDescription(`Are you sure you want to send **֍ ${amount.toLocaleString()}** to ${targetUser}?`)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_share').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_share').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                 const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command.").setColor(0xFF0000).setFooter({ text: 'Go away' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_share') {
                db.removeBalance(userId, amount);
                db.addBalance(targetUser.id, amount);
                db.logTransaction(userId, 'share coins', { amount: -amount });
                db.logTransaction(targetUser.id, 'share coins', { amount: amount });

                if (amount >= 100000000) {
                     db.incrementStat(userId, 'shared_coins', amount);
                     await checkAndUnlockAchievements(userId, i);
                } else {
                     db.incrementStat(userId, 'shared_coins', amount);
                }

                const dmEmbed = new EmbedBuilder()
                    .setTitle('You have been given coins!')
                    .setDescription(`Your friend ${interaction.user} shared **֍ ${amount.toLocaleString()}** with you! Check your \`/balance\` and enjoy!\n\n> **Message:** \`${message}\``)
                    .setFooter({ text: 'Dank Memer' })
                    .setColor(0x00FF00);

                try { await targetUser.send({ embeds: [dmEmbed] }); } catch(e) {}

                const successEmbed = new EmbedBuilder()
                    .setTitle('Coins Shared')
                    .setDescription(`Sent **֍ ${amount.toLocaleString()}** to ${targetUser}.`)
                    .setColor(0x00FF00);
                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                const cancelEmbed = new EmbedBuilder().setTitle('Cancelled').setDescription('Cancelled').setColor(0xFF0000);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    },

    async handleShareItems(interaction) {
        const targetUser = interaction.options.getUser('user');
        const itemName = interaction.options.getString('item');
        const quantityStr = interaction.options.getString('quantity');
        const message = interaction.options.getString('message') || 'None';
        const userId = interaction.user.id;

        if (!db.isFriend(userId, targetUser.id)) {
             const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("You can only share items with friends.").setColor(0xFF0000).setFooter({ text: 'Make some friends first' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const item = items.find(i => i.name === itemName);
        if (!item) {
             const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Item not found.").setColor(0xFF0000).setFooter({ text: 'Check spelling' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        const count = db.getItemCount(userId, item.id);
        const quantity = parseNumber(quantityStr, count);

        if (quantity <= 0 || quantity > count) {
             const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Invalid quantity.").setColor(0xFF0000).setFooter({ text: 'Math is hard' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

         const embed = new EmbedBuilder()
            .setTitle('Confirm Share')
            .setDescription(`Are you sure you want to send **${quantity}x ${item.name}** to ${targetUser}?`)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_share').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_share').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                 const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command.").setColor(0xFF0000).setFooter({ text: 'Go away' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'confirm_share') {
                db.removeItem(userId, item.id, quantity);
                db.logTransaction(userId, 'share items', {
                    amount: 0,
                    items: [{
                        id: item.id,
                        name: item.name,
                        emoji: item.emoji,
                        quantity: quantity // Removing so technically "negative", but usually tracked as just item
                    }]
                });

                db.addItem(targetUser.id, item.id, quantity);
                db.logTransaction(targetUser.id, 'share items', {
                    amount: 0,
                    items: [{
                        id: item.id,
                        name: item.name,
                        emoji: item.emoji,
                        quantity: quantity
                    }]
                });

                 const dmEmbed = new EmbedBuilder()
                    .setTitle('You have been given items!')
                    .setDescription(`Your friend ${interaction.user} shared **${quantity}x ${item.name}** with you!\n\n> **Message:** \`${message}\``)
                    .setFooter({ text: 'Dank Memer' })
                    .setColor(0x00FF00);

                try { await targetUser.send({ embeds: [dmEmbed] }); } catch(e) {}

                const successEmbed = new EmbedBuilder()
                    .setTitle('Items Shared')
                    .setDescription(`Sent **${quantity}x ${item.name}** to ${targetUser}.`)
                    .setColor(0x00FF00);
                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                 const cancelEmbed = new EmbedBuilder().setTitle('Cancelled').setDescription('Cancelled').setColor(0xFF0000);
                await i.update({ embeds: [cancelEmbed], components: [] });
            }
            collector.stop();
        });
    }
};
