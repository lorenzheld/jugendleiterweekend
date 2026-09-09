# 🚀 Quick Start - Server Deployment

Schnellanleitung für das Deployment auf deinem Ubuntu Server.

## Voraussetzungen

- Ubuntu 22.04+ Server mit SSH-Zugriff
- Domain(s) mit DNS auf Server-IP zeigend
- Root oder sudo-Rechte

## 📦 Schritt 1: Server vorbereiten

```bash
# SSH auf Server verbinden
ssh user@your-server-ip

# Als Root wechseln
sudo su -

# Setup-Script herunterladen und ausführen
curl -o setup-server.sh https://raw.githubusercontent.com/YOUR_REPO/main/scripts/setup-server.sh
chmod +x setup-server.sh
./setup-server.sh

# Nach der Installation: Logout und neu einloggen
exit
```

## 📁 Schritt 2: Projekt klonen

```bash
# Zum Projekt-Verzeichnis
cd /opt/jlw2026

# Repository klonen
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# Oder via SSH
git clone git@github.com:YOUR_USERNAME/YOUR_REPO.git .
```

## ⚙️ Schritt 3: Environment konfigurieren

```bash
# Environment-Datei erstellen
cp .env.production.example .env.production

# Bearbeiten
nano .env.production
```

**Wichtig ändern:**
- `POSTGRES_PASSWORD`: Starkes Passwort
- `JWT_SECRET`: Mindestens 32 Zeichen (generieren mit `openssl rand -base64 32`)
- `S3_ACCESS_KEY` & `S3_SECRET_KEY`: AWS Credentials
- `S3_BUCKET`: Dein S3 Bucket Name
- `VITE_API_BASE_URL`: z.B. `https://api.jlw2026.example.com`
- `VITE_MAPTILER_API_KEY`: Dein MapTiler API Key

## 🔒 Schritt 4: SSL Zertifikate

```bash
# Nginx Konfiguration kopieren
sudo cp nginx/jlw2026.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/jlw2026 /etc/nginx/sites-enabled/

# Domains in Nginx-Config anpassen
sudo nano /etc/nginx/sites-available/jlw2026
# Ersetze alle "example.com" mit deiner echten Domain

# Nginx testen und neu laden
sudo nginx -t
sudo systemctl reload nginx

# SSL Zertifikate mit Certbot erstellen
sudo certbot --nginx \
  -d jlw2026.example.com \
  -d api.jlw2026.example.com \
  -d gm.jlw2026.example.com
```

## 🐳 Schritt 5: Docker Deployment

```bash
# Zum Projekt-Verzeichnis
cd /opt/jlw2026

# Deploy-Script ausführbar machen
chmod +x deploy.sh

# Deployment starten
./deploy.sh production
```

Das Script wird:
1. Docker Images bauen
2. Datenbank Backup erstellen
3. Services neu starten
4. Migrationen ausführen
5. Health Checks durchführen

## ✅ Schritt 6: Verifizieren

```bash
# Health Check ausführen
chmod +x scripts/health-check.sh
./scripts/health-check.sh

# Logs ansehen
docker compose -f docker-compose.production.yml logs -f

# Manuell testen
curl https://api.jlw2026.example.com/health
curl https://jlw2026.example.com
curl https://gm.jlw2026.example.com
```

## 🎮 Schritt 7: Test-Daten importieren (Optional)

```bash
# Test-Account erstellen
docker compose -f docker-compose.production.yml exec backend npm run db:seed

# GeoJSON-Daten importieren
docker compose -f docker-compose.production.yml exec backend npm run seed
```

## 🛡️ Schritt 8: GM Dashboard absichern

```bash
# Basic Auth für GM Dashboard erstellen
sudo apt install apache2-utils -y
sudo htpasswd -c /etc/nginx/.htpasswd gmadmin

# Passwort eingeben wenn aufgefordert
# Nginx neu laden
sudo systemctl reload nginx
```

## 📊 Monitoring

```bash
# Container Status
docker compose -f docker-compose.production.yml ps

# Logs verfolgen
docker compose -f docker-compose.production.yml logs -f backend

# System-Ressourcen
docker stats

# Health Check
./scripts/health-check.sh
```

## 🔄 Updates deployen

```bash
cd /opt/jlw2026
git pull origin main
./deploy.sh production
```

## 💾 Backups

```bash
# Manuelles Backup
./scripts/backup-db.sh

# Automatisches Backup einrichten (täglich um 2 Uhr nachts)
crontab -e
# Folgende Zeile hinzufügen:
# 0 2 * * * /opt/jlw2026/scripts/backup-db.sh >> /var/log/jlw2026-backup.log 2>&1
```

## 🆘 Troubleshooting

### Services starten nicht

```bash
# Logs ansehen
docker compose -f docker-compose.production.yml logs backend

# Einzelnen Service neu starten
docker compose -f docker-compose.production.yml restart backend

# Alle Services neu starten
docker compose -f docker-compose.production.yml restart
```

### Datenbank-Probleme

```bash
# PostgreSQL Status
docker compose -f docker-compose.production.yml exec postgres pg_isready

# PostgreSQL Shell
docker compose -f docker-compose.production.yml exec postgres \
  psql -U postgres -d jugendleiter2026
```

### Nginx Fehler

```bash
# Config testen
sudo nginx -t

# Error Log
sudo tail -f /var/log/nginx/error.log

# Nginx neu starten
sudo systemctl restart nginx
```

## 📚 Weitere Dokumentation

- Vollständige Anleitung: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Epic Summaries: [EPIC9_SUMMARY.md](./EPIC9_SUMMARY.md)
- API Dokumentation: `/docs/` Verzeichnis

---

**Viel Erfolg! 🚀**
