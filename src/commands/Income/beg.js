const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');
const peoples = require('../../config/peoples.json');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for coins to help increase your pocket balance.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'beg');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('beg', cooldown.readyAt, 20, 8)],
                flags: MessageFlags.Ephemeral
            });
        }

        // Apply Cooldown (20s default, 8s premium)
        setDurationCooldown(userId, 'beg', 20, 8);

        // Select Random Person
        const person = peoples[Math.floor(Math.random() * peoples.length)];

        // Check for Special Outcome First
        if (person.special_outcome && Math.random() * 100 < person.special_outcome.chance) {
            const special = person.special_outcome;
            const amount = Math.floor(Math.random() * (special.money_max - special.money_min + 1)) + special.money_min;
            const item = items.find(i => i.id === special.item_id);

            db.addBalance(userId, amount);
            if (item) {
                db.addItem(userId, item.id, 1);
            }

            let message = special.message.replace('{amount}', amount.toLocaleString());
            if (item) {
                message = message.replace('{item_emoji}', item.emoji).replace('{item_name}', item.name);
            }

            const embed = new EmbedBuilder()
                .setTitle(person.name)
                .setColor(0xFFD700) // Gold
                .setDescription(message)
                .setFooter({ text: 'RARE DROP!' });

            return interaction.reply({ embeds: [embed] });
        }

        // Roll for Success
        const isSuccess = Math.random() * 100 < person.success_chance;

        const embed = new EmbedBuilder()
            .setTitle(person.name);

        if (isSuccess) {
            const amount = Math.floor(Math.random() * 1901) + 100; // 100 to 2000
            db.addBalance(userId, amount);

            const quote = person.success_quotes[Math.floor(Math.random() * person.success_quotes.length)];
            const formattedQuote = quote.replace('{amount}', amount.toLocaleString());

            embed.setColor(0x00FF00)
                .setDescription(formattedQuote)
                .setFooter({ text: 'They felt bad for you' });
        } else {
            const quote = person.fail_quotes[Math.floor(Math.random() * person.fail_quotes.length)];

            embed.setColor(0xFF0000)
                .setDescription(quote)
                .setFooter({ text: 'They walked away without even glancing at you' });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
