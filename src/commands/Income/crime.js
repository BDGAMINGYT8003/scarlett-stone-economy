const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getMultipliers } = require('../../utils/multiplier');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const crimes = require('../../config/crimes.json');
const items = require('../../config/items.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a fake crime for items and coins, with some risk.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'crime');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('crime', cooldown.readyAt, 25, 10)],
                flags: MessageFlags.Ephemeral
            });
        }

        // Check Minimum Balance
        const userData = db.getUser(userId);
        const userBalance = userData.balance ?? 0;
        if (userBalance < 1000) {
             const brokeEmbed = new EmbedBuilder()
                .setTitle('Too broke for this')
                .setDescription('You need at least **֍ 1,000** to commit a crime. You can\'t even afford a getaway Uber right now.')
                .setFooter({ text: 'Imagine being too poor to break the law' })
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [brokeEmbed] });
        }

        // Check Safety Lock
        if (!acquireLock(userId)) {
             const lockEmbed = new EmbedBuilder()
                .setTitle('Hold tight')
                .setDescription('You are unable to interact with this because there is an active ongoing command you are already using or a minor issue occurred. It should unlock itself in about 30 seconds. Please finish any open commands or try again after 30 seconds.\nIf you keep getting this message from the same interaction, please report it to our support server so we can fix it.');
            return interaction.reply({ embeds: [lockEmbed], flags: MessageFlags.Ephemeral });
        }

        // Select 3 random unique crimes
        const shuffled = [...crimes].sort(() => 0.5 - Math.random());
        const selectedCrimes = shuffled.slice(0, 3);

        const embed = new EmbedBuilder()
            .setColor(0x8B0000)
            .setTitle('**Which crime do you want to commit?**')
            .setDescription('*Pick an option below to start committing one!*');

        const buttons = selectedCrimes.map(crime =>
            new ButtonBuilder()
                .setCustomId(`crime_${crime.id}`)
                .setLabel(crime.name)
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
                    .setDescription('This is not your crime session!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const crimeId = i.customId.replace('crime_', '');
            const crime = selectedCrimes.find(c => c.id === crimeId);

            if (!crime) return;

            let isSpecial = false;
            let amount = 0;
            let bonusAmount = 0; // Store bonus separately
            let fine = 0;
            let message = "";
            let item = null;
            let multiTotal = 0;

            // Check for Special Outcome First
            if (crime.special_outcome && Math.random() * 100 < crime.special_outcome.chance) {
                isSpecial = true;
                const special = crime.special_outcome;
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
                const isSuccess = Math.random() * 100 < crime.success_chance;

                if (isSuccess) {
                    // Success
                    const outcomes = crime.outcomes.success;
                    message = outcomes[Math.floor(Math.random() * outcomes.length)];

                    const baseAmount = Math.floor(Math.random() * (crime.max_coins - crime.min_coins + 1)) + crime.min_coins;

                    // Multiplier
                    const multipliers = getMultipliers(userId);
                    multiTotal = multipliers.total;
                    bonusAmount = Math.floor(baseAmount * (multiTotal / 100));
                    amount = baseAmount + bonusAmount;

                    db.addBalance(userId, amount);
                    message = message.replace('{amount}', amount.toLocaleString());
                } else {
                    // Fail - Determine if fined (50/50 for simplicity unless specified otherwise)
                    const isFined = Math.random() > 0.5;
                    if (isFined) {
                        const outcomes = crime.outcomes.fail_fined;
                        message = outcomes[Math.floor(Math.random() * outcomes.length)];

                        // Fetch fresh balance to ensure we don't go negative
                        const currentData = db.getUser(userId);
                        const currentBalance = currentData.balance ?? 0;

                        let potentialFine = Math.floor(Math.random() * (crime.fine_max - crime.fine_min + 1)) + crime.fine_min;

                        // Cap fine at current balance
                        fine = Math.min(potentialFine, currentBalance);

                        db.removeBalance(userId, fine);
                        message = message.replace('{fine}', fine.toLocaleString());
                    } else {
                        const outcomes = crime.outcomes.fail_safe;
                        message = outcomes[Math.floor(Math.random() * outcomes.length)];
                    }
                }
            }

            // Set Cooldown on successful interaction
            setDurationCooldown(userId, 'crime', 25, 10);

            // Increment Stats
            if (isSpecial || amount > 0) {
                 db.incrementStat(userId, 'crime_count');
            }

            // Check Badges (Covers fines reducing net worth or wins increasing it)
            await checkAndUnlockBadges(userId, interaction);

            // Update UI
            const updatedButtons = buttons.map(btn => {
                const isSelected = btn.data.custom_id === i.customId;
                btn.setDisabled(true);
                if (isSelected) {
                    btn.setStyle(isSpecial || (!fine && amount > 0) ? ButtonStyle.Success : ButtonStyle.Danger);
                }
                return btn;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            const resultEmbed = new EmbedBuilder()
                .setTitle(`${interaction.user.username} committed ${crime.name}`)
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
                    resultEmbed.setFooter({ text: 'Crime pays!' });
                }
            } else {
                resultEmbed.setColor(0xFF0000);
                resultEmbed.setFooter({ text: 'Busted!' });
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
                setDurationCooldown(userId, 'crime', 25, 10);

                const disabledRow = new ActionRowBuilder().addComponents(
                    buttons.map(btn => btn.setDisabled(true))
                );

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('Chicken?')
                    .setDescription(`Guess <@${userId}> did not want to commit crimes anymore?`);

                try {
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [disabledRow]
                    });
                } catch (e) {
                    // Message might have been deleted
                }
            }

            // Release lock when collector ends
            releaseLock(userId);
        });
    },
};
