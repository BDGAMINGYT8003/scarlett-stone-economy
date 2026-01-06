const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { calculateMultiplier } = require('../../utils/multiplier');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
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
                embeds: [getCooldownEmbed('search', cooldown.readyAt, 25, 10)],
                flags: MessageFlags.Ephemeral
            });
        }

        // Check Safety Lock
        if (!acquireLock(userId)) {
             const lockEmbed = new EmbedBuilder()
                .setTitle('Hold tight')
                .setDescription('You are unable to interact with this because there is an active ongoing command you are already using or a minor issue occurred. It should unlock itself in about 30 seconds. Please finish any open commands or try again after 30 seconds.\nIf you keep getting this message from the same interaction, please report it to our support server so we can fix it.');
            return interaction.reply({ embeds: [lockEmbed], flags: MessageFlags.Ephemeral });
        }

        // Select 3 random unique locations
        const shuffled = [...locations].sort(() => 0.5 - Math.random());
        const selectedLocations = shuffled.slice(0, 3);

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('**Where do you want to search?**')
            .setDescription('*Pick an option below to start searching that location!*');

        const buttons = selectedLocations.map(loc =>
            new ButtonBuilder()
                .setCustomId(`search_${loc.id}`)
                .setLabel(loc.name)
                .setStyle(ButtonStyle.Secondary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const embed = new EmbedBuilder()
                    .setTitle('Permission Denied')
                    .setDescription('This is not your search session!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const locationId = i.customId.replace('search_', '');
            const location = selectedLocations.find(l => l.id === locationId);

            if (!location) return;

            let isSpecial = false;
            let amount = 0;
            let bonusAmount = 0;
            let message = "";
            let item = null;
            let multiTotal = 0;

            // Check for Special Outcome First
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
                // Determine Outcome
                const isSuccess = Math.random() * 100 < location.success_chance;
                const outcomeType = isSuccess ? 'success' : 'fail';

                // Select random outcome message
                const outcomes = location.outcomes[outcomeType];
                message = outcomes[Math.floor(Math.random() * outcomes.length)];

                if (isSuccess) {
                    const baseAmount = Math.floor(Math.random() * (location.max_coins - location.min_coins + 1)) + location.min_coins;

                    const multipliers = calculateMultiplier(userId);
                    multiTotal = multipliers.total;
                    bonusAmount = Math.floor(baseAmount * (multiTotal / 100));
                    amount = baseAmount + bonusAmount;

                    db.addBalance(userId, amount);
                    message = message.replace('{amount}', amount.toLocaleString());
                }
            }

            if (amount > 0) {
                db.logTransaction(userId, 'search', { amount: amount });
            }

            // Set Cooldown on successful interaction
            setDurationCooldown(userId, 'search', 25, 10);

            // Increment Stats
            if (isSpecial || amount > 0) {
                 db.incrementStat(userId, 'search_count');
                 await checkAndUnlockBadges(userId, interaction);
            }

            // Update UI
            const updatedButtons = buttons.map(btn => {
                const isSelected = btn.data.custom_id === i.customId;
                btn.setDisabled(true);
                if (isSelected) {
                    btn.setStyle(isSpecial || amount > 0 ? ButtonStyle.Success : ButtonStyle.Danger);
                }
                return btn;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} searched the ${location.name}`)
                .setDescription(message);

            if (isSpecial) {
                resultEmbed.setColor(0xFFD700);
                resultEmbed.setFooter({ text: 'RARE DROP!' });
            } else if (amount > 0) {
                resultEmbed.setColor(0x00FF00);

                if (multiTotal > 0) {
                     const timeString = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                     resultEmbed.setFooter({ text: `Multi Bonus: +${multiTotal}% (+ ֍ ${bonusAmount.toLocaleString()}) | Today at ${timeString}` });
                } else {
                    resultEmbed.setFooter({ text: 'Lucky you!' });
                }
            } else {
                resultEmbed.setColor(0xFF0000);
                resultEmbed.setFooter({ text: 'Better luck next time.' });
            }

            await i.update({
                embeds: [resultEmbed],
                components: [updatedRow]
            });

            collector.stop('user_interaction');
        });

        collector.on('end', async (collected, reason) => {
            if (reason !== 'user_interaction' && reason !== 'messageDelete') {
                // Set Cooldown on timeout
                setDurationCooldown(userId, 'search', 25, 10);

                // If timed out, disable buttons and show message
                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.map(btn => btn.setDisabled(true))
                );

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('So quiet...')
                    .setDescription(`Guess <@${userId}> did not want to search anywhere?`);

                try {
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [disabledRow]
                    });
                } catch (e) {
                    // Message might have been deleted
                }
            }

            // Release lock when collector ends (after setting cooldown if needed)
            releaseLock(userId);
        });
    },
};
