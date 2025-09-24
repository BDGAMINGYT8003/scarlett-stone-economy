const { EmbedBuilder } = require("discord.js");
const db = require("../../db.js");

module.exports = {
  name: "bal",
  aliases: ["balance"],
  premium: true,
  run: async (client, message, args) => {
    const member =
      message.mentions.members.first() ||
      message.guild.members.cache.find(
        (member) =>
          member.user.username.toLowerCase() === args.join(" ").toLowerCase()
      ) ||
      message.guild.members.cache.get(args[0]) ||
      message.guild.members.cache.find(
        (member) =>
          member.displayName.toLowerCase() === args.join(" ").toLowerCase()
      ) ||
      message.member;

    if (member.user.bot) {
      return message.reply("Bots have more cash than you ;-;");
    }

    let coins = db.get(`coins_${member.id}`);
    if (coins === undefined) {
      coins = 500;
      db.set(`coins_${member.id}`, 500);
    }

    let bank = db.get(`bank_${member.id}`);
    if (bank === undefined) {
      bank = 0;
      db.set(`bank_${member.id}`, 0);
    }

    let maxBank = db.get(`maxBank_${member.id}`);
    if (maxBank === undefined) {
        maxBank = 1000;
        db.set(`maxBank_${member.id}`, 1000)
    }

    const pembed = new EmbedBuilder()
      .setTitle(`${member.user.username}'s Balance`)
      .setDescription(`Wallet: ⏣${coins}\nBank: ⏣${bank}/${maxBank}`)
      .setColor("#F4C2C2")
      .setThumbnail(
        "https://cdn.discordapp.com/emojis/873550081159233586.gif?size=160"
      );
    message.reply({ embeds: [pembed] });
  },
};
