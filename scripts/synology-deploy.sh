#!/bin/bash
# Deploy / update FamOrg on Synology NAS (run ON the NAS via SSH).
# Usage: bash scripts/synology-deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/volume1/docker/FamOrg}"
REPO_URL="${REPO_URL:-https://github.com/Nsnnam/FamOrg.git}"

echo "==> FamOrg Synology deploy"
echo "    APP_DIR=$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git pull --ff-only || git pull
fi

cd "$APP_DIR"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
fi

# Ensure HTTPS public URL (idempotent)
if grep -q '^APP_URL=' .env; then
  sed -i 's|^APP_URL=.*|APP_URL=https://namns.i234.me|' .env
else
  echo 'APP_URL=https://namns.i234.me' >> .env
fi

# Ensure ports
grep -q '^LOCAL_PORT=' .env || echo 'LOCAL_PORT=3576' >> .env
grep -q '^PUBLIC_PORT=' .env || echo 'PUBLIC_PORT=8561' >> .env
sed -i 's|^LOCAL_PORT=.*|LOCAL_PORT=3576|' .env
sed -i 's|^PUBLIC_PORT=.*|PUBLIC_PORT=8561|' .env

mkdir -p data
chmod 777 data 2>/dev/null || true

echo "==> docker compose up -d --build"
docker compose up -d --build

echo ""
echo "==> Done."
echo "    LAN:    http://192.168.1.89:3576"
echo "    Public: https://namns.i234.me  (cần Reverse Proxy DSM → localhost:3576)"
echo "    Login:  admin / admin123  (đổi ngay sau lần đầu)"
docker compose ps
