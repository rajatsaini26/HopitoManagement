#!/bin/sh

echo "[SOCAT] Connecting to COM8 via TCP..."

# Start socat and capture PTY path
SOCAT_LOG=$(mktemp)
/usr/bin/socat -d -d PTY,raw,echo=0 TCP:host.docker.internal:5000 2> "$SOCAT_LOG" &

# Wait up to 5 seconds for PTY to appear
for i in 1 2 3 4 5; do
  PTY=$(grep -o '/dev/pts/[0-9]\+' "$SOCAT_LOG" | head -n 1)
  if [ -n "$PTY" ]; then break; fi
  sleep 1
done

if [ -n "$PTY" ]; then
  ln -sf "$PTY" /dev/ttyUSB0
  echo "[SOCAT] Linked $PTY → /dev/ttyUSB0"
else
  echo "[SOCAT] ❌ Failed to find PTY after 5 seconds"
  cat "$SOCAT_LOG"
  exit 1
fi

# Start your actual app
exec npm start
