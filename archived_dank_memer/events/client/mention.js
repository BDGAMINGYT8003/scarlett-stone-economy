
const {MessageActionRow, MessageButton, MessageEmbed} = require("discord.js") 
const config = require("../../botconfig/main") 
const client = require("../../index") 
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (!message.guild.me.permissionsIn(message.channel).has("SEND_MESSAGES"))
    return;


  // mentioned bot
  
   const prefixMention = new RegExp(`^<@!?${client.user.id}>( |)$`);
  if (message.content.match(prefixMention)) {

    let embed = new MessageEmbed()
        .setTitle(`${client.user.username} is Here!`)
        .setDescription(`Hey **${message.author.username},** I was made by <@742335160598659094> 
        Bot Prefix: \`${config.prefix}\` 
Forgot My Prefix? Dw you can always mention me to check my prefix
        Invite Link: [Click Here](https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands)
        <:missingBadge:911535908518527018> Still need help? [Click Here](https://discord.gg/eNEK6kR2hj) to join server
        `)
        .setThumbnail(client.user.displayAvatarURL())
        .setColor("#006732")
        .setFooter(`Thanks for using me`)
    const row2 = new MessageActionRow() 
  .addComponents(
    new MessageButton()
      .setLabel("Invite me")
      
      .setStyle("LINK") 
.setEmoji("909758706290417714")
      .setURL("https://dsc.gg/moonlight05"),
      new MessageButton()
      .setLabel("Support Server")
      
      .setStyle("LINK") 
.setEmoji("911535908518527018")
      .setURL("https://dsc.gg/lunarteam"),
      new MessageButton()
      .setLabel("Vote me")
      
      .setStyle("LINK") 
.setEmoji("911545788608430111")
      .setURL("https://top.gg/bot/903922960354672671/vote")
  )
      message.channel.send({embeds: [embed], components: [row2]})
    
      }

      })
