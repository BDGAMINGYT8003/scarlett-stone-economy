const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { checkAndUnlockBadges } = require('../../utils/badgeManager');
const { checkAndUnlockAchievements } = require('../../utils/achievementManager');
const levelManager = require('../../utils/levelManager');
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
    const [s1, s2, s3] = row;

    if (s1 === s2 && s2 === s3) {
        if (s1 === '<a:PepeTrophy:1446609005630984332>') return 75;
        if (s1 === '<a:PepeMedal:1446609003785228450>') return 25;
        if (s1 === '<:rarepepe:1446608891965214892>') return 7.5;
        if (s1 === '<:LuckyHorseshoe:1446609001600127086>') return 3;
        if (s1 === '<:Coin:1446608996520825002>') return 3;
        if (s1 === '<:Cookie:1446608820196610149>') return 2;
    }

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

    db.removeBalance(userId, betAmount);
    db.logTransaction(userId, 'slots', { amount: -betAmount });

    let message;
    if (interaction.isButton() || interaction.isModalSubmit()) {
        await interaction.deferUpdate();
        message = interaction.message;
    } else {
        await interaction.deferReply();
        message = await interaction.fetchReply();
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

        return new EmbedBuilder()
            .setTitle(`${interaction.user.username}'s Slot Machine`)
            .setColor(color)
            .setDescription(desc)
            .setFooter({ text: `Bet: ${betAmount.toLocaleString()} | Min: ֍ ${MIN_BET.toLocaleString()} | Max: ֍ ${MAX_BET.toLocaleString()}` });
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

    if (interaction.isButton() || interaction.isModalSubmit()) {
         await interaction.editReply({
             embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
             )],
             components: [getButtons(true)]
         });
    } else {
         await interaction.editReply({
             embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
             )],
             components: [getButtons(true)]
         });
    }

    for (let i = 0; i < 4; i++) {
        await sleep(200);
        await interaction.editReply({
            embeds: [getEmbed(
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()],
                 [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()]
            )]
        });
    }

    await sleep(200);

    if (winnings > 0) {
        db.addBalance(userId, winnings);
        db.logTransaction(userId, 'slots', { amount: winnings });
        db.incrementStat(userId, 'slots_wins');
        db.incrementStat(userId, 'slots_won_amount', winnings);

        // XP Grant - Profit
        await levelManager.grantXp(userId, 'profit', interaction);
    } else {
        db.incrementStat(userId, 'slots_lost_amount', betAmount);

        // XP Grant - Loss/Neutral
        await levelManager.grantXp(userId, 'loss', interaction);
    }

    db.incrementStat(userId, 'slots_played');

    await checkAndUnlockBadges(userId, interaction);
    await checkAndUnlockAchievements(userId, interaction);

    await interaction.editReply({
        embeds: [getEmbed(finalRow1, finalRow2, finalRow3, true, multiplier)],
        components: [getButtons(false)]
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

        await runSlots(interaction, betAmount);
    },
    // Handler methods for external calls from interactionCreate
    async handleButton(interaction) {
        let originalUserId = null;
        if (interaction.message.interaction) {
            originalUserId = interaction.message.interaction.user.id;
        }

        if (originalUserId && interaction.user.id !== originalUserId) {
            const embed = new EmbedBuilder()
                .setTitle('Access Denied')
                .setDescription("You cannot interact with someone else's slot machine! Start your own game with `/slots`.")
                .setColor(0xFF0000)
                .setFooter({ text: 'Get your own coins!' });
            return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }

        const customId = interaction.customId;

        if (customId.startsWith('slots_spin_again_')) {
            const betAmount = Number(customId.replace('slots_spin_again_', ''));
             if (!Number.isSafeInteger(betAmount) || betAmount < MIN_BET || betAmount > MAX_BET) {
                const embed = new EmbedBuilder()
                    .setTitle('Invalid Bet')
                    .setDescription('Invalid bet amount.')
                    .setColor(0xFF0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
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
            const embed = new EmbedBuilder()
                .setTitle('Slot Machine Payouts')
                .setDescription(PAYOUTS_TEXT)
                .setColor(0x00AAFF);
            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
    async handleModal(interaction) {
        if (interaction.customId === 'slots_bet_modal') {
            const betStr = interaction.fields.getTextInputValue('slots_bet_input');
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

            await runSlots(interaction, betAmount);
        }
    }
};
