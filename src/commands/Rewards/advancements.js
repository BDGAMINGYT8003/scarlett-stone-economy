const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const levelsConfig = require('../../config/levels.json');
const itemsConfig = require('../../config/items.json');

const ITEMS_PER_PAGE = 5;

// Emojis
const REPLY = '<:Reply:1457839486011445391>';
const REPLY_CONT = '<:ReplyCont:1457839483541127208>';
const CY = '<:CY:1458227576492392540>'; // Using new ID from memory (anti-hallucination protocol compliant)
// Wait, prompt specific embed used `1071484103762915348`.
// The PROMPT explicitly says:
// "**<:CY:1071484103762915348> Level 1**"
// BUT Step 5 of the prompt says: "Exclusively use the custom bot emojis provided: <:CY:1458227576492392540>".
// Step 5 overrides the visual example in the description?
// "Deeply scan... prevent abuse... Here is how the embed... should look" -> uses old ID.
// "5. Final Visual Check ... Exclusively use the custom bot emojis provided: ... 1458..."
// I will use the NEW ID (1458...) because Step 5 is a constraint on visual check and "Exclusively use".
// The example probably used old IDs for illustration.

const CY_FINAL = '<:CY:1458227576492392540>';
// CX is not used in the success list usually, but if we show locked levels?
// The example shows unlocked levels I presume? Or all?
// "Your current level is X".
// Example shows Level 1, 2, 3, 4, 5.
// If I am level 325, do I show 1-5? Or 321-325? Or just page 1?
// Usually paginated lists start at 1.
// Visual indicator: The example shows CY for all levels 1-5.
// If I am level X, previous levels are unlocked (CY). Future levels are likely Locked (CX)?
// The example doesn't show CX. But standard "Advancements" UI usually shows lock status.
// I will use CY for unlocked, CX for locked.

const CX_FINAL = '<:CX:1458227573950775577>';

// Navigation Emojis
const PREV_EMOJI = '<:SingleArrowLeft:1458212849305387069>';
const NEXT_EMOJI = '<:SingleArrowRight:1458212847157903565>';
const REFRESH_EMOJI = '<:Refresh:1458212851637420224>';
const FIRST_EMOJI = '<:DoubleArrowLeft:1458212845161283677>';
const LAST_EMOJI = '<:DoubleArrowRight:1446611400251281542>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('advancements')
        .setDescription('View your progress and rewards.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('levels')
                .setDescription('View level rewards.')),

    async execute(interaction) {
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
                        const name = itemRef ? `${itemRef.emoji} ${itemRef.name}` : i.id; // Fallback
                        rewards.push(`${i.amount} ${name}`); // Example: "1 Life Saver"
                        // Wait, example says "1 <emoji> Life Saver".
                        // My loop logic: `${i.amount} ${name}` -> "1 <emoji> Life Saver". Correct.
                    });
                }

                // Formatting lines with emojis
                // Example:
                // <:ReplyCont:...> Reward 1
                // <:Reply:...> Reward 2

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
            if (i.customId === 'refresh_levels') {
                // re-render
            }

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: getComponents(currentPage)
            });
        });
    },
};
