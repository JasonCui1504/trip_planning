#!/bin/bash
# Installs Trip Workshop as a background app on this Mac.
#
#   - installs dependencies and builds the web app
#   - registers a LaunchAgent so the server starts at login and restarts if it
#     crashes (this is also what lets Price watch check prices every day)
#   - opens the app in your browser
#
# Safe to run again, e.g. after `git pull`, to rebuild and restart.
# Remove everything with scripts/mac/uninstall.sh.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LABEL="com.tripworkshop.server"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_DIR="$HOME/Library/Logs/TripWorkshop"
cd "$APP_DIR"

NODE="$(command -v node || true)"
if [ -z "$NODE" ]; then
  echo "Node.js isn't installed. Install it from https://nodejs.org (LTS) or with: brew install node" >&2
  exit 1
fi
NODE_MAJOR="$("$NODE" -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Trip Workshop needs Node.js 20 or newer (found $("$NODE" -v)). Update from https://nodejs.org" >&2
  exit 1
fi

PORT="$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d '[:space:]' || true)"
PORT="${PORT:-8787}"
URL="http://localhost:$PORT"

echo "→ Installing dependencies…"
npm install --no-audit --no-fund
echo "→ Building the app…"
npm run build
[ -f .env ] || { cp .env.example .env; echo "→ Created .env (add API keys there later)"; }

echo "→ Registering the background server…"
mkdir -p "$HOME/Library/LaunchAgents" "$LOG_DIR"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$APP_DIR/node_modules/tsx/dist/cli.mjs</string>
    <string>server/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$APP_DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
    <key>PATH</key><string>$(dirname "$NODE"):/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/server.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/server.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo -n "→ Starting"
for _ in $(seq 1 30); do
  if curl -fs "$URL/api/health" >/dev/null 2>&1; then
    echo " — running at $URL"
    open "$URL"
    cat <<MSG

Trip Workshop is running and will start automatically when you log in.

To put it in your Dock:
  • Safari: with the app open, choose File → Add to Dock…
  • Chrome: click the install icon (⊕) in the address bar, or ⋮ → Cast, save and share → Install page as app…
            then right-click its Dock icon → Options → Keep in Dock.

Logs: $LOG_DIR/server.log
MSG
    exit 0
  fi
  echo -n "."
  sleep 1
done
echo
echo "The server didn't come up. Check $LOG_DIR/server.log" >&2
exit 1
