const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('View information about an item.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('Name of the item')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const filtered = items.filter(i => i.name.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(i => ({ name: i.name, value: i.id }))
        );
    },
    async execute(interaction) {
        const itemId = interaction.options.getString('item');
        const item = items.find(i => i.id === itemId || i.name.toLowerCase() === itemId.toLowerCase());

        if (!item) {
            const embed = new EmbedBuilder()
                .setTitle('Item Not Found')
                .setDescription('Item not found.')
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.user.id;
        const itemCount = db.getItemCount(userId, item.id);
        const netWorth = db.calculateNetWorth(userId);

        let ownershipPercentage = '0%';
        if (netWorth > 0) {
            const itemTotalValue = item.net_value * itemCount;
            ownershipPercentage = ((itemTotalValue / netWorth) * 100).toFixed(1) + '%';
        }

        const embed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle(item.name)
            .setDescription(`> ${item.description}\n\nYou currently own **${itemCount.toLocaleString()}** (${ownershipPercentage} of your total net worth)\n\n**${item.usage_info || 'No usage info available.'}**\n\n**Net Value**\n֍ ${item.net_value.toLocaleString()}\n\n**Additional Info**\npurchasable in the shop for ֍ ${item.buy_price.toLocaleString()}\ncan sell the item for ֍ ${item.sell_price.toLocaleString()}`)
            .setFooter({ text: `${item.type} | ${item.rarity}` });

        await interaction.reply({ embeds: [embed] });
    },
};
