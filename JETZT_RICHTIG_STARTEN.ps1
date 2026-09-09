# Pfaeffikon Prototyp - KOMPLETTE Neuinstallation

Write-Host "===================================================================" -ForegroundColor Green
Write-Host "Pfaeffikon Prototyp - Komplette Neuinstallation" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Continue"

# 1. Alte Container aufräumen
Write-Host "[1/7] Cleaning up old containers..." -ForegroundColor Cyan
docker stop postgres-prototype 2>$null
docker rm postgres-prototype 2>$null
docker compose -f docker-compose.prototype.yml down 2>$null

# 2. PostgreSQL starten
Write-Host "[2/7] Starting PostgreSQL..." -ForegroundColor Cyan
docker run -d `
  --name postgres-prototype `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=jugendleiter2026_prototype `
  -p 5433:5432 `
  postgis/postgis:16-3.4-alpine

Write-Host "  Waiting for PostgreSQL (15 seconds)..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# 3. Dependencies prüfen
Write-Host "[3/7] Checking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing root dependencies..." -ForegroundColor Yellow
    pnpm install
} else {
    Write-Host "  Dependencies OK" -ForegroundColor Green
}

# 4. Backend Setup
Write-Host "[4/7] Setting up backend..." -ForegroundColor Cyan
cd apps\backend

# bcryptjs installieren falls fehlt
if (-not (Test-Path "node_modules\bcryptjs")) {
    Write-Host "  Installing bcryptjs..." -ForegroundColor Yellow
    pnpm add bcryptjs @types/bcryptjs
}

# DB Migration
Write-Host "  Running migrations..." -ForegroundColor Gray
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype"
pnpm run db:migrate

# Seed Data
Write-Host "  Loading prototype data..." -ForegroundColor Gray
pnpm run tsx scripts/seed-prototype-pfaeffikon-fixed.ts

cd ..\..

# 5. Frontend .env.local erstellen
Write-Host "[5/7] Configuring frontend..." -ForegroundColor Cyan
$frontendEnv = @"
VITE_API_BASE_URL=http://localhost:3001
VITE_MAPTILER_API_KEY=get-your-key-at-maptiler-com
"@
Set-Content -Path "apps\frontend\.env.local" -Value $frontendEnv -Force
Write-Host "  Frontend config created" -ForegroundColor Green

# 6. Backend starten
Write-Host "[6/7] Starting backend (Port 3001)..." -ForegroundColor Cyan
$backendScript = @"
`$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype'
`$env:PORT='3001'
`$env:JWT_SECRET='prototype-dev-secret'
`$env:NODE_ENV='development'
cd '$PWD\apps\backend'
Write-Host '==== BACKEND RUNNING ON PORT 3001 ====' -ForegroundColor Green
pnpm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript
Start-Sleep -Seconds 5

# 7. Frontend starten
Write-Host "[7/7] Starting frontend (Port 5175)..." -ForegroundColor Cyan
$frontendScript = @"
cd '$PWD\apps\frontend'
Write-Host '==== FRONTEND RUNNING ON PORT 5175 ====' -ForegroundColor Cyan
pnpm run dev -- --port 5175
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "FERTIG! Prototyp laeuft!" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Oeffne im Browser: http://localhost:5175" -ForegroundColor Cyan
Write-Host ""
Write-Host "Login-Daten:" -ForegroundColor Yellow
Write-Host "  Username: prototyp_player1" -ForegroundColor White
Write-Host "  Access Code: test123" -ForegroundColor White
Write-Host ""
Write-Host "Alternative Accounts:" -ForegroundColor Yellow
Write-Host "  prototyp_player2 / test123" -ForegroundColor White
Write-Host "  prototyp_gm / test123" -ForegroundColor White
Write-Host ""
Write-Host "Browser wird geoeffnet..." -ForegroundColor Gray
Start-Sleep -Seconds 3
Start-Process "http://localhost:5175"

Write-Host ""
Write-Host "Zum Stoppen:" -ForegroundColor Yellow
Write-Host "  - PowerShell-Fenster schliessen (Backend + Frontend)" -ForegroundColor White
Write-Host "  - Datenbank: docker stop postgres-prototype" -ForegroundColor White
Write-Host "===================================================================" -ForegroundColor Green
