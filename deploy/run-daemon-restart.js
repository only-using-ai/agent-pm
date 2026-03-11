#!/usr/bin/env node
/**
 * Cross-platform daemon restart.
 * npm run daemon:restart [-- --user]
 * On Windows: restarts the Scheduled Task.
 * On Linux: systemctl restart (or --user for user unit).
 * On macOS: launchctl kickstart (or --user for LaunchAgents).
 */

import { execSync } from "child_process";
import { platform } from "process";

const args = process.argv.slice(2);
const userMode = args.includes("--user");

if (platform === "win32") {
  const taskName = "Agent PM";
  try {
    execSync(`powershell -NoProfile -Command "Stop-ScheduledTask -TaskName '${taskName}' -ErrorAction SilentlyContinue; Start-Sleep -Seconds 1; Start-ScheduledTask -TaskName '${taskName}'"`, {
      stdio: "inherit",
    });
    console.log("Daemon restart requested.");
  } catch (e) {
    console.error("Restart failed. Is the daemon installed? Run: npm run daemon");
    process.exit(1);
  }
} else if (platform === "linux") {
  try {
    if (userMode) {
      execSync("systemctl --user restart agent-pm.service", { stdio: "inherit" });
    } else {
      execSync("sudo systemctl restart agent-pm.service", { stdio: "inherit" });
    }
    console.log("Daemon restarted.");
  } catch (e) {
    console.error("Restart failed. Is the daemon installed? Run: npm run daemon or npm run daemon:user");
    process.exit(1);
  }
} else if (platform === "darwin") {
  const label = "org.agent-pm";
  try {
    if (userMode) {
      const uid = process.getuid?.() ?? execSync("id -u", { encoding: "utf8" }).trim();
      execSync(`launchctl kickstart -k gui/${uid}/${label}`, { stdio: "inherit" });
    } else {
      execSync(`sudo launchctl kickstart -k system/${label}`, { stdio: "inherit" });
    }
    console.log("Daemon restarted.");
  } catch (e) {
    console.error("Restart failed. Is the daemon installed? Run: npm run daemon or npm run daemon:user");
    process.exit(1);
  }
} else {
  console.error("Unsupported platform for daemon restart.");
  process.exit(1);
}
