#!/usr/bin/env bash
# Install Agent PM API server as a system service.
# Run from project root: npm run daemon
# Or: ./deploy/install-daemon.sh [--user]
# Supports: Linux (systemd), macOS (launchd). Windows uses deploy/install-daemon.ps1 via run-daemon-install.js.

set -e

USER_MODE=
while [[ $# -gt 0 ]]; do
  case $1 in
    --user)
      USER_MODE=1
      shift
      ;;
    *)
      echo "Usage: $0 [--user]" >&2
      echo "  --user  install for current user (Linux: systemd user; macOS: LaunchAgents)" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OS="$(uname -s)"

# --- Linux (systemd) ---
install_linux() {
  local SERVICE_NAME="agent-pm.service"
  local SERVICE_SRC="$SCRIPT_DIR/$SERVICE_NAME"

  if [[ ! -f "$SERVICE_SRC" ]]; then
    echo "Error: $SERVICE_SRC not found." >&2
    exit 1
  fi

  if ! command -v systemctl &>/dev/null; then
    echo "Error: systemctl not found. systemd is required." >&2
    exit 1
  fi

  if [[ -n "$USER_MODE" ]]; then
    UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
    mkdir -p "$UNIT_DIR"
    SUDO=
  else
    UNIT_DIR="/etc/systemd/system"
    if [[ ! -w "$UNIT_DIR" ]]; then
      echo "Installing system-wide requires sudo."
      echo "  Run: sudo $0"
      echo "Or install for your user (no sudo): npm run daemon:user"
      exit 0
    fi
    SUDO=sudo
  fi

  sed "s|REPLACE_WITH_PROJECT_PATH|$PROJECT_ROOT|g" "$SERVICE_SRC" | $SUDO tee "$UNIT_DIR/$SERVICE_NAME" > /dev/null

  if [[ -n "$USER_MODE" ]]; then
    systemctl --user daemon-reload
  else
    $SUDO systemctl daemon-reload
  fi

  echo "Installed: $UNIT_DIR/$SERVICE_NAME"
  echo ""
  echo "Next steps:"
  if [[ -n "$USER_MODE" ]]; then
    echo "  systemctl --user start agent-pm"
    echo "  systemctl --user enable agent-pm   # optional: start on login"
    echo "  systemctl --user status agent-pm"
    echo "  journalctl --user -u agent-pm -f   # logs"
  else
    echo "  sudo systemctl start agent-pm"
    echo "  sudo systemctl enable agent-pm    # optional: start on boot"
    echo "  sudo systemctl status agent-pm"
    echo "  journalctl -u agent-pm -f          # logs"
  fi
}

# --- macOS (launchd) ---
install_macos() {
  local PLIST_NAME="org.agent-pm.plist"
  local PLIST_SRC="$SCRIPT_DIR/$PLIST_NAME"

  if [[ ! -f "$PLIST_SRC" ]]; then
    echo "Error: $PLIST_SRC not found." >&2
    exit 1
  fi

  if [[ -n "$USER_MODE" ]]; then
    PLIST_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$PLIST_DIR"
    sed "s|REPLACE_WITH_PROJECT_PATH|$PROJECT_ROOT|g" "$PLIST_SRC" > "$PLIST_DIR/$PLIST_NAME"
  else
    PLIST_DIR="/Library/LaunchDaemons"
    if [[ ! -w "/Library" ]]; then
      echo "Installing system-wide requires sudo."
      echo "  Run: sudo $0"
      echo "Or install for your user (no sudo): npm run daemon:user"
      exit 0
    fi
    sed "s|REPLACE_WITH_PROJECT_PATH|$PROJECT_ROOT|g" "$PLIST_SRC" | sudo tee "$PLIST_DIR/$PLIST_NAME" > /dev/null
    sudo chown root:wheel "$PLIST_DIR/$PLIST_NAME"
  fi

  echo "Installed: $PLIST_DIR/$PLIST_NAME"
  echo ""
  echo "Next steps:"
  if [[ -n "$USER_MODE" ]]; then
    echo "  launchctl load ~/Library/LaunchAgents/$PLIST_NAME"
    echo "  launchctl unload ~/Library/LaunchAgents/$PLIST_NAME   # stop"
    echo "  launchctl list | grep org.agent-pm                     # status"
    echo "  tail -f $PROJECT_ROOT/deploy/agent-pm.log              # logs"
  else
    echo "  sudo launchctl load $PLIST_DIR/$PLIST_NAME"
    echo "  sudo launchctl unload $PLIST_DIR/$PLIST_NAME   # stop"
    echo "  sudo launchctl list | grep org.agent-pm        # status"
    echo "  tail -f $PROJECT_ROOT/deploy/agent-pm.log     # logs"
  fi
}

# --- Dispatch ---
case "$OS" in
  Linux)
    install_linux
    ;;
  Darwin)
    install_macos
    ;;
  *)
    echo "Error: Unsupported OS '$OS'. This script supports Linux (systemd) and macOS (launchd)." >&2
    echo "On Windows use: npm run daemon  (runs PowerShell installer)." >&2
    exit 1
    ;;
esac
