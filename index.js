import pty from 'node-pty';
import { Server } from 'socket.io';
import http from 'http';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export let sessionPassword = "pratyush";

const server = http.createServer((req, res) => {
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
});
const io = new Server(server, {
    cors: { origin: "*" }
});

const MAX_HISTORY = 100;
const commandHistory = [];
const activeUsers = new Set();

let sharedShell = null;

function initSharedShell() {
    if (sharedShell) return;

    const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || 'bash');

    sharedShell = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME || process.env.USERPROFILE || os.homedir() || process.cwd(),
        env: process.env
    });

    sharedShell.onData((data) => {
        io.to('authenticated').emit('output', data);
    });

    sharedShell.on('exit', () => {
        sharedShell = null;
    });
}

io.on('connection', (socket) => {
    console.log('New connection:', socket.id);
    let authenticated = false;

    socket.on('auth', (data) => {
        const attemptedUsername = data.username || 'Anonymous';
        
        if (data.password !== sessionPassword) {
            socket.emit('output', '\r\n\x1b[31mAccess Denied: Incorrect Password\x1b[0m\r\n');
        } else if (activeUsers.has(attemptedUsername)) {
            socket.emit('output', `\r\n\x1b[31mAccess Denied: Username '${attemptedUsername}' is already taken in this session.\x1b[0m\r\n`);
        } else {
            authenticated = true;
            socket.username = attemptedUsername;
            activeUsers.add(socket.username);
            socket.join('authenticated');
            initSharedShell();
            socket.emit('output', '\r\n\x1b[32mConnected to shared terminal...\x1b[0m\r\n');
        }
    });

    socket.cmdBuffer = '';

    socket.on('input', (data) => {
        if (authenticated && sharedShell) {
            if (data === '\b' || data === '\x7f') {
                socket.cmdBuffer = socket.cmdBuffer.slice(0, -1);
            }
            else if (!data.startsWith('\x1b')) {
                socket.cmdBuffer += data.replace(/\r/g, '');
            }

            if (data.includes('\r')) {
                io.to('authenticated').emit('user-executed', socket.username);

                const cmd = socket.cmdBuffer.trim();
                if (cmd.length > 0) {
                    commandHistory.push({ user: socket.username, cmd: cmd, time: Date.now() });
                    if (commandHistory.length > MAX_HISTORY) commandHistory.shift();
                    io.to('authenticated').emit('history-data', commandHistory);
                }
                socket.cmdBuffer = '';
            }

            sharedShell.write(data);
        }
    });

    socket.on('request-history', () => {
        if (authenticated) {
            socket.emit('history-data', commandHistory);
        }
    });

    socket.on('resize', (size) => {
        if (authenticated && sharedShell && size && size.cols && size.rows) {
            try {
                sharedShell.resize(size.cols, size.rows);
            } catch (e) { }
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (socket.username) {
            activeUsers.delete(socket.username);
        }
    });
});

export function startServer(port, password) {
    sessionPassword = password;
    return new Promise((resolve, reject) => {
        server.listen(port, () => resolve())
              .on('error', reject);
    });
}