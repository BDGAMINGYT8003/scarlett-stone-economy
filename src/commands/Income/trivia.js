const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const { getTriviaQuestion } = require('../../utils/triviaManager');
const multiplier = require('../../utils/multiplier');

// Scenarios for outcomes
const WIN_SCENARIOS = {
    COIN_ONLY: [
        "You're smarter than you look! Here's **{coins}** ֍.",
        "Wow, you actually knew that? Take **{coins}** ֍.",
        "Correct! Don't spend this **{coins}** ֍ all in one place."
    ],
    TROPHY_ONLY: [
        "You won a shiny **Trivia Trophy**! No coins though, sad.",
        "A trophy for your troubles: **Trivia Trophy**!",
        "Smarty pants! You earned a **Trivia Trophy**."
    ],
    BOTH: [
        "JACKPOT! You got **{coins}** ֍ AND a **Trivia Trophy**!",
        "Double trouble! **{coins}** ֍ and a **Trivia Trophy** for you.",
        "Look at you go! **{coins}** ֍ plus a **Trivia Trophy**."
    ]
};

const LOSE_SCENARIOS = [
    "Wow, that was embarrassing. The answer was **{answer}**.",
    "Back to school for you. It was **{answer}**.",
    "Did you even try? **{answer}** was the correct one.",
    "Nope. Not even close. **{answer}**.",
    "Imagine getting this wrong. **{answer}**.",
    "Are you guessing? Because the answer was **{answer}**."
];

const TIMEOUT_SCENARIOS = [
    "Cat got your tongue? Or just slow?",
    "Too slow! Wake up!",
    "Time's up! Were you Googling it?",
    "Zzz... oh, time's up.",
    "You missed the bus. Too late.",
    "Silence is not an answer here."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Play a game of trivia for coins and prizes.'),
    async execute(interaction) {
        // Cooldown handled by system or we can add manual check if needed, but standard is fine.

        const questionData = getTriviaQuestion();

        if (!questionData) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('Trivia Unavailable')
                .setDescription('The trivia API is currently resting. Please try again in a few seconds!')
                .setFooter({ text: 'Dank Memer', iconURL: 'https://i.imgur.com/7R8Y8bC.png' });
            return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }

        // Prepare Answers
        const answers = [...questionData.incorrect_answers, questionData.correct_answer];
        // Shuffle
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }

        const buttons = answers.map((ans, index) =>
            new ButtonBuilder()
                .setCustomId(`trivia_${index}`)
                .setLabel(ans.length > 80 ? ans.substring(0, 77) + '...' : ans)
                .setStyle(ButtonStyle.Primary)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('You have 10 seconds to answer')
            .setDescription(`> **${questionData.question}**`)
            .addFields(
                { name: 'Difficulty', value: questionData.difficulty, inline: true },
                { name: 'Category', value: questionData.category, inline: true }
            )
            .setFooter({ text: 'Dank Memer', iconURL: 'https://i.imgur.com/7R8Y8bC.png' });

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        const startTime = Date.now();

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 10000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: "This isn't your game!", ephemeral: true });
            }

            const selectedIndex = parseInt(i.customId.split('_')[1]);
            const selectedAnswer = answers[selectedIndex];
            const isCorrect = selectedAnswer === questionData.correct_answer;
            const timeTaken = (Date.now() - startTime) / 1000;
            const timeLeft = Math.max(0, 10 - timeTaken).toFixed(1);

            let resultEmbedContent = '';
            let rewardsText = '';
            let rewardItems = [];
            let rewardAmount = 0;

            if (isCorrect) {
                // Determine Reward
                const isTrophy = Math.random() < 0.2; // 20% chance for trophy
                const isBoth = isTrophy && Math.random() < 0.1; // If trophy, 10% chance for both (Total 2% for both)

                // Adjust logic to match requirements strictly:
                // "1x Trophy OR 1000-1500 coins OR Both"
                // Let's use a simpler distribution:
                // 40% Coins Only
                // 40% Trophy Only
                // 20% Both
                // Wait, usually coins are common. Let's do:
                // 60% Coins Only
                // 30% Trophy Only
                // 10% Both

                const roll = Math.random();
                let scenario = 'COIN_ONLY';

                if (roll < 0.60) scenario = 'COIN_ONLY';
                else if (roll < 0.90) scenario = 'TROPHY_ONLY';
                else scenario = 'BOTH';

                // Calculate Coins
                let baseCoins = Math.floor(Math.random() * (1500 - 1000 + 1)) + 1000;
                const multi = multiplier.calculateMultiplier(interaction.user.id);
                if (scenario !== 'TROPHY_ONLY') {
                    rewardAmount = Math.floor(baseCoins * (1 + (multi / 100)));
                }

                if (scenario === 'TROPHY_ONLY' || scenario === 'BOTH') {
                    rewardItems.push('trivia_trophy');
                    db.addItem(interaction.user.id, 'trivia_trophy', 1);
                }

                if (rewardAmount > 0) {
                    db.addBalance(interaction.user.id, rewardAmount);
                }

                // Log Transaction
                if (rewardAmount > 0 || rewardItems.length > 0) {
                     db.logTransaction(interaction.user.id, 'trivia', {
                        amount: rewardAmount,
                        items: rewardItems
                     });

                     // Stats
                     db.incrementStat(interaction.user.id, 'trivia_wins');
                     // Profit XP (Win)
                     db.addXp(interaction.user.id, 2);
                }

                // Build Message
                let msg = "";
                if (scenario === 'COIN_ONLY') msg = WIN_SCENARIOS.COIN_ONLY[Math.floor(Math.random() * WIN_SCENARIOS.COIN_ONLY.length)];
                if (scenario === 'TROPHY_ONLY') msg = WIN_SCENARIOS.TROPHY_ONLY[Math.floor(Math.random() * WIN_SCENARIOS.TROPHY_ONLY.length)];
                if (scenario === 'BOTH') msg = WIN_SCENARIOS.BOTH[Math.floor(Math.random() * WIN_SCENARIOS.BOTH.length)];

                msg = msg.replace('{coins}', rewardAmount.toLocaleString());
                rewardsText = msg;

                resultEmbedContent = `You got that answer correct know-it-all, you also got **${rewardsText}**`;
                if (multi > 0 && rewardAmount > 0) {
                    resultEmbedContent += `\nMulti Bonus: +${multi}%`;
                }
            } else {
                const msg = LOSE_SCENARIOS[Math.floor(Math.random() * LOSE_SCENARIOS.length)];
                resultEmbedContent = `No twit, the correct answer was **${questionData.correct_answer}**`;
                // Loss XP
                db.addXp(interaction.user.id, 1);
            }

            // Update Embed
            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? 0x00FF00 : 0xFF0000)
                .setTitle(isCorrect ? `You had ${timeLeft} seconds left to answer...` : `You had ${timeLeft} seconds left to answer correctly...`)
                .setDescription(`> **${questionData.question}**`)
                .addFields(
                    { name: 'Difficulty', value: questionData.difficulty, inline: true },
                    { name: 'Category', value: questionData.category, inline: true }
                )
                .setFooter({ text: 'Dank Memer', iconURL: 'https://i.imgur.com/7R8Y8bC.png' });

            // Middle Embed (Wait, Discord doesn't support "Middle Embed" strictly, it's just multiple embeds or description).
            // "Middle Embed (Content Only)" likely implies a second embed in the array.
            const middleEmbed = new EmbedBuilder()
                .setColor(isCorrect ? 0x00FF00 : 0xFF0000)
                .setDescription(`> ${resultEmbedContent}`);

            // Update Buttons
            const newButtons = answers.map((ans, index) => {
                const btn = new ButtonBuilder()
                    .setCustomId(`trivia_end_${index}`)
                    .setLabel(ans.length > 80 ? ans.substring(0, 77) + '...' : ans)
                    .setDisabled(true);

                if (ans === questionData.correct_answer) {
                    btn.setStyle(ButtonStyle.Success);
                } else if (ans === selectedAnswer && !isCorrect) {
                    btn.setStyle(ButtonStyle.Danger);
                } else {
                    btn.setStyle(ButtonStyle.Secondary);
                }
                return btn;
            });

            const newRow = new ActionRowBuilder().addComponents(newButtons);

            await i.update({ embeds: [resultEmbed, middleEmbed], components: [newRow] });
            collector.stop('answered');
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const msg = TIMEOUT_SCENARIOS[Math.floor(Math.random() * TIMEOUT_SCENARIOS.length)];

                const timeOutEmbed = new EmbedBuilder()
                    .setColor(0x808080)
                    .setTitle('You had 10 seconds to answer...')
                    .setDescription(`> **${questionData.question}**`)
                    .addFields(
                        { name: 'Difficulty', value: questionData.difficulty, inline: true },
                        { name: 'Category', value: questionData.category, inline: true }
                    )
                    .setFooter({ text: 'Dank Memer', iconURL: 'https://i.imgur.com/7R8Y8bC.png' });

                const middleEmbed = new EmbedBuilder()
                    .setColor(0x808080)
                    .setDescription(`> ${msg}`);

                const disabledButtons = answers.map((ans, index) =>
                    new ButtonBuilder()
                        .setCustomId(`trivia_to_${index}`)
                        .setLabel(ans.length > 80 ? ans.substring(0, 77) + '...' : ans)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );

                const newRow = new ActionRowBuilder().addComponents(disabledButtons);

                try {
                    await interaction.editReply({ embeds: [timeOutEmbed, middleEmbed], components: [newRow] });
                } catch (e) {
                    // Message might be deleted
                }
            }
        });
    },
};
