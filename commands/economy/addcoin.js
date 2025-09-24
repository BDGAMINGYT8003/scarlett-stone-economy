const db = require("quick.db");

module.exports = {
  name: "addcoin",
  aliases: ["setcoin", "addcoins", "addc"],
  run: async (client, message, args) => {
    const allowed = ["742335160598659094"]; // This should probably be in a config file

    if (!allowed.includes(message.author.id)) return;

    const target = message.mentions.users.first();
    if (!target) {
      return message.reply("Please @ the user.");
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount)) {
      return message.reply("Enter a valid amount.");
    }

    db.add(`coins_${target.id}`, amount);

    return message.reply(`Done! Successfully added ${amount} to ${target}'s bal`);
  },
};
