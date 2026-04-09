import pty from 'node-pty';
import { Server } from 'socket.io';
import http from 'http';
import https from 'https';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let standardPassConfig = null;
export let appConfig = { users: {}, security: { restricted_cmds: {}, allowed_cmds: {} } };

export let onApprovalRequest = null;
export function setApprovalCallback(cb) {
    onApprovalRequest = cb;
}

let server;
let io;

let MAX_HISTORY = 100;
const commandHistory = [];
const activeUsers = new Set();
const connectedClients = new Map();
const pendingClients = new Map();

let tabsEnabled = false;
let terminalSessions = {
    'main': { shell: null, title: 'Terminal' }
};

const getTabsPayload = () => Object.entries(terminalSessions).map(([id, t]) => ({ id, title: t.title }));

const requestHandler = (req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile(join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
};

function initTabShell(tabId) {
    if (terminalSessions[tabId] && terminalSessions[tabId].shell) return;

    const shell = appConfig.shell || (process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash'));

    if (!terminalSessions[tabId]) {
        terminalSessions[tabId] = { title: 'Terminal' };
    }

    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.cwd(),
        env: process.env
    });

    terminalSessions[tabId].shell = ptyProcess;

    ptyProcess.onData((data) => {
        if (io) io.to('authenticated').emit('output', { tabId, data });
    });

    ptyProcess.on('exit', () => {
        if (terminalSessions[tabId]) {
            terminalSessions[tabId].shell = null;
            if (tabId !== 'main') {
                delete terminalSessions[tabId];
                if (io) io.to('authenticated').emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
            }
        }
    });
}

function broadcastUsersUpdate() {
    if (io) {
        io.to('admins').emit('users-sync', {
            active: Array.from(connectedClients.values()),
            pending: Array.from(pendingClients.values())
        });
    }
}

function setupSocketIO() {
    io.on('connection', (socket) => {
        console.log('New connection:', socket.id);
        socket.emit('init-config', { theme: appConfig.theme, ui: appConfig.ui });

        let authenticated = false;

        socket.on('auth', async (data) => {
            let authSuccess = false;
            let role = null;
            let finalUsername = data.username || 'Anonymous';

            if (appConfig.users && appConfig.users.admin && data.password === appConfig.users.admin.password) {
                authSuccess = true;
                role = 'admin';
                finalUsername = appConfig.users.admin.username || 'admin';
            } else if (appConfig.users && appConfig.users.guest && data.password === appConfig.users.guest.password) {
                authSuccess = true;
                role = 'guest';
                finalUsername = appConfig.users.guest.username || 'guest';
            } else if (data.password === standardPassConfig) {
                authSuccess = true;
                role = 'standard';
            }

            if (!authSuccess) {
                socket.emit('output', '\r\n\x1b[31mAccess Denied: Incorrect Password or Username\x1b[0m\r\n');
            } else if (activeUsers.has(finalUsername)) {
                socket.emit('output', `\r\n\x1b[31mAccess Denied: Username '${finalUsername}' is already taken in this session.\x1b[0m\r\n`);
            } else {
                if (appConfig.security && appConfig.security.require_approval && onApprovalRequest) {
                    socket.emit('output', '\r\n\x1b[33m[WAITING] The host is currently reviewing your connection request...\x1b[0m\r\n');
                    const clientIp = socket.handshake.address || socket.request.connection.remoteAddress;
                    pendingClients.set(socket.id, {
                        username: finalUsername,
                        role: role,
                        ip: clientIp || 'Local',
                        connectTime: Date.now()
                    });
                    broadcastUsersUpdate();

                    const approved = await onApprovalRequest(finalUsername, clientIp);
                    
                    pendingClients.delete(socket.id);
                    broadcastUsersUpdate();

                    if (!approved) {
                        socket.emit('output', '\r\n\x1b[31m[DENIED] The host rejected your connection request.\x1b[0m\r\n');
                        socket.disconnect();
                        return;
                    }
                }

                authenticated = true;
                socket.username = finalUsername;
                socket.role = role;
                socket.isSandboxUnlocked = false;
                activeUsers.add(socket.username);
                
                const clientIp = socket.handshake.address || socket.request.connection.remoteAddress;
                connectedClients.set(socket.id, {
                    username: finalUsername,
                    role: role,
                    ip: clientIp || 'Local',
                    connectTime: Date.now()
                });

                socket.join('authenticated');
                if (role === 'admin') socket.join('admins');

                socket.cmdBuffers = {};
                initTabShell('main');

                const roleBadge = role === 'admin' ? '\x1b[35m[ADMIN]' : (role === 'standard' ? '\x1b[34m[STANDARD]' : '\x1b[36m[GUEST]');
                socket.emit('output', { tabId: 'main', data: `\r\n\x1b[32mConnected to shared terminal...\x1b[0m ${roleBadge}\r\n` });
                socket.emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
                
                if (role === 'admin') {
                    socket.emit('users-sync', {
                        active: Array.from(connectedClients.values()),
                        pending: Array.from(pendingClients.values())
                    });
                }
                broadcastUsersUpdate();
            }
        });

        socket.on('toggle-tabs', () => {
            if (authenticated && socket.role === 'admin') {
                tabsEnabled = !tabsEnabled;
                io.to('authenticated').emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
            }
        });

        socket.on('toggle-sandbox', () => {
            if (authenticated && socket.role === 'admin') {
                socket.isSandboxUnlocked = !socket.isSandboxUnlocked;
                const stateMsg = socket.isSandboxUnlocked ? 'System Sandbox Disabled: Unrestricted Mode ON' : 'System Sandbox Enabled: Regulated Mode ON';
                socket.emit('security-alert', stateMsg);
                socket.emit('sandbox-sync', socket.isSandboxUnlocked);
            }
        });

        socket.on('create-tab', () => {
            if (authenticated && socket.role === 'admin' && tabsEnabled) {
                const newId = 'tab-' + Date.now();
                initTabShell(newId);
                io.to('authenticated').emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
            }
        });

        socket.on('close-tab', (tabId) => {
            if (authenticated && socket.role === 'admin' && tabsEnabled && tabId !== 'main') {
                const ptyObj = terminalSessions[tabId];
                if (ptyObj && ptyObj.shell) {
                    ptyObj.shell.kill();
                }
                delete terminalSessions[tabId];
                io.to('authenticated').emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
            }
        });
        
        socket.on('rename-tab', (payload) => {
            if (authenticated && socket.role === 'admin' && payload.tabId && terminalSessions[payload.tabId]) {
                terminalSessions[payload.tabId].title = (payload.newTitle || 'Terminal').substring(0, 30);
                io.to('authenticated').emit('tabs-sync', { tabsEnabled, tabs: getTabsPayload() });
            }
        });

        socket.on('input', (payload) => {
            let tabId = 'main';
            let data = payload;
            if (typeof payload === 'object' && payload.tabId) {
                tabId = payload.tabId;
                data = payload.data;
            }

            const ptyObj = terminalSessions[tabId];

            if (authenticated && ptyObj && ptyObj.shell) {
                if (socket.role === 'guest') return;

                if (!socket.cmdBuffers) socket.cmdBuffers = {};
                let cmdBuffer = socket.cmdBuffers[tabId] || '';

                if (data === '\b' || data === '\x7f') {
                    cmdBuffer = cmdBuffer.slice(0, -1);
                }
                else if (!data.startsWith('\x1b')) {
                    cmdBuffer += data.replace(/\r/g, '');
                }
                socket.cmdBuffers[tabId] = cmdBuffer;

                const osMap = { 'win32': 'windows', 'linux': 'linux', 'darwin': 'mac' };
                const osKey = osMap[process.platform] || 'linux';

                const cmdLower = cmdBuffer.toLowerCase();
                const isPathTraversal = 
                    cmdLower.includes('..') ||       
                    cmdLower.includes('cd \\') ||    
                    cmdLower.includes('cd /') ||     
                    cmdLower.includes('~') ||        
                    /^[a-z]:/.test(cmdLower.trim()) ||
                    /[a-z]:[\\/]/.test(cmdLower) ||
                    /cd\s+["']?[a-z]:/.test(cmdLower);

                if (isPathTraversal && !(socket.role === 'admin' && socket.isSandboxUnlocked)) {
                    ptyObj.shell.write('\x03');
                    socket.cmdBuffers[tabId] = '';
                    io.to('authenticated').emit('security-alert', `Sandboxed: Navigation outside tool directory blocked.`);
                    return; 
                }

                if (socket.role === 'standard') {
                    if (appConfig.security) {
                        if (appConfig.security.allowed_cmds) {
                            const allowlist = appConfig.security.allowed_cmds[osKey] || [];
                            if (allowlist.length > 0) {
                                let isAllowed = false;
                                for (const allowed of allowlist) {
                                    if (allowed.startsWith(cmdBuffer) || cmdBuffer.startsWith(allowed)) {
                                        isAllowed = true;
                                        break;
                                    }
                                }
                                if (!isAllowed) {
                                    ptyObj.shell.write('\x03');
                                    socket.cmdBuffers[tabId] = '';
                                    io.to('authenticated').emit('security-alert', `Command strictly blocked (Not in allowlist).`);
                                    return;
                                }
                            }
                        }

                        if (appConfig.security.restricted_cmds) {
                            const blocklist = appConfig.security.restricted_cmds[osKey] || [];
                            for (const blocked of blocklist) {
                                if (cmdBuffer.includes(blocked)) {
                                    ptyObj.shell.write('\x03'); 
                                    socket.cmdBuffers[tabId] = '';
                                    io.to('authenticated').emit('security-alert', `Command containing "${blocked}" was blocked by administrator.`);
                                    return; 
                                }
                            }
                        }
                    }
                }

                if (data.includes('\r')) {
                    io.to('authenticated').emit('user-executed', socket.username);

                    const cmd = cmdBuffer.trim();
                    if (cmd.length > 0) {
                        commandHistory.push({ user: socket.username, cmd: cmd, tab: tabId, time: Date.now() });
                        if (commandHistory.length > MAX_HISTORY) commandHistory.shift();
                        io.to('authenticated').emit('history-data', commandHistory);
                    }
                    socket.cmdBuffers[tabId] = '';
                }

                ptyObj.shell.write(data);
            }
        });

        socket.on('request-history', () => {
            if (authenticated) {
                socket.emit('history-data', commandHistory);
            }
        });

        socket.on('resize', (payload) => {
            let tabId = 'main';
            let size = payload;
            if (payload && payload.tabId) {
                tabId = payload.tabId;
                size = payload.size;
            }
            const ptyObj = terminalSessions[tabId];
            if (authenticated && ptyObj && ptyObj.shell && size && size.cols && size.rows) {
                try {
                    ptyObj.shell.resize(size.cols, size.rows);
                } catch (e) { }
            }
        });

        socket.on('disconnect', () => {
            console.log('User disconnected:', socket.id);
            if (socket.username) {
                activeUsers.delete(socket.username);
            }
            if (connectedClients.has(socket.id)) {
                connectedClients.delete(socket.id);
                broadcastUsersUpdate();
            }
            if (pendingClients.has(socket.id)) {
                pendingClients.delete(socket.id);
                broadcastUsersUpdate();
            }
        });
    });
}

export function startServer(port, standardPass, configObj = null, sslCert = null, sslKey = null) {
    standardPassConfig = standardPass;
    if (configObj) {
        appConfig = configObj;
        if (appConfig.max_history) MAX_HISTORY = appConfig.max_history;
    }

    if (sslCert && sslKey && fs.existsSync(sslCert) && fs.existsSync(sslKey)) {
        const options = {
            key: fs.readFileSync(sslKey),
            cert: fs.readFileSync(sslCert)
        };
        server = https.createServer(options, requestHandler);
        console.log('\x1b[32mHTTPS Secure Mode Enabled.\x1b[0m');
    } else {
        server = http.createServer(requestHandler);
    }

    io = new Server(server, {
        cors: { origin: "*" }
    });

    setupSocketIO();

    return new Promise((resolve, reject) => {
        server.listen(port, () => resolve())
            .on('error', reject);
    });
}