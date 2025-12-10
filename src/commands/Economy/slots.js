const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const parseNumber = require('../../utils/numberParser');

const SYMBOLS = [
    '<:Cookie:1446608820196610149>',
    '<:Coin:1446608996520825002>',
    '<:LuckyHorseshoe:1446609001600127086>',
    '<:rarepepe:1446608891965214892>',
    '<a:PepeMedal:1446609003785228450>',
    '<a:PepeTrophy:1446609005630984332>'
];

const PAYOUTS_TEXT = `-# **\` low risk \`** **\` infrequent matches \`** **\` high payouts \`**

<:Cookie:1446608820196610149><:Cookie:1446608820196610149><:emptyspace:1446608999293391140> - 0.75x
<:Coin:1446608996520825002><:Coin:1446608996520825002><:emptyspace:1446608999293391140> - 1.1x
<:LuckyHorseshoe:1446609001600127086><:LuckyHorseshoe:1446609001600127086><:emptyspace:1446608999293391140> - 1.2x
<:rarepepe:1446608891965214892><:rarepepe:1446608891965214892><:emptyspace:1446608999293391140> - 1.5x
<:Cookie:1446608820196610149><:Cookie:1446608820196610149><:Cookie:1446608820196610149> - 2x
<a:PepeMedal:1446609003785228450><a:PepeMedal:1446609003785228450><:emptyspace:1446608999293391140> - 2x
<:Coin:1446608996520825002><:Coin:1446608996520825002><:Coin:1446608996520825002> - 3x
<:LuckyHorseshoe:1446609001600127086><:LuckyHorseshoe:1446609001600127086><:LuckyHorseshoe:1446609001600127086> - 3x
<:rarepepe:1446608891965214892><:rarepepe:1446608891965214892><:rarepepe:1446608891965214892> - 7.5x
<a:PepeMedal:1446609003785228450><a:PepeMedal:1446609003785228450><a:PepeMedal:1446609003785228450> - 25x
<a:PepeTrophy:1446609005630984332><a:PepeTrophy:1446609005630984332><a:PepeTrophy:1446609005630984332> - 75x`;

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
        if (s1 === '<a:PepeTrophy:1446609005630984332>') return 75;
        if (s1 === '<a:PepeMedal:1446609003785228450>') return 25;
        if (s1 === '<:rarepepe:1446608891965214892>') return 7.5;
        if (s1 === '<:LuckyHorseshoe:1446609001600127086>') return 3;
        if (s1 === '<:Coin:1446608996520825002>') return 3;
        if (s1 === '<:Cookie:1446608820196610149>') return 2;
    }

    // Check 2 matches (start)
    if (s1 === s2) {
        if (s1 === '<a:PepeMedal:1446609003785228450>') return 2;
        if (s1 === '<:rarepepe:1446608891965214892>') return 1.5;
        if (s1 === '<:LuckyHorseshoe:1446609001600127086>') return 1.2;
        if (s1 === '<:Coin:1446608996520825002>') return 1.1;
        if (s1 === '<:Cookie:1446608820196610149>') return 0.75;
    }

    return 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runSlots(interaction, betAmount) {
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

    // Deduct Bet Immediately
    db.removeBalance(userId, betAmount);

    if (interaction.isButton() || interaction.isModalSubmit()) {
        await interaction.deferUpdate();
    } else {
        await interaction.deferReply();
    }

    const getEmbed = (row1, row2, row3, isFinal = false, multiplier = 0) => {
        const currentBalance = (db.getUser(userId).balance ?? 0);
        const winnings = isFinal ? Math.floor(betAmount * multiplier) : 0;
        const net = isFinal ? winnings - betAmount : 0;
        const netString = net > 0 ? `+${net.toLocaleString()}` : `${net.toLocaleString()}`;

        let desc = `Pocket: **֍ ${currentBalance.toLocaleString()}**\n`;
        desc += `Winnings: **֍ ${winnings.toLocaleString()}**\n`;
        desc += `-# Net: **֍ ${netString}**\n`;
        desc += `<:emptyspace:1446608999293391140>\n`;
        desc += `<:emptyspace:1446608999293391140>\n`;
        desc += `## <:emptyspace:1446608999293391140> **[** ${row1.join(' ')} **]**\n`;
        desc += `## <:DoubleArrowRight:1446611400251281542> **[** ${row2.join(' ')} **]**${isFinal && multiplier > 0 ? ` \` ${multiplier}x \` ` : ''}\n`;
        desc += `## <:emptyspace:1446608999293391140> **[** ${row3.join(' ')} **]**\n`;
        desc += `<:emptyspace:1446608999293391140>\n`;
        desc += `<:emptyspace:1446608999293391140>`;

        const color = isFinal ? (net > 0 ? 0x00FF00 : 0xFF0000) : 0x0099FF;

        return new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Slot Machine\n${desc}`))
            .setColor(color)
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`Bet: ${betAmount.toLocaleString()} | Min: ֍ ${MIN_BET.toLocaleString()} | Max: ֍ ${MAX_BET.toLocaleString()}`));
    };

    const getButtons = (disabled = false) => {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`slots_spin_again_${betAmount}`).setLabel('Spin Again').setStyle(ButtonStyle.Primary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('slots_change_bet').setLabel('Change Bet').setStyle(ButtonStyle.Secondary).setDisabled(disabled),
            new ButtonBuilder().setCustomId('slots_payouts').setLabel('See Payouts').setStyle(ButtonStyle.Secondary).setDisabled(disabled)
        );
    };

    const finalRow1 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const finalRow2 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const finalRow3 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    const multiplier = calculateMultiplier(finalRow2);
    const winnings = Math.floor(betAmount * multiplier);

    const initialContainer = getEmbed(
         [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
         [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
         [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
    );
    initialContainer.addActionRowComponents(getButtons(true));

    await interaction.editReply({
         components: [initialContainer],
         flags: MessageFlags.IsComponentsV2
    });

    for (let i = 0; i < 4; i++) {
        await sleep(200);
        const tempContainer = getEmbed(
             [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
             [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
             [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
        );
        // Buttons must remain present (though disabled)
        tempContainer.addActionRowComponents(getButtons(true));

        await interaction.editReply({
            components: [tempContainer]
        });
    }

    await sleep(200);

    if (winnings > 0) {
        db.addBalance(userId, winnings);
    }

    const finalContainer = getEmbed(finalRow1, finalRow2, finalRow3, true, multiplier);
    finalContainer.addActionRowComponents(getButtons(false));

    await interaction.editReply({
        components: [finalContainer]
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

        await runSlots(interaction, betAmount);
    },
    async handleButton(interaction) {
        const customId = interaction.customId;

        if (customId.startsWith('slots_spin_again_')) {
            const betAmount = parseInt(customId.replace('slots_spin_again_', ''));
            const userData = db.getUser(interaction.user.id);
            const balance = userData.balance ?? 0;

             if (betAmount < MIN_BET || betAmount > MAX_BET) {
                const embed = new ContainerBuilder()
                    .setColor(Colors.Red)
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Invalid Bet\nInvalid bet amount.'));
                return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
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
            const embed = new ContainerBuilder()
                .setColor(0x00AAFF)
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Slot Machine Payouts\n${PAYOUTS_TEXT}`));
            await interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'slots_bet_modal') {
            const betStr = interaction.fields.getTextInputValue('slots_bet_input');
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

            await runSlots(interaction, betAmount);
        }
    }
};
