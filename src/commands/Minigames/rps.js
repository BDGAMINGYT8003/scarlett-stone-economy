const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Challenges a specified user to a game of Rock, Paper, Scissors with an optional currency wager.')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to challenge')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('wager')
                .setDescription('Amount of coins to wager')
                .setMinValue(1)
                .setRequired(false)),

    async execute(interaction) {
        const challenger = interaction.user;
        const target = interaction.options.getUser('opponent');
        const wager = interaction.options.getInteger('wager');

        // Validation Checks
        if (target.id === challenger.id) {
            const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("You can't challenge yourself!").setColor(0xFF0000).setFooter({ text: 'Lonely much?' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }
        if (target.bot) {
            const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("You can't challenge a bot!").setColor(0xFF0000).setFooter({ text: 'They cheat anyway' });
            return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
        }

        if (wager !== null) {
            const challengerData = db.getUser(challenger.id);
            const targetData = db.getUser(target.id);

            if ((challengerData.balance || 0) < wager) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("You don't have enough coins for that wager!").setColor(0xFF0000).setFooter({ text: 'Broke boy' });
                return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
            if ((targetData.balance || 0) < wager) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription(`${target} doesn't have enough coins to match that wager!`).setColor(0xFF0000).setFooter({ text: 'They broke' });
                return interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }
        }

        // Create Unique IDs to avoid COMPONENT_CUSTOM_ID_DUPLICATED
        const uid = interaction.id;
        const confirmId = `confirm_${uid}`;
        const cancelId = `cancel_${uid}`;
        const acceptId = `accept_${uid}`;
        const declineId = `decline_${uid}`;
        const rockId = `r_${uid}`;
        const paperId = `p_${uid}`;
        const scissorsId = `s_${uid}`;

        // Stage 1: Challenger's Confirmation
        const descText = wager !== null
            ? `${challenger}, are you sure you want to challenge ${target} to a game of Rock, Paper, Scissors for a wager of ֍ ${wager.toLocaleString()}?`
            : `${challenger}, are you sure you want to challenge ${target} to a competitive game of Rock, Paper, Scissors?`;

        const footerText = wager !== null
            ? 'Click the "Confirm" button to authorize the challenge.'
            : 'Click the "Confirm" button below to dispatch your challenge request.';

        const embed1 = new EmbedBuilder()
            .setTitle('Pending Confirmation')
            .setDescription(descText)
            .setFooter({ text: footerText })
            .setColor(0xFFFF00);

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(confirmId).setLabel('Confirm').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(cancelId).setLabel('Cancel').setStyle(ButtonStyle.Danger)
        );

        const response = await interaction.reply({ embeds: [embed1], components: [row1], fetchReply: true });

        const collector1 = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

        collector1.on('collect', async i => {
            if (i.user.id !== challenger.id) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            if (i.customId === cancelId) {
                const strikeEmbed = new EmbedBuilder(embed1.toJSON());
                strikeEmbed.setDescription(`~~${embed1.data.description}~~`);
                strikeEmbed.setTitle('Action Cancelled');
                strikeEmbed.setFooter({ text: 'Request cancelled' });
                strikeEmbed.setColor(0xFF0000);
                await i.update({ embeds: [strikeEmbed], components: [] });
                collector1.stop('cancelled');
                return;
            }

            if (i.customId === confirmId) {
                collector1.stop('confirmed');

                // Stage 2: Target's Acceptance
                const descText2 = wager !== null
                    ? `-# ${target}, ${challenger} has challenged you to a game of Rock, Paper, Scissors for a wager of ֍ ${wager.toLocaleString()}! Do you accept this high-stakes duel?`
                    : `-# ${target}, ${challenger} has stepped up and challenged you to a game of Rock, Paper, Scissors! Do you accept the challenge?`;

                const footerText2 = wager !== null
                    ? 'You have 30 seconds to accept.'
                    : 'You have exactly 30 seconds to accept this challenge.';

                const embed2 = new EmbedBuilder()
                    .setTitle('Challenge Received')
                    .setDescription(descText2)
                    .setFooter({ text: footerText2 })
                    .setColor(0xFFFF00);

                const row2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(acceptId).setLabel('Accept').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(declineId).setLabel('Decline').setStyle(ButtonStyle.Danger)
                );

                await i.update({ embeds: [embed2], components: [row2] });

                const collector2 = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

                collector2.on('collect', async targetInteraction => {
                    if (targetInteraction.user.id !== target.id) {
                        const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your command!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                        return targetInteraction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                    }

                    if (targetInteraction.customId === declineId) {
                        const strikeEmbed = new EmbedBuilder(embed2.toJSON());
                        strikeEmbed.setDescription(`~~${embed2.data.description}~~`);
                        strikeEmbed.setTitle('Action Cancelled');
                        strikeEmbed.setFooter({ text: 'Request cancelled' });
                        strikeEmbed.setColor(0xFF0000);
                        await targetInteraction.update({ embeds: [strikeEmbed], components: [] });
                        collector2.stop('declined');
                        return;
                    }

                    if (targetInteraction.customId === acceptId) {
                        collector2.stop('accepted');

                        // Double check balance if wager
                        if (wager !== null) {
                            const cData = db.getUser(challenger.id);
                            const tData = db.getUser(target.id);
                            if ((cData.balance || 0) < wager || (tData.balance || 0) < wager) {
                                const errorEmbed = new EmbedBuilder().setTitle('Action Cancelled').setDescription("Someone doesn't have enough coins anymore!").setColor(0xFF0000);
                                return targetInteraction.update({ embeds: [errorEmbed], components: [] });
                            }
                            // Deduct wagers
                            db.removeBalance(challenger.id, wager);
                            db.removeBalance(target.id, wager);
                            // Log the deduction
                            db.logTransaction(challenger.id, 'rps wager', { amount: -wager });
                            db.logTransaction(target.id, 'rps wager', { amount: -wager });
                        }

                        // Stage 3: Gameplay
                        let challengerMove = null;
                        let targetMove = null;

                        const descText3 = wager !== null
                            ? `The game has begun for a total pot of ֍ ${(2 * wager).toLocaleString()}! ${challenger}, please select your move below.`
                            : `The game has officially begun! ${challenger}, it is your turn to move. Please select your choice below.`;

                        const footerText3 = wager !== null
                            ? `Waiting for ${challenger.username} to choose...`
                            : `Waiting for ${challenger.username} to make a selection...`;

                        const gameEmbed = new EmbedBuilder()
                            .setTitle('Rock, Paper, Scissors')
                            .setDescription(descText3)
                            .setFooter({ text: footerText3 })
                            .setColor(0x0099FF);

                        const gameRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(rockId).setLabel('Rock').setStyle(ButtonStyle.Primary).setEmoji('🪨'),
                            new ButtonBuilder().setCustomId(paperId).setLabel('Paper').setStyle(ButtonStyle.Primary).setEmoji('📄'),
                            new ButtonBuilder().setCustomId(scissorsId).setLabel('Scissors').setStyle(ButtonStyle.Primary).setEmoji('✂️')
                        );

                        await targetInteraction.update({ embeds: [gameEmbed], components: [gameRow] });

                        const collector3 = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 30000 });

                        collector3.on('collect', async gameInteraction => {
                            // Turn 1: Challenger
                            if (!challengerMove) {
                                if (gameInteraction.user.id !== challenger.id) {
                                    const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your turn!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                                    return gameInteraction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                                }

                                if (gameInteraction.customId === rockId) challengerMove = 'Rock';
                                if (gameInteraction.customId === paperId) challengerMove = 'Paper';
                                if (gameInteraction.customId === scissorsId) challengerMove = 'Scissors';

                                const descText4 = wager !== null
                                    ? `A total of ֍ ${(2 * wager).toLocaleString()} is on the line! ${target}, please select your move below.`
                                    : `${challenger} has made their move! ${target}, it is your turn. Please select your choice below.`;

                                const footerText4 = wager !== null
                                    ? `Waiting for ${target.username} to choose...`
                                    : `Waiting for ${target.username} to make a selection...`;

                                const nextEmbed = new EmbedBuilder()
                                    .setTitle('Rock, Paper, Scissors')
                                    .setDescription(descText4)
                                    .setFooter({ text: footerText4 })
                                    .setColor(0x0099FF);

                                // Reset collector timer for the second player
                                collector3.resetTimer({ time: 30000 });
                                await gameInteraction.update({ embeds: [nextEmbed], components: [gameRow] });
                            }
                            // Turn 2: Target
                            else if (!targetMove) {
                                if (gameInteraction.user.id !== target.id) {
                                    const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your turn!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                                    return gameInteraction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
                                }

                                if (gameInteraction.customId === rockId) targetMove = 'Rock';
                                if (gameInteraction.customId === paperId) targetMove = 'Paper';
                                if (gameInteraction.customId === scissorsId) targetMove = 'Scissors';

                                collector3.stop('finished');

                                // Resolve game
                                let resultMsg = '';
                                let winner = null;
                                let quip = '';

                                if (challengerMove === targetMove) {
                                    resultMsg = `It's a tie! Both chose **${challengerMove}**.`;
                                    quip = 'Imagine tying in a 1/3 probability game. Smh.';
                                    if (wager !== null) {
                                        // Refund
                                        db.addBalance(challenger.id, wager);
                                        db.addBalance(target.id, wager);
                                        db.logTransaction(challenger.id, 'rps refund', { amount: wager });
                                        db.logTransaction(target.id, 'rps refund', { amount: wager });
                                        resultMsg += `\nThe wagers of ֍ ${wager.toLocaleString()} have been refunded.`;
                                    }
                                } else if (
                                    (challengerMove === 'Rock' && targetMove === 'Scissors') ||
                                    (challengerMove === 'Paper' && targetMove === 'Rock') ||
                                    (challengerMove === 'Scissors' && targetMove === 'Paper')
                                ) {
                                    winner = challenger;
                                    resultMsg = `${challenger} wins with **${challengerMove}** against **${targetMove}**!`;
                                    quip = 'Absolute skill issue on their part.';
                                } else {
                                    winner = target;
                                    resultMsg = `${target} wins with **${targetMove}** against **${challengerMove}**!`;
                                    quip = 'Absolute skill issue on their part.';
                                }

                                if (winner && wager !== null) {
                                    const pot = wager * 2;
                                    db.addBalance(winner.id, pot);
                                    db.logTransaction(winner.id, 'rps win', { amount: pot });
                                    resultMsg += `\n**${winner.username}** won the total pot of ֍ ${pot.toLocaleString()}!`;
                                }

                                const finalEmbed = new EmbedBuilder()
                                    .setTitle('Rock, Paper, Scissors')
                                    .setDescription(`${resultMsg}\n\n-# ${quip}`)
                                    .setColor(0x00FF00);

                                await gameInteraction.update({ embeds: [finalEmbed], components: [] });
                            }
                        });

                        collector3.on('end', async (c, reason) => {
                            if (reason === 'time') {
                                let culprit = !challengerMove ? challenger : target;
                                let winner = !challengerMove ? target : challenger;

                                let resultMsg = `${culprit} took too long to make a move and forfeited the game!`;
                                let quip = 'Too slow.';

                                if (wager !== null) {
                                    const pot = wager * 2;
                                    db.addBalance(winner.id, pot);
                                    db.logTransaction(winner.id, 'rps win (forfeit)', { amount: pot });
                                    resultMsg += `\n\n${winner} wins by default and takes the total pot of ֍ ${pot.toLocaleString()}!`;
                                    quip = 'Free money is the best kind of money.';
                                } else {
                                    resultMsg += `\n\n${winner} wins by default!`;
                                }

                                const timeoutEmbed = new EmbedBuilder()
                                    .setTitle('Rock, Paper, Scissors - Forfeit')
                                    .setDescription(`${resultMsg}\n\n-# ${quip}`)
                                    .setColor(0x00FF00);

                                try { await interaction.editReply({ embeds: [timeoutEmbed], components: [] }); } catch (e) {}
                            }
                        });

                    }
                });

                collector2.on('end', async (c, reason) => {
                    if (reason === 'time') {
                        const strikeEmbed = new EmbedBuilder(embed2.toJSON());
                        strikeEmbed.setDescription(`~~${embed2.data.description}~~`);
                        strikeEmbed.setTitle('Action Timed Out');
                        strikeEmbed.setFooter({ text: 'Request timed out' });
                        strikeEmbed.setColor(0xFF0000);
                        try { await interaction.editReply({ embeds: [strikeEmbed], components: [] }); } catch(e){}
                    }
                });

            }
        });

        collector1.on('end', async (c, reason) => {
            if (reason === 'time') {
                const strikeEmbed = new EmbedBuilder(embed1.toJSON());
                strikeEmbed.setDescription(`~~${embed1.data.description}~~`);
                strikeEmbed.setTitle('Action Timed Out');
                strikeEmbed.setFooter({ text: 'Request timed out' });
                strikeEmbed.setColor(0xFF0000);
                try { await interaction.editReply({ embeds: [strikeEmbed], components: [] }); } catch(e){}
            }
        });
    },
};
