const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

const ITEMS_PER_PAGE = 10;

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('title')
        .setDescription('Manage your profile title.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your unlocked titles.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your profile title.')
                .addStringOption(option =>
                    option.setName('title')
                        .setDescription('The title to equip')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove your current title.')),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const userId = interaction.user.id;
        const unlockedTitles = db.getTitles(userId);

        const filtered = unlockedTitles.filter(t => t.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(t => ({ name: t, value: t }))
        );
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'list') await this.handleList(interaction);
        else if (subcommand === 'set') await this.handleSet(interaction);
        else if (subcommand === 'remove') await this.handleRemove(interaction);
    },

    async handleList(interaction) {
        const userId = interaction.user.id;
        const unlockedTitles = db.getTitles(userId);
        const userData = db.getUser(userId);
        const currentTitle = userData.selected_title || 'None';

        const titles = [...unlockedTitles].reverse();

        let currentPage = 0;
        const maxPages = Math.ceil(titles.length / ITEMS_PER_PAGE) || 1;

        const generateEmbed = () => {
            const start = currentPage * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentTitles = titles.slice(start, end);

            let desc = `> Your current title: **${currentTitle}**\n\n`;

            if (currentTitles.length === 0) {
                desc += "You haven't unlocked any titles yet.";
            } else {
                currentTitles.forEach(t => {
                    desc += `- ${t}\n`;
                });
            }

            return new EmbedBuilder()
                .setTitle('Available Titles')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${currentPage + 1} of ${maxPages}` });
        };

        const getComponents = () => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage === 0),
                    new ButtonBuilder().setCustomId('refresh_titles').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1),
                    new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(currentPage >= maxPages - 1)
                )
            ];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed()],
            components: getComponents(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your session!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'next_page') currentPage = Math.min(maxPages - 1, currentPage + 1);
            if (i.customId === 'first_page') currentPage = 0;
            if (i.customId === 'last_page') currentPage = maxPages - 1;
            if (i.customId === 'refresh_titles') {
                // update
            }

            await i.update({
                embeds: [generateEmbed()],
                components: getComponents()
            });
        });
    },

    async handleSet(interaction) {
        // ... (Keep existing)
        const title = interaction.options.getString('title');
        const userId = interaction.user.id;

        const unlockedTitles = db.getTitles(userId);
        if (!unlockedTitles.includes(title)) {
            const embed = new EmbedBuilder()
                .setTitle('Title Locked')
                .setDescription("You haven't unlocked this title yet!")
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        db.setTitle(userId, title);

        const embed = new EmbedBuilder()
            .setTitle('Title Equipped')
            .setDescription(`Changed your title to **'${title}'**.`)
            .setColor(0x00FF00)
            .setFooter({ text: 'Lookin\' good!' });

        await interaction.reply({ embeds: [embed] });
    },

    async handleRemove(interaction) {
        // ... (Keep existing)
        const userId = interaction.user.id;
        db.setTitle(userId, null);

        const embed = new EmbedBuilder()
            .setTitle('Title Removed')
            .setDescription('Removed your current title.')
            .setColor(0x00FF00)
            .setFooter({ text: 'Back to basics.' });

        await interaction.reply({ embeds: [embed] });
    }
};
