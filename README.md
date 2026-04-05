# ☁️ Tele-Terminal

> A beautiful, high-performance, synchronized cross-platform shared web terminal.

Tele-Terminal transforms your local command-line interface into a real-time, browser-accessible multiplexed session. By generating a private network daemon, securely authenticated users can remotely execute commands, jump into a persistent interactive shell history, and collaborate synchronously within the exact same pseudo-terminal (PTY) environment natively inside their browsers.

---

### Visual Preview

![Authentication UI](public/Screenshot%202026-04-05%20154915.png)

![Collaborative Terminal Session](public/Screenshot%202026-04-05%20154939.png)

---

## 🔥 Features Summary

- **Real-Time Multiplexing (Matrix Sockets):** Utilizes `Socket.IO` to stream raw PTY byte buffers to `n`-concurrent clients with near-zero latency.
- **PTY Dimension Synchronization:** Solves traditional web-shell visual tearing. Automatically intercepts frontend viewport dimensions and synchronizes the backend VT100 physical wrapper matrix dynamically.
- **Keystroke Buffering & Attribution:** Features a high-fidelity algorithmic parser to track user-execution telemetry (discarding strict ANSI sequences) to power a live, responsive chat-style **Command History Modal**.
- **Aesthetic Excellence:** Completely overhauls standard UI using native CSS glassmorphism, animated macro-blobs, and OS-agnostic macOS-style framing over a customized `xterm.js` canvas.
- **Strict Session Context:** Engineered to aggressively drop ghosted clients. A disconnect listener forces an immediate Local-Storage purge, returning dead sessions instantly back to the authentication gateway. 

---

## 🏗 System Architecture

The core relies on a highly decoupled Web Application architecture leveraging OS-native streams directly piped into WebSockets:

1. **The Orchestrator (`bin/cli.js`):** An intuitive TUI wizard powered by `inquirer` that prompts the host for execution variables (binding port, secure password shell).
2. **The Backend (`index.js`):** Uses `node-pty` to spawn an underlying OS-bound shell (`powershell.exe` for Windows, `bash` natively). It aggregates `stdout` and multicasts physical outputs sequentially into the `authenticated` Socket.IO websocket room.
3. **The Frontend (`index.html`):** Renders the payload utilizing `xterm.js` combined with standard CSS. Upstream inputs are dynamically dispatched, with terminal resizing actions triggering bidirectional backend layout reconciliation.

---

## 🚀 Installation & Usage

> **Note:** The official NPM repository package is currently down/unavailable for the time being. Please use the Git Clone method below to install and run the tool locally.

### 1. Manual Git Clone
First, clone the repository and install all required framework dependencies:
```bash
git clone https://github.com/your-username/tele-terminal.git
cd tele-terminal
npm install
```

Then, link the package globally so your OS recognizes it as a native command:
```bash
npm link
```

### 2. Execute the Package
Once installed or linked, simply type the executable shortcut in any terminal on your system:
```bash
tshare
```

### 2. Configure Your Session
The internal wizard will sequentially command your OS to initialize:
```bash
☁️  Welcome to Tele-Terminal Setup ☁️

? Create a secure password for this web shell session: ********
? What port should the server bind to? 3000
```

### 3. Connect Locally
Browse to `http://localhost:3000` (or your internal LAN address provided by the prompt) to open the interactive terminal in your browser. 

---

## 🌍 Exposing to the World (Ngrok Tunneling)

Running this locally only permits developers on your current Wi-Fi network to collaborate. To share the terminal with anyone on the planet, leverage a reverse tunnel like **Ngrok**.

**1. Start your Tele-Terminal natively first:**
```bash
tshare
# Bind it to Port 3000
```

**2. In a brand new terminal, start an Ngrok secure HTTP tunnel pointing to that port:**
```bash
ngrok http 3000
```

**3. Share the Forwarding URL!**
Ngrok will generate a secure URL (e.g. `https://1a2b-3c4d.ngrok.app`). Share this URL and your created password with your colleagues. They can now enter your local shell seamlessly through their browser! 

---

## ⚠️ Security Disclaimer 

**Use at your own risk.** 

Tele-Terminal provides **direct, authenticated pseudo-terminal access** to the host machine’s actual OS user account. Any user with the password controls the machine with your application's current disk/system elevation rights. 
- Do **not** deploy this on public, untrusted domain spheres without proper secondary network guardrails (firewalls, rate mitigations).
- Be mindful of reverse tunneling (Ngrok, Cloudflare) bypassing standard NAT securities. 
- Once a session executes `rm -rf /` or malicious actions, the changes to the host OS are immediate and permanent.
