#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin:/Users/aashraynarang/.docker/bin:/opt/homebrew/bin:/usr/local/bin"

echo "============================================="
echo "   🚀 Starting GTAClipper Live Deployment    "
echo "============================================="

# Ensure Docker is running
if ! docker ps >/dev/null 2>&1; then
  echo "Starting Docker Desktop..."
  open -a Docker
  for i in {1..30}; do
    if docker ps >/dev/null 2>&1; then break; fi
    sleep 2
  done
fi

cd "$DIR"
echo "Starting Docker containers..."
docker compose up -d

echo "Starting Cloudflare Public Tunnel..."
/Users/aashraynarang/.gemini/antigravity/scratch/bin/start_tunnel.sh

LIVE_URL=$(cat /Users/aashraynarang/.gemini/antigravity/scratch/bin/tunnel_url.txt 2>/dev/null || echo "https://comes-whatever-heel-extract.trycloudflare.com")

echo ""
echo "============================================="
echo "   ✅ GTAClipper is LIVE and Ready!          "
echo "   🌐 Public URL: $LIVE_URL                  "
echo "   💻 Local URL:  http://localhost:3107      "
echo "   👤 User:       narangaashray34@gmail.com  "
echo "   ⭐️ Plan:       Pro (Active)               "
echo "============================================="
