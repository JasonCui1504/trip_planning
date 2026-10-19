#!/bin/bash
# Stops the Trip Workshop background server and removes its LaunchAgent.
# Your trips (data/) and the app folder itself are left untouched; remove the
# Dock icon by dragging it out of the Dock.
set -euo pipefail
LABEL="com.tripworkshop.server"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "Trip Workshop's background server is stopped and won't start at login."
