const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const parseNumber = require('../../utils/numberParser');

const SYMBOLS = [
    '<:Cookie:981318260463136778>',
    '<:Coin:1105833876032606350>',
    '<:LuckyHorseshoe:986396363707281468>',
    '<:RarePepe:936007340736536626>',
    '<a:PepeMedal:948673104870252564>',
    '<a:PepeTrophy:940712966213496842>'
];

const PAYOUTS_TEXT = `-# **\` low risk \`** **\` infrequent matches \`** **\` high payouts \`**

<:Cookie:981318260463136778><:Cookie:981318260463136778><:emptyspace:827651824739156030> - 0.75x
<:Coin:1105833876032606350><:Coin:1105833876032606350><:emptyspace:827651824739156030> - 1.1x
<:LuckyHorseshoe:986396363707281468><:LuckyHorseshoe:986396363707281468><:emptyspace:827651824739156030> - 1.2x
<:RarePepe:936007340736536626><:RarePepe:936007340736536626><:emptyspace:827651824739156030> - 1.5x
<:Cookie:981318260463136778><:Cookie:981318260463136778><:Cookie:981318260463136778> - 2x
<a:PepeMedal:948673104870252564><a:PepeMedal:948673104870252564><:emptyspace:827651824739156030> - 2x
<:Coin:1105833876032606350><:Coin:1105833876032606350><:Coin:1105833876032606350> - 3x
<:LuckyHorseshoe:986396363707281468><:LuckyHorseshoe:986396363707281468><:LuckyHorseshoe:986396363707281468> - 3x
<:RarePepe:936007340736536626><:RarePepe:936007340736536626><:RarePepe:936007340736536626> - 7.5x
<a:PepeMedal:948673104870252564><a:PepeMedal:948673104870252564><a:PepeMedal:948673104870252564> - 25x
<a:PepeTrophy:940712966213496842><a:PepeTrophy:940712966213496842><a:PepeTrophy:940712966213496842> - 75x`;

const MIN_BET = 100;
const MAX_BET = 100000;

function getRandomSymbol() {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function calculateMultiplier(row) {
    // row is array of 3 symbols
    const [s1, s2, s3] = row;

    // Check 3 matches first
    if (s1 === s2 && s2 === s3) {
        if (s1 === '<a:PepeTrophy:940712966213496842>') return 75;
        if (s1 === '<a:PepeMedal:948673104870252564>') return 25;
        if (s1 === '<:RarePepe:936007340736536626>') return 7.5;
        if (s1 === '<:LuckyHorseshoe:986396363707281468>') return 3;
        if (s1 === '<:Coin:1105833876032606350>') return 3;
        if (s1 === '<:Cookie:981318260463136778>') return 2;
    }

    // Check 2 matches (start)
    if (s1 === s2) {
        if (s1 === '<a:PepeMedal:948673104870252564>') return 2;
        if (s1 === '<:RarePepe:936007340736536626>') return 1.5;
        if (s1 === '<:LuckyHorseshoe:986396363707281468>') return 1.2;
        if (s1 === '<:Coin:1105833876032606350>') return 1.1;
        if (s1 === '<:Cookie:981318260463136778>') return 0.75;
    }

    return 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSlots(interaction, betAmount) {
    const userId = interaction.user.id;
    let userData = db.getUser(userId);
    const balance = userData.balance ?? 0;

    if (balance < betAmount) {
         // Reply or Edit based on context
         const content = { content: `You don't have enough coins! You need **֍ ${betAmount.toLocaleString()}**.`, ephemeral: true };
         if (interaction.isButton() || interaction.isModalSubmit()) {
             await interaction.reply(content);
         } else {
             await interaction.reply(content);
         }
         return;
    }

    // Deduct Bet Immediately
    db.removeBalance(userId, betAmount);

    // Defer update or reply to ensure we have the message to edit
    let message;
    if (interaction.isButton() || interaction.isModalSubmit()) {
        // If it's a button click ("Spin Again"), we want to reuse the interaction to update the message
        // But the prompt says "Edit the message 11 times".
        // Usually, we update the existing message.
        await interaction.deferUpdate();
        message = interaction.message;
    } else {
        // Slash command
        await interaction.deferReply();
        message = await interaction.fetchReply();
    }

    // Initial State
    // We need 11 edits.
    // 1-10: Random frames.
    // 11: Final result.

    const getEmbed = (row1, row2, row3, isFinal = false, multiplier = 0) => {
        const currentBalance = (db.getUser(userId).balance ?? 0);
        const winnings = isFinal ? Math.floor(betAmount * multiplier) : 0;
        const net = isFinal ? winnings - betAmount : 0;
        const netString = net > 0 ? `+${net.toLocaleString()}` : `${net.toLocaleString()}`;

        let desc = `Pocket: **֍ ${currentBalance.toLocaleString()}**\n`;
        desc += `Winnings: **֍ ${winnings.toLocaleString()}**\n`;
        desc += `-# Net: **֍ ${netString}**\n`;
        desc += `<:emptyspace:827651824739156030>\n`;
        desc += `<:emptyspace:827651824739156030>\n`;
        desc += `## <:emptyspace:827651824739156030> **[** ${row1.join(' ')} **]**\n`;
        desc += `## <:DoubleArrowRight:863198630688981013> **[** ${row2.join(' ')} **]**${isFinal && multiplier > 0 ? ` \` ${multiplier}x \` ` : ''}\n`;
        desc += `## <:emptyspace:827651824739156030> **[** ${row3.join(' ')} **]**\n`;
        desc += `<:emptyspace:827651824739156030>\n`;
        desc += `<:emptyspace:827651824739156030>`;

        const color = isFinal ? (net > 0 ? 0x00FF00 : 0xFF0000) : 0x0099FF; // Blue for spinning, Green/Red for result

        return new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Slot Machine`)
            .setColor(color)
            .setDescription(desc)
            .setFooter({ text: `Bet: ${betAmount.toLocaleString()} | Min: ֍ ${MIN_BET.toLocaleString()} | Max: ֍ ${MAX_BET.toLocaleString()}` });
    };

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`slots_spin_again_${betAmount}`).setLabel('Spin Again').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('slots_change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('slots_payouts').setLabel('See Payouts').setStyle(ButtonStyle.Secondary)
    );

    // Animation Loop
    // We need to determine the FINAL result first to know if we won, but the prompt says
    // "On the final edit, show the actual determined result".
    // We can pre-calculate it.

    // Determine Final Rows
    const finalRow1 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const finalRow2 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]; // Payline
    const finalRow3 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    const multiplier = calculateMultiplier(finalRow2);
    const winnings = Math.floor(betAmount * multiplier);

    // Send initial frame (Frame 1 of animation? Prompt: "1. Send the initial embed. 2. ... Edit the message 11 times")
    // If we count the "initial embed" as distinct from the "11 edits", then 12 steps total?
    // "Edit the message 11 times total".
    // This implies the message exists, then we edit it 11 times.
    // So 1 initial + 11 edits = 12 visible states?
    // Or 1 initial (edit #0 if using button) + 11 edits.

    // Let's assume 11 edits means 11 frames of animation/result update.

    // First, display "Spinning..." state?
    // The prompt format requires 3 rows of symbols.

    // Initial display (before loop):
    if (interaction.isButton() || interaction.isModalSubmit()) {
         await interaction.editReply({
             embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
             )],
             components: [buttons]
         });
    } else {
         await interaction.editReply({
             embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
             )],
             components: [buttons]
         });
    }

    // Now edit 11 times.
    // 10 times random, 1 time final.
    for (let i = 0; i < 10; i++) {
        await sleep(200);
        await interaction.editReply({
            embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
            )]
        });
    }

    // Final Edit (11th)
    await sleep(200);

    // Update DB if win
    if (winnings > 0) {
        db.addBalance(userId, winnings);
    }

    await interaction.editReply({
        embeds: [getEmbed(finalRow1, finalRow2, finalRow3, true, multiplier)]
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Bet some coins on the slot machine.')
        .addStringOption(option =>
            option.setName('bet')
                .setDescription('Amount to bet')
                .setRequired(true)
        ),
    async execute(interaction) {
        const betStr = interaction.options.getString('bet');
        const userData = db.getUser(interaction.user.id);
        const balance = userData.balance ?? 0;

        // Parse bet
        const betAmount = parseNumber(betStr, balance);

        if (betAmount < MIN_BET) {
            return interaction.reply({ content: `Minimum bet is **֍ ${MIN_BET.toLocaleString()}**.`, ephemeral: true });
        }
        if (betAmount > MAX_BET) {
            return interaction.reply({ content: `Maximum bet is **֍ ${MAX_BET.toLocaleString()}**.`, ephemeral: true });
        }

        await runSlots(interaction, betAmount);
    },
    // Handler methods for external calls from interactionCreate
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('slots_spin_again_')) {
            const betAmount = parseInt(customId.replace('slots_spin_again_', ''));
            const userData = db.getUser(interaction.user.id);
            const balance = userData.balance ?? 0;

            // Check constraints again (in case balance changed or hardcoded constraints changed)
             if (betAmount < MIN_BET || betAmount > MAX_BET) { // Should not happen with valid IDs but safety
                return interaction.reply({ content: 'Invalid bet amount.', ephemeral: true });
            }

            await runSlots(interaction, betAmount);

        } else if (customId === 'slots_change_bet') {
            const modal = new ModalBuilder()
                .setCustomId('slots_bet_modal')
                .setTitle('Change Bet Amount');

            const betInput = new TextInputBuilder()
                .setCustomId('slots_bet_input')
                .setLabel('New Bet Amount')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g. 500, 1k, all')
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(betInput);
            modal.addComponents(row);

            await interaction.showModal(modal);

        } else if (customId === 'slots_payouts') {
            await interaction.reply({ content: PAYOUTS_TEXT, ephemeral: true });
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'slots_bet_modal') {
            const betStr = interaction.fields.getTextInputValue('slots_bet_input');
            const userData = db.getUser(interaction.user.id);
            const balance = userData.balance ?? 0;

            const betAmount = parseNumber(betStr, balance);

            if (betAmount < MIN_BET) {
                return interaction.reply({ content: `Minimum bet is **֍ ${MIN_BET.toLocaleString()}**.`, ephemeral: true });
            }
            if (betAmount > MAX_BET) {
                return interaction.reply({ content: `Maximum bet is **֍ ${MAX_BET.toLocaleString()}**.`, ephemeral: true });
            }

            // For modal, runSlots needs to treat it like a fresh reply,
            // BUT runSlots logic for buttons uses deferUpdate/editReply on existing message.
            // Modal submit creates a NEW interaction token.
            // If we want to replace the old slots message, we can't easily do that unless we fetch it (not passed).
            // Usually, "Change Bet" results in a new game message below.
            // So runSlots will handle it as a new reply.
            // Let's adjust runSlots to handle modal interaction correctly (it has reply/editReply).

            // Logic in runSlots:
            /*
            if (interaction.isButton()) { await interaction.deferUpdate(); ... }
            else { await interaction.deferReply(); ... }
            */
            // ModalSubmitInteraction is NOT a ButtonInteraction.
            // So it falls to `else` -> deferReply -> sends new message. This is correct for "Change Bet" resulting in new output.

            await runSlots(interaction, betAmount);
        }
    }
};
