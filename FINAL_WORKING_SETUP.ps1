# FINALES Working Setup - basiert auf existierendem seed.ts

Write-Host "Stopping all processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
docker stop postgres-prototype 2>$null
docker rm postgres-prototype 2>$null

Write-Host "Starting PostgreSQL..." -ForegroundColor Cyan
docker run -d --name postgres-prototype -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=jugendleiter2026_prototype -p 5433:5432 postgis/postgis:16-3.4-alpine
Start-Sleep -Seconds 20

Write-Host "Running migrations..." -ForegroundColor Cyan
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype"
cd apps\backend
pnpm run db:migrate

Write-Host "Using EXISTING seed script..." -ForegroundColor Cyan
$env:SEED_SKIP_FILTER = "true"
pnpm run seed

Write-Host ""
Write-Host "Starting Backend (Port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5433/jugendleiter2026_prototype'; `$env:PORT='3001'; `$env:JWT_SECRET='test123'; pnpm run dev"

cd ..\..
Start-Sleep -Seconds 5

Write-Host "Starting Frontend (Port 5175)..." -ForegroundColor Cyan
@"
VITE_API_BASE_URL=http://localhost:3001
"@ | Out-File -FilePath "apps\frontend\.env.local" -Force

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\apps\frontend'; pnpm run dev -- --port 5175"

Write-Host ""
Write-Host "DONE! Open http://localhost:5175" -ForegroundColor Green
Write-Host "Login with accounts from the MAIN seed data" -ForegroundColor Yellow
Start-Sleep -Seconds 5
Start-Process "http://localhost:5175"
