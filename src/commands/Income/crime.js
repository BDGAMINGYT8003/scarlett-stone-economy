const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const db = require('../../utils/db');
const { checkDurationCooldown, setDurationCooldown, getCooldownEmbed } = require('../../utils/cooldownManager');
const crimes = require('../../config/crimes.json');
const { acquireLock, releaseLock } = require('../../utils/lockManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('crime')
        .setDescription('Commit a crime to earn money (or lose it).'),
    async execute(interaction) {
        const userId = interaction.user.id;
        const user = db.getUser(userId);
        const walletBalance = user.balance ?? 0;

        // Check Minimum Balance
        if (walletBalance < 1000) {
            const poorEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('Too Poor to Commit Crime')
                .setDescription('You need at least **֍ 1,000** in your wallet to commit a crime. You can\'t risk what you don\'t have!')
                .setFooter({ text: 'Come back when you have some cash.' });
            return interaction.reply({ embeds: [poorEmbed], ephemeral: true });
        }

        // Check Lock
        if (!acquireLock(userId)) {
             return interaction.reply({ content: 'You have an ongoing command running. Please finish it first.', ephemeral: true });
        }

        // Check Cooldown
        const cooldown = checkDurationCooldown(userId, 'crime', 45);
        if (cooldown.onCooldown) {
            releaseLock(userId);
            return interaction.reply({
                embeds: [getCooldownEmbed('crime', cooldown.readyAt, 45, 8)]
            });
        }

        // Pick 3 random crimes
        const shuffled = crimes.sort(() => 0.5 - Math.random());
        const selectedCrimes = shuffled.slice(0, 3);

        const buttons = selectedCrimes.map(c =>
            new ButtonBuilder()
                .setCustomId(`crime_${c.id}`)
                .setLabel(c.name)
                .setStyle(ButtonStyle.Danger)
        );

        const row = new ActionRowBuilder().addComponents(buttons);

        const embed = new EmbedBuilder()
            .setColor(0x8B0000)
            .setTitle('What crime do you want to commit?')
            .setDescription('Choose a crime to attempt.')
            .setFooter({ text: 'You have 15 seconds to choose.' });

        const response = await interaction.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 15000 });

        collector.on('collect', async i => {
            if (i.user.id !== userId) {
                return i.reply({ content: 'These buttons are not for you!', ephemeral: true });
            }

            const crimeId = i.customId.replace('crime_', '');
            const crime = crimes.find(c => c.id === crimeId);

            if (!crime) {
                setDurationCooldown(userId, 'crime', 45);
                releaseLock(userId);
                return i.update({ content: 'Something went wrong.', components: [], embeds: [] });
            }

            // Determine Outcome
            // Roll: 0-100
            const roll = Math.random() * 100;
            const resultEmbed = new EmbedBuilder().setTitle(`Crime Attempt: ${crime.name}`);

            if (roll < crime.success_chance) {
                // Success
                let specialOutcome = null;
                 if (crime.special_outcomes && crime.special_outcomes.length > 0) {
                     for (const special of crime.special_outcomes) {
                         if (Math.random() * 100 < special.chance) {
                             specialOutcome = special;
                             break;
                         }
                     }
                }

                if (specialOutcome) {
                    const amount = specialOutcome.bonus_money;
                    db.addBalance(userId, amount);
                    db.addItem(userId, specialOutcome.item_id, 1);

                    const message = specialOutcome.message.replace('{amount}', amount.toLocaleString());

                    resultEmbed.setColor(0x00FF00)
                        .setDescription(message)
                        .setFooter({ text: 'Criminal Mastermind!' });
                } else {
                    const amount = Math.floor(Math.random() * (crime.max_coins - crime.min_coins + 1)) + crime.min_coins;
                    db.addBalance(userId, amount);

                    const outcomeMsg = crime.outcomes.success[Math.floor(Math.random() * crime.outcomes.success.length)];
                    resultEmbed.setColor(0x00FF00)
                        .setDescription(outcomeMsg.replace('{amount}', amount.toLocaleString()));
                }

            } else {
                // Fail
                // Split fail into Safe Fail and Fined Fail (50/50 split of remaining chance?)
                // Actually usually it's just a another roll. Let's say 30% of fails are fines.
                const isFined = Math.random() < 0.3;

                if (isFined) {
                    let fine = Math.floor(Math.random() * (crime.fine_max - crime.fine_min + 1)) + crime.fine_min;
                    // Cap fine at wallet balance
                    const currentWallet = db.getUser(userId).balance ?? 0;
                    if (fine > currentWallet) fine = currentWallet;

                    db.removeBalance(userId, fine);

                    const outcomeMsg = crime.outcomes.fail_fined[Math.floor(Math.random() * crime.outcomes.fail_fined.length)];
                    resultEmbed.setColor(0xFF0000)
                        .setDescription(outcomeMsg.replace('{fine}', fine.toLocaleString()));
                } else {
                    const outcomeMsg = crime.outcomes.fail_safe[Math.floor(Math.random() * crime.outcomes.fail_safe.length)];
                    resultEmbed.setColor(0xFFA500) // Orange for close call
                        .setDescription(outcomeMsg);
                }
            }

            // Set Cooldown HERE
            setDurationCooldown(userId, 'crime', 45);

            await i.update({ embeds: [resultEmbed], components: [] });
            collector.stop('choice_made');
        });

        collector.on('end', (collected, reason) => {
            releaseLock(userId);
            if (reason === 'time') {
                 // Timeout embed logic
                 const timeoutEmbed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Crime Timeout')
                    .setDescription(`You chickened out, <@${userId}>. The opportunity has passed.`)
                    .setFooter({ text: 'Maybe next time.' });

                interaction.editReply({ embeds: [timeoutEmbed], components: [] });
                setDurationCooldown(userId, 'crime', 45);
            }
        });
    },
};
