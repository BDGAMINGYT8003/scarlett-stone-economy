const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, MessageFlags, Colors } = require('discord.js');
const db = require('../../utils/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('premium')
        .setDescription('Check your premium status and perks.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Check your current premium status.')),
    async execute(interaction) {
        const userId = interaction.user.id;
        const isPremium = db.isPremium(userId);

        const embed = new ContainerBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`# Premium Status\nCurrently: **${isPremium ? 'Active ✅' : 'Inactive ❌'}**`));

        if (isPremium) {
            embed
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`> You are a premium member! Enjoy your perks.`)
                )
                .addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Perks**\n- 50% Reduced Cooldowns\n- Higher Multipliers (Coming Soon)\n- Special Badge (Coming Soon)`)
                    )
                )
                .setColor(0xFFD700); // Gold
        } else {
            embed
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`> You are not a premium member.`)
                )
                .addSectionComponents(
                    new SectionBuilder().addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`**Perks**\n- 50% Reduced Cooldowns\n- Higher Multipliers\n- Support the dev`)
                    )
                )
                .addTextDisplayComponents(new TextDisplayBuilder().setContent('Check `/help` or ask the developer how to get premium!'))
                .setColor(0x808080); // Grey
        }

        await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    },
};
