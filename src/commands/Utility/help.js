const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');

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
        { name: '/work', description: 'Work shifts to earn money and unlock better jobs.' },
        { name: '/multipliers', description: 'Check your current coin multipliers.' },
        { name: '/achievements', description: 'View your achievements progress.' },
        { name: '/badges', description: 'View and manage your badges.' },
        { name: '/advancements levels', description: 'View level rewards.' },
        { name: '/friends', description: 'Manage your friends list and share resources.' },
        { name: '/currencylog', description: 'View your currency transaction history.' }
    ],
    Utility: [
        { name: '/help', description: 'Get help using the bot’s commands.' },
        { name: '/profile', description: 'View your profile and stats.' },
        { name: '/title', description: 'Manage your profile title.' }
    ],
    Admin: [
        { name: '/grant', description: 'Grants money or items to a user (Developer Only).' },
        { name: '/revoke', description: 'Revokes money, items, or premium from a user (Developer Only).' },
        { name: '/godmode', description: 'Grants God Mode (No Cooldowns) to a user (Developer Only).' }
    ]
};

const ITEMS_PER_PAGE = 6;

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

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

            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentCommands = commands.slice(start, end);

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`${category} Commands`)
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });

            currentCommands.forEach(cmd => {
                embed.addFields({ name: cmd.name, value: '-# ' + cmd.description });
            });

            return embed;
        };

        const generateComponents = (category, page) => {
            const commands = categories[category];
            const maxPages = Math.ceil(commands.length / ITEMS_PER_PAGE);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('category_select')
                .setPlaceholder('Select a category')
                .addOptions(
                    { label: 'Currency', value: 'Currency', default: category === 'Currency' },
                    { label: 'Utility', value: 'Utility', default: category === 'Utility' },
                    { label: 'Admin', value: 'Admin', default: category === 'Admin' }
                );

            const row1 = new ActionRowBuilder().addComponents(selectMenu);

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                new ButtonBuilder().setCustomId('refresh_help').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1),
                new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1)
            );

            return [row1, row2];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentCategory, currentPage)],
            components: generateComponents(currentCategory, currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission Denied')
                    .setDescription('This help session is not for you!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (i.componentType === ComponentType.StringSelect) {
                currentCategory = i.values[0];
                currentPage = 0;
            } else if (i.componentType === ComponentType.Button) {
                const maxPages = Math.ceil(categories[currentCategory].length / ITEMS_PER_PAGE);

                if (i.customId === 'prev_page') currentPage = Math.max(0, currentPage - 1);
                else if (i.customId === 'next_page') currentPage = Math.min(maxPages - 1, currentPage + 1);
                else if (i.customId === 'first_page') currentPage = 0;
                else if (i.customId === 'last_page') currentPage = maxPages - 1;
            }

            await i.update({
                embeds: [generateEmbed(currentCategory, currentPage)],
                components: generateComponents(currentCategory, currentPage)
            });
        });

        collector.on('end', async () => {
            const disabledComponents = generateComponents(currentCategory, currentPage).map(row => {
                row.components.forEach(c => c.setDisabled(true));
                return row;
            });

            try {
                await interaction.editReply({ components: disabledComponents });
            } catch (e) {}
        });
    },
};
