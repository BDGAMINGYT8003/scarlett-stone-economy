const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { checkAndUnlockAchievements } = require('../../utils/achievementManager');
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
        const userInventory = db.getInventory(userId);

        // Filter items that are usable AND owned by user
        const ownedUsableItems = items.filter(i => {
            if (!i.usable) return false;
            // Check if user has at least 1 of this item
            const invItem = userInventory.find(inv => inv.item_id === i.id);
            return invItem && invItem.quantity > 0;
        });

        const filtered = ownedUsableItems.filter(i => i.name.toLowerCase().includes(focusedValue));

        await interaction.respond(
            filtered.slice(0, 25).map(i => ({ name: i.name, value: i.id }))
        );
    },
    async execute(interaction) {
        const itemId = interaction.options.getString('item');
        const quantityStr = interaction.options.getString('quantity') || '1';
        const userId = interaction.user.id;

        const item = items.find(i => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());

        if (!item) {
            const embed = new EmbedBuilder()
                .setTitle('Item Not Found')
                .setDescription('Item not found.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (!item.usable) {
            const embed = new EmbedBuilder()
                .setTitle('Unusable Item')
                .setDescription('This item cannot be used.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const ownedQuantity = db.getItemCount(userId, item.id);
        const quantity = parseAmount(quantityStr, ownedQuantity);

        if (quantity <= 0) {
             const embed = new EmbedBuilder()
                .setTitle('Invalid Quantity')
                .setDescription('Invalid quantity.')
                .setColor(0xFF0000);
             return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (quantity > ownedQuantity) {
            const embed = new EmbedBuilder()
                .setTitle('Insufficient Items')
                .setDescription(`You don't have enough ${item.name}s! You only have **${ownedQuantity.toLocaleString()}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
                .setTitle('Bank Space Expanded!')
                .setDescription(`Used ${quantity} ${item.emoji} **${item.name}**\n\n**Added Bank Space**\n֍ ${totalAdded.toLocaleString()}\n\n**Total Bank Space**\n֍ ${userData.bank_capacity.toLocaleString()}`)
                .setFooter({ text: `${(ownedQuantity - quantity).toLocaleString()} ${item.name.toLowerCase()}s left` });

            await interaction.reply({ embeds: [embed] });
        } else if (item.id === 'adventure_ticket' || item.id === 'pizza') {
             // Example lootbox style items that give coins
             // For now just random coins
             let totalCoins = 0;
             for (let i = 0; i < quantity; i++) {
                 totalCoins += Math.floor(Math.random() * 5000) + 1000;
             }

             db.removeItem(userId, item.id, quantity);
             db.addBalance(userId, totalCoins);
             db.logTransaction(userId, 'item_use', { amount: totalCoins, title: `Used ${item.name}` });

             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`${item.name} Used`)
                .setDescription(`You used ${quantity} **${item.name}** and found **֍ ${totalCoins.toLocaleString()}**!`)
                .setFooter({ text: `${(ownedQuantity - quantity).toLocaleString()} ${item.name.toLowerCase()}s left` });

             await interaction.reply({ embeds: [embed] });
        } else {
            // Generic placeholder for other usable items
             db.removeItem(userId, item.id, quantity);
             const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`${item.name} Used`)
                .setDescription(`You used ${quantity} **${item.name}**. It didn't do much yet...`)
                .setFooter({ text: `${(ownedQuantity - quantity).toLocaleString()} ${item.name.toLowerCase()}s left` });

             await interaction.reply({ embeds: [embed] });
        }

        // Track stats and check achievements
        db.incrementStat(userId, 'items_used', quantity);
        await checkAndUnlockAchievements(userId, interaction);
    },
};
