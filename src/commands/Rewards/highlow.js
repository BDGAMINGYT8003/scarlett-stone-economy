const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const levelManager = require('../../utils/levelManager');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('Guess if the secret number is higher or lower!'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'highlow');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('highlow', cooldown.readyAt, 30, 10)],
                flags: MessageFlags.Ephemeral
            });
        }

        // Generate Numbers
        const secretNumber = Math.floor(Math.random() * 100) + 1;
        const hintNumber = Math.floor(Math.random() * 100) + 1;

        // Determine correct answer
        let correctAnswer = '';
        if (secretNumber < hintNumber) correctAnswer = 'Lower';
        else if (secretNumber > hintNumber) correctAnswer = 'Higher';
        else correctAnswer = 'JACKPOT';

        // Initial Embed
        const embed = new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s High-Low Game`)
            .setDescription(`I just chose a secret number between 1 and 100.\nIs the secret number *higher* or *lower* than **${hintNumber}**?`)
            .setFooter({ text: "The jackpot button is if you think it's the same!" })
            .setColor(0x0099FF);

        // Buttons
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('lower').setLabel('Lower').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('jackpot').setLabel('JACKPOT!').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('higher').setLabel('Higher').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({
            embeds: [embed],
            components: [buttons],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 20000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Permission Denied')
                    .setDescription('This is not your game!')
                    .setColor(0xFF0000);
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            // Game Logic
            const choice = i.customId === 'lower' ? 'Lower' : (i.customId === 'higher' ? 'Higher' : 'JACKPOT');
            const isWin = choice === correctAnswer;
            let reward = 0;

            let resultEmbed;

            if (isWin) {
                if (choice === 'JACKPOT') {
                    // Jackpot Win
                    reward = Math.floor(Math.random() * (150000 - 100000 + 1)) + 100000;
                    db.addBalance(userId, reward);
                    db.logTransaction(userId, 'highlow', { amount: reward });
                    db.incrementStat(userId, 'highlow_wins');
                    await checkAndUnlockBadges(userId, i);

                    resultEmbed = new EmbedBuilder()
                        .setTitle(`${interaction.user.username}'s JACKPOT HIGH-LOW GAME!`)
                        .setDescription(`**<a:PepeTrophy:940712966213496842> HOLY MOLY! YOU HIT THE JACKPOT!**\n\n**You won ֍ ${reward.toLocaleString()}**!\n\nYour hint was **${hintNumber}**. The hidden number was **${secretNumber}**.\nIt was a perfect match!`)
                        .setFooter({ text: "GO BUY A LOTTERY TICKET RIGHT NOW!" })
                        .setColor(0xFFD700); // Gold
                } else {
                    // Normal Win
                    reward = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
                    db.addBalance(userId, reward);
                    db.logTransaction(userId, 'highlow', { amount: reward });
                    db.incrementStat(userId, 'highlow_wins');
                    await checkAndUnlockBadges(userId, i);

                    resultEmbed = new EmbedBuilder()
                        .setTitle(`${interaction.user.username}'s winning High-Low Game`)
                        .setDescription(`**You won ֍ ${reward.toLocaleString()}**!\n\nYour hint was **${hintNumber}**. The hidden number was **${secretNumber}**.`)
                        .setFooter({ text: "You're really good at this!" })
                        .setColor(0x00FF00); // Green
                }

                // XP Grant - Profit
                await levelManager.grantXp(userId, 'profit', i);

            } else {
                // Loss
                resultEmbed = new EmbedBuilder()
                    .setTitle(`${interaction.user.username}'s losing High-Low Game`)
                    .setDescription(`**You lost!**\n\nYour hint was **${hintNumber}**. The hidden number was **${secretNumber}**.`)
                    .setFooter({ text: "Better luck next time!" })
                    .setColor(0xFF0000); // Red

                // XP Grant - Loss/Neutral
                await levelManager.grantXp(userId, 'loss', i);
            }

            // Update Buttons
            const updatedButtons = new ActionRowBuilder().addComponents(
                buttons.components.map(btn => {
                    btn.setDisabled(true);
                    if (btn.data.custom_id === i.customId) {
                        btn.setStyle(isWin ? ButtonStyle.Success : ButtonStyle.Danger);
                    } else {
                        btn.setStyle(ButtonStyle.Secondary);
                    }
                    return btn;
                })
            );

            // Apply Cooldown
            setDurationCooldown(userId, 'highlow', 30, 10);

            await i.update({
                embeds: [resultEmbed],
                components: [updatedButtons]
            });

            collector.stop('played');
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                // Apply cooldown on timeout
                setDurationCooldown(userId, 'highlow', 30, 10);

                const timeoutEmbed = new EmbedBuilder()
                    .setTitle(`${interaction.user.username}'s expired High-Low Game`)
                    .setDescription(`Too slow!\nYour hint was **${hintNumber}** and the hidden number was **${secretNumber}**.`)
                    .setFooter({ text: "This game of high-low expired!" })
                    .setColor(0xFF0000);

                const disabledButtons = new ActionRowBuilder().addComponents(
                    buttons.components.map(btn => btn.setDisabled(true).setStyle(ButtonStyle.Secondary))
                );

                try {
                    await interaction.editReply({
                        embeds: [timeoutEmbed],
                        components: [disabledButtons]
                    });
                } catch (e) {
                    // Ignore
                }
            }
        });
    },
};
