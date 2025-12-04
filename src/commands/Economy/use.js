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
        // Filter only usable items
        const usableItems = items.filter(i => i.usable && i.name.toLowerCase().includes(focusedValue));
        await interaction.respond(
            usableItems.slice(0, 25).map(i => ({ name: i.name, value: i.id }))
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
                .setTitle('Bank Space Expanded!')
                .setDescription(`Used ${quantity} ${item.emoji} **${item.name}**\n\n**Added Bank Space**\n֍ ${totalAdded.toLocaleString()}\n\n**Total Bank Space**\n֍ ${userData.bank_capacity.toLocaleString()}`)
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
    },
};
