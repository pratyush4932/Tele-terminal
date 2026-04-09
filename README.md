# ☁️ Tele-Terminal

> A secure, role-based, real-time shared web multiplexing terminal interface.

Tele-Terminal transforms your local command-line interface into a real-time, browser-accessible multiplexed session. By generating a private network daemon, authenticated users can collaboratively jump into a persistent interactive shell history natively inside their browsers, complete with **Role-Based Access Control (RBAC)**, strictly partitioned directory sandboxes, and manual host connection approval mechanisms.

---

### Visual Preview

![Authentication UI](public/Screenshot%202026-04-05%20154915.png)

![Collaborative Terminal Session](public/Screenshot%202026-04-05%20154939.png)

---

## 🔥 Features Summary

- **Role-Based Access Control (RBAC):** Supports 3 unique tiers of execution:
  - **Admin:** Has global, unrestricted bypassing rights directly mapped via `config.json`.
  - **Standard User:** Inherently subjected to strict command blocklists, OS-specific keyword restrictions, and trapped rigidly inside a directory sandbox. 
  - **Guest:** Hardcoded view-only mode. Input sequences are completely discarded before hitting the PTY stream. 
- **Multi-Tab Orchestration:** Admins can spawn multiple independent PTY terminal sessions within the same browser, natively synced to all connected users, and can dynamically rename or close tabs collaboratively.
- **Global Directory Sandbox:** Intelligent regex maps lock Standard users into their initial connection directory natively. Admins feature a dedicated UI **Sandbox Override** switch to dynamically break out.
- **Keystroke Application Firewalls:** Keystroke buffer telemetry scans each active buffer context *before* executing commands, intercepting destructive sequences globally based on the host OS. Includes Support for both **Strict Allowlists** and native blocklists.
- **Advanced Administrator Dashboards:** Real-time user connectivity lists that broadcast standard active users, track native IP metadata, and show highly visible "Pending Connection" status warnings.
- **Manual Host Approval Gatekeeper:** The central CLI natively intercepts connection streams natively using `inquirer`, rendering a giant `Y/n` prompt natively on the host's physical machine. The web UI seamlessly integrates into this flow by parking connections automatically.
- **Strict Password Integrity:** Server configuration sequences execute global regex-checks globally mandating Minimum 8 characters with Uppercase, Lowercase, and Special symbols across all accounts.
- **Fully Responsive Telemetry:** Web viewport structures built strictly with CSS boundaries that adapt intuitively to both mobile devices (bypassing native iOS/Android zoom traps) and vast desktop monitors.

### 📊 Feature Matrix

| Feature | Admin | Standard | Guest |
|---------|-------|----------|-------|
| Read Terminal Output | ✅ | ✅ | ✅ |
| Execute Native Commands | ✅ | ✅ | ❌ |
| Directory Path Traversal | ✅ (Toggleable) | ❌ Restricted | ❌ |
| Bypasses Command Blocklist | ✅ | ❌ | ❌ |
| Manage Multiple Tabs | ✅ | ❌ View Only | ❌ View Only |
| View Active/Pending Users | ✅ | ❌ | ❌ |
| Requires Host TUI Approval | Configurable | Configurable | Configurable |

---

## 🏗 System Architecture

1. **The Orchestrator (`bin/cli.js`):** An intuitive TUI wizard powered by `inquirer` that prompts the host for execution variables, mandates the config parser structure, verifies passwords, and holds the active `Host Approval` loop.
2. **The Backend (`src/index.js`):** The beating heart. Instantiates `node-pty` into an OS-bound shell (`powershell.exe` for Windows, `bash` natively). Applies RBAC policies natively over multiplexed Socket.IO signals before committing standard bytes natively into the backend streams.
3. **The Frontend (`src/index.html`):** Renders the payload utilizing `xterm.js`. Beautiful UI overhauls including Native Glassmorphism login modals and floating red Security Toasts to notify active authenticated connections when anomalous keystrokes are ripped away.

---

## 🚀 Installation & Usage

### 1. NPM Installation
Install the package globally so your OS recognizes it as a native command:
```bash
npm install -g @pratyush4932/tele-terminal@latest
```

### 2. Configure Your Session
Tele-Terminal natively relies upon a persistent `config.json` block for mapping global users. 

**For full configuration steps, please check out the [CONFIG_GUIDE.md](./CONFIG_GUIDE.md).**

Once you have your passwords sorted, execute the package natively:
```bash
tshare
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
Ngrok will generate a secure URL (e.g. `https://1a2b-3c4d.ngrok.app`). Share this URL and your created passwords with your colleagues. They can now enter your local shell seamlessly through their browser! 

---

## ⚠️ Security Disclaimer 

**Use at your own risk.** 

Tele-Terminal provides **direct, authenticated pseudo-terminal access** to the host machine’s actual OS user account. Any user with the password controls the machine with your application's current disk/system elevation rights. 
- Do **not** deploy this on public, untrusted domain spheres without proper secondary network guardrails (firewalls, rate mitigations) or strictly locking down `config.json`.
- Be mindful of reverse tunneling (Ngrok, Cloudflare) bypassing standard NAT securities. 
- Ensure that the TUI Host Approval system remains checked enabled (`Y`) natively inside the terminal if operating over raw public networks.
