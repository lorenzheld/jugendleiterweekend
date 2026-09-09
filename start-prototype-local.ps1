# Lokaler Prototyp-Start (OHNE Docker)
# Einfacher und schneller fuer lokales Testing

Write-Host "===================================================================" -ForegroundColor Green
Write-Host "Starting Pfaeffikon Prototype (LOCAL - NO DOCKER)" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""

$ErrorActionPreference = "Stop"

# 1. PostgreSQL mit Docker starten (nur DB)
Write-Host "[PROTOTYPE] Starting PostgreSQL container..." -ForegroundColor Cyan
docker run -d `
  --name postgres-prototype `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=jugendleiter2026_prototype `
  -p 5433:5432 `
  postgis/postgis:16-3.4-alpine 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Container already exists, restarting..." -ForegroundColor Yellow
    docker start postgres-prototype
}

Write-Host "  Waiting for PostgreSQL to be ready..." -ForegroundColor Gray
Start-Sleep -Seconds 10

# 2. Check if node_modules exist
Write-Host "[PROTOTYPE] Checking dependencies..." -ForegroundColor Cyan
if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing root dependencies..." -ForegroundColor Yellow
    pnpm install
}

if (-not (Test-Path "apps/backend/node_modules")) {
    Write-Host "  Installing backend dependencies..." -ForegroundColor Yellow
    pnpm install
}

# 3. Database Migration
Write-Host "[PROTOTYPE] Running database migrations..." -ForegroundColor Cyan
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype"
cd apps/backend
pnpm run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Migration failed, but continuing..." -ForegroundColor Yellow
}

# 4. Seed Prototype Data
Write-Host "[PROTOTYPE] Loading Pfaeffikon prototype data..." -ForegroundColor Cyan
pnpm run seed:prototype
cd ../..

# 5. Start Backend
Write-Host "[PROTOTYPE] Starting backend on port 3001..." -ForegroundColor Cyan
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype"
$env:JWT_SECRET = "prototype-dev-secret"
$env:PORT = "3001"
$env:NODE_ENV = "development"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD/apps/backend'; `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype'; `$env:PORT='3001'; `$env:JWT_SECRET='prototype-dev-secret'; pnpm run dev"

Start-Sleep -Seconds 5

# 6. Start Frontend
Write-Host "[PROTOTYPE] Starting frontend on port 5175..." -ForegroundColor Cyan

# Create .env.local for frontend
$frontendEnv = @"
VITE_API_BASE_URL=http://localhost:3001
VITE_MAPTILER_API_KEY=get-your-key-at-maptiler-com
"@

Set-Content -Path "apps/frontend/.env.local" -Value $frontendEnv

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD/apps/frontend'; pnpm run dev -- --port 5175"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
Write-Host "Prototype Started!" -ForegroundColor Green
Write-Host "===================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Services are running in separate PowerShell windows:" -ForegroundColor Cyan
Write-Host "   Backend:  http://localhost:3001 (PowerShell 1)" -ForegroundColor White
Write-Host "   Frontend: http://localhost:5175 (PowerShell 2)" -ForegroundColor White
Write-Host "   Database: localhost:5433" -ForegroundColor White
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Cyan
Write-Host "   Player 1: prototyp_player1 / test123" -ForegroundColor White
Write-Host "   Player 2: prototyp_player2 / test123" -ForegroundColor White
Write-Host "   GM:       prototyp_gm / test123" -ForegroundColor White
Write-Host ""
Write-Host "Opening frontend in browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 5
Start-Process "http://localhost:5175"

Write-Host ""
Write-Host "To stop:" -ForegroundColor Yellow
Write-Host "   1. Close the PowerShell windows (Backend + Frontend)" -ForegroundColor White
Write-Host "   2. Stop database: docker stop postgres-prototype" -ForegroundColor White
Write-Host ""
Write-Host "===================================================================" -ForegroundColor Green
