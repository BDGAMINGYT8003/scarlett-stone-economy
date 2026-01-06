const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, MessageFlags } = require('discord.js');
const db = require('../../utils/db');
const { getAllCooldowns } = require('../../utils/cooldownManager');
const { getProgressBar } = require('../../utils/progressBar');
const badgesConfig = require('../../config/badges.json');

// Emoji Constants
const REPLY = '<:Reply:1457839486011445391>';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your profile and stats.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to view (default: yourself)')
                .setRequired(false)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userId = targetUser.id;

        // Ensure user exists in DB
        db.getUser(userId);

        const generateMainEmbed = () => {
            const user = db.getUser(userId);
            const netWorth = db.calculateNetWorth(userId);
            const inventory = db.getInventory(userId);
            const unlockedBadges = db.getUnlockedBadges(userId);
            const badgeEmojis = getBadgeEmojis(unlockedBadges);

            // Level Calc
            const commandsRan = user.commands_ran || 0;
            const level = Math.floor(commandsRan / 75);
            const xp = commandsRan % 75;
            const xpNeeded = 75; // simplified

            const xpBar = getProgressBar(xp, xpNeeded, 5);

            const favoriteCommand = db.getFavoriteCommand(userId);

            const totalItems = inventory.reduce((acc, i) => acc + i.quantity, 0);
            const uniqueItems = inventory.length;
            const invWorth = netWorth - (user.balance + user.bank); // Approx

            const embed = new EmbedBuilder()
                .setTitle(targetUser.username)
                .setDescription(`${badgeEmojis.join(' ')}\n**Country:** 🏳️ Unknown`)
                .addFields(
                    { name: 'Level', value: `Level: \`${level}\`\nExperience: \`${xp}/${xpNeeded}\`\n${xpBar}`, inline: false },
                    { name: 'Coins', value: `Wallet: \`֍ ${formatNumber(user.balance)}\`\nBank: \`֍ ${formatNumber(user.bank)}\`\nNet: \`֍ ${formatNumber(netWorth)}\``, inline: false },
                    { name: 'Items', value: `Unique: \`${uniqueItems}\`\nTotal: \`${formatNumber(totalItems)}\`\nWorth: \`֍ ${formatNumber(invWorth)}\``, inline: false },
                    { name: 'Commands', value: `Total: \`${formatNumber(commandsRan)}\`\nFavorite: \`${favoriteCommand}\``, inline: false }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setColor(0x0099FF);

            return embed;
        };

        const generateWorkEmbed = () => {
            const user = db.getUser(userId);
            const stars = db.getTotalWorkStars(userId);

            return new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Work stats`)
                .setDescription(`**Total:**\nShifts Worked: ${user.total_shifts_completed}\nEarned: ֍ ${formatNumber(user.work_earnings)}\nStars: ${stars}`)
                .setColor(0x0099FF);
        };

        const generateGamblingEmbed = () => {
            const user = db.getUser(userId);

            // Slots
            const slotsWon = user.slots_won_amount || 0;
            const slotsLost = user.slots_lost_amount || 0;
            const slotsNet = slotsWon - slotsLost;
            const slotsPlayed = user.slots_played || 0;
            const slotsWins = user.slots_wins || 0;
            const slotsWinRate = slotsPlayed > 0 ? Math.floor((slotsWins / slotsPlayed) * 100) : 0;

            // SnakeEyes
            const seWon = user.snakeeyes_won_amount || 0;
            const seLost = user.snakeeyes_lost_amount || 0;
            const seNet = seWon - seLost;
            const sePlayed = user.snakeeyes_played || 0;
            const seWins = user.snakeeyes_wins || 0;
            const seWinRate = sePlayed > 0 ? Math.floor((seWins / sePlayed) * 100) : 0;

            const totalWon = slotsWon + seWon;
            const totalLost = slotsLost + seLost;
            const totalNet = totalWon - totalLost;
            const totalPlayed = slotsPlayed + sePlayed;
            const totalWins = slotsWins + seWins;
            const totalWinRate = totalPlayed > 0 ? Math.floor((totalWins / totalPlayed) * 100) : 0;

            return new EmbedBuilder()
                .setTitle(`${targetUser.username}'s gambling stats`)
                .setDescription(`**SLOTS (${slotsPlayed})**\nWon: ${formatNumber(slotsWon)}\nLost: ${formatNumber(slotsLost)}\nNet: ${formatNumber(slotsNet)} (Approx)\nWin: ${slotsWinRate}%\n\n**SNAKEEYES (${sePlayed})**\nWon: ${formatNumber(seWon)}\nLost: ${formatNumber(seLost)}\nNet: ${formatNumber(seNet)} (Approx)\nWin: ${seWinRate}%\n\n**TOTAL (${totalPlayed})**\nWon: ${formatNumber(totalWon)}\nLost: ${formatNumber(totalLost)}\nNet: ${formatNumber(totalNet)} (Approx)\nWin: ${totalWinRate}%`)
                .setColor(0x0099FF)
                .setFooter({ text: 'The number next to the name is how many matches are recorded' });
        };

        const generateCooldownsEmbed = () => {
            if (db.isGodMode(userId)) {
                return new EmbedBuilder()
                    .setTitle(`${targetUser.username}'s Cooldowns`)
                    .setDescription('**GOD MODE ACTIVE**\nNo cooldowns apply.')
                    .setColor(0xFFD700);
            }

            const cooldowns = getAllCooldowns(userId);
            let desc = '';

            if (cooldowns.length === 0) {
                desc = 'No active cooldowns.';
            } else {
                cooldowns.sort((a, b) => a.readyAt - b.readyAt);
                cooldowns.forEach(cd => {
                    const readyUnix = Math.floor(cd.readyAt / 1000);
                    desc += `**${cd.command}**: <t:${readyUnix}:R>\n`;
                });
            }

            return new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Cooldowns`)
                .setDescription(desc)
                .setColor(0x0099FF);
        };

        const generateBadgesEmbed = () => {
            const unlocked = db.getUnlockedBadges(userId);
            let desc = '';

            if (unlocked.length === 0) {
                desc = "No badges earned yet.";
            } else {
                unlocked.forEach(key => {
                    const [id, tier] = key.split(':');
                    const config = badgesConfig.find(b => b.id === id);
                    if (config) {
                        const emoji = config.emojis ? config.emojis[tier] : config.emoji;
                        desc += `${emoji} **${config.name}**\n*${config.description}*\n`;
                    }
                });
            }

            return new EmbedBuilder()
                .setTitle(`${targetUser.username}'s badges`)
                .setDescription(desc)
                .setColor(0x0099FF);
        };

        const generateActiveItemsEmbed = () => {
            const user = db.getUser(userId);
            let desc = '';

            if (user.premium_expires_at > Date.now()) {
                const expiresUnix = Math.floor(user.premium_expires_at / 1000);
                desc += `**Premium Status**: Expires <t:${expiresUnix}:R>\n`;
            } else if (user.is_premium) {
                desc += `**Premium Status**: Permanent\n`;
            } else {
                desc += "No active items/effects.";
            }

            return new EmbedBuilder()
                .setTitle(`${targetUser.username}'s Active Items`)
                .setDescription(desc)
                .setColor(0x0099FF);
        };

        const getComponents = () => {
            const select = new StringSelectMenuBuilder()
                .setCustomId('profile_select')
                .setPlaceholder('Select a category')
                .addOptions(
                    { label: 'Main Profile', value: 'main', emoji: '👤' },
                    { label: 'Work Stats', value: 'work', emoji: '💼' },
                    { label: 'Gambling Stats', value: 'gambling', emoji: '🎰' },
                    { label: 'Cooldowns', value: 'cooldowns', emoji: '⏰' },
                    { label: 'Badges', value: 'badges', emoji: '🏅' },
                    { label: 'Active Items', value: 'items', emoji: '🎒' }
                );
            return [new ActionRowBuilder().addComponents(select)];
        };

        const response = await interaction.reply({
            embeds: [generateMainEmbed()],
            components: getComponents(),
            fetchReply: true
        });

        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60000
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('Error')
                    .setDescription('Not your profile view!')
                    .setColor(0xFF0000)
                    .setFooter({ text: 'Check your own profile' });
                return i.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
            }

            const val = i.values[0];
            let embed;

            switch(val) {
                case 'main': embed = generateMainEmbed(); break;
                case 'work': embed = generateWorkEmbed(); break;
                case 'gambling': embed = generateGamblingEmbed(); break;
                case 'cooldowns': embed = generateCooldownsEmbed(); break;
                case 'badges': embed = generateBadgesEmbed(); break;
                case 'items': embed = generateActiveItemsEmbed(); break;
            }

            await i.update({ embeds: [embed], components: getComponents() });
        });
    }
};

function formatNumber(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString();
}

function getBadgeEmojis(unlockedList) {
    return unlockedList.map(key => {
        const [id, tier] = key.split(':');
        const config = badgesConfig.find(b => b.id === id);
        if (!config) return '';
        return config.emojis ? config.emojis[tier] : config.emoji;
    });
}
