#!/bin/bash
###############################################################################
# Health Check Script for JLW 2026
###############################################################################
# Checks all services and reports their status
###############################################################################

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOCKER_COMPOSE_FILE="docker-compose.production.yml"
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3000}"

print_status() {
    local service=$1
    local status=$2
    local message=$3
    
    if [ "$status" = "OK" ]; then
        echo -e "${GREEN}✓${NC} ${service}: ${GREEN}${status}${NC} ${message}"
    elif [ "$status" = "WARN" ]; then
        echo -e "${YELLOW}⚠${NC} ${service}: ${YELLOW}${status}${NC} ${message}"
    else
        echo -e "${RED}✗${NC} ${service}: ${RED}${status}${NC} ${message}"
    fi
}

echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}JLW 2026 Health Check${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Docker Containers ───────────────────────────────────────────────────────
echo -e "${BLUE}[1] Docker Containers${NC}"

services=("postgres" "backend" "frontend" "gm-client")

for service in "${services[@]}"; do
    if docker compose -f $DOCKER_COMPOSE_FILE ps $service 2>/dev/null | grep -q "Up"; then
        # Get uptime
        uptime=$(docker compose -f $DOCKER_COMPOSE_FILE ps $service | tail -n 1 | awk '{print $4, $5}' | sed 's/Up //')
        print_status "$service" "OK" "(up $uptime)"
    else
        print_status "$service" "FAIL" "(not running)"
    fi
done

echo ""

# ─── Backend Health ──────────────────────────────────────────────────────────
echo -e "${BLUE}[2] Backend API${NC}"

backend_health=$(curl -s -o /dev/null -w "%{http_code}" http://${API_HOST}:${API_PORT}/health 2>/dev/null)

if [ "$backend_health" = "200" ]; then
    print_status "Backend /health" "OK" "(HTTP 200)"
else
    print_status "Backend /health" "FAIL" "(HTTP ${backend_health})"
fi

echo ""

# ─── Database ────────────────────────────────────────────────────────────────
echo -e "${BLUE}[3] PostgreSQL Database${NC}"

db_check=$(docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres pg_isready 2>&1)

if echo "$db_check" | grep -q "accepting connections"; then
    print_status "PostgreSQL" "OK" "(accepting connections)"
    
    # Check table count
    table_count=$(docker compose -f $DOCKER_COMPOSE_FILE exec -T postgres \
        psql -U postgres -d jugendleiter2026 -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    if [ ! -z "$table_count" ] && [ "$table_count" -gt 0 ]; then
        print_status "Database Tables" "OK" "($table_count tables found)"
    else
        print_status "Database Tables" "WARN" "(no tables or migration needed)"
    fi
else
    print_status "PostgreSQL" "FAIL" "(not ready)"
fi

echo ""

# ─── Frontend ────────────────────────────────────────────────────────────────
echo -e "${BLUE}[4] Frontend${NC}"

frontend_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/health 2>/dev/null)

if [ "$frontend_health" = "200" ]; then
    print_status "Frontend" "OK" "(HTTP 200)"
else
    print_status "Frontend" "WARN" "(HTTP ${frontend_health})"
fi

echo ""

# ─── GM Client ───────────────────────────────────────────────────────────────
echo -e "${BLUE}[5] GM Client${NC}"

gm_health=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5174/health 2>/dev/null)

if [ "$gm_health" = "200" ]; then
    print_status "GM Client" "OK" "(HTTP 200)"
else
    print_status "GM Client" "WARN" "(HTTP ${gm_health})"
fi

echo ""

# ─── Nginx (if running) ──────────────────────────────────────────────────────
echo -e "${BLUE}[6] Nginx Reverse Proxy${NC}"

if systemctl is-active --quiet nginx; then
    print_status "Nginx" "OK" "(active)"
    
    # Test config
    if nginx -t 2>&1 | grep -q "test is successful"; then
        print_status "Nginx Config" "OK" "(syntax valid)"
    else
        print_status "Nginx Config" "FAIL" "(syntax error)"
    fi
else
    print_status "Nginx" "WARN" "(not running or not installed)"
fi

echo ""

# ─── Disk Space ──────────────────────────────────────────────────────────────
echo -e "${BLUE}[7] System Resources${NC}"

disk_usage=$(df -h / | tail -1 | awk '{print $5}' | sed 's/%//')
disk_available=$(df -h / | tail -1 | awk '{print $4}')

if [ "$disk_usage" -lt 80 ]; then
    print_status "Disk Space" "OK" "(${disk_usage}% used, ${disk_available} available)"
elif [ "$disk_usage" -lt 90 ]; then
    print_status "Disk Space" "WARN" "(${disk_usage}% used, ${disk_available} available)"
else
    print_status "Disk Space" "FAIL" "(${disk_usage}% used, ${disk_available} available)"
fi

# Memory
mem_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
mem_available=$(free -h | grep Mem | awk '{print $7}')

if [ "$mem_usage" -lt 80 ]; then
    print_status "Memory" "OK" "(${mem_usage}% used, ${mem_available} available)"
elif [ "$mem_usage" -lt 90 ]; then
    print_status "Memory" "WARN" "(${mem_usage}% used, ${mem_available} available)"
else
    print_status "Memory" "FAIL" "(${mem_usage}% used, ${mem_available} available)"
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
