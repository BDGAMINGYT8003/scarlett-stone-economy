const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Use an item from your inventory.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to use')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        // Filter to items the user OWNS
        const userInventory = db.getInventory(interaction.user.id);
        const focusedValue = interaction.options.getFocused().toLowerCase();

        // Map inventory items to full item data
        const ownedItems = userInventory.map(inv => items.find(i => i.id === inv.item_id)).filter(Boolean);

        const choices = ownedItems.map(i => i.name);
        // Remove duplicates if any (though inventory shouldn't have dups)
        const uniqueChoices = [...new Set(choices)];

        const filtered = uniqueChoices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },
    async execute(interaction) {
        const userId = interaction.user.id;
        const itemName = interaction.options.getString('item');
        const item = items.find(i => i.name === itemName);

        if (!item) {
             const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Item Not Found\nCould not find that item.'));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        // Check if user owns the item
        const count = db.getItemCount(userId, item.id);
        if (count < 1) {
             const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# You don't own this\nYou do not have any **${item.name}** in your inventory.`));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        // Logic for item usage
        let message = '';
        let success = true;

        if (item.id === 'bank_note') {
            // Bank Note: Increases bank space
            // Random amount between 5k and 25k (dank memer style varies, let's say 5k-25k)
            const capacity = Math.floor(Math.random() * (25000 - 5000 + 1)) + 5000;
            db.addBankCapacity(userId, capacity);
            db.removeItem(userId, item.id, 1);
            message = `You used a **Bank Note** and gained **֍ ${capacity.toLocaleString()}** bank space!`;
        } else if (item.id === 'apple') {
             db.removeItem(userId, item.id, 1);
             message = `You ate an apple. It was delicious, but did nothing else.`;
        } else if (item.id === 'alcohol') {
             db.removeItem(userId, item.id, 1);
             message = `You drank some alcohol. You feel dizzy.`;
             // Maybe add temporary "drunk" status in DB if we had that system
        } else if (item.id === 'laptop') {
             message = `You can't "use" a laptop directly. Use \`/postmemes\` instead!`;
             success = false;
        } else if (item.id === 'fishing_pole') {
             message = `You can't "use" a fishing pole directly. It's used automatically in \`/fish\` (if implemented) or use \`/search\` maybe?`;
             success = false;
        } else if (item.id === 'shovel') {
             message = `You can't "use" a shovel directly.`;
             success = false;
        } else if (item.id === 'hunting_rifle') {
             message = `You can't "use" a rifle directly.`;
             success = false;
        } else {
            // Generic fallback
             db.removeItem(userId, item.id, 1);
             message = `You used **${item.name}**. Nothing interesting happened.`;
        }

        const embed = new ContainerBuilder();
        if (success) {
            embed.setColor(0x00FF00); // Green
            embed.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Item Used\n${message}`));
        } else {
            embed.setColor(0xFFFF00); // Yellow/Orange
            embed.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Cannot Use\n${message}`));
        }

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
