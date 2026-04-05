#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import { startServer, setApprovalCallback } from '../src/index.js';
import os from 'os';
import fs from 'fs';
import { join } from 'path';

console.log(chalk.bold.cyan("\n☁️  Welcome to Tele-Terminal Setup ☁️\n"));

const pwdRules = 
`${chalk.yellow.bold('GLOBAL PASSWORD POLICY ENFORCED:')}
${chalk.gray('- Minimum 8 characters')}
${chalk.gray('- At least 1 lowercase letter')}
${chalk.gray('- At least 1 uppercase letter')}
${chalk.gray('- At least 1 special character')}

${chalk.dim('Note: This applies to ALL users (Admin, Standard, and Guest).')}`;

console.log(boxen(pwdRules, {
    padding: 1,
    margin: { bottom: 1 },
    borderStyle: 'round',
    borderColor: 'yellow'
}));

const strictPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/;

async function run() {
    const configPath = join(process.cwd(), 'config.json');
    let configObj = null;

    if (!fs.existsSync(configPath)) {
        console.log(chalk.red.bold(`[WARNING] No config files found!`));
        console.log(chalk.yellow(`Generating a demo config.json layout...`));
        configObj = {
            users: {
                "admin": {
                    "username": "superadmin",
                    "password": "SuperSecureAdminPassword2026!"
                },
                "guest": {
                    "username": "guestviewer",
                    "password": "ReadOnlyGuestPass!2026"
                }
            },
            security: {
                require_approval: true,
                restricted_cmds: {
                    windows: ["del /s", "format", "shutdown", "rmdir /s", "diskpart"],
                    linux: ["rm -rf", "mkfs", "shutdown", "reboot", "dd"],
                    mac: ["rm -rf", "mkfs", "shutdown", "reboot", "sudo rm"]
                },
                allowed_cmds: {
                    windows: [],
                    linux: [],
                    mac: []
                }
            }
        };
        fs.writeFileSync(configPath, JSON.stringify(configObj, null, 2));
        console.log(chalk.green(`✓ Added demo config.json containing default users and OS rules.`));
    } else {
        console.log(chalk.green(`✓ Loaded existing config.json.`));
        configObj = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (configObj.users) {
        const adminBlock = configObj.users.admin || {};
        const guestBlock = configObj.users.guest || {};
        
        const rootPass = typeof adminBlock === 'string' ? adminBlock : (configObj.users.root?.password || configObj.users.root || adminBlock.password);
        const guestPass = typeof guestBlock === 'string' ? guestBlock : guestBlock.password;
        
        if (!strictPasswordRegex.test(rootPass) || !strictPasswordRegex.test(guestPass)) {
            console.error(chalk.bgRed.white.bold(`\n [ERROR] SECURITY POLICY VIOLATION `));
            console.error(chalk.red(`Your config.json contains statically mapped Admin or Guest passwords \nthat DO NOT meet the strict global security requirements.`));
            console.error(chalk.red(`Please open config.json and upgrade your passwords to proceed.\n`));
            process.exit(1);
        }
    }

    const hostQuestions = [
        {
            type: 'password',
            name: 'standardPass',
            message: 'Create Standard Password (Subject to Blocklist & locked to current directory):',
            mask: '*',
            validate: (input) => {
                if (strictPasswordRegex.test(input)) return true;
                return 'Password must be 8+ chars and contain 1 uppercase, 1 lowercase, and 1 special char.';
            }
        },
        {
            type: 'confirm',
            name: 'requireApproval',
            message: 'Require manual host approval for all incoming sessions? (Y/n)',
            default: configObj?.security?.require_approval ?? true
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
        },
        {
            type: 'input',
            name: 'sslCert',
            message: '(Optional) Path to SSL Certificate (.pem/.crt) for HTTPS:',
            default: ''
        },
        {
            type: 'input',
            name: 'sslKey',
            message: '(Optional) Path to SSL Private Key (.pem/.key) for HTTPS:',
            default: '',
            when: (answers) => answers.sslCert !== ''
        }
    ];

    const answers = await inquirer.prompt(hostQuestions);
    const port = parseInt(answers.port);
    
    let approvalQueue = Promise.resolve();
    setApprovalCallback((username, ip) => {
        return new Promise((resolve) => {
            approvalQueue = approvalQueue.then(async () => {
                console.log('\n');
                const answer = await inquirer.prompt([{
                    type: 'confirm',
                    name: 'approve',
                    message: chalk.bgRed.white.bold(` [SECURITY] Incoming connection attempt from user '${username}' (IP: ${ip}). Approve session? `),
                    default: false
                }]);
                resolve(answer.approve);
            });
        });
    });

    console.log(chalk.yellow('\nStarting backend pseudo-terminal...'));
    
    if (!configObj.security) configObj.security = {};
    configObj.security.require_approval = answers.requireApproval;

    try {
        await startServer(port, answers.standardPass, configObj, answers.sslCert, answers.sslKey);
        
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

        const protocol = (answers.sslCert && answers.sslKey) ? 'https' : 'http';

        const message = 
`${chalk.green.bold('SUCCESS!')} Terminal server is live.

${chalk.magenta('Local access:')}   ${protocol}://localhost:${port}
${chalk.cyan('Network access:')} ${protocol}://${localIp}:${port}

${chalk.dim('Administrators can log in using credentials mapped in config.json.')}
${chalk.dim('Destructive commands are filtered via the OS-specific restricted_cmds list.')}

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
