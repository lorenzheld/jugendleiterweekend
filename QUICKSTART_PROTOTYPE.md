# 🚀 QUICKSTART: Pfäffikon Prototyp (Lokal)

## ⚡ In 3 Schritten starten:

### 1️⃣ PowerShell öffnen

```powershell
# Im Projekt-Verzeichnis
cd C:\Users\heldl\Projekte\jugendleiterweekend2026
```

### 2️⃣ Prototyp starten

```powershell
# PowerShell-Script ausführen
.\deploy-prototype.ps1
```

**ODER manuell:**

```powershell
# Container starten
docker compose -f docker-compose.prototype.yml up -d --build

# Warten (15 Sekunden)
Start-Sleep -Seconds 15

# Datenbank migrieren
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run db:migrate

# Prototyp-Daten laden
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run seed:prototype
```

### 3️⃣ Im Browser öffnen

```
Frontend: http://localhost:5175
Backend:  http://localhost:3001
```

---

## 🔐 Login-Daten

| Username | Passwort | Rolle |
|----------|----------|-------|
| `prototyp_player1` | `test123` | Spieler 1 |
| `prototyp_player2` | `test123` | Spieler 2 |
| `prototyp_gm` | `test123` | GM |

---

## ✅ Health-Check

```powershell
# Backend testen
Invoke-WebRequest http://localhost:3001/health

# Login testen
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/auth/login" `
  -Method POST `
  -ContentType "application/json" `
  -Body '{"username":"prototyp_player1","password":"test123"}'
```

---

## 📋 Nützliche Befehle

```powershell
# Logs anzeigen
docker compose -f docker-compose.prototype.yml logs -f

# Nur Backend-Logs
docker compose -f docker-compose.prototype.yml logs -f backend-prototype

# Status prüfen
docker compose -f docker-compose.prototype.yml ps

# Container stoppen
docker compose -f docker-compose.prototype.yml down

# Neu starten
docker compose -f docker-compose.prototype.yml restart

# Komplett zurücksetzen (Datenbank löschen!)
docker compose -f docker-compose.prototype.yml down -v
.\deploy-prototype.ps1
```

---

## 🗄️ Datenbank direkt zugreifen

```powershell
# PostgreSQL CLI öffnen
docker compose -f docker-compose.prototype.yml exec postgres-prototype psql -U postgres -d jugendleiter2026_prototype

# Dann in psql:
# \dt              -- Tabellen anzeigen
# SELECT * FROM world_object LIMIT 5;
# SELECT * FROM quest_definition;
# SELECT * FROM player;
```

---

## 🐛 Troubleshooting

### Problem: "Port already in use"

```powershell
# Prüfen was Port 3001 belegt
netstat -ano | findstr :3001

# Prozess beenden (PID aus obigem Befehl)
taskkill /PID <PID> /F

# Oder alte Container stoppen
docker compose -f docker-compose.prototype.yml down
```

### Problem: "Cannot connect to Docker"

```powershell
# Docker Desktop starten
# Dann prüfen:
docker ps

# Wenn Fehler: Docker Desktop neu starten
```

### Problem: "Seed-Script findet Datei nicht"

```powershell
# Prüfen ob GeoJSON existiert
Get-ChildItem "docs\Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1 (1).geojson"

# Falls nicht: Dateinamen in seed-prototype-pfaeffikon.ts anpassen
```

### Problem: "Frontend zeigt leere Seite"

```powershell
# Frontend-Logs prüfen
docker compose -f docker-compose.prototype.yml logs frontend-prototype

# Frontend neu bauen
docker compose -f docker-compose.prototype.yml up -d --build frontend-prototype
```

---

## 📱 Smartphone-Zugriff (im lokalen Netzwerk)

Falls du mit deinem Smartphone auf den Prototyp zugreifen willst:

1. **Finde deine lokale IP:**
   ```powershell
   ipconfig | Select-String "IPv4"
   # Beispiel: 192.168.1.100
   ```

2. **Firewall-Regel hinzufügen:**
   ```powershell
   # Als Administrator:
   New-NetFirewallRule -DisplayName "JLW2026 Prototype" -Direction Inbound -LocalPort 3001,5175 -Protocol TCP -Action Allow
   ```

3. **Im Smartphone-Browser öffnen:**
   ```
   http://192.168.1.100:5175
   ```

   ⚠️ **Achtung:** `VITE_API_BASE_URL` muss dann auch auf deine IP zeigen!

---

## 🎯 Was ist geladen?

Nach dem Seeding enthält die Datenbank:

### WorldObjects (13):
- ✅ 3 Queststationen (Ost, Mitte, West)
- ✅ 2 Unique-Gegner
- ✅ 1 Store
- ✅ 1 Revive-Punkt
- ✅ 1 Boss
- ✅ Spawn-Bereiche

### Quest:
- ✅ PT-Q01: "Die drei Siegel der Schildwacht"

### Team:
- ✅ "Pfäffikon Test Team" (200 Denare, 0 Ruhm)
- ✅ 2 Spieler (je 100 HP)

---

## ✨ Next Steps

1. **Im Browser öffnen:** http://localhost:5175
2. **Mit `prototyp_player1` / `test123` einloggen**
3. **GPS aktivieren** (Browser fragt nach Berechtigung)
4. **Karte sollte Pfäffikon ZH zeigen**

**Für Feldtest:**
- GPS-Simulation im Browser nutzen (DevTools → Sensors)
- Oder: Server deployen (siehe `docs/DEPLOYMENT_PROTOTYPE.md`)

---

**Viel Erfolg! 🗺️⚔️**
