const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');

const ITEMS_PER_PAGE = 5;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your inventory or someone else’s.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check inventory for')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        // Initial Fetch
        let inventory = db.getInventory(targetUser.id);

        // Helper to refresh data
        const refreshInventory = () => {
            inventory = db.getInventory(targetUser.id);
             // Sort alphabetically
            inventory.sort((a, b) => {
                const itemA = items.find(i => i.id === a.item_id);
                const itemB = items.find(i => i.id === b.item_id);
                return (itemA?.name || '').localeCompare(itemB?.name || '');
            });
        };

        refreshInventory();

        if (inventory.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('Empty Inventory')
                .setDescription(`${targetUser.username} has no items in their inventory.`)
                .setColor(0xFFFF00);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        let currentPage = 0;

        const getMaxPages = () => Math.max(1, Math.ceil(inventory.length / ITEMS_PER_PAGE));

        const generateEmbed = (page) => {
            const maxPages = getMaxPages();
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentItems = inventory.slice(start, end);

            let content = "";
            for (const invItem of currentItems) {
                const itemData = items.find(i => i.id === invItem.item_id);
                if (itemData) {
                    content += `${itemData.emoji} **${itemData.name}** ─ ${invItem.quantity.toLocaleString()}\n`;
                } else {
                    content += `❓ **Unknown Item (${invItem.item_id})** ─ ${invItem.quantity.toLocaleString()}\n`;
                }
            }

            return new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle(`${targetUser.username}'s Inventory`)
                .setDescription(content || "No items on this page.")
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });
        };

        const generateComponents = (page) => {
            const maxPages = getMaxPages();

            const prevButton = new ButtonBuilder()
                .setCustomId('inv_prev')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0);

            const refreshButton = new ButtonBuilder()
                .setCustomId('inv_refresh')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Primary);

            const nextButton = new ButtonBuilder()
                .setCustomId('inv_next')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= maxPages - 1);

            return [new ActionRowBuilder().addComponents(prevButton, refreshButton, nextButton)];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: generateComponents(currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission Denied')
                    .setDescription('This is not your inventory session!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'inv_prev') {
                currentPage = Math.max(0, currentPage - 1);
            } else if (i.customId === 'inv_next') {
                const maxPages = getMaxPages();
                currentPage = Math.min(maxPages - 1, currentPage + 1);
            } else if (i.customId === 'inv_refresh') {
                refreshInventory();
                // Reset page if it exceeds new max
                const maxPages = getMaxPages();
                if (currentPage >= maxPages) {
                    currentPage = maxPages - 1;
                }
            }

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: generateComponents(currentPage)
            });
        });

        collector.on('end', async () => {
             const disabledRow = new ActionRowBuilder().addComponents(
                generateComponents(currentPage)[0].components.map(btn => btn.setDisabled(true))
            );
            try {
                await interaction.editReply({ components: [disabledRow] });
            } catch (e) {}
        });
    },
};
