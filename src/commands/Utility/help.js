const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ContainerBuilder, TextDisplayBuilder, SectionBuilder } = require('discord.js');

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
        { name: '/use', description: 'Use an item from your inventory.' },
        { name: '/slots', description: 'Bet some coins on the slot machine.' },
        { name: '/snakeeyes', description: 'Roll the dice for a chance to win big!' },
        { name: '/highlow', description: 'Guess if the secret number is higher or lower!' },
        { name: '/postmemes', description: 'Post a meme to earn money (requires a Laptop).' },
        { name: '/work', description: 'Work shifts to earn money and unlock better jobs.' }
    ],
    Utility: [
        { name: '/help', description: 'Get help using the bot’s commands.' }
    ],
    Admin: [
        { name: '/grant', description: 'Grants money or items to a user (Developer Only).' }
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

            const container = new ContainerBuilder()
                .setColor(0x0099FF)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${category} Commands`));

            currentCommands.forEach(cmd => {
                const section = new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**${cmd.name}**\n${cmd.description}`)
                    );
                container.addSectionComponents(section);
            });

            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Page ${page + 1} of ${maxPages}`));

            return container;
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
                    { label: 'Utility', value: 'Utility', default: category === 'Utility' },
                    { label: 'Admin', value: 'Admin', default: category === 'Admin' }
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

        // Wait, V2 allows ActionRows inside Container?
        // Documentation says: "addTextDisplayComponents(...), addSectionComponents(...), addActionRowComponents(...): Adds children to the container."
        // So I should put the action rows INSIDE the container if possible.
        // But `interaction.reply` takes `components` array which can accept `ContainerBuilder` AND `ActionRowBuilder` (or V2 equivalents).
        // Actually, the prompt says "ensure that all kinds of components... are directly put inside the embed itself, using the new Components V2 elements."
        // This implies I should use `ContainerBuilder.addActionRowComponents`.

        const generateResponseComponents = (category, page) => {
            const container = generateEmbed(category, page);
            const actionRows = generateComponents(category, page);

            // Add action rows to the container
            container.addActionRowComponents(...actionRows);

            return [container];
        };

        const response = await interaction.reply({
            components: generateResponseComponents(currentCategory, currentPage),
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            time: 60000 // 1 minute timeout
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorContainer = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Permission Denied\nThis help session is not for you!'))
                    .setColor(0xFF0000);
                return i.reply({ components: [errorContainer], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
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
                components: generateResponseComponents(currentCategory, currentPage)
            });
        });

        collector.on('end', async () => {
            // Disable all components on timeout
            // Since components are inside the container, I need to regenerate the container with disabled components.

            const actionRows = generateComponents(currentCategory, currentPage);
            actionRows.forEach(row => {
                row.components.forEach(c => c.setDisabled(true));
            });

            const container = generateEmbed(currentCategory, currentPage);
            container.addActionRowComponents(...actionRows);

            try {
                await interaction.editReply({ components: [container] });
            } catch (e) {
                // Ignore if message was deleted
            }
        });
    },
};
