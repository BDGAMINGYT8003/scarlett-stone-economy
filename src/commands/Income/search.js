const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');
const locations = require('../../config/locations.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for money in various locations.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Lock
        if (!acquireLock(userId)) {
             return interaction.reply({ content: 'You have an ongoing command running. Please finish it first.', ephemeral: true });
        }

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'search', 30);
        if (cooldown.onCooldown) {
            releaseLock(userId);
            return interaction.reply({
                embeds: [getCooldownEmbed('search', cooldown.readyAt, 30, 8)]
            });
        }

        // Pick 3 random locations
        const shuffled = locations.sort(() => 0.5 - Math.random());
        const selectedLocations = shuffled.slice(0, 3);

        const buttons = selectedLocations.map(loc =>
            new ButtonBuilder()
                .setCustomId(`search_${loc.id}`)
                .setLabel(loc.name)
                .setStyle(ButtonStyle.Primary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        const embed = new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('Where do you want to search?')
            .setDescription('Choose a location to search for money.')
            .setFooter({ text: 'You have 15 seconds to choose.' });

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
            }

            const locationId = i.customId.replace('search_', '');
            const location = locations.find(l => l.id === locationId);

            if (!location) {
                setDurationCooldown(userId, 'search', 30);
                releaseLock(userId);
                return i.update({ content: 'Something went wrong.', components: [], embeds: [] });
            }

            // Determine Outcome
            const isSuccess = Math.random() * 100 < location.success_chance;

            const resultEmbed = new EmbedBuilder().setTitle(`Searched: ${location.name}`);

            if (isSuccess) {
                // Check Special Outcome
                let specialOutcome = null;
                if (location.special_outcomes && location.special_outcomes.length > 0) {
                     for (const special of location.special_outcomes) {
                         if (Math.random() * 100 < special.chance) {
                             specialOutcome = special;
                             break;
                         }
                     }
                }

                if (specialOutcome) {
                    const amount = specialOutcome.bonus_money;
                    db.addBalance(userId, amount);
                    db.addItem(userId, specialOutcome.item_id, 1);

                    const message = specialOutcome.message.replace('{amount}', amount.toLocaleString());

                    resultEmbed.setColor(0x00FF00)
                        .setDescription(message)
                        .setFooter({ text: 'What a find!' });
                } else {
                    const amount = Math.floor(Math.random() * (location.max_coins - location.min_coins + 1)) + location.min_coins;
                    db.addBalance(userId, amount);

                    const outcomeMsg = location.outcomes.success[Math.floor(Math.random() * location.outcomes.success.length)];
                    resultEmbed.setColor(0x00FF00)
                        .setDescription(outcomeMsg.replace('{amount}', amount.toLocaleString()));
                }
            } else {
                const outcomeMsg = location.outcomes.fail[Math.floor(Math.random() * location.outcomes.fail.length)];
                resultEmbed.setColor(0xFF0000)
                    .setDescription(outcomeMsg);
            }

            // Set Cooldown HERE
            setDurationCooldown(userId, 'search', 30);

            await i.update({ embeds: [resultEmbed], components: [] });
            collector.stop('choice_made');
        });

        collector.on('end', (collected, reason) => {
            releaseLock(userId);
            if (reason === 'time') {
                 // Timeout embed logic
                 const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Search Timeout')
                    .setDescription(`You took too long to choose a location, <@${userId}>. The opportunity has passed.`)
                    .setFooter({ text: 'Be faster next time!' });

                interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                setDurationCooldown(userId, 'search', 30);
            }
        });
    },
};
