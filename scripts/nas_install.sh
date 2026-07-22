#!/bin/bash
# Run on Synology as root (sudo bash nas_install.sh)
# Pull prebuilt image first (avoids Alpine DNS/build failures on NAS).
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/sbin

APP_DIR="/volume5/docker/FamOrg"
PUBLIC_URL="https://namns.i234.me:8561"
REPO_TARBALL="https://github.com/Nsnnam/FamOrg/archive/refs/heads/main.tar.gz"
# Prebuilt public image (amd64 OK for DS920+)
IMAGE_DEFAULT="ghcr.io/happysmartlight/family-organizer:latest"

echo "==> Preparing ${APP_DIR}"
mkdir -p /volume5/docker
cd /volume5/docker
rm -rf FamOrg.tmp
mkdir -p FamOrg.tmp
cd FamOrg.tmp

echo "==> Downloading compose/config source"
if command -v wget >/dev/null 2>&1; then
  wget -O main.tar.gz "$REPO_TARBALL"
else
  curl -fsSL -o main.tar.gz "$REPO_TARBALL"
fi

tar -xzf main.tar.gz
SRC=$(ls -d FamOrg-* | head -1)
rm -rf "${APP_DIR}.new"
mv "$SRC" "${APP_DIR}.new"

if [ -d "${APP_DIR}/data" ]; then
  echo "==> Preserving data/"
  mkdir -p "${APP_DIR}.new/data"
  cp -a "${APP_DIR}/data/." "${APP_DIR}.new/data/" || true
fi
if [ -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env" "${APP_DIR}.new/.env" || true
fi

rm -rf "${APP_DIR}.old"
if [ -d "${APP_DIR}" ]; then
  mv "${APP_DIR}" "${APP_DIR}.old"
fi
mv "${APP_DIR}.new" "${APP_DIR}"
rm -rf /volume5/docker/FamOrg.tmp

cd "${APP_DIR}"
if [ ! -f .env ]; then
  cp .env.example .env
fi

grep -q '^LOCAL_PORT=' .env || echo 'LOCAL_PORT=3576' >> .env
grep -q '^PUBLIC_PORT=' .env || echo 'PUBLIC_PORT=8561' >> .env
grep -q '^APP_URL=' .env || echo "APP_URL=${PUBLIC_URL}" >> .env
grep -q '^GITHUB_REPO=' .env || echo 'GITHUB_REPO=Nsnnam/FamOrg' >> .env
grep -q '^WATCHTOWER_HTTP_API_TOKEN=' .env || echo 'WATCHTOWER_HTTP_API_TOKEN=dea0bef7609b468058a3115d3a4b9e8b5c207c9a7365d913' >> .env
grep -q '^IMAGE=' .env || echo "IMAGE=${IMAGE_DEFAULT}" >> .env

sed -i "s|^LOCAL_PORT=.*|LOCAL_PORT=3576|" .env
sed -i "s|^PUBLIC_PORT=.*|PUBLIC_PORT=8561|" .env
sed -i "s|^APP_URL=.*|APP_URL=${PUBLIC_URL}|" .env
sed -i "s|^GITHUB_REPO=.*|GITHUB_REPO=Nsnnam/FamOrg|" .env
# Ensure IMAGE line uses prebuilt (overwrite if empty/old)
if grep -q '^IMAGE=' .env; then
  sed -i "s|^IMAGE=.*|IMAGE=${IMAGE_DEFAULT}|" .env
else
  echo "IMAGE=${IMAGE_DEFAULT}" >> .env
fi

# Patch docker-compose if downloaded copy still points only at nsnnam without IMAGE var
# (main already has IMAGE=; force write compose snippet not needed if repo updated)

mkdir -p data
chmod 777 data || true

echo "==> .env"
cat .env

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo "==> Pull prebuilt images (no local build)"
$COMPOSE pull || true
docker pull "${IMAGE_DEFAULT}" || true
docker pull containrrr/watchtower || true

# Tag so compose image name matches if needed
# Compose uses IMAGE from .env

echo "==> Start stack (pull only, no --build)"
$COMPOSE down || true
$COMPOSE up -d --pull always
$COMPOSE ps
$COMPOSE logs --tail=60 family-organizer || true

echo "==> Health check"
sleep 5
curl -sS -o /dev/null -w "3576 -> %{http_code}\n" http://127.0.0.1:3576/ || true
curl -sS -o /dev/null -w "8561 -> %{http_code}\n" http://127.0.0.1:8561/ || true

echo "==> Done"
echo "LAN:    http://192.168.1.89:3576"
echo "Public: ${PUBLIC_URL}"
echo "Login:  admin / admin123"
