# Frontend Test-Anleitung – Epic 7: Realtime & Offline-Resilienz

## ✅ Logik-Überprüfung abgeschlossen

Alle TypeScript-Checks erfolgreich:
- ✅ Backend kompiliert ohne Fehler
- ✅ Frontend kompiliert ohne Fehler
- ✅ Contracts kompiliert ohne Fehler
- ✅ Event-Namen korrekt (Combat: `combat:started`, Quest: `quest.accepted`, etc.)
- ✅ SQL-Migration syntaktisch korrekt

---

## 🚀 Frontend Testen – Schritt für Schritt

### Voraussetzungen

1. **Backend läuft:**
   ```powershell
   cd C:\Users\heldl\Projekte\jugendleiterweekend2026\apps\backend
   npm run dev
   ```

2. **Datenbank-Migration ausgeführt:**
   ```powershell
   cd C:\Users\heldl\Projekte\jugendleiterweekend2026\apps\backend
   npm run db:migrate
   ```
   
   **Erwartete Ausgabe:**
   ```
   Applying migration: 0009_epic7_ws_event_log.sql
   ✅ Migration complete
   ```

3. **Test-Account erstellt:**
   ```powershell
   cd C:\Users\heldl\Projekte\jugendleiterweekend2026\apps\backend
   npm run db:seed
   ```
   
   **Notiere dir den JWT-Token aus der Ausgabe!**

---

## Test 1: WebSocket-Verbindung (Backend-Test)

```powershell
cd C:\Users\heldl\Projekte\jugendleiterweekend2026\apps\backend
$env:TEST_TOKEN="<dein-jwt-token>"
npm run test:ws
```

### ✅ Erwartetes Ergebnis:

```
═══════════════════════════════════════════════════
  Epic 7: WebSocket Connection Test Suite
═══════════════════════════════════════════════════

🧪 Testing WebSocket connection...

✅ WebSocket connected
   URL: ws://localhost:3000/api/v1/geo/ws
   Time: 2026-09-08T14:05:12.345Z

📨 Received event: ws.connected
   Payload: {
     "event": "ws.connected",
     "playerId": "...",
     "teamId": "...",
     "nearbyObjects": [],
     "timestamp": "..."
   }

✅ Connection handshake successful

🧪 Testing event recovery endpoint...

✅ Recovery endpoint working
   Since: 2026-09-08T14:04:12.345Z
   Events recovered: 0

🧪 Testing WebSocket health check...

✅ Health check endpoint working
   Status: ok
   Active connections: 0
   Rooms: {}

═══════════════════════════════════════════════════
  ✅ All tests passed!
═══════════════════════════════════════════════════
```

### ❌ Wenn Fehler auftreten:

1. **"Connection refused"** → Backend läuft nicht, starte `npm run dev`
2. **"401 Unauthorized"** → JWT-Token falsch oder abgelaufen, erstelle neuen mit `npm run db:seed`
3. **"ws.connected not received"** → Prüfe Backend-Logs auf Fehler

---

## Test 2: Frontend WebSocket-Verbindung

### Schritt 1: Frontend starten

```powershell
cd C:\Users\heldl\Projekte\jugendleiterweekend2026\apps\frontend
npm run dev
```

**Frontend läuft auf:** http://localhost:5173

### Schritt 2: Browser öffnen und anmelden

1. Öffne **http://localhost:5173** in Chrome/Edge
2. Öffne **DevTools** (F12)
3. Gehe zum **Console-Tab**
4. Melde dich mit dem Test-Account an:
   - Username: `testteam1` (oder wie in db:seed erstellt)
   - Password: `test123`

### Schritt 3: WebSocket-Logs prüfen

In der Browser-Console solltest du sehen:

```javascript
[WS] Connecting to: ws://localhost:3000/api/v1/geo/ws?token=***
[WS] WebSocket connected
[WS] Received event: ws.connected
```

### ✅ Erwartetes Verhalten:

1. **Connection-Indicator** erscheint oben rechts:
   - Zuerst: gelb/orange "Verbinde..."
   - Dann: grün "Verbunden" (verschwindet nach 2-3 Sekunden)

2. **Console-Logs zeigen:**
   ```
   [WS Context] Connection state: connected
   [WS] Connected
   [WS] Received event: ws.connected
   ```

3. **Keine Fehler in der Console**

---

## Test 3: Reconnect-Logik testen

### Schritt 1: Verbindung manuell trennen

In der Browser-DevTools-Console:

```javascript
// Verbindung trennen
const ws = window.__ws_instance__;  // Falls exponiert, sonst manuell über Network-Tab
// Alternativ: DevTools → Network → Toggle "Offline"
```

**Einfacher Weg:**
1. DevTools → **Network-Tab**
2. Dropdown "No throttling" → **Offline**

### Schritt 2: Beobachte Reconnect

**Connection-Indicator zeigt:**
- Orange "Reconnecting (1)..."
- Nach ~1 Sekunde: "Reconnecting (2)..."
- Usw.

**Console zeigt:**
```javascript
[WS] WebSocket closed: 1006 
[WS] Reconnecting in 1000ms (attempt 1)
[WS] Connecting to: ws://...
```

### Schritt 3: Wieder Online gehen

1. DevTools → Network → **No throttling**
2. Nach 1-2 Sekunden sollte Reconnect erfolgreich sein

**✅ Erwartetes Verhalten:**
```javascript
[WS] WebSocket connected
[WS Context] Connection state: connected
[State Recovery] Starting state recovery...
[State Recovery] Recovering combat state...
[State Recovery] Recovering quest state...
[State Recovery] Recovering team state...
[State Recovery] State recovery complete: { hasCombat: false, questCount: 0, hasTeamUpdates: true }
[GameMap] State recovery completed
```

**Connection-Indicator:**
- Grün "✓ Verbunden"
- Optional: "Verbindung wiederhergestellt" Toast-Nachricht

---

## Test 4: Event-Recovery nach Disconnect

Dieser Test ist fortgeschritten und erfordert zwei Browser-Fenster.

### Setup:

1. **Fenster 1:** Spieler 1 angemeldet (bleibt online)
2. **Fenster 2:** Spieler 2 angemeldet (simuliert Disconnect)

### Ablauf:

1. **Fenster 2:** Gehe Offline (Network → Offline)
2. **Fenster 1:** Führe eine Aktion aus:
   - Bewege dich zu einem WorldObject
   - Oder: Simuliere ein Event über Backend-Script
3. **Fenster 2:** Gehe wieder Online

**✅ Erwartetes Verhalten in Fenster 2:**
```javascript
[WS] Reconnecting...
[WS] Connected
GET /api/v1/ws/events?since=2026-09-08T14:00:00.000Z
[State Recovery] Recovered 3 missed events
[WS] Flushing 3 queued events
```

Die fehlenden Events werden nachgeholt und verarbeitet.

---

## Test 5: PWA Service-Worker & Cache

### Schritt 1: Service-Worker-Registrierung prüfen

1. **DevTools → Application-Tab**
2. **Service Workers** (linke Sidebar)
3. Du solltest sehen:
   - ✅ Status: **activated and running**
   - URL: `/dev-sw.js` (Dev) oder `/sw.js` (Production)

### Schritt 2: Cache-Inhalt prüfen

1. **DevTools → Application → Cache Storage**
2. Du solltest sehen:
   - `workbox-precache-v2-...` (Static Assets)
   - `api-cache` (API-Responses)
   - `map-tiles-cache` (Karten-Tiles)
   - `audio-cache` (Audio-Dateien)

### Schritt 3: Offline-Modus testen

1. **Network → Offline**
2. **Page Reload (Ctrl+R)**
3. App sollte aus Cache laden
4. ✅ App lädt, aber API-Calls schlagen fehl (erwartet)

**Console zeigt:**
```javascript
[WS] Cannot connect: offline
Service Worker: Serving from cache
```

---

## Test 6: Combat-Event-Integration (Optional)

Wenn ein Combat-System bereits läuft:

1. Starte ein Combat (über API oder GM-Dashboard)
2. **Console sollte zeigen:**
   ```javascript
   [WS] Received event: combat:started
   [Combat] Combat started: { combatId: "...", ... }
   [Combat] Fetching active combat...
   ```

3. Combat-UI sollte automatisch erscheinen
4. Combat-Runden sollten in Echtzeit erscheinen (kein Polling!)

---

## 🐛 Troubleshooting

### Problem: "Cannot connect to WebSocket"

**Lösung:**
1. Backend läuft? → `curl http://localhost:3000/health`
2. JWT-Token valide? → Prüfe Ablaufzeit (7 Tage nach `db:seed`)
3. Firewall? → Windows Firewall-Ausnahme für Node.js

### Problem: "CORS Error"

**Lösung:**
1. Backend sollte CORS erlauben für `http://localhost:5173`
2. Prüfe `@fastify/cors`-Konfiguration in `backend/src/index.ts`

### Problem: "Service Worker not registered"

**Lösung:**
1. Dev-Mode? → PWA läuft im Dev mit `devOptions: { enabled: true }`
2. HTTPS? → In Production benötigt PWA HTTPS (in Dev nicht)
3. Browser-Support? → Chrome/Edge/Firefox unterstützt, Safari eingeschränkt

### Problem: "State recovery fails"

**Lösung:**
1. `/auth/me` erreichbar? → `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/auth/me`
2. Player hat Team? → Prüfe DB: `SELECT * FROM player WHERE id = '...'`
3. Console-Logs prüfen für detaillierte Fehler

### Problem: "Events werden doppelt empfangen"

**Lösung:**
1. Nur eine WebSocket-Verbindung pro Tab erlaubt
2. React StrictMode in Dev? → Doppeltes Mount ist normal, wird bereinigt
3. Prüfe, dass `useWsEvent` mit `useCallback` wrapper ist

---

## 📊 Erfolgs-Checkliste

Nach allen Tests solltest du:

- [ ] ✅ WebSocket-Verbindung sehen (Backend-Test)
- [ ] ✅ Frontend verbindet automatisch bei Login
- [ ] ✅ Connection-Indicator zeigt korrekten Status
- [ ] ✅ Reconnect funktioniert automatisch (1-30s)
- [ ] ✅ State-Recovery läuft nach Reconnect
- [ ] ✅ Service-Worker ist registriert
- [ ] ✅ Cache enthält Assets (~200 MB)
- [ ] ✅ Keine TypeScript-Fehler in Console
- [ ] ✅ Keine WebSocket-Fehler in Backend-Logs

---

## 🎉 Wenn alles funktioniert

**Console zeigt:**
```
✅ WebSocket: Connected
✅ State: Synced
✅ Cache: Ready
✅ Offline: Supported
```

**Status:**
- Connection-Indicator: Grün oder nicht sichtbar (bei stable connection)
- Keine Fehler in Console
- Events kommen in Echtzeit
- Reconnect funktioniert automatisch

---

## 📚 Weitere Infos

- **Vollständige Doku:** [epic7-realtime-offline.md](./epic7-realtime-offline.md)
- **Quick-Start:** [REALTIME_QUICKSTART.md](./REALTIME_QUICKSTART.md)
- **Backend-Code:** `apps/backend/src/modules/ws/`
- **Frontend-Code:** `apps/frontend/src/hooks/use-websocket.ts`

Bei Fragen oder Problemen: Prüfe die Backend-Logs (`npm run dev` Output) und Browser-Console (F12).
