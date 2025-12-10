const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const locations = require('../../config/locations.json');
const items = require('../../config/items.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search various places for items and coins, with some risks.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'search');
        if (cooldown.onCooldown) {
            return interaction.reply({
                components: [getCooldownEmbed('search', cooldown.readyAt, 30, 15)],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        // Check Safety Lock
        if (!acquireLock(userId)) {
             const lockEmbed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Hold tight\nYou are unable to interact with this because there is an active ongoing command you are already using or a minor issue occurred. It should unlock itself in about 30 seconds. Please finish any open commands or try again after 30 seconds.'));
            return interaction.reply({ components: [lockEmbed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        // Select 3 random unique locations
        const shuffled = [...locations].sort(() => 0.5 - Math.random());
        const selectedLocations = shuffled.slice(0, 3);

        const embed = new ContainerBuilder()
            .setColor(0x00FF00) // Green
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('# **Where do you want to search?**\n*Pick an option below to start searching!*'));

        const buttons = selectedLocations.map(loc =>
            new ButtonBuilder()
                .setCustomId(`search_${loc.id}`)
                .setLabel(loc.name)
                .setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);
        embed.addActionRowComponents(row);

        const response = await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const embed = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Permission Denied\nThis is not your search session!'))
                    .setColor(0xFF0000);
                return i.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            const locId = i.customId.replace('search_', '');
            const location = selectedLocations.find(l => l.id === locId);

            if (!location) return;

            // Logic
            let amount = 0;
            let message = "";
            let item = null;
            let isSpecial = false;

            // Check Special Outcome
            if (location.special_outcome && Math.random() * 100 < location.special_outcome.chance) {
                isSpecial = true;
                const special = location.special_outcome;
                amount = Math.floor(Math.random() * (special.money_max - special.money_min + 1)) + special.money_min;
                item = items.find(it => it.id === special.item_id);

                db.addBalance(userId, amount);
                if (item) {
                    db.addItem(userId, item.id, 1);
                }

                message = special.message.replace('{amount}', amount.toLocaleString());
                if (item) {
                    message = message.replace('{item_emoji}', item.emoji).replace('{item_name}', item.name);
                }
            } else {
                // Regular Outcome
                const roll = Math.random() * 100;

                if (roll < location.fail_chance) {
                    // Fail
                    const outcomes = location.fail_outcomes;
                    message = outcomes[Math.floor(Math.random() * outcomes.length)];
                } else if (roll < location.fail_chance + location.death_chance) {
                    // Death (Simulation - just loss of coins or nothing happens in this clone yet aside from message)
                    message = "You died while searching (not really, but you got nothing).";
                } else {
                    // Success
                    const outcomes = location.success_outcomes;
                    message = outcomes[Math.floor(Math.random() * outcomes.length)];

                    amount = Math.floor(Math.random() * (location.max_coins - location.min_coins + 1)) + location.min_coins;
                    db.addBalance(userId, amount);
                    message = message.replace('{amount}', amount.toLocaleString());
                }
            }

            setDurationCooldown(userId, 'search', 30, 15);

            // Update UI
            const updatedButtons = buttons.map(btn => {
                const isSelected = btn.data.custom_id === i.customId;
                btn.setDisabled(true);
                if (isSelected) {
                    btn.setStyle(amount > 0 ? ButtonStyle.Success : ButtonStyle.Danger);
                }
                return btn;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            const resultEmbed = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${interaction.user.username} searched the ${location.name}\n${message}`));

            if (isSpecial) {
                resultEmbed.setColor(0xFFD700);
                resultEmbed.addTextDisplayComponents(new TextDisplayBuilder().setContent('RARE DROP!'));
            } else if (amount > 0) {
                resultEmbed.setColor(0x00FF00);
            } else {
                resultEmbed.setColor(0xFF0000);
            }

            resultEmbed.addActionRowComponents(updatedRow);

            await i.update({
                components: [resultEmbed]
            });

            collector.stop('user_interaction');
        });

        collector.on('end', async (collected, reason) => {
             if (reason !== 'user_interaction' && reason !== 'messageDelete') {
                setDurationCooldown(userId, 'search', 30, 15);

                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.map(btn => btn.setDisabled(true))
                );

                const timeoutEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Time's up\nYou took too long to decide where to search.`));

                timeoutEmbed.addActionRowComponents(disabledRow);

                try {
                    await interaction.editReply({
                        components: [timeoutEmbed]
                    });
                } catch (e) {
                    // Ignore
                }
             }
             releaseLock(userId);
        });
    },
};
