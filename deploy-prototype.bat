@echo off
REM Pfäffikon Prototype Deployment Script (Batch)
REM Startet eine separate Prototyp-Umgebung OHNE die Rom-Daten zu berühren

echo ===================================================================
echo Starting Pfaffikon Prototype Deployment
echo ===================================================================
echo.
echo This will NOT affect your main Rome database!
echo.

REM 1. Stoppe alte Prototyp-Container
echo [PROTOTYPE] Stopping old prototype containers...
docker compose -f docker-compose.prototype.yml down >nul 2>&1

REM 2. Starte neue Prototyp-Container
echo [PROTOTYPE] Starting prototype containers...
docker compose -f docker-compose.prototype.yml up -d --build

if errorlevel 1 (
    echo [ERROR] Failed to start containers!
    pause
    exit /b 1
)

REM 3. Warte auf Datenbank
echo [PROTOTYPE] Waiting for PostgreSQL...
timeout /t 15 /nobreak >nul

REM 4. Fuehre Migrationen aus
echo [PROTOTYPE] Running database migrations...
docker compose -f docker-compose.prototype.yml exec -T backend-prototype npm run db:migrate

if errorlevel 1 (
    echo [WARNING] Migrations failed, but continuing...
)

REM 5. Lade Prototyp-Daten
echo [PROTOTYPE] Loading Pfaffikon prototype data...
docker compose -f docker-compose.prototype.yml exec -T backend-prototype npm run seed:prototype

if errorlevel 1 (
    echo [WARNING] Seeding failed!
)

REM 6. Health Check
echo [PROTOTYPE] Running health check...
timeout /t 3 /nobreak >nul

curl -f http://localhost:3001/health >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Backend health check failed (might still be starting...)
) else (
    echo [PROTOTYPE] Backend health check passed!
)

echo.
echo ===================================================================
echo Prototype Deployment Complete!
echo ===================================================================
echo.
echo Pfaffikon Prototype is running on:
echo    Backend:  http://localhost:3001
echo    Frontend: http://localhost:5175
echo    Database: localhost:5433 (jugendleiter2026_prototype)
echo.
echo Test Credentials:
echo    Player 1: prototyp_player1 / test123
echo    Player 2: prototyp_player2 / test123
echo    GM:       prototyp_gm / test123
echo.
echo Test Area: Pfaffikon ZH - Im Berg
echo.
echo Your main Rome database is UNTOUCHED:
echo    Backend:  http://localhost:3000
echo    Database: localhost:5432 (jugendleiter2026)
echo.
echo To stop prototype:
echo    docker compose -f docker-compose.prototype.yml down
echo.
echo View logs:
echo    docker compose -f docker-compose.prototype.yml logs -f
echo.
echo ===================================================================
echo.
echo Opening frontend in browser...
timeout /t 2 /nobreak >nul
start http://localhost:5175

pause
