# Realtime & Offline-Resilienz – Quick Start

## 🚀 Setup (Erstmaliges Einrichten)

### 1. Dependencies installieren
```bash
# Root-Level
npm install

# Backend
cd apps/backend
npm install

# Frontend
cd apps/frontend
npm install
```

### 2. Datenbank-Migration ausführen
```bash
cd apps/backend
npm run db:migrate
```

Dies führt die Migration `0009_epic7_ws_event_log.sql` aus und erstellt die `ws_event_log` Tabelle.

### 3. Test-Account erstellen
```bash
cd apps/backend
npm run db:seed
```

Notiere den generierten JWT-Token für die Tests.

## 🧪 Testing

### WebSocket-Verbindung testen
```bash
cd apps/backend
TEST_TOKEN=<dein-jwt-token> npm run test:ws
```

**Erwartetes Ergebnis:**
```
═══════════════════════════════════════════════════
  Epic 7: WebSocket Connection Test Suite
═══════════════════════════════════════════════════

🧪 Testing WebSocket connection...

✅ WebSocket connected
   URL: ws://localhost:3000/api/v1/geo/ws
   Time: 2026-09-08T13:45:12.345Z

📨 Received event: ws.connected
   Payload: {
     "event": "ws.connected",
     "playerId": "...",
     "teamId": "...",
     "nearbyObjects": [],
     "timestamp": "2026-09-08T13:45:12.345Z"
   }

✅ Connection handshake successful

🔌 WebSocket closed
   Code: 1000
   Reason: Normal closure

📊 Summary:
   Events received: 1
   Event types: ws.connected

✅ All tests passed!
```

### Frontend Live-Test

1. **Backend starten:**
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Frontend starten:**
   ```bash
   cd apps/frontend
   npm run dev
   ```

3. **Browser öffnen:**
   - Gehe zu `http://localhost:5173`
   - Melde dich an (Test-Account)
   - Öffne DevTools Console
   - Suche nach `[WS] Connected`-Logs

4. **Reconnect testen:**
   - DevTools → Network → Toggle "Offline"
   - Warte 2-3 Sekunden
   - Toggle "Online"
   - Connection-Indicator sollte "Reconnecting" → "Connected" zeigen
   - Console sollte "State recovery completed" zeigen

## 📡 Features nutzen

### WebSocket-Events subscriben

```typescript
import { useWs, useWsEvent } from '../contexts/websocket.context';

function MyComponent() {
  const { isConnected } = useWs();

  // Subscribe zu spezifischen Events
  useWsEvent('combat.round', (event) => {
    console.log('Combat round:', event);
  });

  useWsEvent('quest.completed', (event) => {
    console.log('Quest completed:', event);
  });

  return (
    <div>
      Status: {isConnected ? '✅ Connected' : '❌ Disconnected'}
    </div>
  );
}
```

### State-Recovery nutzen

```typescript
import { useStateRecovery } from '../hooks/use-state-recovery';

function GameScreen() {
  useStateRecovery({
    debug: true,
    onRecoveryComplete: () => {
      console.log('✅ State recovered after reconnect');
    },
  });

  // ... rest of component
}
```

### Connection-Status anzeigen

```typescript
import { ConnectionIndicator } from '../components/common/connection-indicator';

function App() {
  return (
    <div>
      <ConnectionIndicator 
        position="top-right" 
        showText 
      />
      {/* ... rest of app */}
    </div>
  );
}
```

## 🔍 Debugging

### WebSocket-Logs aktivieren

**Frontend:**
```typescript
<WebSocketProvider debug={true}>
  <App />
</WebSocketProvider>
```

**Backend:**
Logs automatisch in `pino`-Output:
```bash
# Nur WebSocket-Logs
npm run dev | grep "ws:"
```

### Connection-Status prüfen

**HTTP Endpoint:**
```bash
curl http://localhost:3000/api/v1/ws/health
```

**Erwartet:**
```json
{
  "status": "ok",
  "connections": 3,
  "rooms": {
    "team-uuid-1": 2,
    "team-uuid-2": 1
  }
}
```

### Event-Recovery testen

```bash
# Events der letzten 5 Minuten abrufen
curl "http://localhost:3000/api/v1/ws/events?since=2026-09-08T13%3A40%3A00.000Z" \
  -H "Authorization: Bearer <token>"
```

**Erwartet:**
```json
{
  "events": [
    { "event": "radius.transition", "..." },
    { "event": "combat.round", "..." }
  ],
  "count": 2
}
```

## 📊 Monitoring

### Datenbank-Größe prüfen

```sql
-- Anzahl Events im Log
SELECT COUNT(*) FROM ws_event_log;

-- Größe der Tabelle
SELECT pg_size_pretty(pg_total_relation_size('ws_event_log'));

-- Events pro Team
SELECT team_id, COUNT(*) 
FROM ws_event_log 
GROUP BY team_id 
ORDER BY COUNT(*) DESC;
```

### Cleanup-Job prüfen

Backend-Logs sollten alle 60s zeigen:
```
[WS Cleanup] Cleaned up old WS events { deleted: 23, cutoff: "..." }
```

## 🚨 Troubleshooting

### Problem: "WebSocket connection failed"

**Lösung:**
1. Backend läuft? → `curl http://localhost:3000/health`
2. CORS-Problem? → Prüfe `@fastify/cors` Konfiguration
3. JWT-Token valide? → Prüfe Token-Ablaufzeit (7 Tage)

### Problem: "No events received"

**Lösung:**
1. Sind andere Spieler im gleichen Team online?
2. Bewegt sich jemand durch Radius-Zonen?
3. Läuft ein Combat? → Manuell triggern mit `POST /combat/start`

### Problem: "Reconnect loop"

**Lösung:**
1. Heartbeat-Timeout zu niedrig? → Prüfe `HEARTBEAT_TIMEOUT` (60s)
2. Netzwerk instabil? → Exponential Backoff greift (max 30s)
3. Server-Restart? → Auto-Reconnect sollte nach 1-30s erfolgen

### Problem: "State recovery failed"

**Lösung:**
1. `/auth/me` Endpoint erreichbar? → `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/auth/me`
2. Combat-Endpoint erreichbar? → `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/combat/team/active`
3. Browser-Console prüfen → Sollte Error-Details zeigen

## 📚 Weitere Ressourcen

- **Vollständige Dokumentation:** [epic7-realtime-offline.md](./epic7-realtime-offline.md)
- **WebSocket-Contracts:** [packages/contracts/src/schemas/realtime.ts](../packages/contracts/src/schemas/realtime.ts)
- **Backend-Hub:** [apps/backend/src/modules/ws/ws.hub.ts](../apps/backend/src/modules/ws/ws.hub.ts)
- **Frontend-Hook:** [apps/frontend/src/hooks/use-websocket.ts](../apps/frontend/src/hooks/use-websocket.ts)

## ✅ Checkliste für Deployment

- [ ] Migration `0009_epic7_ws_event_log.sql` ausgeführt
- [ ] Backend-Umgebungsvariablen gesetzt (`JWT_SECRET`)
- [ ] Frontend-Build mit PWA-Plugin: `npm run build`
- [ ] WebSocket-Health-Check funktioniert: `GET /api/v1/ws/health`
- [ ] HTTPS für Production (WSS statt WS)
- [ ] Service-Worker registriert (PWA)
- [ ] Cache-Größe ~200 MB validiert
- [ ] Event-Cleanup-Job läuft (Backend-Logs prüfen)

---

**Bei Problemen:** Siehe [Troubleshooting](#-troubleshooting) oder öffne ein Issue im Repo.
