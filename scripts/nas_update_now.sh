#!/bin/bash
# Update FamOrg on Synology in-place (preserve data/ + certs/ + .env keys)
set -euo pipefail
export PATH=/usr/local/bin:/usr/bin:/bin:/sbin

APP=/path/to/your/famorg
IMAGE=ghcr.io/your-github-user/famorg:latest
REPO_TARBALL=https://github.com/your-github-user/FamOrg/archive/refs/heads/main.tar.gz
TMP=/path/to/your/famorg.tmp

echo "==> Current containers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}' || true

echo "==> Download latest source"
rm -rf "$TMP"
mkdir -p "$TMP"
cd "$TMP"
if command -v wget >/dev/null 2>&1; then
  wget -O main.tar.gz "$REPO_TARBALL"
else
  curl -fsSL -o main.tar.gz "$REPO_TARBALL"
fi
tar -xzf main.tar.gz
SRC=$(ls -d FamOrg-* | head -1)
echo "SRC=$SRC"

echo "==> Stage new tree + preserve data/certs/.env"
rm -rf "${APP}.new"
mv "$SRC" "${APP}.new"

if [ -d "$APP/data" ]; then
  mkdir -p "${APP}.new/data"
  cp -a "$APP/data/." "${APP}.new/data/" || true
fi
if [ -d "$APP/certs" ]; then
  mkdir -p "${APP}.new/certs"
  cp -a "$APP/certs/." "${APP}.new/certs/" || true
fi
if [ -f "$APP/.env" ]; then
  cp "$APP/.env" "${APP}.new/.env"
else
  cp "${APP}.new/.env.example" "${APP}.new/.env"
fi

cd "${APP}.new"
if grep -q '^IMAGE=' .env; then
  sed -i "s|^IMAGE=.*|IMAGE=${IMAGE}|" .env
else
  echo "IMAGE=${IMAGE}" >> .env
fi
grep -q '^LOCAL_PORT=' .env || echo 'LOCAL_PORT=3000' >> .env
grep -q '^PUBLIC_PORT=' .env || echo 'PUBLIC_PORT=8443' >> .env
grep -q '^APP_URL=' .env || echo 'APP_URL=https://your-domain.example:8443' >> .env
grep -q '^GITHUB_REPO=' .env || echo 'GITHUB_REPO=your-github-user/FamOrg' >> .env
sed -i 's|^LOCAL_PORT=.*|LOCAL_PORT=3000|' .env
sed -i 's|^PUBLIC_PORT=.*|PUBLIC_PORT=8443|' .env
sed -i 's|^APP_URL=.*|APP_URL=https://your-domain.example:8443|' .env
sed -i 's|^GITHUB_REPO=.*|GITHUB_REPO=your-github-user/FamOrg|' .env
chmod 777 data 2>/dev/null || true

# Ensure TLS certs exist
if [ ! -f certs/fullchain.pem ] || [ ! -f certs/privkey.pem ]; then
  if [ -f /path/to/your/docker/external-certs/certs/fullchain.pem ]; then
    mkdir -p certs
    cp -a /path/to/your/docker/external-certs/certs/fullchain.pem /path/to/your/docker/external-certs/certs/privkey.pem certs/
  fi
fi

echo "==> Swap directories"
rm -rf "${APP}.old"
if [ -d "$APP" ]; then
  mv "$APP" "${APP}.old"
fi
mv "${APP}.new" "$APP"
rm -rf "$TMP"
cd "$APP"

echo "==> Effective config"
grep -E '^(LOCAL_PORT|PUBLIC_PORT|APP_URL|IMAGE|GITHUB_REPO)=' .env || true

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
else
  COMPOSE="docker-compose"
fi

echo "==> Pull image $IMAGE"
docker pull "$IMAGE" || true
$COMPOSE pull || true

echo "==> Restart stack"
$COMPOSE down || true
$COMPOSE up -d --pull always
sleep 10
$COMPOSE ps

echo "==> Logs (app)"
$COMPOSE logs --tail=40 family-organizer || true
echo "==> Logs (nginx)"
$COMPOSE logs --tail=20 nginx || true

echo "==> Health checks"
curl -sS -o /dev/null -w "LAN  http://127.0.0.1:3000 -> %{http_code}\n" http://127.0.0.1:3000/ || true
curl -skS -o /dev/null -w "TLS  https://127.0.0.1:8443 -> %{http_code}\n" https://127.0.0.1:8443/ || true

echo "==> Outbound probe from container"
docker exec famorg_app node -e '
const urls=[
  "https://api.open-meteo.com/v1/forecast?latitude=10.78&longitude=106.7&current=temperature_2m",
  "https://api.coingecko.com/api/v3/ping",
  "https://open.er-api.com/v6/latest/USD",
  "https://www.vang.today/api/prices?type=SJL1L10",
  "https://api.telegram.org"
];
(async()=>{
  for (const u of urls) {
    const t=Date.now();
    try {
      const r=await fetch(u,{signal:AbortSignal.timeout(12000)});
      console.log("OK", r.status, (Date.now()-t)+"ms", u.slice(0,70));
    } catch(e) {
      console.log("FAIL", (Date.now()-t)+"ms", u.slice(0,70), String(e.message||e));
    }
  }
})();
' || echo "outbound probe skipped"

echo "==> Done. Public: https://your-domain.example:8443"
