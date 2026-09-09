# Test-Script fuer Pfaeffikon Prototyp
# Prueft ob alles korrekt laeuft

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Testing Pfaeffikon Prototype" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$allTestsPassed = $true

# Test 1: Docker Container laufen?
Write-Host "Test 1: Checking Docker containers..." -ForegroundColor Yellow
try {
    $containers = docker compose -f docker-compose.prototype.yml ps --format json 2>&1
    if ($LASTEXITCODE -eq 0) {
        $containerList = $containers | ConvertFrom-Json
        $runningCount = ($containerList | Where-Object { $_.State -eq "running" }).Count
        
        if ($runningCount -ge 3) {
            Write-Host "  [OK] All containers are running ($runningCount/3)" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] Not all containers running ($runningCount/3)" -ForegroundColor Red
            $allTestsPassed = $false
        }
    } else {
        Write-Host "  [FAIL] Cannot get container status" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Docker error: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 2: PostgreSQL erreichbar?
Write-Host "Test 2: Checking PostgreSQL connection..." -ForegroundColor Yellow
try {
    $pgResult = docker compose -f docker-compose.prototype.yml exec -T postgres-prototype pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [OK] PostgreSQL is ready" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] PostgreSQL not ready!" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Cannot connect to PostgreSQL!" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 3: Backend Health Check
Write-Host "Test 3: Checking Backend health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] Backend is healthy" -ForegroundColor Green
        Write-Host "    Response: $($response.Content)" -ForegroundColor Gray
    } else {
        Write-Host "  [FAIL] Backend returned status code $($response.StatusCode)" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Cannot reach backend at http://localhost:3001" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 4: Frontend erreichbar?
Write-Host "Test 4: Checking Frontend..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5175" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "  [OK] Frontend is accessible" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Frontend returned status code $($response.StatusCode)" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Cannot reach frontend at http://localhost:5175" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 5: Login funktioniert?
Write-Host "Test 5: Testing authentication..." -ForegroundColor Yellow
try {
    $body = @{
        username = "prototyp_player1"
        password = "test123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10

    if ($response.token) {
        Write-Host "  [OK] Login successful, token received" -ForegroundColor Green
        Write-Host "    Token: $($response.token.Substring(0, 20))..." -ForegroundColor Gray
    } else {
        Write-Host "  [FAIL] Login failed: No token in response" -ForegroundColor Red
        $allTestsPassed = $false
    }
} catch {
    Write-Host "  [FAIL] Authentication test failed" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 6: Datenbank-Daten vorhanden?
Write-Host "Test 6: Checking database content..." -ForegroundColor Yellow
try {
    # WorldObjects zaehlen
    $woCount = docker compose -f docker-compose.prototype.yml exec -T postgres-prototype psql -U postgres -d jugendleiter2026_prototype -t -c "SELECT COUNT(*) FROM world_object;" 2>&1
    $woCount = $woCount.Trim()
    
    if ([int]$woCount -gt 0) {
        Write-Host "  [OK] WorldObjects found: $woCount" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] No WorldObjects in database!" -ForegroundColor Red
        $allTestsPassed = $false
    }

    # Quest pruefen
    $questCount = docker compose -f docker-compose.prototype.yml exec -T postgres-prototype psql -U postgres -d jugendleiter2026_prototype -t -c "SELECT COUNT(*) FROM quest_definition WHERE external_id = 'PT-Q01';" 2>&1
    $questCount = $questCount.Trim()
    
    if ([int]$questCount -eq 1) {
        Write-Host "  [OK] Quest PT-Q01 found" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Quest PT-Q01 not found!" -ForegroundColor Red
        $allTestsPassed = $false
    }

    # Team pruefen
    $teamCount = docker compose -f docker-compose.prototype.yml exec -T postgres-prototype psql -U postgres -d jugendleiter2026_prototype -t -c "SELECT COUNT(*) FROM team WHERE id = 'team-prototype-test-01';" 2>&1
    $teamCount = $teamCount.Trim()
    
    if ([int]$teamCount -eq 1) {
        Write-Host "  [OK] Test team found" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] Test team not found!" -ForegroundColor Red
        $allTestsPassed = $false
    }

} catch {
    Write-Host "  [FAIL] Database query failed" -ForegroundColor Red
    Write-Host "    Error: $($_.Exception.Message)" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Test 7: GeoJSON-Datei vorhanden?
Write-Host "Test 7: Checking GeoJSON file..." -ForegroundColor Yellow
$geojsonPath = "docs\Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1 (1).geojson"
if (Test-Path $geojsonPath) {
    $fileSize = (Get-Item $geojsonPath).Length
    $fileSizeKB = [math]::Round($fileSize/1KB, 2)
    Write-Host "  [OK] GeoJSON file exists ($fileSizeKB KB)" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] GeoJSON file not found at: $geojsonPath" -ForegroundColor Red
    $allTestsPassed = $false
}
Write-Host ""

# Zusammenfassung
Write-Host "===================================================================" -ForegroundColor Cyan
if ($allTestsPassed) {
    Write-Host "All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Ready to test!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Open http://localhost:5175 in browser" -ForegroundColor White
    Write-Host "  2. Login with: prototyp_player1 / test123" -ForegroundColor White
    Write-Host "  3. Allow GPS permissions" -ForegroundColor White
    Write-Host "  4. Map should show Pfaeffikon ZH" -ForegroundColor White
} else {
    Write-Host "Some tests failed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Check logs: docker compose -f docker-compose.prototype.yml logs" -ForegroundColor White
    Write-Host "  2. Restart: docker compose -f docker-compose.prototype.yml restart" -ForegroundColor White
    Write-Host "  3. Redeploy: .\deploy-prototype.ps1" -ForegroundColor White
}
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

# Return exit code
if ($allTestsPassed) {
    exit 0
} else {
    exit 1
}
