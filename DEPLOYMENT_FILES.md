# 🗂️ Deployment-Dateien Übersicht

Vollständige Liste aller Deployment-relevanten Dateien für das JLW 2026 Projekt.

## 📄 Hauptdokumentation

| Datei | Beschreibung |
|-------|--------------|
| `DEPLOYMENT.md` | Vollständige Deployment-Anleitung mit allen Details |
| `QUICKSTART.md` | Schnellanleitung für schnelles Setup |
| `README.md` | Projekt-Übersicht (sollte auf Deployment-Docs verweisen) |

## 🐳 Docker Konfiguration

| Datei | Beschreibung |
|-------|--------------|
| `docker-compose.yml` | Development Setup |
| `docker-compose.production.yml` | Production Setup mit allen Services |
| `docker/Dockerfile.backend` | Backend Docker Image |
| `docker/Dockerfile.frontend` | Frontend Docker Image (Nginx) |
| `docker/Dockerfile.gm-client` | GM Client Docker Image (Nginx) |
| `docker/nginx-frontend.conf` | Nginx Config für Frontend Container |
| `docker/nginx-gm-client.conf` | Nginx Config für GM Client Container |

## 🌐 Nginx Reverse Proxy

| Datei | Beschreibung |
|-------|--------------|
| `nginx/jlw2026.conf` | Nginx Reverse Proxy Config für Server |
|                      | - Frontend: jlw2026.example.com |
|                      | - API: api.jlw2026.example.com |
|                      | - GM: gm.jlw2026.example.com |
|                      | - SSL/TLS, Rate Limiting, WebSocket Support |

## ⚙️ Environment Configuration

| Datei | Beschreibung | Status |
|-------|--------------|---------|
| `.env.example` | Development Environment Template | ✅ Im Repo |
| `.env.production.example` | Production Environment Template | ✅ Im Repo |
| `.env.production` | Production Environment (Server) | ⚠️ **NICHT committen!** |

## 🔧 Deployment Scripts

| Datei | Beschreibung | Verwendung |
|-------|--------------|------------|
| `deploy.sh` | Haupt-Deployment-Script | `./deploy.sh production` |
| `scripts/setup-server.sh` | Initiales Server Setup | `sudo ./setup-server.sh` |
| `scripts/backup-db.sh` | Datenbank Backup | `./scripts/backup-db.sh` |
| `scripts/health-check.sh` | System Health Check | `./scripts/health-check.sh` |

## 📊 Script-Funktionen

### `deploy.sh`
- ✅ Git Pull
- ✅ Automatisches DB Backup vor Deployment
- ✅ Docker Images bauen
- ✅ Services neu starten
- ✅ Database Migrationen
- ✅ Health Checks
- ✅ Rollback bei Fehler

### `setup-server.sh`
- ✅ Docker & Docker Compose Installation
- ✅ Nginx Installation
- ✅ Certbot Installation
- ✅ UFW Firewall Setup
- ✅ Fail2Ban Setup
- ✅ Swap-Datei erstellen
- ✅ Log Rotation konfigurieren

### `backup-db.sh`
- ✅ PostgreSQL Dump erstellen
- ✅ Kompression (gzip)
- ✅ Alte Backups aufräumen (30 Tage Retention)
- ✅ Optional: S3 Upload

### `health-check.sh`
- ✅ Docker Container Status
- ✅ Backend API Health
- ✅ Database Connection
- ✅ Frontend/GM Client Status
- ✅ Nginx Status
- ✅ Disk & Memory Usage

## 🗄️ Verzeichnisstruktur nach Deployment

```
/opt/jlw2026/
├── apps/
│   ├── backend/
│   ├── frontend/
│   └── gm-client/
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── Dockerfile.gm-client
│   ├── nginx-frontend.conf
│   └── nginx-gm-client.conf
├── nginx/
│   └── jlw2026.conf
├── scripts/
│   ├── setup-server.sh
│   ├── backup-db.sh
│   └── health-check.sh
├── backups/                      # Automatisch erstellt
│   ├── backup_20260909_020000.sql.gz
│   └── ...
├── .env.production               # ⚠️ Nicht im Git!
├── docker-compose.production.yml
├── deploy.sh
├── DEPLOYMENT.md
└── QUICKSTART.md
```

## 🔒 Sicherheit

### Dateien die NIEMALS ins Git gehören:
- ❌ `.env.production`
- ❌ `.env.staging`
- ❌ `*.pem`, `*.key`, `*.crt` (SSL Zertifikate)
- ❌ `backups/*.sql*`
- ❌ Private SSH Keys

### Secrets Management

**Produktions-Secrets sollten:**
1. ✅ Auf dem Server in `.env.production` liegen
2. ✅ Nur von Root/Deploy-User lesbar sein (`chmod 600`)
3. ✅ Regelmäßig rotiert werden (JWT_SECRET, Passwörter)
4. ✅ Bei AWS/S3 IAM mit minimal notwendigen Rechten nutzen

## 📝 Checklists

### Pre-Deployment Checklist
- [ ] `.env.production` konfiguriert
- [ ] DNS-Records gesetzt
- [ ] S3 Bucket erstellt & CORS konfiguriert
- [ ] SSL Zertifikate erstellt
- [ ] Backups getestet
- [ ] Health Checks funktionieren
- [ ] Load Testing durchgeführt (optional)

### Post-Deployment Checklist
- [ ] Health-Check ausgeführt: `./scripts/health-check.sh`
- [ ] Logs geprüft: `docker compose logs -f`
- [ ] Frontend erreichbar
- [ ] API erreichbar
- [ ] WebSocket funktioniert
- [ ] GM Dashboard erreichbar & geschützt
- [ ] Automatische Backups eingerichtet (cron)

## 🔄 Update-Workflow

```bash
# 1. Auf Server connecten
ssh user@server

# 2. Zum Projekt
cd /opt/jlw2026

# 3. Code aktualisieren
git pull origin main

# 4. Deployment ausführen
./deploy.sh production

# 5. Verifizieren
./scripts/health-check.sh
```

## 🆘 Troubleshooting Commands

```bash
# Container Status
docker compose -f docker-compose.production.yml ps

# Logs ansehen
docker compose -f docker-compose.production.yml logs -f backend

# Service neu starten
docker compose -f docker-compose.production.yml restart backend

# Health Check
./scripts/health-check.sh

# Nginx testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx

# Manuelles Backup
./scripts/backup-db.sh
```

## 📞 Support

Bei Problemen:
1. Logs prüfen: `docker compose logs -f`
2. Health Check: `./scripts/health-check.sh`
3. Dokumentation: `DEPLOYMENT.md`
4. GitHub Issues: [Link zum Repo]

---

**Erstellt**: 2026-09-09  
**Version**: 1.0.0  
**Epic**: 1-9 Complete
