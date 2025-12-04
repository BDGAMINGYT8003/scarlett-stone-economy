const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
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

        let maxAmount = 0;
        let userData = db.getUser(user.id); // Get fresh data

        if (selection === 'Money') {
            maxAmount = userData.balance || 0;
        } else {
             const itemObj = items.find(i => i.name === selection);
             if (itemObj) {
                 maxAmount = db.getItemCount(user.id, itemObj.id);
             }
        }

        let amount = parseNumber(quantityStr, maxAmount);

        // If parsing results in 0 but user input a number (e.g. "100" with max=0), numberParser handles it.
        // If user typed "all" and has 0, it grants 0.
        if (amount <= 0 && quantityStr.toLowerCase() !== '0') {
             // Fallback for direct number if relative failed
             const direct = parseFloat(quantityStr.replace(/,/g, ''));
             if (!isNaN(direct) && direct > 0) amount = Math.floor(direct);
        }

        if (amount < 0) amount = 0;

        const timestamp = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });

        if (selection === 'Money') {
            db.addBalance(user.id, amount);
            // Re-fetch for total owned
            userData = db.getUser(user.id);
            const totalOwned = userData.balance.toLocaleString();

            const embed = new EmbedBuilder()
                .setTitle('Item Granted')
                .setDescription(`Successfully added **֍ ${amount.toLocaleString()}** to your inventory.`)
                .addFields({ name: 'Total Owned', value: `֍ ${totalOwned}` })
                .setFooter({ text: `Developer Command | Today at ${timestamp}` });

            await interaction.reply({ embeds: [embed] });

            // Notification
            const notifyEmbed = new EmbedBuilder()
                .setTitle('Item Granted')
                .setDescription(`Successfully added **֍ ${amount.toLocaleString()}** to your inventory.`)
                .addFields({ name: 'Granted By', value: interaction.user.tag })
                .setFooter({ text: `Developer Command | Today at ${timestamp}` });

            try {
                await user.send({ embeds: [notifyEmbed] });
            } catch (e) {
                // Cannot DM user
            }

        } else {
            const item = items.find(i => i.name === selection);
            if (!item) {
                return interaction.reply({
                    content: `Item "${selection}" not found.`,
                    flags: MessageFlags.Ephemeral
                });
            }
            db.addItem(user.id, item.id, amount);

            // Re-fetch for total owned
            const totalOwned = db.getItemCount(user.id, item.id).toLocaleString();

            const embed = new EmbedBuilder()
                .setTitle('Item Granted')
                .setDescription(`Successfully added **${amount.toLocaleString()}** ${item.emoji} **${item.name}** to your inventory.`)
                .addFields({ name: 'Total Owned', value: `${totalOwned} ${item.name}` })
                .setFooter({ text: `Developer Command | Today at ${timestamp}` });

            await interaction.reply({ embeds: [embed] });

            // Notification
            const notifyEmbed = new EmbedBuilder()
                .setTitle('Item Granted')
                .setDescription(`Successfully added **${amount.toLocaleString()}** ${item.emoji} **${item.name}** to your inventory.`)
                .addFields({ name: 'Granted By', value: interaction.user.tag })
                .setFooter({ text: `Developer Command | Today at ${timestamp}` });

            try {
                await user.send({ embeds: [notifyEmbed] });
            } catch (e) {
                // Cannot DM user
            }
        }
    }
};
