const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const crimes = require('../../config/crimes.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a crime.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'crime', 25);
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('crime', cooldown.readyAt, 25, 10)]
            });
        }

        // Check Safety Lock
        if (!acquireLock(userId)) {
             const lockEmbed = new EmbedBuilder()
                .setTitle('Hold tight')
                .setDescription('You are unable to interact with this because there is an active ongoing command you are already using or a minor issue occurred. It should unlock itself in about 30 seconds. Please finish any open commands or try again after 30 seconds.\nIf you keep getting this message from the same interaction, please report it to our support server so we can fix it.');
            return interaction.reply({ embeds: [lockEmbed], ephemeral: true });
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
                return i.reply({ content: 'This is not your crime session!', ephemeral: true });
            }

            const crimeId = i.customId.replace('crime_', '');
            const crime = selectedCrimes.find(c => c.id === crimeId);

            if (!crime) return;

            // Determine Outcome
            const isSuccess = Math.random() * 100 < crime.success_chance;
            let amount = 0;
            let fine = 0;
            let message = "";
            let outcomeKey = 'success'; // Default

            if (isSuccess) {
                // Success
                outcomeKey = 'success';
                const outcomes = crime.outcomes.success;
                message = outcomes[Math.floor(Math.random() * outcomes.length)];

                amount = Math.floor(Math.random() * (crime.max_coins - crime.min_coins + 1)) + crime.min_coins;
                db.addBalance(userId, amount);
                message = message.replace('{amount}', amount.toLocaleString());
            } else {
                // Fail - Determine if fined (50/50 for simplicity unless specified otherwise? "Each crime must include two success outcomes and two failure outcomes. One failure outcome should involve no fine, while the other should include a fine")
                // Let's assume 50/50 chance between fail_safe and fail_fined if user fails.
                const isFined = Math.random() > 0.5;
                if (isFined) {
                    outcomeKey = 'fail_fined';
                    const outcomes = crime.outcomes.fail_fined;
                    message = outcomes[Math.floor(Math.random() * outcomes.length)];

                    fine = Math.floor(Math.random() * (crime.fine_max - crime.fine_min + 1)) + crime.fine_min;
                    db.removeBalance(userId, fine);
                    message = message.replace('{fine}', fine.toLocaleString());
                } else {
                    outcomeKey = 'fail_safe';
                    const outcomes = crime.outcomes.fail_safe;
                    message = outcomes[Math.floor(Math.random() * outcomes.length)];
                }
            }

            // Set Cooldown on successful interaction
            setDurationCooldown(userId, 'crime', 25);

            // Update UI
            const updatedButtons = buttons.map(btn => {
                const isSelected = btn.data.custom_id === i.customId;
                btn.setDisabled(true);
                if (isSelected) {
                    btn.setStyle(isSuccess ? ButtonStyle.Success : ButtonStyle.Danger);
                }
                return btn;
            });

            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            const resultEmbed = new EmbedBuilder()
                .setColor(isSuccess ? 0x00FF00 : 0xFF0000)
                .setTitle(`${interaction.user.username} committed ${crime.name}`)
                .setDescription(message)
                .setFooter({ text: isSuccess ? "Crime pays!" : "Busted!" });

            await i.update({
                embeds: [resultEmbed],
                components: [updatedRow]
            });

            collector.stop('user_interaction');
        });

        collector.on('end', async (collected, reason) => {
            releaseLock(userId);

            if (reason !== 'user_interaction' && reason !== 'messageDelete') {
                // Set Cooldown on timeout
                setDurationCooldown(userId, 'crime', 25);

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
        });
    },
};
