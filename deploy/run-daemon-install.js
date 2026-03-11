#!/usr/bin/env node
/**
 * Cross-platform launcher for daemon install.
 * npm run daemon / npm run daemon:user
 * On Windows runs PowerShell script; on Linux/macOS runs bash script.
 */

import { execSync } from "child_process";
import path from "path";

const projectRoot = process.cwd();
const deployDir = path.join(projectRoot, "deploy");
const args = process.argv.slice(2); // e.g. ["--user"]

if (process.platform === "win32") {
  const psScript = path.join(deployDir, "install-daemon.ps1");
  const userArg = args.includes("--user") ? "-User" : "";
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -File "${psScript}" ${userArg}`.trim(),
    { stdio: "inherit", cwd: projectRoot }
  );
} else {
  const bashScript = path.join(deployDir, "install-daemon.sh");
  const cmd = ["bash", bashScript, ...args].join(" ");
  execSync(cmd, { stdio: "inherit", cwd: projectRoot });
}
