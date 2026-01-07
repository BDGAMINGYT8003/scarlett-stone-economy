const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('compare')
        .setDescription('Compare stats with another user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to compare with')
                .setRequired(true)),
    async execute(interaction) {
        const initiator = interaction.user;
        const target = interaction.options.getUser('user');

        if (initiator.id === target.id) {
            const embed = new EmbedBuilder()
                .setTitle('Are you lonely?')
                .setDescription('You cannot compare yourself to your own reflection. Go find a friend (or an enemy).')
                .setColor(0xFF0000)
                .setFooter({ text: 'Narcissism check failed' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        if (target.bot) {
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription('You cannot compare stats with a bot.')
                .setColor(0xFF0000)
                .setFooter({ text: 'They are built different' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        // Fetch Data
        const userData1 = db.getUser(initiator.id);
        const userData2 = db.getUser(target.id);

        // Helper to get stats
        const getStats = (user, userData) => {
            const inventory = db.getInventory(user.id);

            // Items Quantity
            const itemsCount = inventory.reduce((sum, item) => sum + item.quantity, 0);

            // Items Net Worth (Net Worth - Wallet - Bank)
            const totalNetWorth = db.calculateNetWorth(user.id);
            const wallet = userData.balance ?? 0;
            const bank = userData.bank ?? 0;
            const itemsWorth = totalNetWorth - wallet - bank;

            // Gambling Net
            // Columns: slots_won_amount, slots_lost_amount, snakeeyes_won_amount, snakeeyes_lost_amount
            // highlow doesn't seem to have tracked amount columns in db.js schema, only wins count.
            // We use what we have.
            const gambWins = (userData.slots_won_amount ?? 0) + (userData.snakeeyes_won_amount ?? 0);
            const gambLosses = (userData.slots_lost_amount ?? 0) + (userData.snakeeyes_lost_amount ?? 0);
            const gambNet = gambWins - gambLosses;

            // Badges
            let badgesCount = 0;
            try {
                const badges = JSON.parse(userData.unlocked_badges || '[]');
                badgesCount = badges.length;
            } catch (e) {
                badgesCount = 0;
            }

            return {
                level: userData.level ?? 0,
                prestige: userData.prestige ?? 0,
                commands: userData.commands_ran ?? 0,
                wallet: wallet,
                bank: bank,
                items: itemsCount,
                itemsWorth: itemsWorth,
                gamblingNet: gambNet,
                badges: badgesCount
            };
        };

        const stats1 = getStats(initiator, userData1);
        const stats2 = getStats(target, userData2);

        // Emojis
        const KICK = '<:PepeKick:1458566201289740361>';
        const MONKAE = '<:monkaE:1458566198542205152>';
        const COMFY = '<a:PepeChairComfy:1458566204867215463>';

        const compareField = (label, val1, val2, formatMoney = false) => {
            let str1 = formatMoney ? val1.toLocaleString() : val1.toLocaleString();
            let str2 = formatMoney ? val2.toLocaleString() : val2.toLocaleString();

            let emoji1 = '';
            let emoji2 = '';

            if (val1 === 0 && val2 === 0) {
                emoji1 = ` ${MONKAE}`;
                emoji2 = ` ${MONKAE}`;
            } else if (val1 === val2 && val1 > 0) {
                emoji1 = ` ${COMFY}`;
                emoji2 = ` ${COMFY}`;
            } else if (val1 > val2) {
                emoji1 = ` ${KICK}`;
            } else if (val2 > val1) {
                emoji2 = ` ${KICK}`;
            }

            return `${initiator.username}: \`${str1}\`${emoji1}\n${target.username}: \`${str2}\`${emoji2}`;
        };

        const embed = new EmbedBuilder()
            .setTitle(`${initiator.username} vs ${target.username}`)
            .setColor(0x0099FF)
            .addFields(
                { name: 'Level', value: compareField('Level', stats1.level, stats2.level), inline: false },
                { name: 'Prestige', value: compareField('Prestige', stats1.prestige, stats2.prestige), inline: false },
                { name: 'Commands Issued', value: compareField('Commands Issued', stats1.commands, stats2.commands), inline: false },
                { name: 'Wallet', value: compareField('Wallet', stats1.wallet, stats2.wallet, true), inline: false },
                { name: 'Bank', value: compareField('Bank', stats1.bank, stats2.bank, true), inline: false },
                { name: 'Items', value: compareField('Items', stats1.items, stats2.items), inline: false },
                { name: 'Items Worth', value: compareField('Items Worth', stats1.itemsWorth, stats2.itemsWorth, true), inline: false },
                { name: 'Gambling Net', value: compareField('Gambling Net', stats1.gamblingNet, stats2.gamblingNet, true), inline: false },
                { name: 'Badges', value: compareField('Badges', stats1.badges, stats2.badges), inline: false }
            )
            .setFooter({ text: 'Comparison is the thief of joy... but this is funny.' });

        // Logic check: "Content Structure" in prompt lists fields as paragraphs, but Discord embeds fields are cleaner.
        // Prompt says:
        // > **Level**
        // > [initiator]: `395` [Emoji]
        // > [target]: `9` [Emoji]
        //
        // My implementation uses addFields which results in:
        // **Level** (Field Name)
        // [initiator]: `395` [Emoji] (Field Value line 1)
        // [target]: `9` [Emoji] (Field Value line 2)
        //
        // This matches the visual structure requested perfectly.
        // Prompt requested structure implies strictly formatted text block?
        // "Title: ... Content Structure: ..."
        // Using fields is the standard way to achieve that structure in an Embed.
        // If I put it all in description it might get cluttered.
        // The prompt says "Content Structure", then lists bold headers. This maps 1:1 to Embed Fields.

        await interaction.reply({ embeds: [embed] });
    },
};
