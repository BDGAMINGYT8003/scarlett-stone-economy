const {MessageActionRow, MessageButton, MessageSelectMenu, MessageEmbed} = require("discord.js")

const config = require("../../botconfig/main") 
module.exports = {
name: "help",

run: async (client, message, args) => {
const row = new MessageActionRow() 
  .addComponents(
				new MessageSelectMenu()
					.setCustomId('select')
					.setPlaceholder('Nothing selected')

					.addOptions([
            {
							label: 'Main Menu',
							description: 'Shows the main menu',
              emoji: "909758706290417714",
							value: '0',
						},
						{
							label: 'Config Commands',
							description: 'Shows all the config commands',
              emoji: "888347974944571392",
							value: '1',
						},

				
            {
							label: 'Economy Commands',
							description: 'Shows all the economy commands',
              emoji: "910512217168941126",
							value: '2',
						},


{
							label: 'Fun Commands',
							description: 'Shows all the fun commands',
  emoji: "920258063703879700",
							value: '3',
						},
            {
							label: 'Games Commands',
							description: 'Shows all the game commands',
              emoji: "922464211240632330",
							value: '4',
						},


{
							label: 'Information Commands',
							description: 'Shows all the information commands',
  emoji: "911535908518527018",
							value: '5',
						},
{
							label: 'Moderation Commands',
							description: 'Shows all the moderation commands',
  emoji: "908346330412355605",
							value: '6',
						},
            {
							label: 'Utility Commands',
							description: 'Shows all the utility commands',
              emoji: "922461948535271425",
							value: '7',
						},
					]),
			);
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
  
const embed = new MessageEmbed()
  .setTitle("**HELP MENU**")
  .setDescription(`Pls select a category to see more commands.\n\n> <:C4N1:909758187769593866> \`\Prefix\`\: ${config.prefix}\n> <:C42Button:909758293080162344> \`\Total Commands\`\: ${client.commands.size}\n> <:C43Button:909758539185156146> \`\Total Servers\`\: ${client.guilds.cache.size} `)
  .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
.setColor("#f4c2c2")


  let sendmsg = message.channel.send({embeds: [embed], components: [row,row2]})

let embed1 = new MessageEmbed()
.setColor('#FFFFFF')
.setTitle('**HELP MENU**')
.addFields(
    {name: "**CONFIG COMMANDS**", value: "`set-countingchannel`, `setwelcomechannel`, `setleavechannel`"})
.setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
.setColor("#f4c2c2")
.setFooter('Page 1')

    

    let embed2 = new MessageEmbed()
  
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
  .addFields(
    {name: "**ECONOMY COMMANDS**", value: "`balance`, `deposit`, `withdraw`, `search`, `shop`, `inv`, `pet`, `adopt`, `buy`, `sell`, `use`, `gamble`, `multi`, `beg`, `daily`, `fish`, `hunt`, `rob`, `rich` `postmeme`"})
.setColor("#f4c2c2")
.setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
.setFooter('Page 2')



    
   let embed3 = new MessageEmbed()
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
  .addFields(
    {name: "**FUN COMMANDS**", value: "`8ball`, `activity`, `pixelize`, `meme`"})
     .setColor("#f4c2c2")
     .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
    .setFooter('Page 3')
    
    let embed4 = new MessageEmbed()
  
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
  .addFields(
    {name: "**GAMES COMMANDS**", value: "`c4`, `tictactoe`, `wouldyourather`, `roadrace`, `snake`, `football`, `quickclick`, `catchthefish`"})
      .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
      .setColor("#f4c2c2")
.setFooter('Page 4')
   
       let embed5 = new MessageEmbed()
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
  .addFields(
    {name: "**INFO COMMANDS**", value: "`help`, `cmdhelp`, `botinfo`, `ping`, `invite`, `embed`"})
         .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
         .setColor("#f4c2c2")
    .setFooter('Page 5')
    
       let embed6 = new MessageEmbed()
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
  .addFields(
    {name: "**MOD COMMANDS**", value: "`ban`, `addroleall`, `removeroleall`, `softban`, `purge`, `mute`, `kick`, `tempmute`, `nuke` `stealemoji`"})
    .setFooter('Page 6')
         .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
  .setColor("#f4c2c2")
       let embed7 = new MessageEmbed()
    .setTitle('**Help Menu**')
    .setColor('#FFFFFF')
.addFields({name: "**UTILITY COMMANDS**", value: "`addtag`, `edittag`, `removetag`, `afk`, `rolelist`, `snipe`, `timer`, `calculator`, `avatar`, `serverinfo`, `ss`, `dump`"})
         .setImage("https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif")
         .setColor("#f4c2c2")
    .setFooter('Page 7')

const filter = i => i.user.id===message.author.id;
    const collector = message.channel.createMessageComponentCollector({
    filter,
      time: 40000,
    componentType: "SELECT_MENU"
 });
       

collector.on("collect", async (collected) =>{
const value = collected.values[0]
if(value === "0" ){
collected.update({embeds: [embed], components: [row,row2]})
}
if(value === "1" ){
collected.update({embeds: [embed1], components: [row,row2]})
  }
  if(value === "2" ){
collected.update({embeds: [embed2],components: [row,row2]})
  }
if(value === "3"){
collected.update({embeds: [embed3],components: [row,row2]})
}
if(value === "4" ){
collected.update({embeds: [embed4],components: [row,row2]})
}
if(value === "5" ){
collected.update({embeds: [embed5],components: [row,row2]})
}
if(value === "6"){
collected.update({embeds: [embed6],components: [row,row2]})
}
if(value === "7"){
collected.update({embeds: [embed7],components: [row,row2]})
}
  
  
 })
  
  
}
  }