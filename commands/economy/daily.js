const { EmbedBuilder } = require("discord.js");
const db = require("../../db.js");

module.exports = {
  name: "daily",
  category: "economy",
  description: "claim your daily rewards",
  usage: "?daily",
  aliases: [],
  timeout: 86400,
  boostersOnly: false,
  cooldownMsg: {
    title: `U already claimed the rewards`,
    description: `**Next reward in [timeleft]**`,
    color: "RED",
  },
  run: async (client, message, args) => {
    const amount = 25000;

    db.add(`coins_${message.author.id}`, amount);

    let embed = new EmbedBuilder()
      .setTitle(`Daily Rewards!`)
      .setDescription(
        `${message.author.username}, you got **⏣${amount}**!`
      )
      .setFooter({ text: "Come back tomorrow!" })
      .setTimestamp()
      .setColor("Green");
    message.reply({ embeds: [embed] });
  },
};
