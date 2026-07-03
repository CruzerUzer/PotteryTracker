#!/bin/bash
# fetch-prod-db.sh — Hämta produktionsdatabasen + uppladdade bilder till lokal testmiljö
#
# Användning:
#   ./fetch-prod-db.sh [user@host] [remote-installationskatalog]
#
# Standardvärden kan sättas via miljövariabler:
#   PROD_SSH   (default: ubuntu@potterytracker.faris.se)
#   PROD_DIR   (default: /srv/PotteryTracker)
#
# Scriptet:
#   1. Tar en säker, konsistent kopia av SQLite-databasen på servern
#      (sqlite3 .backup om tillgängligt, annars cp)
#   2. Backar upp din lokala databas innan den skrivs över
#   3. Hämtar databasen och synkar uploads/ (bilder + miniatyrer)

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROD_SSH="${1:-${PROD_SSH:-ubuntu@potterytracker.faris.se}}"
PROD_DIR="${2:-${PROD_DIR:-/srv/PotteryTracker}}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_DB="$SCRIPT_DIR/backend/database/database.db"
LOCAL_UPLOADS="$SCRIPT_DIR/backend/uploads"

echo -e "${YELLOW}Hämtar produktionsdata från ${PROD_SSH}:${PROD_DIR}${NC}"

# Step 1: Verify SSH access and remote paths
if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$PROD_SSH" "test -f ${PROD_DIR}/backend/database/database.db"; then
    echo -e "${RED}Fel: Kan inte nå ${PROD_SSH} eller hittar inte ${PROD_DIR}/backend/database/database.db${NC}"
    echo "Kontrollera SSH-åtkomst (nyckel i authorized_keys) och sökvägen."
    exit 1
fi

# Step 2: Create a consistent snapshot on the server
#         sqlite3 .backup is safe even while the app is running (WAL-aware).
echo -e "${YELLOW}Steg 1/3: Skapar konsistent databaskopia på servern...${NC}"
ssh "$PROD_SSH" "
    cd ${PROD_DIR}/backend/database
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 database.db \".backup /tmp/potterytracker-snapshot.db\"
    else
        cp database.db /tmp/potterytracker-snapshot.db
    fi
"

# Step 3: Back up local database before overwriting
if [ -f "$LOCAL_DB" ]; then
    LOCAL_BACKUP="${LOCAL_DB}.local-backup-$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}Steg 2/3: Backar upp lokal databas till $(basename "$LOCAL_BACKUP")${NC}"
    cp "$LOCAL_DB" "$LOCAL_BACKUP"
fi

# Step 4: Fetch snapshot + sync uploads
echo -e "${YELLOW}Steg 3/3: Hämtar databas och synkar bilder...${NC}"
mkdir -p "$(dirname "$LOCAL_DB")" "$LOCAL_UPLOADS"
scp -q "$PROD_SSH:/tmp/potterytracker-snapshot.db" "$LOCAL_DB"
ssh "$PROD_SSH" "rm -f /tmp/potterytracker-snapshot.db"
rsync -az --delete "$PROD_SSH:${PROD_DIR}/backend/uploads/" "$LOCAL_UPLOADS/"

echo -e "${GREEN}Klart! Produktionsdata hämtad.${NC}"
echo "  Databas:  $LOCAL_DB"
echo "  Bilder:   $LOCAL_UPLOADS/"
echo ""
echo "Starta om backend för att läsa in nya databasen."
