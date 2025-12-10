const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors, MediaGalleryBuilder } = require('discord.js');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('View information about an item.')
        .addStringOption(option =>
            option.setName('item')
                .setDescription('The item to view')
                .setRequired(true)
                .setAutocomplete(true)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = items.map(i => i.name);
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },
    async execute(interaction) {
        const itemName = interaction.options.getString('item');
        const item = items.find(i => i.name === itemName);

        if (!item) {
            const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`# Item Not Found\nCould not find an item named "${itemName}".`)
                );
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        const embed = new ContainerBuilder()
            .setColor(0x0099FF)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${item.emoji} ${item.name}\n${item.description || 'No description available.'}`)
            )
            .addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Type**\n${item.type}`),
                    new TextDisplayBuilder().setContent(`**Buy Price**\n${item.buy_price ? `֍ ${item.buy_price.toLocaleString()}` : 'Not for sale'}`),
                    new TextDisplayBuilder().setContent(`**Sell Price**\n${item.sell_price ? `֍ ${item.sell_price.toLocaleString()}` : 'Not sellable'}`)
                )
            );

        if (item.image) {
             const gallery = new MediaGalleryBuilder().addItems({ media: { url: item.image }, description: item.name });

             return interaction.reply({
                 components: [embed, gallery],
                 flags: MessageFlags.IsComponentsV2
             });
        }

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
