const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('weekly')
        .setDescription('Once per week, get a moderate amount of coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'weekly');
        if (check.onCooldown) {
            return interaction.reply({
                components: [getScheduleCooldownEmbed('weekly', check.readyAt)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const amount = 75000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'weekly', Date.now());

        const embed = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Weekly Coins\n> **֍ ${amount.toLocaleString()}** was placed in your wallet!`)
            )
            .addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Base**\n֍ 75,000`),
                    new TextDisplayBuilder().setContent(`**Streak Bonus**\n֍ 0`),
                    new TextDisplayBuilder().setContent(`**Donor Bonus**\n֍ 0`)
                )
            )
            .setColor(0xFFFFFF); // White

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
