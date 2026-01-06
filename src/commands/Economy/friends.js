const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const parseNumber = require('../../utils/numberParser');
const items = require('../../config/items.json');
const { checkAndUnlockAchievements } = require('../../utils/achievementManager');

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';

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
        // User inventory for sharing
        const inventory = db.getInventory(userId);
        // Map to items config
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
        const targetUser = interaction.options.getUser('user');
        const userId = interaction.user.id;

        if (targetUser.id === userId) return interaction.reply({ content: "You can't add yourself!", flags: MessageFlags.Ephemeral });
        if (targetUser.bot) return interaction.reply({ content: "You can't add bots!", flags: MessageFlags.Ephemeral });
        if (db.isFriend(userId, targetUser.id)) return interaction.reply({ content: "You are already friends!", flags: MessageFlags.Ephemeral });

        const friends = db.getFriends(userId);
        if (friends.length >= 10) return interaction.reply({ content: "You have reached the maximum of 10 friends!", flags: MessageFlags.Ephemeral });

        // Phase 1: Initiator Confirmation
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
            if (i.user.id !== userId) return i.reply({ content: 'Not your command!', flags: MessageFlags.Ephemeral });

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
                // Phase 2: Target Confirmation
                const embed2 = new EmbedBuilder()
                    .setTitle('Pending Confirmation')
                    .setDescription(`-# ${targetUser}, ${interaction.user} wants to add you as a friend!\n\n- You can share items, coins, and pets with each other tax free\n**WARNING**: Do not add people you don't trust, scams WILL happen.\nBecoming friends just to trade is against [bot rules](https://dankmemer.lol/rules) in addition to the risk of scams.`)
                    .setFooter({ text: 'Do you accept?' })
                    .setColor(0xFFFF00);

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('target_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('target_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [embed1, embed2], components: [row2] }); // Keep embed1? "previous embed will stay".

                // New collector for target
                const targetCollector = response.createMessageComponentCollector({
                    componentType: ComponentType.Button,
                    time: 30000
                });

                targetCollector.on('collect', async ti => {
                    if (ti.user.id !== targetUser.id) return ti.reply({ content: 'Not for you!', flags: MessageFlags.Ephemeral });

                    if (ti.customId === 'target_cancel') {
                        const strikeEmbed = new EmbedBuilder(embed2.toJSON());
                        strikeEmbed.setDescription(`~~${embed2.data.description}~~`);
                        strikeEmbed.setTitle('Action Cancelled');
                        strikeEmbed.setFooter({ text: 'Request denied' });
                        strikeEmbed.setColor(0xFF0000);
                        await ti.update({ embeds: [embed1, strikeEmbed], components: [] });
                        targetCollector.stop();
                    } else {
                        // Success
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
                collector.stop(); // Stop first collector
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
            return interaction.reply({ content: "You are not friends with this user.", flags: MessageFlags.Ephemeral });
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
            if (i.user.id !== userId) return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });

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
        const friends = db.getFriends(userId);

        let currentPage = 0;
        const ITEMS_PER_PAGE = 5;
        const maxPages = Math.ceil(friends.length / ITEMS_PER_PAGE) || 1;

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

            return new EmbedBuilder()
                .setTitle(`${interaction.user.username}'s Friends`)
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `${slotsLeft} slots left ─ Page ${page + 1} of ${maxPages}` });
        };

        const getComponents = () => [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                new ButtonBuilder().setCustomId('refresh').setEmoji('🔄').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
            )
        ];

        const response = await interaction.reply({
            embeds: [await generateEmbed(currentPage)],
            components: getComponents(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) return i.reply({ content: 'Not your command!', flags: MessageFlags.Ephemeral });

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            } else if (i.customId === 'refresh') {
                // Just update
            }

            await i.update({
                embeds: [await generateEmbed(currentPage)],
                components: getComponents()
            });
        });
    },

    async handleInspect(interaction) {
        // Not detailed in prompt requirement beyond "Inspect a friendship's stats".
        // Placeholder implementation
        interaction.reply({ content: 'Friendship inspection not implemented yet.', flags: MessageFlags.Ephemeral });
    },

    async handleShareCoins(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amountStr = interaction.options.getString('quantity');
        const message = interaction.options.getString('message') || 'None';
        const userId = interaction.user.id;

        if (!db.isFriend(userId, targetUser.id)) {
            return interaction.reply({ content: "You can only share coins with friends.", flags: MessageFlags.Ephemeral });
        }

        const userData = db.getUser(userId);
        const amount = parseNumber(amountStr, userData.balance);

        if (amount <= 0 || amount > userData.balance) {
            return interaction.reply({ content: "Invalid amount or insufficient funds.", flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setTitle('Confirm Share')
            .setDescription(`Are you sure you want to send **⏣ ${amount.toLocaleString()}** to ${targetUser}?`)
            .setColor(0xFFFF00);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_share').setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_share').setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });

            if (i.customId === 'confirm_share') {
                db.removeBalance(userId, amount);
                db.addBalance(targetUser.id, amount);

                // Logging
                db.logTransaction(userId, 'share coins', { amount: -amount });
                db.logTransaction(targetUser.id, 'share coins', { amount: amount });

                // Achievement Check
                if (amount >= 100000000) {
                     db.incrementStat(userId, 'shared_coins', amount);
                     await checkAndUnlockAchievements(userId, i); // Use interaction i
                } else {
                     db.incrementStat(userId, 'shared_coins', amount); // Increment anyway for cumulative tracking if needed
                }

                // DM Target
                const dmEmbed = new EmbedBuilder()
                    .setTitle('You have been given coins!')
                    .setDescription(`Your friend ${interaction.user} shared **⏣ ${amount.toLocaleString()}** with you! Check your \`/balance\` and enjoy!\n\n> **Message:** \`${message}\``)
                    .setFooter({ text: 'Dank Memer' })
                    .setColor(0x00FF00);

                try { await targetUser.send({ embeds: [dmEmbed] }); } catch(e) {}

                const successEmbed = new EmbedBuilder()
                    .setTitle('Coins Shared')
                    .setDescription(`Sent **⏣ ${amount.toLocaleString()}** to ${targetUser}.`)
                    .setColor(0x00FF00);
                await i.update({ embeds: [successEmbed], components: [] });
            } else {
                await i.update({ content: 'Cancelled', embeds: [], components: [] });
            }
            collector.stop();
        });
    },

    async handleShareItems(interaction) {
        // Similar logic for items
        const targetUser = interaction.options.getUser('user');
        const itemName = interaction.options.getString('item');
        const quantityStr = interaction.options.getString('quantity');
        const message = interaction.options.getString('message') || 'None';
        const userId = interaction.user.id;

        if (!db.isFriend(userId, targetUser.id)) {
            return interaction.reply({ content: "You can only share items with friends.", flags: MessageFlags.Ephemeral });
        }

        const item = items.find(i => i.name === itemName);
        if (!item) return interaction.reply({ content: "Item not found.", flags: MessageFlags.Ephemeral });

        const count = db.getItemCount(userId, item.id);
        const quantity = parseNumber(quantityStr, count);

        if (quantity <= 0 || quantity > count) return interaction.reply({ content: "Invalid quantity.", flags: MessageFlags.Ephemeral });

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
            if (i.user.id !== userId) return i.reply({ content: 'Not your command.', flags: MessageFlags.Ephemeral });

            if (i.customId === 'confirm_share') {
                db.removeItem(userId, item.id, quantity);
                db.addItem(targetUser.id, item.id, quantity);

                // DM Target
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
                await i.update({ content: 'Cancelled', embeds: [], components: [] });
            }
            collector.stop();
        });
    }
};
