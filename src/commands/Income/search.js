const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search a location for coins or items.')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('Where do you want to search?')
                .setRequired(true)
                .addChoices(
                    { name: 'Discord', value: 'discord' },
                    { name: 'Couch', value: 'couch' },
                    { name: 'Pocket', value: 'pocket' },
                    { name: 'Street', value: 'street' }
                )),
    async execute(interaction) {
        const location = interaction.options.getString('location');
        const userId = interaction.user.id;

        const success = Math.random() > 0.4; // 60% chance
        if (!success) {
             return interaction.reply({ content: `You searched the ${location} but found nothing.` });
        }

        const amount = Math.floor(Math.random() * 1000) + 100;
        db.addBalance(userId, amount);

        const embed = new EmbedBuilder()
            .setColor(0x00AA00)
            .setDescription(`You searched the **${location}** and found **${amount} coins**!`);

        await interaction.reply({ embeds: [embed] });
    },
};
