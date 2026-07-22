#!/bin/bash
# Run on Synology as root (sudo bash nas_install.sh)
# Pull prebuilt image first (avoids Alpine DNS/build failures on NAS).
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/sbin

APP_DIR="/path/to/your/famorg"
PUBLIC_URL="https://your-domain.example:8443"
REPO_TARBALL="https://github.com/your-github-user/FamOrg/archive/refs/heads/main.tar.gz"
# Prebuilt public image (amd64 OK for DS920+)
IMAGE_DEFAULT="ghcr.io/happysmartlight/family-organizer:latest"

echo "==> Preparing ${APP_DIR}"
mkdir -p /path/to/your/docker
cd /path/to/your/docker
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
rm -rf /path/to/your/famorg.tmp

cd "${APP_DIR}"
if [ ! -f .env ]; then
  cp .env.example .env
fi

grep -q '^LOCAL_PORT=' .env || echo 'LOCAL_PORT=3000' >> .env
grep -q '^PUBLIC_PORT=' .env || echo 'PUBLIC_PORT=8443' >> .env
grep -q '^APP_URL=' .env || echo "APP_URL=${PUBLIC_URL}" >> .env
grep -q '^GITHUB_REPO=' .env || echo 'GITHUB_REPO=your-github-user/FamOrg' >> .env
grep -q '^WATCHTOWER_HTTP_API_TOKEN=' .env || echo 'WATCHTOWER_HTTP_API_TOKEN=GENERATE_A_NEW_TOKEN_DURING_INSTALL' >> .env
grep -q '^IMAGE=' .env || echo "IMAGE=${IMAGE_DEFAULT}" >> .env

sed -i "s|^LOCAL_PORT=.*|LOCAL_PORT=3000|" .env
sed -i "s|^PUBLIC_PORT=.*|PUBLIC_PORT=8443|" .env
sed -i "s|^APP_URL=.*|APP_URL=${PUBLIC_URL}|" .env
sed -i "s|^GITHUB_REPO=.*|GITHUB_REPO=your-github-user/FamOrg|" .env
# Ensure IMAGE line uses prebuilt (overwrite if empty/old)
if grep -q '^IMAGE=' .env; then
  sed -i "s|^IMAGE=.*|IMAGE=${IMAGE_DEFAULT}|" .env
else
  echo "IMAGE=${IMAGE_DEFAULT}" >> .env
fi

# Patch docker-compose if downloaded copy still points only at your-github-user without IMAGE var
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
curl -sS -o /dev/null -w "3000 -> %{http_code}\n" http://127.0.0.1:3000/ || true
curl -sS -o /dev/null -w "8443 -> %{http_code}\n" http://127.0.0.1:8443/ || true

echo "==> Done"
echo "LAN:    http://192.0.2.10:3000"
echo "Public: ${PUBLIC_URL}"
echo "Login:  admin / admin123"
