const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const { log } = require('../utils/logger');

module.exports = async (client) => {
    client.commands = new Map();
    const commands = [];
    const commandsPath = path.join(__dirname, '../commands');

    // Dynamically create commands directory if it doesn't exist
    if (!fs.existsSync(commandsPath)) {
        fs.mkdirSync(commandsPath, { recursive: true });
        log(`Created commands directory at ${commandsPath}`, 'info');
    }

    // Read command folders or files directly
    const commandItems = fs.readdirSync(commandsPath);

    for (const item of commandItems) {
        const itemPath = path.join(commandsPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            const commandFiles = fs.readdirSync(itemPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(itemPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    commands.push(command.data.toJSON());
                    log(`Loaded command: ${command.data.name}`, 'debug');
                } else {
                    log(`The command at ${filePath} is missing a required "data" or "execute" property.`, 'warn');
                }
            }
        } else if (stat.isFile() && item.endsWith('.js')) {
            const command = require(itemPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
                log(`Loaded command: ${command.data.name}`, 'debug');
            } else {
                log(`The command at ${itemPath} is missing a required "data" or "execute" property.`, 'warn');
            }
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        log(`Started refreshing ${commands.length} application (/) commands.`, 'info');

        // Put commands globally
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
