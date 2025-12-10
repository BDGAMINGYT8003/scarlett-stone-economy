const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');
const { checkScheduledCooldown, getScheduleCooldownEmbed } = require('../../utils/cooldownManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('monthly')
        .setDescription('Each month, receive a large amount of coins.'),
    async execute(interaction) {
        const userId = interaction.user.id;

        const check = checkScheduledCooldown(userId, 'monthly');
        if (check.onCooldown) {
            return interaction.reply({
                components: [getScheduleCooldownEmbed('monthly', check.readyAt)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const amount = 500000;
        db.addBalance(userId, amount);
        db.setLastClaimed(userId, 'monthly', Date.now());

        const embed = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`# ${interaction.user.username}'s Monthly Coins\n> **֍ ${amount.toLocaleString()}** was placed in your wallet!`)
            )
            .addSectionComponents(
                new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Base**\n֍ 500,000`),
                    new TextDisplayBuilder().setContent(`**Streak Bonus**\n֍ 0`), // Monthly doesn't usually have streak logic in this clone
                    new TextDisplayBuilder().setContent(`**Donor Bonus**\n֍ 0`)
                )
            )
            .setColor(0x000000); // Black/Dark

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
