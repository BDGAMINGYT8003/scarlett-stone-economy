const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');
const parseAmount = require('../../utils/numberParser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Name of the item to use')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('quantity')
                .setDescription('Quantity to use (default 1)')
                .setRequired(false)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;

        // Get user inventory
        const inventory = db.getInventory(userId);

        // Filter inventory items that are usable AND match search
        // We need to map inventory item_ids to item config to check 'usable' property and name
        const usableUserItems = inventory.map(invItem => {
            const configItem = items.find(i => i.id === invItem.item_id);
            return configItem ? { ...configItem, quantity: invItem.quantity } : null;
        }).filter(item => item && item.usable && item.quantity > 0 && item.name.toLowerCase().includes(focusedValue));

        await interaction.respond(
            usableUserItems.slice(0, 25).map(i => ({ name: `${i.name} (${i.quantity})`, value: i.id }))
        );
    },
    async execute(interaction) {
        const itemId = interaction.options.getString('item');
        const quantityStr = interaction.options.getString('quantity') || '1';
        const userId = interaction.user.id;

        const item = items.find(i => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());

        if (!item) {
            return interaction.reply({ content: 'Item not found.', ephemeral: true });
        }

        if (!item.usable) {
            return interaction.reply({ content: 'This item cannot be used.', ephemeral: true });
        }

        const ownedQuantity = db.getItemCount(userId, item.id);
        const quantity = parseAmount(quantityStr, ownedQuantity);

        if (quantity <= 0) {
             return interaction.reply({ content: 'Invalid quantity.', ephemeral: true });
        }

        if (quantity > ownedQuantity) {
            return interaction.reply({ content: `You don't have enough ${item.name}s! You only have **${ownedQuantity.toLocaleString()}**.`, ephemeral: true });
        }

        // Logic for specific items
        if (item.id === 'bank_note') {
            // Bank Note Logic
            let totalAdded = 0;
            for (let i = 0; i < quantity; i++) {
                totalAdded += Math.floor(Math.random() * (75000 - 50000 + 1)) + 50000;
            }

            db.removeItem(userId, item.id, quantity);
            db.increaseBankCapacity(userId, totalAdded);

            const userData = db.getUser(userId);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nAdded Bank Space: **֍ ${totalAdded.toLocaleString()}**\nTotal Bank Space: **֍ ${userData.bank_capacity.toLocaleString()}**`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });

            await interaction.reply({ embeds: [embed] });
        } else if (item.id === 'alcohol') {
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nYou are now drunk. Don't drive!`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });
             await interaction.reply({ embeds: [embed] });

        } else if (item.id === 'lucky_clover') {
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nYou feel luckier!`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });
             await interaction.reply({ embeds: [embed] });
        } else if (item.id === 'pizza') {
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nYummy! You feel energized.`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });
             await interaction.reply({ embeds: [embed] });
        } else if (item.id === 'apple') {
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nAn apple a day...`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });
             await interaction.reply({ embeds: [embed] });
        } else if (item.id === 'padlock') {
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nYour wallet is locked! (Not really implemented yet but pretend it is).`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });
             await interaction.reply({ embeds: [embed] });
        } else {
            // Generic fallback
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Used')
                .setDescription(`${quantity} **${item.emoji} ${item.name}** used\nNothing happened.`)
                .setFooter({ text: `Remaining ${item.name}s in inventory: ${(ownedQuantity - quantity).toLocaleString()}` });

             await interaction.reply({ embeds: [embed] });
        }
    },
};
