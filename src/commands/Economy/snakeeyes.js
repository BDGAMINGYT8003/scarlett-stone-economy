const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const parseNumber = require('../../utils/numberParser');

const SNAKE_EYES_EMOJI = '<:SnakeEyes:1446613388049387632>';
const DICE_1 = '<:Dice1:1446613390234619934>';
const DICE_2 = '<:Dice2:1446613392436625449>';
const DICE_3 = '<:Dice3:1446613394332454922>';
const DICE_4 = '<:Dice4:1446613396559630336>';
const DICE_5 = '<:Dice5:1446613398711308369>';
const DICE_6 = '<:Dice6:1446613400573575239>';

const DICE_FACES = [DICE_1, DICE_2, DICE_3, DICE_4, DICE_5, DICE_6];

const MIN_BET = 5000;
const MAX_BET = 500000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSnakeEyes(interaction, betAmount) {
    const userId = interaction.user.id;
    let userData = db.getUser(userId);
    const balance = userData.balance ?? 0;

    if (balance < betAmount) {
         const embed = new ContainerBuilder()
            .setColor(Colors.Red)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Insufficient Funds\nYou don't have enough coins! You need **֍ ${betAmount.toLocaleString()}**.`));

         if (interaction.isButton() || interaction.isModalSubmit()) {
             await interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
         } else {
             await interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
         }
         return;
    }

    db.removeBalance(userId, betAmount);

    if (interaction.isButton() || interaction.isModalSubmit()) {
        await interaction.deferUpdate();
    } else {
        await interaction.deferReply();
    }

    // Animation frames
    const getEmbed = (dice1, dice2, isFinal = false, multiplier = 0) => {
        const currentBalance = (db.getUser(userId).balance ?? 0);
        const winnings = isFinal ? Math.floor(betAmount * multiplier) : 0;
        const net = isFinal ? winnings - betAmount : 0;
        const netString = net > 0 ? `+${net.toLocaleString()}` : `${net.toLocaleString()}`;

        let desc = `**Bet:** ֍ ${betAmount.toLocaleString()}\n`;
        desc += `**Winnings:** ֍ ${winnings.toLocaleString()}\n`;
        desc += `**Net:** ֍ ${netString}\n\n`;
        desc += `> ${dice1} ${dice2}\n\n`; // Dice display

        if (isFinal) {
            if (multiplier === 12) desc += `**SNAKE EYES!** (12x Payout)`;
            else if (multiplier === 1.25) desc += `**One Eye!** (1.25x Payout)`;
            else desc += `**Better luck next time!**`;
        } else {
            desc += `*Rolling...*`;
        }

        const color = isFinal ? (net > 0 ? 0x00FF00 : 0xFF0000) : 0x0099FF;

        return new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Snake Eyes ${SNAKE_EYES_EMOJI}\n${desc}`))
            .setColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Pocket: ֍ ${currentBalance.toLocaleString()}`));
    };

    const getButtons = (disabled = false) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`snakeeyes_roll_again_${betAmount}`).setLabel('Roll Again').setStyle(ButtonStyle.Primary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('snakeeyes_change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
    };

    // Rolling animation (1.5 seconds)
    // Show initial state
    const initialContainer = getEmbed(DICE_FACES[Math.floor(Math.random() * 6)], DICE_FACES[Math.floor(Math.random() * 6)]);
    initialContainer.addActionRowComponents(getButtons(true));
    await interaction.editReply({ components: [initialContainer], flags: MessageFlags.IsComponentsV2 });

    // A few frames
    for (let i = 0; i < 3; i++) {
        await sleep(400);
         const tempContainer = getEmbed(DICE_FACES[Math.floor(Math.random() * 6)], DICE_FACES[Math.floor(Math.random() * 6)]);
         tempContainer.addActionRowComponents(getButtons(true));
        await interaction.editReply({ components: [tempContainer] });
    }

    await sleep(300);

    // Final Result
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const dice1Emoji = DICE_FACES[roll1 - 1];
    const dice2Emoji = DICE_FACES[roll2 - 1];

    let multiplier = 0;
    if (roll1 === 1 && roll2 === 1) {
        multiplier = 12;
    } else if (roll1 === 1 || roll2 === 1) {
        multiplier = 1.25;
    }

    const winnings = Math.floor(betAmount * multiplier);
    if (winnings > 0) {
        db.addBalance(userId, winnings);
    }

    const finalContainer = getEmbed(dice1Emoji, dice2Emoji, true, multiplier);
    finalContainer.addActionRowComponents(getButtons(false));

    await interaction.editReply({ components: [finalContainer] });
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
             const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Invalid Bet\nMinimum bet is **֍ ${MIN_BET.toLocaleString()}**.`));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
        if (betAmount > MAX_BET) {
             const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Invalid Bet\nMaximum bet is **֍ ${MAX_BET.toLocaleString()}**.`));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        await runSnakeEyes(interaction, betAmount);
    },
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('snakeeyes_roll_again_')) {
            const betAmount = parseInt(customId.replace('snakeeyes_roll_again_', ''));
            const userData = db.getUser(interaction.user.id);
            const balance = userData.balance ?? 0;

             if (betAmount < MIN_BET || betAmount > MAX_BET) {
                const embed = new ContainerBuilder()
                    .setColor(Colors.Red)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Invalid Bet\nInvalid bet amount.'));
                return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
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
                .setPlaceholder('e.g. 5k, 10k, all')
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
                 const embed = new ContainerBuilder()
                    .setColor(Colors.Red)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Invalid Bet\nMinimum bet is **֍ ${MIN_BET.toLocaleString()}**.`));
                return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }
            if (betAmount > MAX_BET) {
                 const embed = new ContainerBuilder()
                    .setColor(Colors.Red)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Invalid Bet\nMaximum bet is **֍ ${MAX_BET.toLocaleString()}**.`));
                return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            await runSnakeEyes(interaction, betAmount);
        }
    }
};
