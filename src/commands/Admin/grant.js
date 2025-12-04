const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const items = require('../../config/items.json');
const db = require('../../utils/db.js');
const parseNumber = require('../../utils/numberParser.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grant')
        .setDescription('Grants money or items to a user (Developer Only).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to grant to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('item_or_money')
                .setDescription('Select Money or an Item')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('quantity')
                .setDescription('The amount to grant')
                .setRequired(true)),
    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const choices = ['Money', ...items.map(i => i.name)];
        const filtered = choices.filter(choice => choice.toLowerCase().includes(focusedValue));
        await interaction.respond(
            filtered.slice(0, 25).map(choice => ({ name: choice, value: choice }))
        );
    },
    async execute(interaction) {
        if (interaction.user.id !== '794482283993235478') {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                flags: MessageFlags.Ephemeral
            });
        }

        const user = interaction.options.getUser('user');
        const selection = interaction.options.getString('item_or_money');
        const quantityStr = interaction.options.getString('quantity');

        // For 'Money', we treat 'max' as a large safe number or handle it specifically,
        // but typically grant doesn't have a 'max' context unless it's filling bank/wallet?
        // The prompt says "Quantity input must accept... relative keywords like ... max".
        // For grant, 'max' is ambiguous for money. Let's assume it means a very large amount or is just allowed as input parsing.
        // However, numberParser(..., maxAmount) needs a maxAmount for percentage/max calculation.
        // For granting money, maybe we don't support 'max' or % relative to anything?
        // Or maybe relative to the user's current balance? The prompt is general.
        // "Quantity input must accept: ... relative keywords like "30%", "all", or "max""
        // Let's assume for 'grant', 'max' might not make sense or we just use a high cap.
        // BUT, since we need to implement it exactly as described, we should probably pass 0 or some context as maxAmount
        // if it's not applicable, or maybe the max wallet capacity if that exists.
        // Wait, if I grant "50%", 50% of what? The user's current balance? That makes sense.

        let maxAmount = 0;
        const targetUserData = db.getUser(user.id);

        if (selection === 'Money') {
            // If money, maybe maxAmount is current wallet?
            maxAmount = targetUserData.balance || 0;
        } else {
            // If item, maybe maxAmount is... ? Typically max/all in grant context is weird.
            // But let's stick to simple parsing. If they say 'max', maybe we just give a lot?
            // Or maybe it refers to existing inventory?
            // "If ֍ Money is selected, the quantity grants wallet balance."
            // "If an item is selected, the quantity grants that many of the chosen item."

            // Standard interpretation:
            // If I say "grant 50%", it usually means 50% of what I have? No, I am granting.
            // Maybe it means "grant max" -> sets to max possible? (int limit?)
            // Let's look at how other commands use numberParser.
            // If I use 'all' in deposit, it means all my wallet.

            // For GRANT, adding 'all' or 'max' is risky if it means Infinity.
            // Let's assume for Grant, relative percentages are NOT supported or based on 0,
            // UNLESS I decide "50%" means 50% of their current balance/item count.

            // Let's try to interpret "Quantity input must accept...".
            // It lists formats. "all" and "max" are keywords.
            // If I type "all", numberParser returns maxAmount.
            // If I pass maxAmount=Infinity (or safe int limit), "all" grants that much.
            // Let's use a safe high number for 'max' if it's just arbitrary,
            // or perhaps 0 and document that relative doesn't work well for grant.

            // However, the prompt says "replicate exactly".
            // "Quantity input must accept: ... relative keywords like '30%', 'all', or 'max'"
            // Maybe I should just check if the parser returns 0 or handled value.

            // Let's look at numberParser again.
            // It takes (input, maxAmount).
            // If I pass 0 as maxAmount, 'all' returns 0. '50%' returns 0.

            // For now, I'll pass a large number for 'max'/'all' if it's money (like 100m?),
            // or maybe I should just use the input directly if it parses.
            // Actually, usually admin grant commands take raw numbers.
            // But if I MUST accept "2k", "1,234", numberParser handles that without maxAmount.
            // Only %, all, max need maxAmount.

            // If I grant "50%" money, maybe it adds 50% of their current balance.
            // If I grant "50%" item, maybe it adds 50% of their current item count.
            // Let's go with that logic.

            if (selection === 'Money') {
                 maxAmount = targetUserData.balance || 0;
            } else {
                 const itemObj = items.find(i => i.name === selection);
                 if (itemObj) {
                     maxAmount = db.getItemCount(user.id, itemObj.id);
                 }
            }
        }

        let amount = parseNumber(quantityStr, maxAmount);

        // If amount is 0 and they typed something, maybe it failed or they meant 0.
        // But if they typed "all" and have 0, it adds 0.

        // Edge case: "max" or "all" when they have 0 results in 0 grant.
        // Maybe for grant, "max" should mean something else?
        // "Quantity input must accept... relative keywords..."
        // If I grant "max" money, maybe it fills to a limit?
        // But there is no wallet limit mentioned in memory (only bank capacity).
        // Let's just stick to the interpretation: relative to current holdings.

        if (amount <= 0) {
             // Try parsing without max dependency if it was 0
             // (e.g. if they typed "100" but maxAmount was 0, parseNumber("100", 0) returns 100).
             // Wait, parseNumber implementation:
             /*
                if (input === 'all' || input === 'max') return maxAmount;
                if (input.endsWith('%')) ...
                ...
                const number = parseFloat(input); ...
             */
             // So regular numbers work fine even if maxAmount is 0.
             // Only 'all', 'max', '%' rely on maxAmount.

             // So if they type 'max' and have 0, they get 0. This seems safe.
        }

        if (selection === 'Money') {
            db.addBalance(user.id, amount);
            await interaction.reply({
                content: `Successfully granted **֍ ${amount.toLocaleString()}** to ${user}.`
            });
        } else {
            const item = items.find(i => i.name === selection);
            if (!item) {
                return interaction.reply({
                    content: `Item "${selection}" not found.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            db.addItem(user.id, item.id, amount);
             await interaction.reply({
                content: `Successfully granted **${amount.toLocaleString()}** ${item.emoji} **${item.name}** to ${user}.`
            });
        }
    }
};
