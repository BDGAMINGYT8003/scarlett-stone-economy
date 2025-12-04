const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

const categories = {
    Currency: [
        { name: '/deposit', description: 'Deposit coins into your bank from your pocket.' },
        { name: '/withdraw', description: 'Withdraw money from your bank into your pocket.' },
        { name: '/balance', description: 'See someone’s balance, including pocket, bank, net worth, and more.' },
        { name: '/beg', description: 'Beg for coins to help increase your pocket balance.' },
        { name: '/search', description: 'Search various places for items and coins, with some risks.' },
        { name: '/crime', description: 'Commit a fake crime for items and coins, with some risk.' },
        { name: '/daily', description: 'Each day you can get a small amount of coins and maintain a streak.' },
        { name: '/weekly', description: 'Once per week, get a moderate amount of coins.' },
        { name: '/monthly', description: 'Each month, receive a large amount of coins.' },
        { name: '/item', description: 'View information about an item.' },
        { name: '/inventory', description: 'View your inventory or someone else’s.' },
        { name: '/use', description: 'Use an item from your inventory.' }
    ],
    Utility: [
        { name: '/help', description: 'Get help using the bot’s commands.' }
    ]
};

const ITEMS_PER_PAGE = 6;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Get help using the bot’s commands.'),
    async execute(interaction) {
        let currentCategory = 'Currency';
        let currentPage = 0;

        const generateEmbed = (category, page) => {
            const commands = categories[category];
            const maxPages = Math.ceil(commands.length / ITEMS_PER_PAGE);

            // Slice commands for current page
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentCommands = commands.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${category} Commands`)
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });

            currentCommands.forEach(cmd => {
                embed.addFields({ name: cmd.name, value: cmd.description });
            });

            return embed;
        };

        const generateComponents = (category, page) => {
            const commands = categories[category];
            const maxPages = Math.ceil(commands.length / ITEMS_PER_PAGE);

            // Select Menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('category_select')
                .setPlaceholder('Select a category')
                .addOptions(
                    { label: 'Currency', value: 'Currency', default: category === 'Currency' },
                    { label: 'Utility', value: 'Utility', default: category === 'Utility' }
                );

            const row1 = new ActionRowBuilder().addComponents(selectMenu);

            // Pagination Buttons
            const prevButton = new ButtonBuilder()
                .setCustomId('prev_page')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0);

            const nextButton = new ButtonBuilder()
                .setCustomId('next_page')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page >= maxPages - 1);

            const row2 = new ActionRowBuilder().addComponents(prevButton, nextButton);

            return [row1, row2];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentCategory, currentPage)],
            components: generateComponents(currentCategory, currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This help session is not for you!', ephemeral: true });
            }

            if (i.componentType === ComponentType.StringSelect) {
                currentCategory = i.values[0];
                currentPage = 0; // Reset to first page
            } else if (i.componentType === ComponentType.Button) {
                if (i.customId === 'prev_page') {
                    currentPage = Math.max(0, currentPage - 1);
                } else if (i.customId === 'next_page') {
                    const maxPages = Math.ceil(categories[currentCategory].length / ITEMS_PER_PAGE);
                    currentPage = Math.min(maxPages - 1, currentPage + 1);
                }
            }

            await i.update({
                embeds: [generateEmbed(currentCategory, currentPage)],
                components: generateComponents(currentCategory, currentPage)
            });
        });

        collector.on('end', async () => {
            // Disable all components on timeout
            const disabledComponents = generateComponents(currentCategory, currentPage).map(row => {
                row.components.forEach(c => c.setDisabled(true));
                return row;
            });

            try {
                await interaction.editReply({ components: disabledComponents });
            } catch (e) {
                // Ignore if message was deleted
            }
        });
    },
};
