const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { log } = require('../utils/logger');

module.exports = async (client) => {
    client.commands = new Map();
    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');

    // Read command folders
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        if (fs.statSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    log(`Loaded command: ${command.data.name}`, 'debug');
                } else {
                    log(`The command at ${filePath} is missing a required "data" or "execute" property.`, 'warn');
                }
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        log(`Started refreshing ${commands.length} application (/) commands.`, 'info');

        // Put commands globally (or per guild for development speed if needed, but requirements say "synced automatically")
        // Using global application commands
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        log(`Successfully reloaded ${data.length} application (/) commands.`, 'success');
    } catch (error) {
        log(error.message, 'error');
        console.error(error);
    }
};
