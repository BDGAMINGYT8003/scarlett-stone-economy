const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const levelsConfig = require('../../config/levels.json');
const itemsConfig = require('../../config/items.json');
const { getProgressBar } = require('../../utils/progressBar');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';
const CY_FINAL = '<:CY:1458227576492392540>';
const CX_FINAL = '<:CX:1458227573950775577>';

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

const CONGRATS_PHRASES = [
    "Congratulations, you absolute gamer. You have earned this prestige and the rewards associated with it; don't let anyone tell you otherwise. Omega when?",
    "Prestige achieved! You are officially addicted. Go touch some grass... after checking your rewards.",
    "Another prestige down! Your dedication is scary. Good job!",
    "Wow, you actually did it. Resetting everything for clout? Respect.",
    "Level 0 looks good on you. Time to grind all over again!",
    "You pressed the button! Enjoy the prestige icon and the bragging rights.",
    "Prestiged! Your bank account is crying, but your profile looks awesome.",
    "The grind never ends. Welcome to the next level of prestige!",
    "One small step for man, one giant leap for your Discord profile.",
    "Absolute madness. You prestiged again. Here are your rewards!"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advancements')
        .setDescription('View your progress and rewards.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('levels')
                .setDescription('View level rewards.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('prestige')
                .setDescription('View prestige requirements and advancement.')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'levels') await this.handleLevels(interaction);
        else if (subcommand === 'prestige') await this.handlePrestige(interaction);
    },

    async handleLevels(interaction) {
        const userId = interaction.user.id;
        const user = db.getUser(userId);
        const currentLevel = user.level || 0;

        let currentPage = 0;
        const maxPages = Math.ceil(levelsConfig.length / ITEMS_PER_PAGE);

        const generateEmbed = (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentLevels = levelsConfig.slice(start, end);

            let desc = `-# Your current level is **${currentLevel}**.\n\n`;

            currentLevels.forEach(lvl => {
                const isUnlocked = currentLevel >= lvl.level;
                const statusEmoji = isUnlocked ? CY_FINAL : CX_FINAL;

                desc += `**${statusEmoji} Level ${lvl.level}**\n`;

                const rewards = [];
                if (lvl.rewards.coins) rewards.push(`֍ ${lvl.rewards.coins.toLocaleString()}`);
                if (lvl.rewards.title) rewards.push(`'${lvl.rewards.title}' Title`);
                if (lvl.rewards.multiplier_bonus) rewards.push(`+${lvl.rewards.multiplier_bonus}% Coin Multiplier`);
                if (lvl.rewards.items) {
                    lvl.rewards.items.forEach(i => {
                        const itemRef = itemsConfig.find(it => it.id === i.id);
                        const name = itemRef ? `${itemRef.emoji} ${itemRef.name}` : i.id;
                        rewards.push(`${i.amount} ${name}`);
                    });
                }

                rewards.forEach((reward, index) => {
                    const isLast = index === rewards.length - 1;
                    const bullet = isLast ? REPLY : REPLY_CONT;
                    desc += `${bullet} ${reward}\n`;
                });
            });

            return new EmbedBuilder()
                .setTitle('Level Rewards')
                .setDescription(desc)
                .setColor(0x0099FF)
                .setFooter({ text: `Page ${page + 1} of ${maxPages}` });
        };

        const getComponents = (page) => {
            return [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('first_page').setEmoji(FIRST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('prev_page').setEmoji(PREV_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page === 0),
                    new ButtonBuilder().setCustomId('refresh_levels').setEmoji(REFRESH_EMOJI).setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('next_page').setEmoji(NEXT_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1),
                    new ButtonBuilder().setCustomId('last_page').setEmoji(LAST_EMOJI).setStyle(ButtonStyle.Primary).setDisabled(page >= maxPages - 1)
                )
            ];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed(currentPage)],
            components: getComponents(currentPage),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your session!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prev_page') currentPage = Math.max(0, currentPage - 1);
            if (i.customId === 'next_page') currentPage = Math.min(maxPages - 1, currentPage + 1);
            if (i.customId === 'first_page') currentPage = 0;
            if (i.customId === 'last_page') currentPage = maxPages - 1;
            // refresh just re-renders

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: getComponents(currentPage)
            });
        });
    },

    async handlePrestige(interaction) {
        const userId = interaction.user.id;
        const user = db.getUser(userId);
        const currentPrestige = user.prestige || 0;
        const nextPrestige = currentPrestige + 1;

        // Requirements
        const coinsReq = nextPrestige * 25000000;
        const levelReq = nextPrestige * 85;

        // Current Stats
        const currentCoins = (user.balance || 0);
        const currentLevel = user.level || 0;

        const isCoinsMet = currentCoins >= coinsReq;
        const isLevelMet = currentLevel >= levelReq;
        const isEligible = isCoinsMet && isLevelMet;

        const generateEmbed = (state) => {
            // States: 'status', 'pending', 'final_pending', 'cancelled', 'timeout'

            const color = isEligible ? 0x00FF00 : 0xFF0000;
            const title = state === 'status' ? `Prestige ${nextPrestige} Requirements` :
                          state === 'pending' || state === 'final_pending' ? 'Action Pending' :
                          state === 'cancelled' ? 'Action Cancelled' : 'Timed Out';

            const footerText = state === 'status' ? (isEligible ? "You are eligible to prestige!" : "Imagine thinking you can prestige already LOL") :
                               state === 'pending' || state === 'final_pending' ? "Are you sure you want to prestige?" :
                               state === 'cancelled' ? "Prestige cancelled." : "Prestige timed out.";

            // Bars
            const coinsPct = Math.min(100, Math.floor((currentCoins / coinsReq) * 100));
            const levelPct = Math.min(100, Math.floor((currentLevel / levelReq) * 100));
            const coinsBar = getProgressBar(currentCoins, coinsReq, 5);
            const levelBar = getProgressBar(currentLevel, levelReq, 5);

            const coinsEmoji = isCoinsMet ? CY_FINAL : CX_FINAL;
            const levelEmoji = isLevelMet ? CY_FINAL : CX_FINAL;

            let desc = "";
            if (state === 'cancelled' || state === 'timeout') {
                desc += `~~${coinsEmoji} **Pocket Balance**~~\n`;
                desc += `~~${REPLY_CONT} ֍ ${currentCoins.toLocaleString()}/${coinsReq.toLocaleString()}~~\n`;
                desc += `~~${REPLY} ${coinsBar} \` ${coinsPct}% \`~~\n\n`;

                desc += `~~${levelEmoji} **Level Required**~~\n`;
                desc += `~~${REPLY_CONT} ${currentLevel}/${levelReq}~~\n`;
                desc += `~~${REPLY} ${levelBar} \` ${levelPct}% \`~~\n`;
            } else {
                desc += `${coinsEmoji} **Pocket Balance**\n`;
                desc += `${REPLY_CONT} ֍ ${currentCoins.toLocaleString()}/${coinsReq.toLocaleString()}\n`;
                desc += `${REPLY} ${coinsBar} \` ${coinsPct}% \`\n\n`;

                desc += `${levelEmoji} **Level Required**\n`;
                desc += `${REPLY_CONT} ${currentLevel}/${levelReq}\n`;
                desc += `${REPLY} ${levelBar} \` ${levelPct}% \`\n`;
            }

            if (state === 'pending' || state === 'final_pending') {
                desc += `\nPrestiging takes a lot of things away in exchange for a small upgrade. Click the ❓ to learn about what you lose to prestige.`;
                if (state === 'final_pending') {
                    desc += `\n\n**FINAL WARNING**: This action cannot be undone. Are you REALLY sure?`;
                }
            }

            return new EmbedBuilder()
                .setTitle(title)
                .setDescription(desc)
                .setColor(color)
                .setFooter({ text: footerText });
        };

        const getComponents = (state) => {
            const row = new ActionRowBuilder();
            if (state === 'status') {
                row.addComponents(
                    new ButtonBuilder().setCustomId('prestige_start').setLabel('Prestige Now').setStyle(ButtonStyle.Success).setDisabled(!isEligible)
                );
            } else if (state === 'pending') {
                row.addComponents(
                    new ButtonBuilder().setCustomId('prestige_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('prestige_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('prestige_help').setLabel('❓').setStyle(ButtonStyle.Secondary)
                );
            } else if (state === 'final_pending') {
                row.addComponents(
                    new ButtonBuilder().setCustomId('prestige_final_confirm').setLabel('Final Confirm').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('prestige_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
                );
            }
            return [row];
        };

        const response = await interaction.reply({
            embeds: [generateEmbed('status')],
            components: getComponents('status'),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your session!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === 'prestige_start') {
                await i.update({ embeds: [generateEmbed('pending')], components: getComponents('pending') });
            } else if (i.customId === 'prestige_confirm') {
                await i.update({ embeds: [generateEmbed('final_pending')], components: getComponents('final_pending') });
            } else if (i.customId === 'prestige_final_confirm') {
                // Execute Prestige
                db.addPrestige(userId); // Add prestige FIRST
                db.resetProfileForPrestige(userId); // Then reset stats

                // Grant Rewards
                db.addItem(userId, 'prestige_pack', 1);
                db.addItem(userId, 'prestige_coin', 1);

                // Phrase
                const phrase = CONGRATS_PHRASES[Math.floor(Math.random() * CONGRATS_PHRASES.length)];

                const successEmbed = new EmbedBuilder()
                    .setTitle(`${interaction.user.username} | Prestige ${nextPrestige}`)
                    .setDescription(`**${phrase}**\n\n**Earned Items:**\n1x <:PrestigePack:898709240837976064> Prestige Pack\n1x <:PrestigeCoin:899772669262700615> Prestige Coin\n\n**Earned Perks:**\n- Prestige badge in profile\n- Increased bank space gain rate from using <:BankNote:914902643531477002> Bank Notes\n- Coin Multiplier (+5% per prestige)`)
                    .setColor(0xFFD700)
                    .setFooter({ text: 'Omega when?' });

                await i.update({ embeds: [successEmbed], components: [] });
                collector.stop('success');

            } else if (i.customId === 'prestige_cancel') {
                await i.update({ embeds: [generateEmbed('cancelled')], components: [] });
                collector.stop('cancelled');
            } else if (i.customId === 'prestige_help') {
                const helpEmbed = new EmbedBuilder()
                    .setTitle('Prestige Information')
                    .setDescription('**What you LOSE:**\n- All coins in your wallet and bank\n- All unlocked levels and XP (Reset to 0)\n- Your current job and promotions\n- Bank space earned from leveling\n- Active items\n\n**What you KEEP:**\n- Inventory items\n- Friends list\n- Work history/stars\n- Daily streak\n- Max bank storage from Bank Notes\n- Command history\n- Badges/Achievements\n\n**What you EARN:**\n- Prestige Icon\n- Prestige Pack & Coin\n- Coin Multiplier (+5%)\n- Faster bank space gain from levels')
                    .setColor(0x00AAFF);
                await i.reply({ embeds: [helpEmbed], flags: MessageFlags.Ephemeral });
            }
        });

        collector.on('end', async (c, reason) => {
            if (reason === 'time') {
                try {
                    await interaction.editReply({ embeds: [generateEmbed('timeout')], components: [] });
                } catch (e) {}
            }
        });
    }
};
