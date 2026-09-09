# Stop Local Prototype

Write-Host "Stopping local prototype..." -ForegroundColor Yellow

# Stop PostgreSQL container
Write-Host "Stopping PostgreSQL container..." -ForegroundColor Cyan
docker stop postgres-prototype 2>$null

Write-Host ""
Write-Host "Prototype stopped!" -ForegroundColor Green
Write-Host ""
Write-Host "To remove database completely:" -ForegroundColor Yellow
Write-Host "   docker rm postgres-prototype" -ForegroundColor White
Write-Host "   docker volume rm postgres_prototype_data" -ForegroundColor White
