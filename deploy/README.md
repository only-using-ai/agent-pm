# Agent PM daemon

Run the API server as a background service so it stays up and can start on login/boot. Works on **Linux**, **macOS**, and **Windows**. All code stays in your project directory; restart the service after code changes.

## Prerequisites

- Node.js and project deps installed (`npm install`)

## Install (any OS)

From your **agent-pm** project root:

```bash
npm run daemon
```

For a **user-level** install (no sudo on Linux/macOS):

```bash
npm run daemon:user
```

The installer detects your OS and sets up the right service. Then start it using the commands below for your platform.

---

## Linux (systemd)

- **Install:** `npm run daemon` (system-wide; script will prompt for sudo) or `npm run daemon:user`
- **Start:** `sudo systemctl start agent-pm` or `systemctl --user start agent-pm`
- **Stop:** `sudo systemctl stop agent-pm` or `systemctl --user stop agent-pm`
- **Status:** `sudo systemctl status agent-pm` or `systemctl --user status agent-pm`
- **Logs:** `journalctl -u agent-pm -f` or `journalctl --user -u agent-pm -f`
- **Start on boot/login:** `sudo systemctl enable agent-pm` or `systemctl --user enable agent-pm`

---

## macOS (launchd)

- **Install:** `npm run daemon` (system-wide may need sudo) or `npm run daemon:user`
- **Start:** `launchctl load ~/Library/LaunchAgents/org.agent-pm.plist` (user) or `sudo launchctl load /Library/LaunchDaemons/org.agent-pm.plist`
- **Stop:** `launchctl unload ~/Library/LaunchAgents/org.agent-pm.plist` or `sudo launchctl unload /Library/LaunchDaemons/org.agent-pm.plist`
- **Status:** `launchctl list | grep org.agent-pm`
- **Logs:** `tail -f deploy/agent-pm.log`

---

## Windows (Scheduled Task)

The installer creates a task that runs the server at **logon**.

- **Install:** `npm run daemon`
- **Start now:** `Start-ScheduledTask -TaskName "Agent PM"`
- **Stop:** `Stop-ScheduledTask -TaskName "Agent PM"`
- **Status:** `Get-ScheduledTask -TaskName "Agent PM"`
- **Uninstall:** `Unregister-ScheduledTask -TaskName "Agent PM"`

---

## Port

The server listens on **38472** by default (see `server/config.ts`). Override with `PORT` or `AGENT_PM_PORT` in the service/plist/task or in the environment.
