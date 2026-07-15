#!/bin/bash
# deploy-frontend.sh — Bygg frontend LOKALT och synka till prod med rsync.
#
# Varför: prod-VM:en har bara ~1 GB RAM. `vite build` på servern OOM-dödas
# (kärnan skriver "Killed") och kan lämna frontend/dist/ trasigt. Det här
# scriptet bygger på en maskin med gott om minne och kopierar bara färdiga
# dist/ till prod — inget bygge på prod-VM:en.
#
# Användning (kör från en dev-maskin med SSH-åtkomst till prod):
#   ./deploy-frontend.sh [user@host] [remote-installationskatalog]
#
# Standardvärden via miljövariabler:
#   PROD_SSH  (default: ubuntu@potterytracker.faris.se)
#   PROD_DIR  (default: /srv/PotteryTracker)
#   PROD_URL  (default: https://potterytracker.faris.se)

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

PROD_SSH="${1:-${PROD_SSH:-ubuntu@potterytracker.faris.se}}"
PROD_DIR="${2:-${PROD_DIR:-/srv/PotteryTracker}}"
PROD_URL="${PROD_URL:-https://potterytracker.faris.se}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/frontend"

echo -e "${YELLOW}1/3 Installerar beroenden (vid behov)...${NC}"
if [ ! -d node_modules ]; then
  npm install
fi

echo -e "${YELLOW}2/3 Bygger frontend lokalt...${NC}"
npm run build
if [ ! -f dist/index.html ]; then
  echo -e "${RED}Fel: dist/index.html saknas efter bygget — avbryter (synkar inte trasig dist).${NC}"
  exit 1
fi

echo -e "${YELLOW}3/3 Synkar dist/ → ${PROD_SSH}:${PROD_DIR}/frontend/dist/ ...${NC}"
# --delete så prod matchar exakt; exkludera interna designmockups.
rsync -az --delete --exclude 'design-concepts' \
  -e "ssh -o BatchMode=yes -o ConnectTimeout=20" \
  dist/ "${PROD_SSH}:${PROD_DIR}/frontend/dist/"

echo -e "${YELLOW}Verifierar...${NC}"
CODE=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$PROD_URL" || echo "000")
if [ "$CODE" = "200" ]; then
  echo -e "${GREEN}Klart — ${PROD_URL} svarar 200.${NC}"
else
  echo -e "${RED}Varning: ${PROD_URL} svarade ${CODE} (förväntade 200). Kontrollera nginx/dist.${NC}"
  exit 1
fi
