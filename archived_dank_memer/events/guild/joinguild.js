const config = require("../../botconfig/main") 

const { MessageEmbed, MessageActionRow, MessageButton } = require("discord.js") 
const client = require("../../index") 
client.on('guildCreate', guild => {
    const channel = guild.channels.cache.find(channel => channel.type === 'GUILD_TEXT' && channel.permissionsFor(guild.me).has('SEND_MESSAGES'))
 let embed = new MessageEmbed()
 .setColor('BLACK')
 .setTitle('Connected To New Server')
 .setURL('https://dsc.gg/moonlight05')
 .setDescription(`<:cookie:921311220814979084> Thank You For Inviting Me. My prefix is \`${config.prefix}\`
Run ${config.prefix} help for more info about me!`)
 
 .addFields(
 { name: 'Creator', value: '<@742335160598659094>' }
 )

 .setImage('https://media.discordapp.net/attachments/910500369082224680/922456006179573790/reQYfwzIc9opL3ph.gif')
 .setTimestamp()
 .setFooter('MoonLight', 'https://dsc.gg/moonlight05');
channel.send({embeds : [embed]});
}) 
