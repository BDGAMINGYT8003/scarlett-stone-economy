const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const { checkAndUnlockAchievements } = require('../../utils/achievementManager');
const parseNumber = require('../../utils/numberParser');

const MIN_BET = 5000;
const MAX_BET = 500000;

const DICE_EMOJIS = {
    ANIMATED: '<a:animated_dice:1447148017630318686>',
    1: '<:dice1:1447148019983061035>',
    2: '<:dice2:1447148022361493617>',
    3: '<:dice3:1447148024752242778>',
    4: '<:dice4:1447148027088338945>',
    5: '<:dice5:1447148029755789332>',
    6: '<:dice6:1447148031647547412>'
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSnakeEyes(interaction, betAmount) {
    const userId = interaction.user.id;
    let userData = db.getUser(userId);
    const balance = userData.balance ?? 0;

    if (balance < betAmount) {
        const embed = new EmbedBuilder()
            .setTitle('Insufficient Funds')
            .setDescription(`You don't have enough coins! You need **֍ ${betAmount.toLocaleString()}**.`)
            .setColor(0xFF0000);

        if (interaction.isButton() || interaction.isModalSubmit()) {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        } else {
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        return;
    }

    // Deduct Bet
    db.removeBalance(userId, betAmount);
    db.logTransaction(userId, 'snakeeyes', { amount: -betAmount });

    let message;
    if (interaction.isButton() || interaction.isModalSubmit()) {
        await interaction.deferUpdate();
        message = interaction.message;
    } else {
        await interaction.deferReply();
        message = await interaction.fetchReply();
    }

    // Phase 1: Rolling
    const rollingEmbed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Snake Eyes Game`)
        .setDescription(`Pocket: **֍ ${(balance - betAmount).toLocaleString()}**\nWinnings: **Rolling...**\n<:emptyspace:1446608999293391140>\n## <:emptyspace:1446608999293391140> ${DICE_EMOJIS.ANIMATED} ${DICE_EMOJIS.ANIMATED}\n<:emptyspace:1446608999293391140>`)
        .setFooter({ text: `Bet: ֍ ${betAmount.toLocaleString()} | Payouts: 1 eye (1.25x) 2 eyes (12x)` })
        .setColor(0x0099FF);

    const disabledButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`snakeeyes_roll_again_${betAmount}`).setLabel('Roll Again').setStyle(ButtonStyle.Primary).setDisabled(true),
        new ButtonBuilder().setCustomId('snakeeyes_change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary).setDisabled(true)
    );

    await interaction.editReply({ embeds: [rollingEmbed], components: [disabledButtons] });

    await sleep(1500);

    // Phase 2: Result
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;

    let multiplier = 0;
    if (dice1 === 1 && dice2 === 1) {
        multiplier = 12;
    } else if (dice1 === 1 || dice2 === 1) {
        multiplier = 1.25;
    }

    const winnings = Math.floor(betAmount * multiplier);
    const profit = winnings - betAmount;

    if (winnings > 0) {
        db.addBalance(userId, winnings);
        db.logTransaction(userId, 'snakeeyes', { amount: winnings });
        db.incrementStat(userId, 'snakeeyes_wins');
        db.incrementStat(userId, 'snakeeyes_won_amount', winnings);
    } else {
        db.incrementStat(userId, 'snakeeyes_lost_amount', betAmount);
    }

    db.incrementStat(userId, 'snakeeyes_played');

    // Check Badges (Bet deduction or Win)
    await checkAndUnlockBadges(userId, interaction);
    await checkAndUnlockAchievements(userId, interaction);

    // Refresh user data for final balance display
    const newBalance = (db.getUser(userId).balance ?? 0);
    const profitString = profit > 0 ? `+${profit.toLocaleString()}` : `${profit.toLocaleString()}`;

    const resultEmbed = new EmbedBuilder()
        .setTitle(`${interaction.user.username}'s Snake Eyes Game`)
        .setDescription(`Pocket: **֍ ${newBalance.toLocaleString()}**\nWinnings: **֍ ${profitString}**\n<:emptyspace:1446608999293391140>\n## <:emptyspace:1446608999293391140> ${DICE_EMOJIS[dice1]} ${DICE_EMOJIS[dice2]}\n<:emptyspace:1446608999293391140>`)
        .setFooter({ text: `Bet: ֍ ${betAmount.toLocaleString()} | Payouts: 1 eye (1.25x) 2 eyes (12x)` })
        .setColor(profit > 0 ? 0x00FF00 : 0xFF0000);

    const enabledButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`snakeeyes_roll_again_${betAmount}`).setLabel('Roll Again').setStyle(ButtonStyle.Primary).setDisabled(false),
        new ButtonBuilder().setCustomId('snakeeyes_change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary).setDisabled(false)
    );

    await interaction.editReply({ embeds: [resultEmbed], components: [enabledButtons] });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('snakeeyes')
        .setDescription('Roll the dice for a chance to win big!')
        .addStringOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true)
        ),
    async execute(interaction) {
        const betStr = interaction.options.getString('bet');
        const userData = db.getUser(interaction.user.id);
        const balance = userData.balance ?? 0;

        const betAmount = parseNumber(betStr, balance);

        if (betAmount < MIN_BET) {
            const embed = new EmbedBuilder()
                .setTitle('Invalid Bet')
                .setDescription(`Minimum bet is **֍ ${MIN_BET.toLocaleString()}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
        if (betAmount > MAX_BET) {
             const embed = new EmbedBuilder()
                .setTitle('Invalid Bet')
                .setDescription(`Maximum bet is **֍ ${MAX_BET.toLocaleString()}**.`)
                .setColor(0xFF0000);
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        await runSnakeEyes(interaction, betAmount);
    },
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('snakeeyes_roll_again_')) {
            const betAmount = parseInt(customId.replace('snakeeyes_roll_again_', ''));

             if (betAmount < MIN_BET || betAmount > MAX_BET) {
                const embed = new EmbedBuilder()
                    .setTitle('Invalid Bet')
                    .setDescription('Invalid bet amount.')
                    .setColor(0xFF0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            await runSnakeEyes(interaction, betAmount);

        } else if (customId === 'snakeeyes_change_bet') {
            const modal = new ModalBuilder()
                .setCustomId('snakeeyes_bet_modal')
                .setTitle('Change Bet Amount');

            const betInput = new TextInputBuilder()
                .setCustomId('snakeeyes_bet_input')
                .setLabel('New Bet Amount')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 5000, 10k')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(betInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'snakeeyes_bet_modal') {
            const betStr = interaction.fields.getTextInputValue('snakeeyes_bet_input');
            const userData = db.getUser(interaction.user.id);
            const balance = userData.balance ?? 0;

            const betAmount = parseNumber(betStr, balance);

            if (betAmount < MIN_BET) {
                 const embed = new EmbedBuilder()
                    .setTitle('Invalid Bet')
                    .setDescription(`Minimum bet is **֍ ${MIN_BET.toLocaleString()}**.`)
                    .setColor(0xFF0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            if (betAmount > MAX_BET) {
                 const embed = new EmbedBuilder()
                    .setTitle('Invalid Bet')
                    .setDescription(`Maximum bet is **֍ ${MAX_BET.toLocaleString()}**.`)
                    .setColor(0xFF0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            await runSnakeEyes(interaction, betAmount);
        }
    }
};
