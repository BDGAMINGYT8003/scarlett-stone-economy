const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('highlow')
        .setDescription('Guess if the secret number is higher or lower!'),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'highlow');
        if (cooldown.onCooldown) {
            return interaction.reply({
                components: [getCooldownEmbed('highlow', cooldown.readyAt, 30, 30)], // Cooldown: 30s
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        // Generate numbers
        const hint = Math.floor(Math.random() * 100) + 1;
        const secret = Math.floor(Math.random() * 100) + 1;

        const embed = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# Higher or Lower?\nA secret number between 1 and 100 has been chosen.\nYour hint is **${hint}**.\n\nIs the secret number *higher* or *lower* than ${hint}?`)
            )
            .setColor(0x0099FF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('hl_lower').setLabel('Lower').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('hl_jackpot').setLabel('Jackpot').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('hl_higher').setLabel('Higher').setStyle(ButtonStyle.Primary)
        );
        embed.addActionRowComponents(row);

        const response = await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2,
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const error = new ContainerBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent('Not your game.'));
                return i.reply({ components: [error], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            let win = false;
            let jackpot = false;
            const choice = i.customId.replace('hl_', '');

            if (choice === 'lower' && secret < hint) win = true;
            if (choice === 'higher' && secret > hint) win = true;
            if (choice === 'jackpot' && secret === hint) {
                win = true;
                jackpot = true;
            }

            // Payouts
            let amount = 0;
            if (win) {
                if (jackpot) {
                    amount = Math.floor(Math.random() * (150000 - 100000 + 1)) + 100000;
                } else {
                    amount = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
                }
                db.addBalance(userId, amount);
            }

            setDurationCooldown(userId, 'highlow', 30, 30);

            // Update UI
            const finalEmbed = new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Higher or Lower?\nThe secret number was **${secret}**.`));

            if (win) {
                finalEmbed.setColor(0x00FF00); // Green
                finalEmbed.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You guessed correctly!\nYou won **֍ ${amount.toLocaleString()}**!`));
            } else {
                finalEmbed.setColor(0xFF0000); // Red
                finalEmbed.addTextDisplayComponents(new TextDisplayBuilder().setContent(`You guessed wrong!\nYou won nothing.`));
            }

            const updatedButtons = row.components.map(btn => {
                btn.setDisabled(true);
                // Highlight correct/incorrect
                if (btn.data.custom_id === i.customId) {
                    btn.setStyle(win ? ButtonStyle.Success : ButtonStyle.Danger);
                } else {
                    btn.setStyle(ButtonStyle.Secondary);
                }
                return btn;
            });

            finalEmbed.addActionRowComponents(new ActionRowBuilder().addComponents(updatedButtons));

            await i.update({
                components: [finalEmbed]
            });

            collector.stop();
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                setDurationCooldown(userId, 'highlow', 30, 30);
                const disabledRow = new ActionRowBuilder().addComponents(
                    row.components.map(btn => btn.setDisabled(true))
                );
                const timeoutEmbed = new ContainerBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent('# Time\'s up\nYou took too long to guess.'))
                    .setColor(0xFF0000);
                timeoutEmbed.addActionRowComponents(disabledRow);

                try {
                    await interaction.editReply({ components: [timeoutEmbed] });
                } catch (e) {}
            }
        });
    },
};
