const chalk = require('chalk');

const log = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    switch (type) {
        case 'success':
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.green.bold('SUCCESS')} ${message}`);
            break;
        case 'error':
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.red.bold('ERROR')} ${message}`);
            break;
        case 'warn':
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.yellow.bold('WARN')} ${message}`);
            break;
        case 'info':
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.blue.bold('INFO')} ${message}`);
            break;
        case 'debug':
            console.log(`${chalk.gray(`[${timestamp}]`)} ${chalk.magenta.bold('DEBUG')} ${message}`);
            break;
        default:
            console.log(`${chalk.gray(`[${timestamp}]`)} ${message}`);
    }
};

module.exports = { log };
