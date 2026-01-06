const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');
const numberParser = require('../../utils/numberParser');

const REPLY_EMOJI = '<:Reply:1457839486011445391>';
const REPLY_CONT_EMOJI = '<:ReplyCont:1457839483541127208>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('friends')
        .setDescription('Manage your friends and share coins/items.')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a friend.')
                .addUserOption(option => option.setName('user').setDescription('The user to add').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a friend.')
                .addUserOption(option => option.setName('user').setDescription('The user to remove').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List your friends.')
                .addIntegerOption(option => option.setName('page').setDescription('The page to view').setMinValue(1))
        )
        .addSubcommand(sub =>
            sub.setName('inspect')
                .setDescription('Inspect a friendship.')
                .addUserOption(option => option.setName('user').setDescription('The friend to inspect').setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('share_coins')
                .setDescription('Share coins with a friend.')
                .addUserOption(option => option.setName('user').setDescription('The friend to share with').setRequired(true))
                .addStringOption(option => option.setName('amount').setDescription('Amount to share').setRequired(true))
                .addStringOption(option => option.setName('message').setDescription('Optional message'))
        )
        .addSubcommand(sub =>
            sub.setName('share_items')
                .setDescription('Share items with a friend.')
                .addUserOption(option => option.setName('user').setDescription('The friend to share with').setRequired(true))
                .addStringOption(option => option.setName('quantity').setDescription('Quantity to share').setRequired(true))
                .addStringOption(option => option.setName('item').setDescription('Item to share (ID or name)').setRequired(true).setAutocomplete(true))
                .addStringOption(option => option.setName('message').setDescription('Optional message'))
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const userInventory = db.getInventory(interaction.user.id);

        // Filter items the user actually has
        const ownedItems = userInventory.map(invItem => {
            const configItem = items.find(i => i.id === invItem.item_id);
            return configItem ? { name: configItem.name, value: configItem.id } : null;
        }).filter(item => item !== null);

        const filtered = ownedItems.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user');

        if (['add', 'remove', 'share_coins', 'share_items', 'inspect'].includes(subcommand)) {
            if (targetUser.id === interaction.user.id) {
                return interaction.reply({
                    content: 'You cannot perform this action on yourself.',
                    flags: MessageFlags.Ephemeral
                });
            }
            if (targetUser.bot) {
                return interaction.reply({
                    content: 'You cannot add bots as friends.',
                    flags: MessageFlags.Ephemeral
                });
            }
        }

        if (subcommand === 'add') {
            await handleAdd(interaction, targetUser);
        } else if (subcommand === 'remove') {
            await handleRemove(interaction, targetUser);
        } else if (subcommand === 'list') {
            await handleList(interaction);
        } else if (subcommand === 'inspect') {
            await handleInspect(interaction, targetUser);
        } else if (subcommand === 'share_coins') {
            await handleShareCoins(interaction, targetUser);
        } else if (subcommand === 'share_items') {
            await handleShareItems(interaction, targetUser);
        }
    }
};

async function handleAdd(interaction, targetUser) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;

    // Checks
    if (db.areFriends(userId, targetId)) {
        return interaction.reply({ content: 'You are already friends!', flags: MessageFlags.Ephemeral });
    }

    const friends = db.getFriends(userId);
    if (friends.length >= 10) {
        return interaction.reply({ content: 'You have reached the maximum of 10 friends.', flags: MessageFlags.Ephemeral });
    }

    // Check target's friends limit
    const targetFriends = db.getFriends(targetId);
    if (targetFriends.length >= 10) {
        return interaction.reply({ content: `${targetUser.username} has reached the maximum of 10 friends.`, flags: MessageFlags.Ephemeral });
    }

    const cooldown = db.getFriendCooldown(userId, targetId);
    if (cooldown > Date.now()) {
        return interaction.reply({
            content: `You cannot add this user as a friend until <t:${Math.floor(cooldown / 1000)}:R>.`,
            flags: MessageFlags.Ephemeral
        });
    }

    // Step 1: Initiator Confirmation
    const confirmBtn = new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success);
    const cancelBtn = new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    const embed = new EmbedBuilder()
        .setTitle('Pending Confirmation')
        .setDescription(`Are you sure you want to add ${targetUser} as a friend?

- You will have no tax in \`/wager\` against each other
- You can share items and coins with each other tax-free
**WARNING**: Do not add people you don't trust; scams WILL happen.
Becoming friends just to trade is against [bot rules](https://dankmemer.lol/rules) in addition to the risk of scams.`)
        .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
        .setColor('#FFA500'); // Orange for pending

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) {
            return i.reply({ content: 'This is not your confirmation.', flags: MessageFlags.Ephemeral });
        }

        if (i.customId === 'cancel') {
            embed.setTitle('Action Cancelled')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Action Cancelled', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#FF0000'); // Red
            await i.update({ embeds: [embed], components: [] });
            return;
        }

        if (i.customId === 'confirm') {
            // Update Initiator Embed
            embed.setTitle('Action Confirmed')
                 .setDescription(`Request sent to ${targetUser}!`)
                 .setColor('#00FF00');
            await i.update({ embeds: [embed], components: [] });

            // Step 2: Target Confirmation (New Embed)
            const targetEmbed = new EmbedBuilder()
                .setTitle('Pending Confirmation')
                .setDescription(`-# ${targetUser}, ${interaction.user} wants to add you as a friend!

- You can share items, coins, and pets with each other tax-free
**WARNING**: Do not add people you don't trust; scams WILL happen.
Becoming friends just to trade is against [bot rules](https://dankmemer.lol/rules) in addition to the risk of scams.`)
                .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#FFA500');

            const targetRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('target_confirm').setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('target_cancel').setLabel('Decline').setStyle(ButtonStyle.Danger)
            );

            // Send to channel (or followUp if possible, but channel.send ensures visibility if context allows)
            // Using followUp is safer for slash commands context
            const targetMsg = await interaction.followUp({ content: `${targetUser}`, embeds: [targetEmbed], components: [targetRow], fetchReply: true });

            const targetCollector = targetMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

            targetCollector.on('collect', async ti => {
                if (ti.user.id !== targetId) {
                    return ti.reply({ content: 'This is not for you.', flags: MessageFlags.Ephemeral });
                }

                if (ti.customId === 'target_cancel') {
                    targetEmbed.setTitle('Action Cancelled')
                        .setDescription(`~~${targetEmbed.data.description}~~`)
                        .setFooter({ text: 'Action Cancelled', iconURL: interaction.client.user.displayAvatarURL() })
                        .setColor('#FF0000');
                    await ti.update({ embeds: [targetEmbed], components: [] });
                    return;
                }

                if (ti.customId === 'target_confirm') {
                    // Double check checks again
                    if (db.areFriends(userId, targetId)) {
                         return ti.update({ content: 'Already friends!', components: [] });
                    }
                    if (db.getFriends(userId).length >= 10 || db.getFriends(targetId).length >= 10) {
                         return ti.update({ content: 'Someone reached the friend limit!', components: [] });
                    }

                    db.addFriend(userId, targetId);

                    targetEmbed.setTitle('Action Confirmed')
                        .setDescription(`You are now friends with ${interaction.user}!`)
                        .setColor('#00FF00');
                    await ti.update({ embeds: [targetEmbed], components: [] });
                }
            });

            targetCollector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    targetEmbed.setTitle('Timed Out')
                        .setDescription(`~~${targetEmbed.data.description}~~`)
                        .setFooter({ text: 'Timed Out', iconURL: interaction.client.user.displayAvatarURL() })
                        .setColor('#808080');
                    try { await targetMsg.edit({ embeds: [targetEmbed], components: [] }); } catch (e) {}
                }
            });
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            embed.setTitle('Timed Out')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Timed Out', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#808080');
            try { await response.edit({ embeds: [embed], components: [] }); } catch (e) {}
        }
    });
}

async function handleRemove(interaction, targetUser) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;

    if (!db.areFriends(userId, targetId)) {
        return interaction.reply({ content: 'You are not friends with this user.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('Pending Confirmation')
        .setDescription(`Are you sure you want to remove ${targetUser} as a friend? You won't be able to add them as a friend again for a day.`)
        .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
        .setColor('#FFA500');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) return i.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });

        if (i.customId === 'cancel') {
            embed.setTitle('Action Cancelled')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Action Cancelled', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#FF0000');
            await i.update({ embeds: [embed], components: [] });
            return;
        }

        if (i.customId === 'confirm') {
            db.removeFriend(userId, targetId);
            embed.setTitle('Action Confirmed')
                .setDescription(`Removed ${targetUser} from friends.`)
                .setColor('#00FF00');
            await i.update({ embeds: [embed], components: [] });
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            embed.setTitle('Timed Out')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Timed Out', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#808080');
            try { await response.edit({ embeds: [embed], components: [] }); } catch (e) {}
        }
    });
}

async function handleList(interaction) {
    const userId = interaction.user.id;
    const friends = db.getFriends(userId);
    const totalFriends = friends.length;
    const page = interaction.options.getInteger('page') || 1;
    const itemsPerPage = 5;
    const totalPages = Math.ceil(totalFriends / itemsPerPage) || 1;

    if (page > totalPages && totalFriends > 0) {
        return interaction.reply({ content: `Invalid page. Max pages: ${totalPages}`, flags: MessageFlags.Ephemeral });
    }

    const generateEmbed = async (p) => {
        const start = (p - 1) * itemsPerPage;
        const pageItems = friends.slice(start, start + itemsPerPage);

        let desc = '';
        for (const f of pageItems) {
            const fId = f.user_id_1 === userId ? f.user_id_2 : f.user_id_1;
            const friendUser = await interaction.client.users.fetch(fId).catch(() => ({ username: 'Unknown', id: fId }));
            const timestamp = Math.floor(f.created_at / 1000);

            desc += `> <@${fId}> (${friendUser.username})\n`;
            desc += `${REPLY_CONT_EMOJI} Friends since <t:${timestamp}:D> (<t:${timestamp}:R>)\n`;
        }

        if (totalFriends === 0) desc = 'You have no friends yet! Use `/friends add` to add some.';

        const slotsLeft = 10 - totalFriends;

        return new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Friends`)
            .setDescription(desc)
            .setFooter({ text: `${slotsLeft} slots left ─ Page ${p} of ${totalPages}`, iconURL: interaction.client.user.displayAvatarURL() })
            .setColor('#2C2F33');
    };

    const embed = await generateEmbed(page);

    // Pagination Buttons
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 1),
        new ButtonBuilder().setCustomId('refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
        new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages)
    );

    const response = await interaction.reply({ embeds: [embed], components: totalFriends > 0 ? [row] : [], fetchReply: true });

    if (totalFriends === 0) return;

    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    let currentPage = page;

    collector.on('collect', async i => {
        if (i.user.id !== userId) return i.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });

        if (i.customId === 'prev') currentPage--;
        if (i.customId === 'next') currentPage++;
        // refresh just re-renders

        const newEmbed = await generateEmbed(currentPage);
        const newRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev').setLabel('Previous').setStyle(ButtonStyle.Primary).setDisabled(currentPage === 1),
            new ButtonBuilder().setCustomId('refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
            new ButtonBuilder().setCustomId('next').setLabel('Next').setStyle(ButtonStyle.Primary).setDisabled(currentPage === totalPages)
        );

        await i.update({ embeds: [newEmbed], components: [newRow] });
    });
}

async function handleInspect(interaction, targetUser) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;

    if (!db.areFriends(userId, targetId)) {
        return interaction.reply({ content: 'You are not friends with this user.', flags: MessageFlags.Ephemeral });
    }

    const friends = db.getFriends(userId);
    const friendData = friends.find(f => f.user_id_1 === targetId || f.user_id_2 === targetId);

    if (!friendData) return interaction.reply({ content: 'Error finding friendship data.', flags: MessageFlags.Ephemeral });

    const timestamp = Math.floor(friendData.created_at / 1000);

    const embed = new EmbedBuilder()
        .setTitle(`Friendship: ${interaction.user.username} & ${targetUser.username}`)
        .setDescription(`**Friends since:** <t:${timestamp}:F> (<t:${timestamp}:R>)`)
        .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
        .setColor('#2C2F33');

    interaction.reply({ embeds: [embed] });
}

async function handleShareCoins(interaction, targetUser) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;
    const amountStr = interaction.options.getString('amount');
    const message = interaction.options.getString('message') || 'None';

    if (!db.areFriends(userId, targetId)) {
        return interaction.reply({ content: 'You can only share coins with friends.', flags: MessageFlags.Ephemeral });
    }

    const userBal = db.getUser(userId).balance;
    let amount = numberParser.parse(amountStr, userBal);

    if (!amount || amount <= 0) {
        return interaction.reply({ content: 'Invalid amount.', flags: MessageFlags.Ephemeral });
    }
    if (amount > userBal) {
        return interaction.reply({ content: 'You do not have enough coins.', flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('Pending Confirmation')
        .setDescription(`Are you sure you want to send **⏣ ${amount.toLocaleString()}** to ${targetUser}?`)
        .addFields({ name: 'Message', value: message })
        .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
        .setColor('#FFA500');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) return i.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });

        if (i.customId === 'cancel') {
            embed.setTitle('Action Cancelled')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Action Cancelled', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#FF0000');
            await i.update({ embeds: [embed], components: [] });
            return;
        }

        if (i.customId === 'confirm') {
            // Re-check balance
            const currentBal = db.getUser(userId).balance;
            if (currentBal < amount) {
                return i.update({ content: 'You no longer have enough coins.', embeds: [], components: [] });
            }

            db.removeBalance(userId, amount);
            db.addBalance(targetId, amount);

            // Log
            db.logTransaction(userId, 'share_coins', { to: targetId, amount, message });

            // Increment shared_coins stat for achievement
            db.incrementStat(userId, 'shared_coins', amount);

            // Check for specific achievement: "Share 100m in a single transaction"
            if (amount >= 100000000) {
                db.setAchievement(userId, 'share_100m', true, 100000000);
            }

            // DM Recipient
            const dmEmbed = new EmbedBuilder()
                .setTitle('You have been given coins!')
                .setDescription(`Your friend ${interaction.user} shared **⏣ ${amount.toLocaleString()}** with you! Check your \`/balance\` and enjoy!

> **Message:** ${message}`)
                .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#00FF00');

            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (e) {
                // Ignore DM failure
            }

            embed.setTitle('Action Confirmed')
                .setDescription(`Successfully sent **⏣ ${amount.toLocaleString()}** to ${targetUser}!`)
                .setColor('#00FF00');
            await i.update({ embeds: [embed], components: [] });
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            embed.setTitle('Timed Out')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Timed Out', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#808080');
            try { await response.edit({ embeds: [embed], components: [] }); } catch (e) {}
        }
    });
}

async function handleShareItems(interaction, targetUser) {
    const userId = interaction.user.id;
    const targetId = targetUser.id;
    const itemId = interaction.options.getString('item');
    const quantityStr = interaction.options.getString('quantity');
    const message = interaction.options.getString('message') || 'None';

    if (!db.areFriends(userId, targetId)) {
        return interaction.reply({ content: 'You can only share items with friends.', flags: MessageFlags.Ephemeral });
    }

    const item = items.find(i => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());
    if (!item) return interaction.reply({ content: 'Item not found.', flags: MessageFlags.Ephemeral });

    const userItemCount = db.getItemCount(userId, item.id);
    const quantity = numberParser.parse(quantityStr, userItemCount);

    if (!quantity || quantity <= 0) {
        return interaction.reply({ content: 'Invalid quantity.', flags: MessageFlags.Ephemeral });
    }
    if (quantity > userItemCount) {
        return interaction.reply({ content: `You only have ${userItemCount} ${item.name}.`, flags: MessageFlags.Ephemeral });
    }

    const embed = new EmbedBuilder()
        .setTitle('Pending Confirmation')
        .setDescription(`Are you sure you want to send **${quantity}x ${item.name}** to ${targetUser}?`)
        .addFields({ name: 'Message', value: message })
        .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
        .setColor('#FFA500');

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger)
    );

    const response = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

    collector.on('collect', async i => {
        if (i.user.id !== userId) return i.reply({ content: 'Not for you.', flags: MessageFlags.Ephemeral });

        if (i.customId === 'cancel') {
            embed.setTitle('Action Cancelled')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Action Cancelled', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#FF0000');
            await i.update({ embeds: [embed], components: [] });
            return;
        }

        if (i.customId === 'confirm') {
            // Re-check
            if (db.getItemCount(userId, item.id) < quantity) {
                return i.update({ content: 'You no longer have enough items.', embeds: [], components: [] });
            }

            db.removeItem(userId, item.id, quantity);
            db.addItem(targetId, item.id, quantity);

            // Log
            db.logTransaction(userId, 'share_items', { to: targetId, item: item.id, quantity, message });
            db.incrementStat(userId, 'items_shared', quantity);

            // DM Recipient
            const dmEmbed = new EmbedBuilder()
                .setTitle('You have been given items!')
                .setDescription(`Your friend ${interaction.user} shared **${quantity}x ${item.name}** with you! Check your \`/inventory\`!

> **Message:** ${message}`)
                .setFooter({ text: 'Dank Memer', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#00FF00');

            try {
                await targetUser.send({ embeds: [dmEmbed] });
            } catch (e) {
                // Ignore
            }

            embed.setTitle('Action Confirmed')
                .setDescription(`Successfully sent **${quantity}x ${item.name}** to ${targetUser}!`)
                .setColor('#00FF00');
            await i.update({ embeds: [embed], components: [] });
        }
    });

    collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
            embed.setTitle('Timed Out')
                .setDescription(`~~${embed.data.description}~~`)
                .setFooter({ text: 'Timed Out', iconURL: interaction.client.user.displayAvatarURL() })
                .setColor('#808080');
            try { await response.edit({ embeds: [embed], components: [] }); } catch (e) {}
        }
    });
}
