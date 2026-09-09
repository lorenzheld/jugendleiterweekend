# 🧪 Pfäffikon Prototype Deployment Guide

Dieser Guide zeigt, wie du den **Pfäffikon Prototyp** deployen kannst, **ohne deine Rom-Daten zu berühren**.

## 🎯 Warum separate Umgebungen?

- ✅ **Rom-Datenbank bleibt unberührt** (läuft auf Port 5432)
- ✅ **Prototyp-Datenbank ist isoliert** (läuft auf Port 5433)
- ✅ **Paralleles Testen möglich** (beide Systeme gleichzeitig)
- ✅ **Nur Pfäffikon-Daten** (keine Rom-Assets)

## 📋 Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│                    DEIN DEVELOPMENT-PC                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ROM (Production)           │  PFÄFFIKON (Prototype)         │
│  ─────────────────         │  ──────────────────────        │
│  Backend:  :3000            │  Backend:  :3001               │
│  Frontend: :5173            │  Frontend: :5175               │
│  DB:       :5432            │  DB:       :5433               │
│                             │                                │
│  Via_Romae_GameObjects      │  Prototype_GameObjects         │
│  v0.8.geojson               │  v0.1.geojson                  │
│  (Rom, publishable=true)    │  (Pfäffikon, publishable=false)│
│                             │                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Schnellstart: Lokales Prototyp-Testing

### Option 1: Automatisches Deployment (empfohlen)

```bash
# Script ausführbar machen
chmod +x deploy-prototype.sh

# Prototyp deployen
./deploy-prototype.sh
```

**Das war's!** 🎉

Der Prototyp läuft jetzt auf:
- Backend: http://localhost:3001
- Frontend: http://localhost:5175

### Option 2: Manuelles Deployment

```bash
# 1. Prototyp-Container starten
docker compose -f docker-compose.prototype.yml up -d --build

# 2. Warten bis Datenbank bereit ist
docker compose -f docker-compose.prototype.yml exec postgres-prototype pg_isready

# 3. Migrationen ausführen
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run db:migrate

# 4. Prototyp-Daten laden
docker compose -f docker-compose.prototype.yml exec backend-prototype npm run seed:prototype
```

---

## 🔐 Test-Accounts

Nach dem Seeding sind folgende Accounts verfügbar:

| Username | Passwort | Rolle | Team |
|----------|----------|-------|------|
| `prototyp_player1` | `test123` | Player | Pfäffikon Test Team |
| `prototyp_player2` | `test123` | Player | Pfäffikon Test Team |
| `prototyp_gm` | `test123` | GM | - |

**Start-Ressourcen:**
- 200 Denare (gemäß Spec)
- 0 Ruhm
- 100 HP (beide Spieler)

---

## 🗺️ Geladene Daten

Der Prototyp lädt **nur** die Pfäffikon-Daten:

### WorldObjects (aus GeoJSON):
- ✅ 3 Queststationen (Ost, Mitte, West)
- ✅ 2 Unique-Gegner (Leone del Flaminio, Legionario della Colonna)
- ✅ 1 Store (Bottega del Borgo)
- ✅ 1 Revive-Punkt
- ✅ 1 Boss (Il Cannoniere del Gianicolo)
- ✅ Zufallsspawn-Straßen

### Quest:
- ✅ PT-Q01: "Die drei Siegel der Schildwacht"
- ✅ 7 Quest-Steps (PICKUP → OBJECTIVE → CLIMAX → RESOLUTION)

### Spawn-Controller:
- ✅ Nur auf freigegebenen Straßenlinien
- ✅ Pool: Ratto dell'Acqua Virgo (60%), Cavalleggero Pontificio (40%)

---

## 📱 Feldtest-Deployment (auf Server)

Wenn du den Prototyp **im Feld** (mit Smartphones) testen willst, brauchst du einen öffentlich erreichbaren Server.

### Server-Setup

```bash
# 1. SSH zum Server
ssh root@DEINE-SERVER-IP

# 2. Repository clonen
cd /opt
git clone https://github.com/DEIN-REPO/jugendleiterweekend2026.git jlw2026-prototype
cd jlw2026-prototype

# 3. Environment-File für Prototyp erstellen
cp .env.production.example .env.prototype

# Anpassen:
nano .env.prototype
```

**Wichtige Settings in `.env.prototype`:**

```bash
# Separate Datenbank für Prototyp
DATABASE_URL=postgresql://postgres:SICHERES_PASSWORT@postgres-prototype:5432/jugendleiter2026_prototype
POSTGRES_DB=jugendleiter2026_prototype
POSTGRES_PASSWORD=SICHERES_PASSWORT

# JWT Secret (eigener für Prototyp)
JWT_SECRET=DEIN_PROTOTYPE_JWT_SECRET

# Backend URL (öffentlich!)
VITE_API_BASE_URL=https://prototype-api.jlw2026.example.com

# MapTiler Key
VITE_MAPTILER_API_KEY=DEIN_MAPTILER_KEY

# Prototyp-Feature-Flags
PLAYTEST_MODE=true
PLAYTEST_RUN_ID=PT-PFAEFFIKON-IM-BERG
SEED_SKIP_FILTER=true
```

### Nginx-Konfiguration (für Prototyp-Subdomain)

Erstelle `/etc/nginx/sites-available/jlw2026-prototype.conf`:

```nginx
# Prototype Frontend
server {
    listen 80;
    server_name prototype.jlw2026.example.com;

    location / {
        proxy_pass http://127.0.0.1:5175;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Prototype Backend
server {
    listen 80;
    server_name prototype-api.jlw2026.example.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # WebSocket Support
        proxy_read_timeout 86400;
    }
}
```

```bash
# Config aktivieren
sudo ln -s /etc/nginx/sites-available/jlw2026-prototype.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL-Zertifikate
sudo certbot --nginx \
  -d prototype.jlw2026.example.com \
  -d prototype-api.jlw2026.example.com
```

### Deployment

```bash
# Mit Environment-File deployen
./deploy-prototype.sh
```

---

## 🧪 Testing-Checkliste

Nach dem Deployment solltest du testen:

### Backend Health Check
```bash
curl http://localhost:3001/health
# Erwartete Antwort: OK oder {"status":"healthy"}
```

### Datenbank-Verbindung
```bash
docker compose -f docker-compose.prototype.yml exec postgres-prototype psql -U postgres -d jugendleiter2026_prototype -c "\dt"
# Sollte Tabellen anzeigen
```

### Geladene Daten prüfen
```bash
# WorldObjects zählen
docker compose -f docker-compose.prototype.yml exec postgres-prototype psql -U postgres -d jugendleiter2026_prototype -c "SELECT COUNT(*) FROM world_object;"

# Quest prüfen
docker compose -f docker-compose.prototype.yml exec postgres-prototype psql -U postgres -d jugendleiter2026_prototype -c "SELECT external_id, title FROM quest_definition WHERE external_id = 'PT-Q01';"
```

### Login testen
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"prototyp_player1","password":"test123"}'
  
# Sollte Token zurückgeben
```

---

## 🛠️ Troubleshooting

### Problem: "Port 3001 already in use"

```bash
# Prüfen, was Port belegt
lsof -i :3001

# Alten Container stoppen
docker compose -f docker-compose.prototype.yml down
```

### Problem: "Cannot connect to database"

```bash
# Logs prüfen
docker compose -f docker-compose.prototype.yml logs postgres-prototype

# Container neu starten
docker compose -f docker-compose.prototype.yml restart postgres-prototype
```

### Problem: "Seed-Script findet GeoJSON nicht"

```bash
# Prüfen ob Datei existiert
ls -la docs/Via_Romae_Pfaeffikon_Prototype_GameObjects_v0.1\ \(1\).geojson

# Falls umbenannt: Pfad in seed-prototype-pfaeffikon.ts anpassen
```

### Problem: "Frontend zeigt leere Karte"

```bash
# Prüfe VITE_API_BASE_URL in docker-compose.prototype.yml
# Muss auf http://localhost:3001 zeigen (lokal) oder https://prototype-api... (Server)

# Frontend neu bauen
docker compose -f docker-compose.prototype.yml up -d --build frontend-prototype
```

---

## 🔄 Prototyp zurücksetzen

Falls du den Prototyp komplett zurücksetzen willst:

```bash
# 1. Container stoppen
docker compose -f docker-compose.prototype.yml down

# 2. Datenbank-Volume löschen
docker volume rm jugendleiterweekend2026_postgres_prototype_data

# 3. Neu deployen
./deploy-prototype.sh
```

---

## 📊 Parallelbetrieb: Rom + Pfäffikon

Beide Systeme können **gleichzeitig** laufen:

| System | Backend | Frontend | Datenbank | Status |
|--------|---------|----------|-----------|--------|
| **Rom (Main)** | :3000 | :5173 | :5432 | Production-ready |
| **Pfäffikon (Prototype)** | :3001 | :5175 | :5433 | Field-testing |

```bash
# Beide starten
docker compose up -d                          # Rom
docker compose -f docker-compose.prototype.yml up -d  # Pfäffikon

# Beide stoppen
docker compose down
docker compose -f docker-compose.prototype.yml down
```

---

## ✅ Pre-Feldtest Checklist

Vor dem Feldtest in Pfäffikon prüfen:

- [ ] Prototyp deployed (lokal oder Server)
- [ ] Test-Accounts funktionieren
- [ ] GPS-Koordinaten in GeoJSON korrekt (Pfäffikon ZH)
- [ ] Backend Health Check OK
- [ ] WebSocket-Verbindung funktioniert
- [ ] MapTiler API Key gültig
- [ ] Frontend auf Smartphone erreichbar
- [ ] GPS-Permissions im Browser aktiviert
- [ ] Debug-Overlay zeigt GPS-Metriken

---

## 📞 Support

Bei Problemen:

1. **Logs prüfen:**
   ```bash
   docker compose -f docker-compose.prototype.yml logs -f backend-prototype
   ```

2. **Datenbank prüfen:**
   ```bash
   docker compose -f docker-compose.prototype.yml exec postgres-prototype psql -U postgres -d jugendleiter2026_prototype
   ```

3. **Container neu starten:**
   ```bash
   docker compose -f docker-compose.prototype.yml restart
   ```

---

**Happy Field-Testing! 🗺️⚔️**
