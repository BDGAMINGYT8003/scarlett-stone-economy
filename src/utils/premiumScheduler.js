const { EmbedBuilder } = require('discord.js');
const db = require('./db');

async function checkExpiredPremium(client) {
    const expiredUsers = db.getExpiredPremiumUsers();

    for (const user of expiredUsers) {
        // Notify
        try {
            const discordUser = await client.users.fetch(user.id);
            if (discordUser) {
                const durationText = user.premium_duration_text || 'some time';

                const embed = new EmbedBuilder()
                    .setTitle('Premium Expired! 😭')
                    .setDescription(`Oh no! Your premium status of **${durationText}** has expired!\n\nYou are now back to being a normal peasant with long cooldowns. You should probably buy it or win it again if you want those sweet perks back.`)
                    .setFooter({ text: 'It was good while it lasted' })
                    .setColor(0xFF0000); // Red

                await discordUser.send({ embeds: [embed] }).catch(() => {});
            }
        } catch (e) {
            console.error(`Failed to notify user ${user.id} of premium expiry:`, e);
        }

        // Remove Premium
        db.setPremium(user.id, false);
    }
}

function startPremiumScheduler(client) {
    // Check every minute
    setInterval(() => checkExpiredPremium(client), 60000);
}

module.exports = { startPremiumScheduler };
