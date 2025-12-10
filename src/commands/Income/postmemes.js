const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const items = require('../../config/items.json');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

// Loot Tables & Configuration
const PLATFORMS = {
    TikTok: {
        id: 'tiktok',
        outcomes: [
            { type: 'jackpot', chance: 0.5, min: 1800, max: 6500, items: ['diamond', 'bank_note', 'ancient_coin'] },
            { type: 'rare', chance: 3, min: 1200, max: 2800, items: ['adventure_ticket', 'adventure_ticket'] },
            { type: 'uncommon', chance: 8, min: 400, max: 1200, items: ['hunting_rifle', 'ancient_coin'] },
            { type: 'dead', chance: 20 },
            { type: 'fail', chance: 25.5 },
            { type: 'common', chance: 43, min: 150, max: 400, items: ['apple', 'laptop'] }
        ]
    },
    Discord: {
        id: 'discord',
        outcomes: [
            { type: 'jackpot', chance: 2, min: 5000, max: 10000, items: ['diamond', 'bank_note', 'laptop'] },
            { type: 'rare', chance: 3, min: 1000, max: 5000, items: ['padlock', 'adventure_ticket', 'pizza'] },
            { type: 'uncommon', chance: 7, min: 500, max: 1000, items: ['hunting_rifle', 'alcohol'] },
            { type: 'dead', chance: 20 },
            { type: 'fail', chance: 25 },
            { type: 'common', chance: 43, min: 250, max: 600, items: ['apple', 'bank_note', 'apple', 'adventure_ticket'] }
        ]
    },
    Reddit: {
        id: 'reddit',
        outcomes: [
            { type: 'jackpot', chance: 1.5, min: 1500, max: 5500, items: ['trash', 'padlock', 'pizza'] },
            { type: 'rare', chance: 12, min: 800, max: 2200, items: ['camera', 'mouse', 'trash'] },
            { type: 'fail', chance: 22 },
            { type: 'dead', chance: 25 },
            { type: 'common', chance: 39.5, min: 550, max: 800, items: ['padlock', 'bank_note', 'apple', 'apple', 'keyboard'] }
        ]
    },
    Twitter: {
        id: 'twitter',
        outcomes: [
            { type: 'jackpot', chance: 2, min: 3500, max: 4500, items: ['ancient_coin', 'laptop'] },
            { type: 'rare', chance: 9, min: 1000, max: 2300, items: ['camera', 'keyboard', 'trash', 'trash', 'beggars_bowl'] },
            { type: 'dead', chance: 20 },
            { type: 'fail', chance: 20 },
            { type: 'common', chance: 49, min: 550, max: 900, items: ['bank_note', 'adventure_ticket', 'padlock'] }
        ]
    },
    Facebook: {
        id: 'facebook',
        outcomes: [
            { type: 'jackpot', chance: 2, min: 1500, max: 3500, items: ['bank_note', 'trash', 'trash', 'fishing_pole'] },
            { type: 'rare', chance: 9, min: 600, max: 1300, items: ['mouse', 'trash', 'trash', 'ancient_coin'] },
            { type: 'dead', chance: 15 },
            { type: 'fail', chance: 35 },
            { type: 'common', chance: 39, min: 300, max: 600, items: ['trash', 'adventure_ticket', 'apple'] }
        ]
    }
};

const PHRASES = {
    success: [
        "Your meme went viral on {platform}!",
        "The people of {platform} loved your {type} meme.",
        "Stonks! Your meme is trending on {platform}.",
        "You posted a {type} meme on {platform} and everyone liked it."
    ],
    fail: [
        "Your meme died in new on {platform}.",
        "Nobody liked your {type} meme on {platform}.",
        "You got zero likes. Ouch.",
        "Maybe try being funny next time?"
    ],
    dead: [
        "Your meme was so bad you got banned from {platform} for 3 minutes.",
        "Cringe. Absolute cringe. You are timed out.",
        "Everyone hated your {type} meme. Go sit in the corner.",
        "You posted a dead meme and now you are dead to us (for 3 mins)."
    ]
};

const getRandomPhrase = (type, platform, memeType) => {
    const list = PHRASES[type];
    const raw = list[Math.floor(Math.random() * list.length)];
    return raw.replace('{platform}', platform).replace('{type}', memeType);
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postmemes')
        .setDescription('Post a meme to earn money (requires a Laptop).'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // 1. Check for Laptop
        const laptopCount = db.getItemCount(userId, 'laptop');
        if (laptopCount <= 0) {
            const embed = new ContainerBuilder()
                .setColor(Colors.Red)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('# Missing Item\nYou need a **💻 Laptop** to post memes!')
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('Buy one from the shop or find one!'));
            return interaction.reply({ components: [embed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }

        // 2. Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'postmemes');
        if (cooldown.onCooldown) {
            return interaction.reply({
                components: [getCooldownEmbed('postmemes', cooldown.readyAt, 35, 12)],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        // 3. Initial Interface
        const embed = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Meme Posting Session\n**Pick a meme type and a platform to post a meme on!**\nHopefully people will like it and give you some $$$$ and loot, but it's also possible they hate it and your cooldown to posting a new meme rises to THREE MINUTES!`)
            )
            .addTextDisplayComponents(new TextDisplayBuilder().setContent('(Select options below)'))
            .setColor(0x0099FF);

        const platformSelect = new StringSelectMenuBuilder()
            .setCustomId('postmeme_platform')
            .setPlaceholder('Select a platform')
            .addOptions(
                { label: 'TikTok', value: 'TikTok' },
                { label: 'Discord', value: 'Discord' },
                { label: 'Reddit', value: 'Reddit' },
                { label: 'Twitter', value: 'Twitter' },
                { label: 'Facebook', value: 'Facebook' }
            );

        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('postmeme_type')
            .setPlaceholder('Select a meme type')
            .addOptions(
                { label: 'Fresh', value: 'Fresh' },
                { label: 'Repost', value: 'Repost' },
                { label: 'Intellectual', value: 'Intellectual' },
                { label: 'Copypasta', value: 'Copypasta' },
                { label: 'Cooked', value: 'Cooked' }
            );

        const postButton = new ButtonBuilder()
            .setCustomId('postmeme_post')
            .setLabel('Post')
            .setStyle(ButtonStyle.Secondary);

        const row1 = new ActionRowBuilder().addComponents(platformSelect);
        const row2 = new ActionRowBuilder().addComponents(typeSelect);
        const row3 = new ActionRowBuilder().addComponents(postButton);

        embed.addActionRowComponents(row1, row2, row3);

        const response = await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === interaction.user.id,
            time: 60000
        });

        let selectedPlatform = null;
        let selectedType = null;

        collector.on('collect', async i => {
            if (i.customId === 'postmeme_platform') {
                selectedPlatform = i.values[0];
                await i.deferUpdate();
            } else if (i.customId === 'postmeme_type') {
                selectedType = i.values[0];
                await i.deferUpdate();
            } else if (i.customId === 'postmeme_post') {
                if (!selectedPlatform || !selectedType) {
                    const errorEmbed = new ContainerBuilder()
                        .setColor(Colors.Red)
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Missing Selection\nPlease select both a Platform and a Meme Type first.'));
                    return i.reply({ components: [errorEmbed], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                }

                // Logic
                const platformData = PLATFORMS[selectedPlatform];
                const roll = Math.random() * 100;
                let cumulativeChance = 0;
                let outcome = null;

                for (const o of platformData.outcomes) {
                    cumulativeChance += o.chance;
                    if (roll <= cumulativeChance) {
                        outcome = o;
                        break;
                    }
                }

                if (!outcome) outcome = platformData.outcomes[platformData.outcomes.length - 1]; // Fallback

                let finalEmbed = new ContainerBuilder();
                let buttonStyle;
                let cooldownTime = 35; // Default
                let premiumCooldownTime = 12; // Premium

                if (outcome.type === 'dead') {
                    // Dead Meme
                    cooldownTime = 180; // 3 minutes
                    premiumCooldownTime = 180;
                    finalEmbed
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Meme Posting Session\n${getRandomPhrase('dead', selectedPlatform, selectedType)}\n\n**You posted a dead meme, you cannot post another meme for another 3 minutes**`),
                            new TextDisplayBuilder().setContent('RIP your career')
                        )
                        .setColor(0xFF0000);
                    buttonStyle = ButtonStyle.Danger;

                } else if (outcome.type === 'fail') {
                    // Fail
                    finalEmbed
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Meme Posting Session\n${getRandomPhrase('fail', selectedPlatform, selectedType)}`),
                            new TextDisplayBuilder().setContent('Better luck next time')
                        )
                        .setColor(0xFF0000);
                    buttonStyle = ButtonStyle.Danger;

                } else {
                    // Success (Common, Uncommon, Rare, Jackpot)
                    let wonMoney = 0;
                    let wonItem = null;

                    // 30% chance for item if available in outcome pool
                    const isItem = (outcome.items && outcome.items.length > 0 && Math.random() < 0.3);

                    if (isItem) {
                        const itemId = outcome.items[Math.floor(Math.random() * outcome.items.length)];
                        const itemObj = items.find(it => it.id === itemId);
                        if (itemObj) {
                            wonItem = itemObj;
                            db.addItem(userId, itemObj.id, 1);
                        } else {
                            // Fallback if item not found
                            wonMoney = Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min;
                            db.addBalance(userId, wonMoney);
                        }
                    } else {
                        wonMoney = Math.floor(Math.random() * (outcome.max - outcome.min + 1)) + outcome.min;
                        db.addBalance(userId, wonMoney);
                    }

                    let desc = `${getRandomPhrase('success', selectedPlatform, selectedType)}\n\n**You Received:**\n`;
                    if (wonMoney > 0) desc += `- ֍ ${wonMoney.toLocaleString()}\n`;
                    if (wonItem) desc += `- 1 ${wonItem.emoji} ${wonItem.name}\n`;

                    finalEmbed
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Meme Posting Session\n${desc}`),
                            new TextDisplayBuilder().setContent('Meme Lord Status: Rising')
                        )
                        .setColor(0x00FF00);
                    buttonStyle = ButtonStyle.Success;
                }

                setDurationCooldown(userId, 'postmemes', cooldownTime, premiumCooldownTime);

                // Disable all
                const disabledRow1 = new ActionRowBuilder().addComponents(
                    platformSelect.setDisabled(true)
                );
                const disabledRow2 = new ActionRowBuilder().addComponents(
                    typeSelect.setDisabled(true)
                );
                const disabledRow3 = new ActionRowBuilder().addComponents(
                    postButton.setDisabled(true).setStyle(buttonStyle)
                );

                finalEmbed.addActionRowComponents(disabledRow1, disabledRow2, disabledRow3);

                await i.update({
                    components: [finalEmbed]
                });

                collector.stop('completed');
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const timeoutEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Session Expired\nYou took too long to post a meme!'))
                    .setColor(0xFF0000);

                const disabledRow1 = new ActionRowBuilder().addComponents(platformSelect.setDisabled(true));
                const disabledRow2 = new ActionRowBuilder().addComponents(typeSelect.setDisabled(true));
                const disabledRow3 = new ActionRowBuilder().addComponents(postButton.setDisabled(true));

                timeoutEmbed.addActionRowComponents(disabledRow1, disabledRow2, disabledRow3);

                try {
                    await interaction.editReply({
                        components: [timeoutEmbed]
                    });
                } catch (e) {
                    // Ignore
                }
            }
        });
    },
};
