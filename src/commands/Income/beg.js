const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');
const peoples = require('../../config/peoples.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('beg')
        .setDescription('Beg for coins to help increase your pocket balance.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'beg', 20);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('beg', cooldown.readyAt, 20, 8)]
            });
        }

        // Apply Cooldown immediately as per previous logic (non-interactive)
        setDurationCooldown(userId, 'beg', 20);

        // Select Random Person
        const person = peoples[Math.floor(Math.random() * peoples.length)];

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
