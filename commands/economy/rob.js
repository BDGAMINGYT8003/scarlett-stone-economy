const { EmbedBuilder } = require("discord.js");
const db = require("../../db.js");
const ms = require("ms");

module.exports = {
  name: "rob",
  aliases: ["steal"],
  timeout: 60,
  run: async (client, message, args) => {
    const member = message.mentions.members.first();

    if (!member) {
      return message.reply("You didn't mention a member to rob!");
    }

    if (member.id === message.member.id) {
      return message.reply("You can't rob yourself!");
    }
    if (member.user.bot) {
      return message.reply("You can't rob bots!");
    }

    const robberCoins = db.get(`coins_${message.author.id}`);
    if (robberCoins < 5000) {
      return message.reply("You need at least ⏣5,000 to rob someone.");
    }

    const victimCoins = db.get(`coins_${member.id}`);
    if (victimCoins < 5000) {
      return message.reply("You can't rob broke people.");
    }

    const padlock = db.get(`padlock_${member.id}`);
    if (padlock) {
      db.subtract(`padlock_${member.id}`, 1);
      return message.reply("Imagine trying to rob a person with a padlock.");
    }

    const chances = Math.floor(Math.random() * 2);

    if (chances !== 1) {
      const amount = Math.floor(Math.random() * (5500 - 5000 + 1)) + 5000;
      message.reply(`You were caught! You paid ⏣${amount}`);
      db.subtract(`coins_${message.author.id}`, amount);
      db.add(`coins_${member.id}`, amount);
    } else {
      const amount = Math.floor(Math.random() * (victimCoins / 4)) + 1;
      db.add(`coins_${message.author.id}`, amount);
      db.subtract(`coins_${member.id}`, amount);

      const robEmbed = new EmbedBuilder()
        .setTitle("Robbery Successful!")
        .setDescription(
          `You stole a portion from ${member.user.username} and got ⏣${amount}`
        )
        .setColor("#00FF00")
        .setTimestamp();

      message.reply({ embeds: [robEmbed] });
    }
  },
};
