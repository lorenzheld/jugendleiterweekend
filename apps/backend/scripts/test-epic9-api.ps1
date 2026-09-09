# Epic 9 Manual API Test Script (PowerShell)
# Prerequisites: Backend running on localhost:3000, valid JWT token

# Configuration
$API_BASE = "http://localhost:3000/api/v1"
$JWT_TOKEN = "YOUR_JWT_TOKEN_HERE"  # Replace with actual token

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Epic 9 GM Dashboard & Operations - API Test Suite" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $JWT_TOKEN"
    "Content-Type" = "application/json"
}

# Test 1: Get Event State
Write-Host "Test 1: Get Event State" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/event/state" -Method GET -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Get Team Status
Write-Host "Test 2: Get All Team Status" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/dashboard/team-status" -Method GET -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get Player Positions
Write-Host "Test 3: Get Player Positions" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/dashboard/player-positions" -Method GET -Headers $headers
    Write-Host "Found $($response.Length) player(s)" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Get World Objects
Write-Host "Test 4: Get World Objects" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/dashboard/world-objects" -Method GET -Headers $headers
    Write-Host "Found $($response.Length) world object(s)" -ForegroundColor Cyan
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Get Media Inbox
Write-Host "Test 5: Get Media Inbox" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/dashboard/media-inbox" -Method GET -Headers $headers
    Write-Host "Found $($response.Length) pending submission(s)" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: Get Leaderboard
Write-Host "Test 6: Get Leaderboard" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/event/leaderboard" -Method GET -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Get Event Summary
Write-Host "Test 7: Get Event Summary" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/event/summary" -Method GET -Headers $headers
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 8: Get Audit Log
Write-Host "Test 8: Get Audit Log (last 10 entries)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/gm/audit-log?limit=10" -Method GET -Headers $headers
    Write-Host "Found $($response.Length) audit log entry(ies)" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10
    Write-Host "✅ PASS" -ForegroundColor Green
} catch {
    Write-Host "❌ FAIL: $_" -ForegroundColor Red
}
Write-Host ""

# Test 9: Start Event (CAUTION: Changes DB state!)
Write-Host "Test 9: Start Event (commented out - set `$RUN_WRITE_TESTS = `$true to run)" -ForegroundColor Yellow
$RUN_WRITE_TESTS = $false
if ($RUN_WRITE_TESTS) {
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/gm/event/start" -Method POST -Headers $headers
        $response | ConvertTo-Json -Depth 10
        Write-Host "✅ PASS" -ForegroundColor Green
    } catch {
        Write-Host "❌ FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped (set `$RUN_WRITE_TESTS = `$true to run)" -ForegroundColor Gray
}
Write-Host ""

# Test 10: HP Override (CAUTION: Requires valid team ID!)
Write-Host "Test 10: HP Override (commented out)" -ForegroundColor Yellow
if ($RUN_WRITE_TESTS) {
    $TEAM_ID = "replace-with-valid-uuid"
    $body = @{
        teamId = $TEAM_ID
        newHP = 75
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$API_BASE/gm/commands/hp-override" -Method POST -Headers $headers -Body $body
        $response | ConvertTo-Json -Depth 10
        Write-Host "✅ PASS" -ForegroundColor Green
    } catch {
        Write-Host "❌ FAIL: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped (set `$RUN_WRITE_TESTS = `$true and provide valid TEAM_ID)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "Tests completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Notes:" -ForegroundColor Cyan
Write-Host "- Replace JWT_TOKEN with your actual token"
Write-Host "- Set `$RUN_WRITE_TESTS = `$true to enable write operations"
Write-Host "- Provide valid UUIDs for HP/Currency commands"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
