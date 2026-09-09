#!/bin/bash
# Epic 9 Manual API Test Script
# Prerequisites: Backend running on localhost:3000, valid JWT token

# Configuration
API_BASE="http://localhost:3000/api/v1"
JWT_TOKEN="YOUR_JWT_TOKEN_HERE"  # Replace with actual token

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Epic 9 GM Dashboard & Operations - API Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Get Event State
echo -e "${YELLOW}Test 1: Get Event State${NC}"
curl -s -X GET "$API_BASE/gm/event/state" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 2: Get Team Status
echo -e "${YELLOW}Test 2: Get All Team Status${NC}"
curl -s -X GET "$API_BASE/gm/dashboard/team-status" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 3: Get Player Positions
echo -e "${YELLOW}Test 3: Get Player Positions${NC}"
curl -s -X GET "$API_BASE/gm/dashboard/player-positions" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 4: Get World Objects
echo -e "${YELLOW}Test 4: Get World Objects${NC}"
curl -s -X GET "$API_BASE/gm/dashboard/world-objects" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '. | length'
echo ""

# Test 5: Get Media Inbox
echo -e "${YELLOW}Test 5: Get Media Inbox${NC}"
curl -s -X GET "$API_BASE/gm/dashboard/media-inbox" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 6: Get Leaderboard
echo -e "${YELLOW}Test 6: Get Leaderboard${NC}"
curl -s -X GET "$API_BASE/gm/event/leaderboard" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 7: Get Event Summary
echo -e "${YELLOW}Test 7: Get Event Summary${NC}"
curl -s -X GET "$API_BASE/gm/event/summary" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 8: Get Audit Log (last 10 entries)
echo -e "${YELLOW}Test 8: Get Audit Log${NC}"
curl -s -X GET "$API_BASE/gm/audit-log?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  | jq '.'
echo ""

# Test 9: Start Event (CAUTION: Changes DB state!)
echo -e "${YELLOW}Test 9: Start Event (commented out - uncomment to run)${NC}"
# curl -s -X POST "$API_BASE/gm/event/start" \
#   -H "Authorization: Bearer $JWT_TOKEN" \
#   | jq '.'
echo "Skipped (uncomment to run)"
echo ""

# Test 10: HP Override (CAUTION: Requires valid team ID!)
echo -e "${YELLOW}Test 10: HP Override (commented out - uncomment to run)${NC}"
# TEAM_ID="replace-with-valid-uuid"
# curl -s -X POST "$API_BASE/gm/commands/hp-override" \
#   -H "Authorization: Bearer $JWT_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d "{\"teamId\": \"$TEAM_ID\", \"newHP\": 75}" \
#   | jq '.'
echo "Skipped (uncomment to run)"
echo ""

# Test 11: Currency Correction (CAUTION: Requires valid team ID!)
echo -e "${YELLOW}Test 11: Currency Correction (commented out - uncomment to run)${NC}"
# TEAM_ID="replace-with-valid-uuid"
# curl -s -X POST "$API_BASE/gm/commands/currency-correction" \
#   -H "Authorization: Bearer $JWT_TOKEN" \
#   -H "Content-Type: application/json" \
#   -d "{\"teamId\": \"$TEAM_ID\", \"currencyType\": \"FAME\", \"amount\": 10, \"reason\": \"Test reward\"}" \
#   | jq '.'
echo "Skipped (uncomment to run)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Tests completed!${NC}"
echo ""
echo "Notes:"
echo "- Replace JWT_TOKEN with your actual token"
echo "- Tests 9-11 are commented out to prevent accidental DB changes"
echo "- Uncomment and customize with valid IDs to test write operations"
echo "- Install jq for formatted JSON output: sudo apt install jq"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
