#!/bin/bash
# PotteryTracker Update Script
# This script updates an existing PotteryTracker installation
# Run from any directory: bash update-potterytracker.sh
#
# ALLA frågor ställs först (nedan). Därefter körs resten oövervakat.
# Ordning: backup → kod (git) → backend + DB → PM2-restart → FRONTEND (sist).
# Frontend byggs på servern bara om du väljer det; annars deployar du den
# separat efteråt med ./deploy-frontend.sh (bygg lokalt + rsync).

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PotteryTracker Update Script${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================================================
# SAFETY: kör INTE som root/sudo (skapar root-ägda filer som bryter appen)
# ============================================================================
if [ "$(id -u)" -eq 0 ]; then
    echo -e "${RED}Fel: Kör inte det här scriptet som root eller med sudo.${NC}"
    echo -e "${YELLOW}Det skapar root-ägda filer (uploads, databas, node_modules) som gör att appen inte kan skriva,${NC}"
    echo -e "${YELLOW}och PM2 körs per användare. Kör som den vanliga app-användaren (t.ex. ubuntu).${NC}"
    echo -e "${YELLOW}Scriptet frågar själv efter sudo på de få rader som verkligen behöver det (Nginx).${NC}"
    exit 1
fi

# ============================================================================
# ALLA FRÅGOR FÖRST — inget mer frågas efter det här blocket
# ============================================================================
echo -e "${BLUE}Svara på frågorna nedan. Sedan körs allt klart utan fler frågor.${NC}"
echo ""

# --- Installationskatalog ---
read -p "PotteryTracker installation directory (default: /srv/PotteryTracker): " INSTALL_DIR
INSTALL_DIR="${INSTALL_DIR:-/srv/PotteryTracker}"

if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}Error: Directory not found: $INSTALL_DIR${NC}"
    exit 1
fi

if [ ! -d "$INSTALL_DIR/.git" ]; then
    echo -e "${YELLOW}Warning: Directory does not appear to be a git repository${NC}"
    echo -e "${YELLOW}This script is designed for git-based installations${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE
    if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
        exit 0
    fi
fi

# --- Varna vid blandat ägande (klassisk orsak till "permission denied") ---
CURRENT_USER="$(id -un)"
MIXED=""
for d in "$INSTALL_DIR" "$INSTALL_DIR/backend" "$INSTALL_DIR/backend/node_modules" \
         "$INSTALL_DIR/backend/database" "$INSTALL_DIR/backend/uploads" \
         "$INSTALL_DIR/frontend" "$INSTALL_DIR/frontend/node_modules" "$INSTALL_DIR/frontend/dist"; do
    if [ -e "$d" ] && [ "$(stat -c '%U' "$d" 2>/dev/null)" != "$CURRENT_USER" ]; then
        MIXED="$MIXED\n  $d ($(stat -c '%U' "$d" 2>/dev/null))"
    fi
done
if [ -n "$MIXED" ]; then
    echo -e "${YELLOW}Varning: dessa kataloger ägs inte av $CURRENT_USER:${NC}$(echo -e "$MIXED")"
    echo -e "${YELLOW}Det ger sannolikt 'permission denied' under uppdateringen. Fixa en gång med:${NC}"
    echo -e "${YELLOW}  sudo chown -R $CURRENT_USER:$(id -gn) $INSTALL_DIR${NC}"
    read -p "Fortsätt ändå? (y/n): " CONT_OWN
    if [ "$CONT_OWN" != "y" ] && [ "$CONT_OWN" != "Y" ]; then
        exit 0
    fi
fi

# --- Upptäck PM2-namn och nuvarande branch (för defaultsvar) ---
cd "$INSTALL_DIR"
PM2_NAME="pottery-api"
if command -v pm2 &> /dev/null; then
    PM2_LIST=$(pm2 list 2>/dev/null | grep -o "pottery[^ ]*" | head -1 || true)
    [ -n "$PM2_LIST" ] && PM2_NAME="$PM2_LIST"
fi
if [ -d ".git" ]; then
    git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
else
    CURRENT_BRANCH="main"
fi

# --- Backup? ---
read -p "Create backup before updating? (y/n, default: y): " CREATE_BACKUP
CREATE_BACKUP="${CREATE_BACKUP:-y}"

# --- Branch? ---
read -p "Branch to update to (default: $CURRENT_BRANCH): " UPDATE_BRANCH
UPDATE_BRANCH="${UPDATE_BRANCH:-$CURRENT_BRANCH}"

# --- Bygg frontend på servern? (default NEJ) ---
echo ""
echo -e "${BLUE}Frontend kan byggas HÄR på servern, eller hoppas över och deployas${NC}"
echo -e "${BLUE}separat efteråt med ./deploy-frontend.sh (bygg lokalt + rsync).${NC}"
echo -e "${BLUE}Servern har lite RAM — bygg lokalt + rsync är säkrast. Default: NEJ.${NC}"
read -p "Bygg frontend på servern nu? (j/N): " BUILD_FRONTEND_ANS
case "$BUILD_FRONTEND_ANS" in
    j|J|y|Y) BUILD_FRONTEND="yes" ;;
    *)       BUILD_FRONTEND="no" ;;
esac

echo ""
echo -e "${GREEN}Tack — inga fler frågor. Kör:${NC}"
echo "  Katalog:        $INSTALL_DIR"
echo "  Branch:         $UPDATE_BRANCH"
echo "  Backup:         $CREATE_BACKUP"
echo "  Bygg frontend:  $([ "$BUILD_FRONTEND" = "yes" ] && echo "JA (på servern)" || echo "NEJ (deploya separat efteråt)")"
echo ""

# ============================================================================
# STEG 1: BACKUP
# ============================================================================
echo -e "${YELLOW}Steg 1: Skapar backup...${NC}"
# Backuper hamnar i en dedikerad, användarägd katalog (styr med BACKUP_ROOT).
BACKUP_ROOT="${BACKUP_ROOT:-/srv/potterytracker-backups}"
BACKUP_DIR="${BACKUP_ROOT}/$(basename "$INSTALL_DIR")_backup_$(date +%Y%m%d_%H%M%S)"

if [ "$CREATE_BACKUP" = "y" ]; then
    echo -e "${YELLOW}Backar upp till: $BACKUP_DIR${NC}"
    if ! mkdir -p "$BACKUP_ROOT" 2>/dev/null || [ ! -w "$BACKUP_ROOT" ]; then
        echo -e "${YELLOW}Warning: kan inte skriva till $BACKUP_ROOT (behörighet?).${NC}"
        echo -e "${YELLOW}Skapa den en gång med:${NC}"
        echo -e "${YELLOW}  sudo mkdir -p $BACKUP_ROOT && sudo chown $(id -un):$(id -gn) $BACKUP_ROOT${NC}"
        echo -e "${YELLOW}Hoppar över backup den här gången.${NC}"
        BACKUP_DIR=""
    else
        rsync -a --exclude 'node_modules' --exclude 'dist' --exclude '.git' "$INSTALL_DIR/" "$BACKUP_DIR/" 2>/dev/null || {
            echo -e "${YELLOW}Warning: rsync saknas, använder cp (långsammare)...${NC}"
            mkdir -p "$BACKUP_DIR"
            cp -r "$INSTALL_DIR/." "$BACKUP_DIR/"
            rm -rf "$BACKUP_DIR/node_modules" "$BACKUP_DIR/dist" "$BACKUP_DIR/.git" 2>/dev/null || true
        }
        echo -e "${GREEN}Backup skapad: $BACKUP_DIR${NC}"
        echo -e "${YELLOW}Obs: archives/ och uploads/ bevaras i installationen${NC}"
    fi
else
    echo -e "${YELLOW}Hoppar över backup (valdes bort).${NC}"
    BACKUP_DIR=""
fi
echo ""

# ============================================================================
# STEG 2: UPPDATERA KOD (git)
# ============================================================================
echo -e "${YELLOW}Steg 2: Uppdaterar kod från repot...${NC}"
cd "$INSTALL_DIR"

# Backup av datakataloger före git-operationer (archives, uploads, database)
ARCHIVES_BACKUP=""; UPLOADS_BACKUP=""; DATABASE_BACKUP=""
if [ -d ".git" ]; then
    if [ -d "backend/archives" ] && [ "$(ls -A backend/archives 2>/dev/null)" ]; then
        ARCHIVES_BACKUP=$(mktemp -d); cp -r backend/archives/* "$ARCHIVES_BACKUP/" 2>/dev/null || true
        echo -e "${YELLOW}Backade upp archives-katalogen${NC}"
    fi
    if [ -d "backend/uploads" ] && [ "$(ls -A backend/uploads 2>/dev/null)" ]; then
        UPLOADS_BACKUP=$(mktemp -d); cp -r backend/uploads/* "$UPLOADS_BACKUP/" 2>/dev/null || true
        echo -e "${YELLOW}Backade upp uploads-katalogen${NC}"
    fi
    if [ -d "backend/database" ] && [ -f "backend/database/database.db" ]; then
        DATABASE_BACKUP=$(mktemp); cp "backend/database/database.db" "$DATABASE_BACKUP" 2>/dev/null || true
        echo -e "${YELLOW}Backade upp databasen${NC}"
    fi

    echo -e "${YELLOW}Stashar lokala ändringar (bevarar datakataloger)...${NC}"
    git stash push -m "Pre-update stash $(date +%Y%m%d_%H%M%S)" || {
        if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
            echo -e "${YELLOW}Warning: Kunde inte stasha, försöker fortsätta...${NC}"
        fi
    }

    echo -e "${YELLOW}Hämtar senaste...${NC}"
    git fetch origin

    echo -e "${YELLOW}Uppdaterar till senaste koden...${NC}"
    if git checkout "$UPDATE_BRANCH" 2>/dev/null; then
        git pull origin "$UPDATE_BRANCH" || {
            echo -e "${RED}Error: Kunde inte pulla senaste ändringar${NC}"
            echo -e "${YELLOW}Du kan behöva lösa konflikter manuellt${NC}"
            exit 1
        }
    else
        if git show-ref --verify --quiet refs/remotes/origin/"$UPDATE_BRANCH"; then
            git checkout -b "$UPDATE_BRANCH" "origin/$UPDATE_BRANCH" || {
                echo -e "${RED}Error: Kunde inte checka ut branch $UPDATE_BRANCH${NC}"; exit 1; }
        else
            echo -e "${RED}Error: Branch $UPDATE_BRANCH finns inte på remote${NC}"; exit 1
        fi
    fi

    # Återställ datakataloger
    if [ -n "$ARCHIVES_BACKUP" ] && [ -d "$ARCHIVES_BACKUP" ]; then
        mkdir -p backend/archives; cp -r "$ARCHIVES_BACKUP"/* backend/archives/ 2>/dev/null || true
        rm -rf "$ARCHIVES_BACKUP"; echo -e "${GREEN}Återställde archives-katalogen${NC}"
    fi
    if [ -n "$UPLOADS_BACKUP" ] && [ -d "$UPLOADS_BACKUP" ]; then
        mkdir -p backend/uploads; cp -r "$UPLOADS_BACKUP"/* backend/uploads/ 2>/dev/null || true
        rm -rf "$UPLOADS_BACKUP"; echo -e "${GREEN}Återställde uploads-katalogen${NC}"
    fi
    if [ -n "$DATABASE_BACKUP" ] && [ -f "$DATABASE_BACKUP" ]; then
        mkdir -p backend/database; cp "$DATABASE_BACKUP" backend/database/database.db 2>/dev/null || true
        rm -f "$DATABASE_BACKUP"; echo -e "${GREEN}Återställde databasen${NC}"
    fi
    echo -e "${GREEN}Koden uppdaterad${NC}"
else
    echo -e "${YELLOW}Inte ett git-repo, hoppar över koduppdatering${NC}"
fi
echo ""

# ============================================================================
# STEG 3: BACKEND-BEROENDEN + MIGRATIONER
# ============================================================================
echo -e "${YELLOW}Steg 3: Uppdaterar backend-beroenden...${NC}"
cd "$INSTALL_DIR/backend"
if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}Backend-beroenden uppdaterade${NC}"
    echo -e "${YELLOW}Bygger om native-moduler...${NC}"
    npm rebuild sqlite3 || {
        echo -e "${YELLOW}Warning: sqlite3-rebuild misslyckades, provar ren install...${NC}"
        rm -rf node_modules/sqlite3
        npm install sqlite3 --build-from-source || {
            echo -e "${YELLOW}Warning: Kunde inte bygga om sqlite3, fortsätter ändå...${NC}"; }
    }
else
    echo -e "${RED}Error: backend/package.json saknas${NC}"; exit 1
fi
echo ""

echo -e "${YELLOW}Steg 3b: Kör databasmigrationer...${NC}"
DB_PATH="${INSTALL_DIR}/backend/database/database.db"
if [ -f "$DB_PATH" ]; then
    MIGRATIONS=(
        "database/migrate_multi_user.js"
        "database/migrate_admin.js"
        "database/migrate_add_done.js"
        "database/migration-add-locations.js"
        "database/migrate_add_material_description.js"
    )
    for migration in "${MIGRATIONS[@]}"; do
        if [ -f "$migration" ]; then
            echo -e "${YELLOW}  Kör migration: $migration${NC}"
            node "$migration" && echo -e "${GREEN}  ✓ $migration${NC}" || \
                echo -e "${YELLOW}  ⚠ Migration överhoppad eller redan applicerad: $migration${NC}"
        fi
    done
    echo -e "${GREEN}Migrationer klara${NC}"
else
    echo -e "${YELLOW}Ingen databas hittad, hoppar över migrationer (ny install)${NC}"
fi
echo ""

# ============================================================================
# STEG 4: STARTA OM BACKEND (PM2) — före frontend, så backend+DB är klara först
# ============================================================================
echo -e "${YELLOW}Steg 4: Startar om backend (PM2)...${NC}"
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "$PM2_NAME"; then
        echo -e "${YELLOW}Startar om PM2-processen: $PM2_NAME${NC}"
        pm2 restart "$PM2_NAME" || { echo -e "${YELLOW}Warning: restart misslyckades, provar reload...${NC}"; pm2 reload "$PM2_NAME" || true; }
        pm2 save
        echo -e "${GREEN}Backend omstartad${NC}"
    else
        echo -e "${YELLOW}PM2-processen '$PM2_NAME' saknas, startar den...${NC}"
        cd "$INSTALL_DIR/backend"; pm2 start server.js --name "$PM2_NAME" || true; pm2 save
    fi
else
    echo -e "${YELLOW}PM2 saknas, hoppar över backend-omstart${NC}"
fi
echo ""

# ============================================================================
# STEG 5: FRONTEND (SIST) — bygg på servern ELLER hoppa över
# ============================================================================
FRONTEND_STATUS="skipped"
if [ "$BUILD_FRONTEND" = "yes" ]; then
    echo -e "${YELLOW}Steg 5: Bygger frontend på servern...${NC}"
    cd "$INSTALL_DIR/frontend"
    if [ -f "package.json" ]; then
        npm install
        export PATH="$PWD/node_modules/.bin:$PATH"
        chmod +x node_modules/.bin/vite 2>/dev/null || true
        if npm run build && [ -f "dist/index.html" ]; then
            FRONTEND_STATUS="built"
            echo -e "${GREEN}Frontend byggd${NC}"
        else
            FRONTEND_STATUS="failed"
            echo ""
            echo -e "${RED}✗ Frontend-bygget MISSLYCKADES (troligen slut på minne — 'Killed').${NC}"
            echo -e "${YELLOW}  Backend + databas är redan uppdaterade och igång.${NC}"
            echo -e "${YELLOW}  Bygg frontend på en annan maskin och deploya den så här:${NC}"
            echo -e "${YELLOW}      ./deploy-frontend.sh${NC}"
        fi
    else
        FRONTEND_STATUS="failed"
        echo -e "${RED}Error: frontend/package.json saknas${NC}"
    fi
else
    echo ""
    echo -e "${BLUE}------------------------------------------------------------${NC}"
    echo -e "${YELLOW}Steg 5: Frontend byggdes INTE (du svarade nej).${NC}"
    echo -e "${YELLOW}Prod kör fortfarande den GAMLA frontenden tills du deployar den.${NC}"
    echo -e "${GREEN}  → Kör detta från en dev-maskin för att rulla ut frontenden:${NC}"
    echo -e "${GREEN}      ./deploy-frontend.sh${NC}"
    echo -e "${BLUE}------------------------------------------------------------${NC}"
fi
echo ""

# ============================================================================
# STEG 6: NGINX
# ============================================================================
echo -e "${YELLOW}Steg 6: Laddar om Nginx...${NC}"
if command -v nginx &> /dev/null; then
    if sudo nginx -t; then
        sudo service nginx reload || sudo systemctl reload nginx
        echo -e "${GREEN}Nginx omladdad${NC}"
    else
        echo -e "${YELLOW}Warning: Nginx-konfigtest misslyckades — laddade inte om${NC}"
    fi
else
    echo -e "${YELLOW}Nginx saknas, hoppar över${NC}"
fi
echo ""

# ============================================================================
# STEG 7: VERIFIERING
# ============================================================================
echo -e "${YELLOW}Steg 7: Verifierar...${NC}"
if command -v pm2 &> /dev/null && pm2 list | grep -q "$PM2_NAME"; then
    PM2_STATUS=$(pm2 jlist | grep -o "\"name\":\"$PM2_NAME\".*\"pm2_env\":{\"status\":\"[^\"]*\"" | grep -o "\"status\":\"[^\"]*\"" | cut -d'"' -f4)
    [ "$PM2_STATUS" = "online" ] && echo -e "${GREEN}✓ PM2-processen kör${NC}" || echo -e "${YELLOW}⚠ PM2-status: $PM2_STATUS${NC}"
fi

if [ -f "$INSTALL_DIR/backend/.env" ]; then
    BACKEND_PORT=$(grep "^PORT=" "$INSTALL_DIR/backend/.env" | cut -d'=' -f2 | tr -d '"' || echo "3001")
else
    BACKEND_PORT="3001"
fi
sleep 2
if curl -s "http://localhost:$BACKEND_PORT/api/version" > /dev/null; then
    echo -e "${GREEN}✓ Backend-API svarar${NC}"
else
    echo -e "${YELLOW}⚠ Backend-API svarar inte (kan behöva en stund)${NC}"
fi

case "$FRONTEND_STATUS" in
    built)   echo -e "${GREEN}✓ Frontend byggd på servern${NC}" ;;
    skipped) echo -e "${YELLOW}ℹ Frontend byggdes inte denna körning — deploya separat (./deploy-frontend.sh)${NC}" ;;
    failed)  echo -e "${RED}✗ Frontend-bygget misslyckades — deploya separat (./deploy-frontend.sh)${NC}" ;;
esac
echo ""

# ============================================================================
# SAMMANFATTNING
# ============================================================================
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Uppdatering klar!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "  Katalog:  $INSTALL_DIR"
echo "  Branch:   $UPDATE_BRANCH"
[ -n "$BACKUP_DIR" ] && echo "  Backup:   $BACKUP_DIR"
echo ""

if [ "$FRONTEND_STATUS" != "built" ]; then
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  VIKTIGT: FRONTENDEN ÄR INTE UTRULLAD${NC}"
    echo -e "${RED}========================================${NC}"
    echo -e "${YELLOW}Backend + databas är uppdaterade, men prod visar fortfarande den${NC}"
    echo -e "${YELLOW}GAMLA frontenden. Kör detta från en dev-maskin för att slutföra:${NC}"
    echo -e "${GREEN}    ./deploy-frontend.sh${NC}"
    echo ""
fi

echo -e "${YELLOW}Om något strular:${NC}"
echo "  pm2 logs $PM2_NAME"
echo "  sudo tail -f /var/log/nginx/error.log"
[ -n "$BACKUP_DIR" ] && echo "  Backup: $BACKUP_DIR"
echo "  git stash list   (i $INSTALL_DIR)"
echo ""
