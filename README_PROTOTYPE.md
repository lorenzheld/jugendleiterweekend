# 🧪 Pfäffikon Prototyp - Lokales Testing Setup

## ✅ Alles ist ready! Du kannst jetzt starten.

Ich habe eine **komplette separate Test-Umgebung** für den Pfäffikon-Prototyp eingerichtet.

---

## 🎯 Was wurde erstellt?

### 📁 Neue Dateien:

```
jugendleiterweekend2026/
├── 🚀 START_PROTOTYPE_HIER.txt          ← Schnell-Anleitung (HIER STARTEN!)
├── 🚀 QUICKSTART_PROTOTYPE.md           ← Ausführliche Anleitung
├── 🚀 README_PROTOTYPE.md               ← Diese Datei
│
├── ⚙️ docker-compose.prototype.yml      ← Separate Docker-Umgebung
├── ⚙️ .env.prototype.example            ← Environment-Variablen
│
├── 🔧 deploy-prototype.ps1              ← PowerShell Deploy-Script
├── 🔧 deploy-prototype.bat              ← Batch Deploy-Script
├── 🔧 deploy-prototype.sh               ← Bash Deploy-Script (Linux/Mac)
├── 🧪 test-prototype.ps1                ← Test-Script zum Prüfen
│
├── apps/backend/scripts/
│   └── seed-prototype-pfaeffikon.ts     ← Seed-Script (nur Pfäffikon-Daten)
│
└── docs/
    └── DEPLOYMENT_PROTOTYPE.md          ← Server-Deployment Anleitung
```

---

## 🚀 Jetzt starten (3 Optionen):

### Option 1: PowerShell (Empfohlen)

```powershell
# PowerShell öffnen im Projekt-Verzeichnis
cd C:\Users\heldl\Projekte\jugendleiterweekend2026

# Deployment starten
.\deploy-prototype.ps1

# Warten bis fertig (ca. 2-3 Minuten)
# Browser öffnen: http://localhost:5175
```

### Option 2: Batch-Datei (Am einfachsten)

```
Doppelklick auf: deploy-prototype.bat
```

### Option 3: Manuell

```powershell
docker compose -f docker-compose.prototype.yml up -d --build
timeout /t 15
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run db:migrate
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run seed:prototype
```

---

## 🔐 Nach dem Start einloggen:

| URL | Zweck |
|-----|-------|
| http://localhost:5175 | **Frontend** (Spieler-App) |
| http://localhost:3001 | **Backend** (API) |
| http://localhost:3001/health | Health-Check |

**Test-Accounts:**
- `prototyp_player1` / `test123` (Spieler 1)
- `prototyp_player2` / `test123` (Spieler 2)
- `prototyp_gm` / `test123` (Game Master)

---

## ✅ Prüfen ob alles läuft:

```powershell
# Test-Script ausführen
.\test-prototype.ps1
```

Oder manuell:

```powershell
# Container-Status
docker compose -f docker-compose.prototype.yml ps

# Backend Health Check
Invoke-WebRequest http://localhost:3001/health

# Logs anzeigen
docker compose -f docker-compose.prototype.yml logs -f
```

---

## 🗺️ Was ist geladen?

Der Prototyp enthält **nur** die Pfäffikon-Daten:

### WorldObjects:
- ✅ 3 Queststationen (Ost, Mitte, West)
- ✅ 2 Unique-Gegner (Leone del Flaminio, Legionario della Colonna)
- ✅ 1 Store (Bottega del Borgo)
- ✅ 1 Revive-Punkt
- ✅ 1 Boss (Il Cannoniere del Gianicolo)
- ✅ Zufallsspawn-Bereiche (Straßen-gebunden)

### Quest:
- ✅ PT-Q01: "Die drei Siegel der Schildwacht"
- ✅ 7 Quest-Steps

### Team:
- ✅ "Pfäffikon Test Team"
- ✅ 200 Denare (Startkapital)
- ✅ 2 Spieler mit je 100 HP

---

## 🔒 Deine Rom-Datenbank ist sicher!

Die beiden Systeme sind **komplett getrennt**:

| System | Backend | Frontend | Datenbank | Status |
|--------|---------|----------|-----------|--------|
| **ROM** | :3000 | :5173 | :5432 | ✅ Unberührt |
| **PFÄFFIKON** | :3001 | :5175 | :5433 | 🧪 Prototyp |

Du kannst beide **gleichzeitig** laufen lassen!

---

## 🛠️ Wichtige Befehle:

```powershell
# Starten
.\deploy-prototype.ps1

# Status prüfen
docker compose -f docker-compose.prototype.yml ps

# Logs anzeigen
docker compose -f docker-compose.prototype.yml logs -f

# Einzelne Container-Logs
docker compose -f docker-compose.prototype.yml logs -f backend-prototype

# Container neu starten
docker compose -f docker-compose.prototype.yml restart

# Stoppen (Daten bleiben erhalten)
docker compose -f docker-compose.prototype.yml down

# Komplett zurücksetzen (Datenbank löschen!)
docker compose -f docker-compose.prototype.yml down -v
.\deploy-prototype.ps1
```

---

## 📱 Smartphone-Testing (im lokalen Netzwerk)

### 1. Lokale IP finden:
```powershell
ipconfig | Select-String "IPv4"
# Beispiel: 192.168.1.100
```

### 2. Firewall-Regel hinzufügen:
```powershell
# Als Administrator ausführen:
New-NetFirewallRule -DisplayName "JLW2026 Prototype" `
  -Direction Inbound `
  -LocalPort 3001,5175 `
  -Protocol TCP `
  -Action Allow
```

### 3. Am Smartphone im Browser:
```
http://192.168.1.100:5175
```

⚠️ **Wichtig:** Frontend muss dann mit deiner lokalen IP gebaut werden:
```yaml
# In docker-compose.prototype.yml ändern:
VITE_API_BASE_URL: http://192.168.1.100:3001
```

---

## 🐛 Troubleshooting

### Problem: "Port already in use"
```powershell
# Prüfen was Port 3001 belegt
netstat -ano | findstr :3001

# Container stoppen
docker compose -f docker-compose.prototype.yml down
```

### Problem: "Cannot connect to Docker"
```powershell
# Docker Desktop starten
# Dann Status prüfen:
docker ps
```

### Problem: "Seed-Script findet Datei nicht"
```powershell
# GeoJSON-Datei prüfen:
Get-ChildItem "docs\Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1 (1).geojson"

# Wenn Datei existiert: Container neu starten
docker compose -f docker-compose.prototype.yml restart backend-prototype
```

### Problem: "Backend startet nicht"
```powershell
# Logs anschauen
docker compose -f docker-compose.prototype.yml logs backend-prototype

# Häufigste Ursachen:
# - Datenbank noch nicht bereit → warten
# - Migration fehlgeschlagen → nochmal ausführen
# - Port 3001 belegt → andere Anwendung stoppen
```

### Problem: "Frontend zeigt leere Seite"
```powershell
# Frontend neu bauen
docker compose -f docker-compose.prototype.yml up -d --build frontend-prototype

# Browser-Cache leeren
# Dann: http://localhost:5175 neu laden
```

---

## 📚 Weitere Dokumentation

- **QUICKSTART_PROTOTYPE.md** - Ausführliche Anleitung mit allen Details
- **docs/DEPLOYMENT_PROTOTYPE.md** - Server-Deployment für Feldtest
- **docs/Via_Romae_Pfaeffikon_Prototype_Vibecoding_Brief_v0.1.md** - Spieldesign
- **docs/Via_Romae_Pfaeffikon_Prototype_Questdoc_v0.1.pdf** - Quest-Details

---

## 🎮 Next Steps:

1. ✅ **Deployment ausführen:** `.\deploy-prototype.ps1`
2. ✅ **Tests durchführen:** `.\test-prototype.ps1`
3. ✅ **Browser öffnen:** http://localhost:5175
4. ✅ **Einloggen:** `prototyp_player1` / `test123`
5. ✅ **GPS aktivieren** (Browser fragt nach Berechtigung)
6. 🧪 **Lokal testen** mit GPS-Simulation (Chrome DevTools → Sensors)
7. 🚀 **Feldtest vorbereiten** (siehe `docs/DEPLOYMENT_PROTOTYPE.md`)

---

## 💡 Tipps für lokales GPS-Testing:

### Chrome DevTools GPS-Simulation:

1. **DevTools öffnen** (F12)
2. **More Tools → Sensors** (⋮ Menü)
3. **Location** auswählen
4. **Custom location** setzen:
   ```
   Pfäffikon ZH - Queststation Ost:
   Latitude:  47.3745502
   Longitude: 8.7949444
   ```

5. **Koordinaten aus GeoJSON:**
   - Queststation Mitte: `47.3745641, 8.7926421`
   - Queststation West: `47.3754434, 8.7906471`
   - Store: `47.3761413, 8.7902254`
   - Boss: `47.375964, 8.7894232`

---

## ✨ Alles fertig!

Der Prototyp ist **komplett ready** für lokales Testing.

**Viel Erfolg beim Testen! 🗺️⚔️**

Bei Problemen:
1. Logs prüfen: `docker compose -f docker-compose.prototype.yml logs -f`
2. Test-Script ausführen: `.\test-prototype.ps1`
3. Neu deployen: `.\deploy-prototype.ps1`
