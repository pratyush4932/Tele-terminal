# ⚙️ Configuration Guide (`config.json`)

Tele-Terminal uses a highly persistent `config.json` payload map placed in the same exact directory as execution to globally manage persistent users, rule logic, and operating-system-based application firewalls. 

If this file is entirely missing, the Tele-Terminal server will proactively render a demo structure for you natively inside your system on its next boot sequence.

---

## The Default Schema

Below is the required schema block. **You MUST structure your file exactly like this.**

```json
{
  "port": 3000,
  "max_history": 100,
  "shell": "",
  "ssl_cert": "",
  "ssl_key": "",
  "theme": {
    "background": "#111111",
    "foreground": "#f8f8f2",
    "cursor": "#667eea",
    "cursorAccent": "#111111",
    "selection": "rgba(255, 255, 255, 0.1)",
    "black": "#21222C",
    "red": "#FF5555",
    "green": "#50FA7B",
    "yellow": "#F1FA8C",
    "blue": "#BD93F9",
    "magenta": "#FF79C6",
    "cyan": "#8BE9FD",
    "white": "#F8F8F2"
  },
  "ui": {
    "title": "Shared Terminal Session"
  },
  "users": {
    "admin": {
      "username": "superadmin",
      "password": "SuperAwesomeAdmin@1"
    },
    "guest": {
      "username": "guestviewer",
      "password": "GuestReadOnly@123"
    }
  },
  "security": {
    "require_approval": true,
    "restricted_cmds": {
      "windows": ["del /s", "format", "shutdown", "rmdir /s", "diskpart"],
      "linux": ["rm -rf", "mkfs", "shutdown", "reboot", "dd"],
      "mac": ["rm -rf", "mkfs", "shutdown", "reboot", "sudo rm"]
    },
    "allowed_cmds": {
      "windows": [],
      "linux": [],
      "mac": []
    }
  }
}
```

---

## 🔒 1. Security Integrations & Passwords

Tele-Terminal does **NOT** trust simplistic passwords. Both your Admin credentials and Guest credentials stored inside `config.json`, as well as your dynamic Standard passwords created from the CLI, are natively bound by an unbreakable algorithmic verification string before the server even allows execution.

### The Password Rules:
- Passwords must be at minimum **8 characters long**.
- Passwords must contain at least **1 Lowercase Character**.
- Passwords must contain at least **1 Uppercase Character**.
- Passwords must contain at least **1 Special Character** (`!`, `@`, `$`, etc).

> **Important:** If your mapped `"password"` strings in the `config.json` block fail this test, the server completely aborts and throws a red `SECURITY POLICY VIOLATION` error in your face asking you to immediately open `config.json` and change them to complex strings. 

### Identity Rules (Usernames):
The usernames you enter dynamically in `config.json` (like `"superadmin"`) will permanently overrule anything the individual manually inputs into the visual web modal when connecting to the terminal over the network. 

---

## 🛡️ 2. The Application Firewalls (`restricted_cmds`)

The system understands that your host Operating System changes based on where `tshare` runs. This is why we split keyword firewalls natively by OS tree: `windows`, `linux`, `mac`.

This `restricted_cmds` array actively analyzes and monitors keystroke buffer buffers for basic Standard Users logging into the web interface. 
- If a Standard User types `rm -rf /` natively in Linux, the server parses the active array and violently terminates their command sequences natively, tossing a red Security Toast backward into their frontend UI.
- The **Admin User** completely bypasses these restrictions natively.

### What is `allowed_cmds`?
It acts as a literal **Allowlist** opposite to blocklists.
- If the `"allowed_cmds": { "windows": [] }` array is completely left empty (default), Tele-Terminal safely allows all commands except those matched in `restricted_cmds`.
- **If you map even a single word into an `allowed_cmds` OS array**, the terminal flips modes—aggressively blocking ALL commands the user executes *except* those structurally mapped in the `allowed_cmds` array. 

---

## 🛑 3. Host Authentication Override (`require_approval`)

The JSON natively accepts `require_approval: true`.
When enabled, it completely locks down the Socket stream layer. A web-user could bypass the password validation check locally inside the browser completely successfully, natively gaining access to the room—**but their screen freezes in limbo.**

The backend CLI (`cli.js`) stops the Node process over at the Host machine, waiting for the active computer owner to physically hit `Y` or `n` on their keyboard to officially inject the PTY instance pipeline into that specific web user instance! 

You can toggle this manually inside the configuration file over here, or directly configure the bypass prompt shown during `tshare` startup wizard procedures.
