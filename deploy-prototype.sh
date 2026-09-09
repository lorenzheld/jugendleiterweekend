#!/bin/bash
###############################################################################
# Prototype Deployment Script - Pfäffikon Test
###############################################################################
# Startet eine separate Prototyp-Umgebung OHNE die Rom-Daten zu berühren
###############################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[PROTOTYPE]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_info "═══════════════════════════════════════════════════════════════"
log_info "Starting Pfäffikon Prototype Deployment"
log_info "═══════════════════════════════════════════════════════════════"
log_info ""
log_warn "This will NOT affect your main Rome database!"
log_info ""

# 1. Stoppe alte Prototyp-Container (falls vorhanden)
log_info "Stopping old prototype containers..."
docker compose -f docker-compose.prototype.yml down 2>/dev/null || true

# 2. Starte neue Prototyp-Container
log_info "Starting prototype containers..."
docker compose -f docker-compose.prototype.yml up -d --build

# 3. Warte auf Datenbank
log_info "Waiting for PostgreSQL..."
sleep 5

until docker compose -f docker-compose.prototype.yml exec -T postgres-prototype pg_isready -U postgres > /dev/null 2>&1; do
    log_info "  Waiting for database..."
    sleep 2
done
log_info "✓ PostgreSQL ready!"

# 4. Führe Migrationen aus
log_info "Running database migrations..."
docker compose -f docker-compose.prototype.yml exec -T backend-prototype npm run db:migrate

# 5. Lade Prototyp-Daten
log_info "Loading Pfäffikon prototype data..."
docker compose -f docker-compose.prototype.yml exec -T backend-prototype npm run seed:prototype

# 6. Health Check
log_info "Running health check..."
sleep 3

BACKEND_HEALTH=$(curl -s http://localhost:3001/health || echo "fail")
if [[ "$BACKEND_HEALTH" == *"OK"* ]] || [[ "$BACKEND_HEALTH" == *"healthy"* ]]; then
    log_info "✓ Backend health check passed"
else
    log_warn "✗ Backend health check failed (might still be starting...)"
fi

log_info ""
log_info "═══════════════════════════════════════════════════════════════"
log_info "✅ Prototype Deployment Complete!"
log_info "═══════════════════════════════════════════════════════════════"
log_info ""
log_info "📍 Pfäffikon Prototype is running on:"
log_info "   Backend:  http://localhost:3001"
log_info "   Frontend: http://localhost:5175"
log_info "   Database: localhost:5433 (jugendleiter2026_prototype)"
log_info ""
log_info "🔐 Test Credentials:"
log_info "   Player 1: prototyp_player1 / test123"
log_info "   Player 2: prototyp_player2 / test123"
log_info "   GM:       prototyp_gm / test123"
log_info ""
log_info "🗺️  Test Area: Pfäffikon ZH - Im Berg"
log_info ""
log_info "📊 Your main Rome database is UNTOUCHED:"
log_info "   Backend:  http://localhost:3000"
log_info "   Database: localhost:5432 (jugendleiter2026)"
log_info ""
log_info "🛑 To stop prototype:"
log_info "   docker compose -f docker-compose.prototype.yml down"
log_info ""
log_info "📋 View logs:"
log_info "   docker compose -f docker-compose.prototype.yml logs -f"
log_info "═══════════════════════════════════════════════════════════════"
