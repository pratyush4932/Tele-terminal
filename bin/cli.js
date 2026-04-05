#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { startServer } from '../index.js';
import os from 'os';

console.log(chalk.bold.cyan("\n☁️  Welcome to Tele-Terminal Setup ☁️\n"));

async function run() {
    const questions = [
        {
            type: 'password',
            name: 'sessionPassword',
            message: 'Create a secure password for this web shell session:',
            mask: '*',
            validate: (input) => {
                if (input.length < 8) return 'Password must be at least 8 characters long.';
                if (!/[A-Z]/.test(input)) return 'Password must contain at least one uppercase letter.';
                if (!/[a-z]/.test(input)) return 'Password must contain at least one lowercase letter.';
                if (!/[^A-Za-z0-9]/.test(input)) return 'Password must contain at least one special character.';
                return true;
            }
        },
        {
            type: 'input',
            name: 'port',
            message: 'What port should the server bind to?',
            default: '3000',
            validate: (input) => {
                const p = parseInt(input);
                if (isNaN(p) || p <= 0 || p > 65535) return 'Please enter a valid port number (1-65535).';
                return true;
            }
        }
    ];

    const answers = await inquirer.prompt(questions);
    const port = parseInt(answers.port);
    
    console.log(chalk.yellow('\nStarting backend pseudo-terminal...'));
    
    try {
        await startServer(port, answers.sessionPassword);
        
        // Find Local IP for network sharing
        let localIp = 'localhost';
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if ('IPv4' !== iface.family || iface.internal !== false) {
                    continue;
                }
                localIp = iface.address;
            }
        }

        const message = 
`${chalk.green.bold('SUCCESS!')} Terminal server is live.

${chalk.magenta('Local access:')}   http://localhost:${port}
${chalk.cyan('Network access:')} http://${localIp}:${port}

${chalk.dim('Share the network access URL and your password')}
${chalk.dim('with your team to grant them real-time shell access.')}

${chalk.red.bold('Press Ctrl+C to stop the server.')}`;

        console.log(boxen(message, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan'
        }));

    } catch (e) {
        console.error(chalk.red('\nFailed to start server:'), e.message);
        process.exit(1);
    }
}

run();
