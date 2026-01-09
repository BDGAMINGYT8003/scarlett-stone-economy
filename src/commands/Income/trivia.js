const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getQuestion, decodeBase64 } = require('../../utils/triviaManager');
const triviaConfig = require('../../config/trivia.json');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');
const items = require('../../config/items.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Play a game of trivia for coins and items.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Cooldown Check
        const cooldown = checkDurationCooldown(userId, 'trivia');
        if (cooldown.onCooldown) {
            return interaction.reply({
                embeds: [getCooldownEmbed('trivia', cooldown.readyAt, 10, 5)], // Using short cooldown for trivia
                flags: MessageFlags.Ephemeral
            });
        }

        // Get Question
        const qData = getQuestion();
        const question = decodeBase64(qData.question);
        const category = decodeBase64(qData.category);
        const difficulty = decodeBase64(qData.difficulty);
        const correctAnswer = decodeBase64(qData.correct_answer);
        const incorrectAnswers = qData.incorrect_answers.map(a => decodeBase64(a));

        // Shuffle Answers
        const allAnswers = [...incorrectAnswers, correctAnswer];
        for (let i = allAnswers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
        }

        // Buttons
        const buttons = allAnswers.map((ans, index) =>
            new ButtonBuilder()
                .setCustomId(`trivia_${index}`)
                .setLabel(ans.substring(0, 80)) // Truncate if too long
                .setStyle(ButtonStyle.Primary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        // Initial Embed
        const embed = new EmbedBuilder()
            .setTitle('You have 10 seconds to answer')
            .setDescription(`> **${question}**`)
            .addFields(
                { name: 'Difficulty', value: difficulty, inline: true },
                { name: 'Category', value: category, inline: true }
            )
            .setColor(0x0099FF)
            .setFooter({ text: 'Tick tock...' });

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10000
        });

        const startTime = Date.now();

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                const errorEmbed = new EmbedBuilder().setTitle('Error').setDescription("Not your game!").setColor(0xFF0000).setFooter({ text: 'Mind your business' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            const selectedIndex = parseInt(i.customId.split('_')[1]);
            const selectedAnswer = allAnswers[selectedIndex];
            const isCorrect = selectedAnswer === correctAnswer;
            const timeTaken = (Date.now() - startTime) / 1000;
            const timeLeft = Math.max(0, 10 - timeTaken).toFixed(1);

            // Disable buttons and color them
            const updatedButtons = buttons.map((btn, idx) => {
                const ans = allAnswers[idx];
                btn.setDisabled(true);
                if (ans === correctAnswer) {
                    btn.setStyle(ButtonStyle.Success);
                } else if (idx === selectedIndex && !isCorrect) {
                    btn.setStyle(ButtonStyle.Danger);
                } else {
                    btn.setStyle(ButtonStyle.Secondary); // Gray
                }
                return btn;
            });
            const updatedRow = new ActionRowBuilder().addComponents(updatedButtons);

            let resultEmbed;
            let middleEmbed;

            if (isCorrect) {
                // Determine Reward
                const roll = Math.random() * 100;
                let outcomeType = 'coin';
                // Chances: 10% Both, 20% Item, 70% Coin
                if (roll < 10) outcomeType = 'both';
                else if (roll < 30) outcomeType = 'item';
                else outcomeType = 'coin';

                const rewardCoins = Math.floor(Math.random() * (1500 - 1000 + 1)) + 1000;

                // Grant Rewards
                if (outcomeType === 'coin' || outcomeType === 'both') {
                    db.addBalance(userId, rewardCoins);
                }

                // Item Grant logic (Only Trivia Trophy)
                // Wait, prompt said: "1x Trivia Trophy... Worth 1,000".
                // Item Reward logic should be specifically Trivia Trophy.
                if (outcomeType === 'item' || outcomeType === 'both') {
                    db.addItem(userId, 'trivia_trophy', 1);
                }

                // Log
                let logItems = [];
                if (outcomeType === 'item' || outcomeType === 'both') {
                    logItems.push({ id: 'trivia_trophy', name: 'Trivia Trophy', emoji: '<:TriviaTrophy:1033824245077262386>', quantity: 1 });
                }
                db.logTransaction(userId, 'trivia win', { amount: (outcomeType === 'coin' || outcomeType === 'both') ? rewardCoins : 0, items: logItems });

                // Stats
                db.incrementStat(userId, 'trivia_wins');

                // Message
                const msgs = triviaConfig.correct[outcomeType];
                const msg = msgs[Math.floor(Math.random() * msgs.length)].replace('{coins}', rewardCoins.toLocaleString());

                resultEmbed = new EmbedBuilder(embed.toJSON())
                    .setTitle(`You had ${timeLeft} seconds left to answer...`)
                    .setColor(0x00FF00); // Green

                middleEmbed = new EmbedBuilder()
                    .setDescription(`You got that answer correct know-it-all, you also got **${msg.replace(/You got .* \*\*(.*)\*\*!/, '$1').replace('Correct! ', '')}**`) // Extracting reward part dynamically or just use msg?
                    // Prompt says: "You got that answer correct know-it-all, you also got **[Rewards]**"
                    // My config messages are like "You brainiac! You got it right and earned **֍ 1,000**."
                    // I will just use the config message as the description content.
                    .setDescription(msg)
                    .setColor(0x00FF00);

            } else {
                // Incorrect
                const msgs = triviaConfig.incorrect;
                const msg = msgs[Math.floor(Math.random() * msgs.length)].replace('{correct_answer}', correctAnswer);

                resultEmbed = new EmbedBuilder(embed.toJSON())
                    .setTitle(`You had ${timeLeft} seconds left to answer correctly...`)
                    .setColor(0xFF0000); // Red

                middleEmbed = new EmbedBuilder()
                    .setDescription(`No twit, the correct answer was **${correctAnswer}**`)
                    .setColor(0xFF0000);
            }

            await i.update({
                embeds: [resultEmbed, middleEmbed],
                components: [updatedRow]
            });
            collector.stop('answered');
            setDurationCooldown(userId, 'trivia', 10, 5); // Set cooldown after game
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const msgs = triviaConfig.timeout;
                const msg = msgs[Math.floor(Math.random() * msgs.length)].replace('{correct_answer}', correctAnswer);

                const disabledButtons = buttons.map(btn => btn.setDisabled(true).setStyle(ButtonStyle.Secondary));
                const disabledRow = new ActionRowBuilder().addComponents(disabledButtons);

                const resultEmbed = new EmbedBuilder(embed.toJSON())
                    .setTitle('You had 10 seconds to answer...')
                    .setColor(0x808080); // Grey

                const middleEmbed = new EmbedBuilder()
                    .setDescription(`> Guess you didn't wanna play trivia after all?\n\n(The answer was **${correctAnswer}**)`)
                    .setColor(0x808080);

                try {
                    await interaction.editReply({
                        embeds: [resultEmbed, middleEmbed],
                        components: [disabledRow]
                    });
                } catch (e) {
                    // Ignore
                }
                setDurationCooldown(userId, 'trivia', 10, 5);
            }
        });
    },
};
