const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');
const parseAmount = require('../../utils/numberParser');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grant')
        .setDescription('Admin only: Grant money or items to yourself.')
        .addStringOption(option =>
            option.setName('selection')
                .setDescription('Select Money or an Item to grant')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('quantity')
                .setDescription('The amount to grant')
                .setRequired(true)),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        // Options: Money + All Items
        const allOptions = [
            { name: '֍ Money', value: 'money' },
            ...items.map(i => ({ name: `${i.emoji} ${i.name}`, value: i.id }))
        ];

        const filtered = allOptions.filter(choice => choice.name.toLowerCase().includes(focusedValue));

        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice.name, value: choice.value }))
        );
    },

    async execute(interaction) {
        // Check if user is the admin
        if (interaction.user.id !== '794482283993235478') {
            return interaction.reply({ content: 'You are not authorized to use this command.', ephemeral: true });
        }

        const selection = interaction.options.getString('selection');
        const quantityStr = interaction.options.getString('quantity');

        // Parse quantity
        // If selection is money, "max" implies a safe large limit or maybe just fail.
        // Let's assume a large limit for money if max is used, or just standard parsing.
        // numberParser accepts a maxAmount.
        // For items, maxAmount could be "how many fit in inventory" but we don't have hard inventory limits yet except logical ones.
        // Let's pass Number.MAX_SAFE_INTEGER as the limit for now.
        const quantity = parseAmount(quantityStr, Number.MAX_SAFE_INTEGER);

        if (quantity <= 0) {
            return interaction.reply({ content: 'Invalid quantity provided.', ephemeral: true });
        }

        if (selection === 'money') {
            db.addBalance(interaction.user.id, quantity);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Grant Successful')
                .setDescription(`Granted **֍ ${quantity.toLocaleString()}** to your wallet.`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } else {
            // It's an item
            const item = items.find(i => i.id === selection);
            if (!item) {
                return interaction.reply({ content: 'Invalid item selected.', ephemeral: true });
            }

            db.addItem(interaction.user.id, item.id, quantity);

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('Grant Successful')
                .setDescription(`Granted **${quantity.toLocaleString()}** ${item.emoji} **${item.name}**(s) to your inventory.`)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    },
};
