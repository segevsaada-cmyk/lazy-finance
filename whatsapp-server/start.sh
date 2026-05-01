#!/bin/bash
# Lazy Finance WhatsApp Server — Auto-start with Cloudflare tunnel
# Pushes the public tunnel URL to Lazy Finance Supabase secrets each restart.

cd "$(dirname "$0")"

export PORT=3002

# Kill old tunnel processes for this port
pkill -f "cloudflared tunnel.*localhost:3002" 2>/dev/null
sleep 1

# Install deps if needed
if [ ! -d "node_modules" ]; then
  echo "[$(date)] Installing dependencies..."
  npm install
fi

# Start WhatsApp server (if not already running)
if ! pgrep -f "node.*tizrim/whatsapp-server/index.js" > /dev/null; then
  node index.js &
  echo "[$(date)] Lazy Finance WhatsApp server started on port $PORT"
  sleep 3
fi

# Local-only mode: daily tips run via launchd → localhost:3002
# No tunnel needed since launchd runs on the same Mac as the WA server.

# Keep server alive — check health every 5 minutes
while true; do
  sleep 300
  HEALTH=$(curl -s --max-time 5 "http://localhost:$PORT/health" 2>/dev/null)
  if [ -z "$HEALTH" ]; then
    echo "[$(date)] WA server not responding, restarting..."
    pkill -f "node.*tizrim/whatsapp-server/index.js" 2>/dev/null
    sleep 2
    node index.js &
    sleep 3
  fi
done
