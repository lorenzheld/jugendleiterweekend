# KOMPLETTER NEUSTART - Stoppt ALLES und startet sauber neu

Write-Host "====================================================================" -ForegroundColor Red
Write-Host "CLEANUP: Stoppe ALLE alten Prozesse" -ForegroundColor Red
Write-Host "====================================================================" -ForegroundColor Red
Write-Host ""

# 1. ALLE Node/PowerShell Prozesse stoppen (außer diesem Script)
Write-Host "[1/3] Killing all node/pnpm processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process node.exe -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "[2/3] Killing Docker containers..." -ForegroundColor Yellow
# Alle prototype Container stoppen
docker stop postgres-prototype 2>$null
docker rm postgres-prototype 2>$null
docker compose -f docker-compose.prototype.yml down --volumes --remove-orphans 2>$null

# Alle laufenden Container die jugendleiter heißen
docker ps -a --format "{{.Names}}" | Select-String "jugendleiter" | ForEach-Object {
    docker stop $_ 2>$null
}

Write-Host "[3/3] Cleaning Docker volumes..." -ForegroundColor Yellow
docker volume prune -f 2>$null

Write-Host ""
Write-Host "Cleanup complete! Waiting 5 seconds..." -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "NEUSTART: Starte Prototyp komplett neu" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""

# PostgreSQL starten
Write-Host "[STEP 1/8] Starting PostgreSQL on port 5433..." -ForegroundColor Cyan
docker run -d `
  --name postgres-prototype `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=jugendleiter2026_prototype `
  -p 5433:5432 `
  postgis/postgis:16-3.4-alpine

Write-Host "  Waiting for PostgreSQL (20 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 20

# Test PostgreSQL
Write-Host "[STEP 2/8] Testing PostgreSQL connection..." -ForegroundColor Cyan
$pgTest = docker exec postgres-prototype pg_isready -U postgres 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  PostgreSQL is ready!" -ForegroundColor Green
} else {
    Write-Host "  WARNING: PostgreSQL not ready yet, waiting 10 more seconds..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# Dependencies checken
Write-Host "[STEP 3/8] Checking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing root dependencies..." -ForegroundColor Yellow
    pnpm install --force
} else {
    Write-Host "  Root dependencies OK" -ForegroundColor Green
}

if (-not (Test-Path "apps\backend\node_modules")) {
    Write-Host "  Installing backend dependencies..." -ForegroundColor Yellow
    cd apps\backend
    pnpm install --force
    cd ..\..
} else {
    Write-Host "  Backend dependencies OK" -ForegroundColor Green
}

# bcryptjs sicherstellen
Write-Host "[STEP 4/8] Ensuring bcryptjs is installed..." -ForegroundColor Cyan
cd apps\backend
pnpm add bcryptjs @types/bcryptjs 2>$null
cd ..\..

# Database Migration
Write-Host "[STEP 5/8] Running database migrations..." -ForegroundColor Cyan
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype"
cd apps\backend
pnpm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Migration failed!" -ForegroundColor Red
    cd ..\..
    exit 1
}
Write-Host "  Migrations successful!" -ForegroundColor Green

# Seed Data
Write-Host "[STEP 6/8] Loading prototype data..." -ForegroundColor Cyan
pnpm exec tsx scripts/seed-prototype-pfaeffikon-fixed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Seeding failed!" -ForegroundColor Red
    cd ..\..
    exit 1
}
Write-Host "  Data loaded successfully!" -ForegroundColor Green
cd ..\..

# Frontend Config
Write-Host "[STEP 7/8] Configuring frontend..." -ForegroundColor Cyan
$frontendEnv = @"
VITE_API_BASE_URL=http://localhost:3001
VITE_MAPTILER_API_KEY=get-your-key-at-maptiler-com
"@
Set-Content -Path "apps\frontend\.env.local" -Value $frontendEnv -Force
Write-Host "  Frontend config created!" -ForegroundColor Green

# Backend starten
Write-Host "[STEP 8/8] Starting services..." -ForegroundColor Cyan
Write-Host "  Starting Backend on port 3001..." -ForegroundColor Gray

$backendScript = @"
`$Host.UI.RawUI.WindowTitle = 'PROTOTYPE BACKEND - PORT 3001'
`$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype'
`$env:PORT='3001'
`$env:JWT_SECRET='prototype-dev-secret'
`$env:NODE_ENV='development'
cd '$PWD\apps\backend'
Write-Host ''
Write-Host '======================================================================' -ForegroundColor Green
Write-Host 'BACKEND RUNNING ON PORT 3001' -ForegroundColor Green
Write-Host '======================================================================' -ForegroundColor Green
Write-Host 'Health Check: http://localhost:3001/health' -ForegroundColor Cyan
Write-Host ''
pnpm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
Write-Host "  Backend starting (wait 5 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Frontend starten
Write-Host "  Starting Frontend on port 5175..." -ForegroundColor Gray

$frontendScript = @"
`$Host.UI.RawUI.WindowTitle = 'PROTOTYPE FRONTEND - PORT 5175'
cd '$PWD\apps\frontend'
Write-Host ''
Write-Host '======================================================================' -ForegroundColor Cyan
Write-Host 'FRONTEND RUNNING ON PORT 5175' -ForegroundColor Cyan
Write-Host '======================================================================' -ForegroundColor Cyan
Write-Host 'Open: http://localhost:5175' -ForegroundColor Green
Write-Host ''
pnpm run dev -- --port 5175
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript
Write-Host "  Frontend starting (wait 5 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Health Check
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Performing Health Check..." -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green

Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "[OK] Backend is healthy!" -ForegroundColor Green
    } else {
        Write-Host "[WARNING] Backend responded with status: $($response.StatusCode)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[WARNING] Backend not responding yet (might need more time)" -ForegroundColor Yellow
    Write-Host "  Try: http://localhost:3001/health in browser" -ForegroundColor Gray
}

Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "PROTOTYP LAEUFT!" -ForegroundColor Green
Write-Host "====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services:" -ForegroundColor Cyan
Write-Host "  Backend:  http://localhost:3001 (PowerShell Window 1)" -ForegroundColor White
Write-Host "  Frontend: http://localhost:5175 (PowerShell Window 2)" -ForegroundColor White
Write-Host "  Database: localhost:5433 (Docker Container)" -ForegroundColor White
Write-Host ""
Write-Host "Login:" -ForegroundColor Yellow
Write-Host "  Username:     prototyp_player1" -ForegroundColor White
Write-Host "  Access Code:  test123" -ForegroundColor White
Write-Host ""
Write-Host "Alternative Accounts:" -ForegroundColor Yellow
Write-Host "  prototyp_player2 / test123" -ForegroundColor White
Write-Host "  prototyp_gm / test123" -ForegroundColor White
Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5175"

Write-Host ""
Write-Host "Zum Stoppen:" -ForegroundColor Yellow
Write-Host "  1. Schliesse die 2 PowerShell-Fenster (Backend + Frontend)" -ForegroundColor White
Write-Host "  2. Fuehre aus: docker stop postgres-prototype" -ForegroundColor White
Write-Host ""
Write-Host "====================================================================" -ForegroundColor Green
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
