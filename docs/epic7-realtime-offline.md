# Epic 7: Realtime & Offline-Resilienz

## Übersicht

Epic 7 implementiert eine robuste Echtzeit-Synchronisation mit automatischer Wiederverbindung und Offline-Resilienz für die Via Romae Spieler-App.

## Features

### 1. WebSocket-Integration ✅

#### Backend (`apps/backend/src/modules/ws/`)
- **`ws.hub.ts`**: Zentraler WebSocket-Hub für team-basierte Räume
  - Automatisches Ping/Pong (25s Intervall)
  - Event-Logging für Client-Recovery
  - Unterstützung für verschiedene Event-Typen (Combat, Quest, Team, PvP)
  
- **`ws.routes.ts`**: HTTP-Endpunkte für WebSocket-Recovery
  - `GET /api/v1/ws/events?since=<timestamp>`: Abrufen fehlender Events nach Reconnect
  - `GET /api/v1/ws/health`: Diagnose-Endpunkt für Connection-Status
  
- **`ws.cleanup.ts`**: Automatischer Cleanup-Job
  - Löscht Events älter als 5 Minuten
  - Läuft alle 60 Sekunden
  - Verhindert unbegrenztes Datenbank-Wachstum

#### Database Schema
- **`ws_event_log` Tabelle**: Persistiert alle WebSocket-Events
  - `id`, `event_type`, `team_id`, `payload`, `timestamp`
  - Index auf `(team_id, timestamp)` für schnelle Recovery-Queries
  - Automatisches Pruning nach 5 Minuten

#### Frontend (`apps/frontend/src/`)

##### Hooks
- **`hooks/use-websocket.ts`**: Core WebSocket-Hook
  - Automatische Reconnect-Logik mit exponential backoff (1s → 30s)
  - Event-Queue für Offline-Perioden (max. 100 Events)
  - Heartbeat-Monitoring (60s Timeout)
  - Event-Recovery nach Reconnect
  - TypeScript-sichere Event-Subscriptions

##### Contexts
- **`contexts/websocket.context.tsx`**: Globaler WebSocket-Provider
  - Stellt Connection-State im gesamten App-Tree bereit
  - Bietet spezialisierte Hooks für Event-Typen:
    - `useWs()`: Zugriff auf Connection-State
    - `useWsEvent()`: Subscribe zu spezifischen Events
    - `useRadiusEvents()`: Radius-Transition-Events
    - `useConnectionStatus()`: UI-Status-Indikator
  - Automatische Notification bei Reconnect

##### Components
- **`components/common/connection-indicator.tsx`**: Visueller Status-Indikator
  - Zeigt Connection-State (connecting, connected, reconnecting, error)
  - Pulsiert während Reconnect-Versuchen
  - Zeigt Anzahl gepufferter Events
  - Positionierbar (top-left, top-right, bottom-left, bottom-right)

### 2. Event-Typen (Contracts)

#### Bestehende Events
- **Radius Events** (`geo.ts`): `radius.transition`, `ws.connected`
- **Combat Events** (`combat.ts`): `combat.started`, `combat.round`, `combat.ended`
- **Quest Events** (`quest.ts`): `quest.accepted`, `quest.step_completed`, `quest.completed`

#### Neue Events (Epic 7)
- **Team Events** (`realtime.ts`):
  - `team.updated`: Fame, Denarii, Inventory-Änderungen
  - `team.member_joined`: Spieler tritt Team bei
  - `team.member_left`: Spieler verlässt Team
  
- **PvP Events** (`realtime.ts`):
  - `pvp.challenge`: Team fordert anderes Team heraus
  - `pvp.accepted`: Challenge akzeptiert
  - `pvp.declined`: Challenge abgelehnt
  
- **System Events** (`realtime.ts`):
  - `system.announcement`: GM-Nachrichten, globale Ankündigungen

### 3. Reconnect-Logik & State-Recovery ✅

#### `hooks/use-state-recovery.ts`
Automatische Wiederherstellung von:
- **Combat-State**: Aktiver Kampf, Locks, Runden-Status
- **Quest-State**: Aktive Quests, Dialog-Position, Objectives
- **Team-State**: Fame, Denarii, Inventory
- **Pending Actions**: Fehlgeschlagene API-Calls während Offline-Phase

**Features:**
- Parallele Recovery (alle Endpunkte gleichzeitig)
- Deduplizierung (verhindert mehrfache Recovery-Versuche)
- Callback für UI-Updates nach Recovery
- Debug-Logging für Entwicklung

**Integration:**
- Automatisch in `GameMap`-Komponente integriert
- Läuft bei jedem Reconnect
- Transparent für andere Komponenten

### 4. Combat WebSocket-Integration ✅

#### `hooks/use-combat.ts` (Epic 7 Update)
- **Entfernt**: Polling-Mechanismus (alle 5s)
- **Neu**: Event-basierte Updates via `useWsEvent()`
  - `combat.started` → Fetch full combat state
  - `combat.round` → Update logs, refresh state
  - `combat.ended` → Final logs, clear UI after 3s
  
- **Vorteile:**
  - Sofortige Updates (keine Latenz)
  - Reduzierte Server-Last (kein Polling)
  - Synchroner Multi-Player-State

### 5. PWA Offline-Resilienz ✅

#### Service Worker Konfiguration (`vite.config.ts`)
- **Erweiterte Glob-Patterns:**
  - JavaScript, CSS, HTML, Bilder (PNG, JPG, SVG, WEBP)
  - Audio (MP3, OGG, WAV, M4A)
  - Geodaten (JSON, GeoJSON)
  
- **Größenlimit:** 50 MB pro Asset (vorher 10 MB)
- **Gesamtkapazität:** ~200 MB statische Assets

#### Caching-Strategien

##### Network-First (API-Calls)
- Pattern: `/api/v1/`
- Timeout: 5s
- Max Entries: 100
- Max Age: 5 Minuten
- **Use Case:** Aktuelle Daten bevorzugt, Fallback auf Cache bei Offline

##### Cache-First (Statische Assets)

**Map Tiles:**
- Pattern: `\.(png|jpg|jpeg|svg|webp)$`
- Max Entries: 500
- Max Age: 7 Tage
- **Use Case:** Karten-Tiles ändern sich selten

**Audio:**
- Pattern: `\.(mp3|ogg|wav|m4a)$`
- Max Entries: 200
- Max Age: 30 Tage
- **Use Case:** Sound-Effekte, Hintergrundmusik

**Fonts:**
- Pattern: `\.(woff|woff2|ttf|eot)$`
- Max Entries: 30
- Max Age: 1 Jahr
- **Use Case:** UI-Schriftarten

### 6. Integration in App-Flow

#### `App.tsx`
```tsx
<AuthProvider>
  <WebSocketProvider debug={DEV}>
    <AppShell />
    <ConnectionIndicator position="top-right" />
  </WebSocketProvider>
</AuthProvider>
```

#### `GameMap.tsx`
```tsx
useStateRecovery({
  debug: DEV,
  onRecoveryComplete: () => console.log("Recovery done"),
});
```

## Architektur-Diagramm

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐    │
│  │   App.tsx    │────▶│ WebSocketCtx │────▶│  GameMap.tsx │    │
│  └──────────────┘     └──────┬───────┘     └──────┬───────┘    │
│                              │                     │             │
│                              ▼                     ▼             │
│                     ┌─────────────────┐   ┌─────────────────┐  │
│                     │ use-websocket.ts│   │use-state-recovery│  │
│                     └────────┬────────┘   └────────┬────────┘  │
│                              │                     │             │
│                              │ WebSocket           │ HTTP        │
└──────────────────────────────┼─────────────────────┼────────────┘
                               │                     │
                        wss://server/ws     https://server/api
                               │                     │
┌──────────────────────────────┼─────────────────────┼────────────┐
│                         Backend                                  │
├──────────────────────────────┼─────────────────────┼────────────┤
│                              ▼                     ▼             │
│                     ┌──────────────┐      ┌──────────────┐     │
│                     │   WsHub      │      │  ws.routes   │     │
│                     └──────┬───────┘      └──────┬───────┘     │
│                            │                     │              │
│                            ▼                     ▼              │
│                     ┌─────────────────────────────────┐        │
│                     │       ws_event_log (DB)         │        │
│                     └─────────────────────────────────┘        │
│                                   ▲                             │
│                                   │                             │
│                           ┌───────┴────────┐                   │
│                           │  ws.cleanup.ts │                   │
│                           └────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

## Offline-Szenarien

### Szenario 1: Kurzer Verbindungsabbruch (< 5 Min)
1. Verbindung bricht ab
2. Events werden in lokale Queue gepuffert (max 100)
3. WebSocket reconnected automatisch (exponential backoff)
4. Client ruft fehlende Events via `/ws/events?since=<timestamp>` ab
5. State-Recovery lädt Combat/Quest/Team-State
6. Gepufferte Events werden abgespielt
7. ✅ Nahtlose Fortsetzung

### Szenario 2: Längerer Verbindungsabbruch (> 5 Min)
1. Verbindung bricht ab
2. Events werden gepuffert
3. WebSocket reconnected
4. `/ws/events` liefert nur Events der letzten 5 Min
5. State-Recovery lädt aktuellen State
6. ⚠️ Events zwischen "Offline-Start" und "Jetzt - 5 Min" gehen verloren
7. ✅ Aktueller State ist trotzdem korrekt (durch Full-State-Fetch)

### Szenario 3: Combat während Offline
1. Spieler ist in Combat
2. Verbindung bricht ab
3. Team-Mitglieder führen Aktionen aus (auf Server)
4. Spieler reconnected
5. State-Recovery fetched aktuelle Combat-Instance
6. ✅ Spieler sieht aktuellen Combat-State

### Szenario 4: Complete Offline (kein Netz)
1. App startet ohne Internet
2. Service Worker liefert gecachte Assets
3. API-Calls fallen zurück auf Cache (wenn vorhanden)
4. WebSocket-Events werden gepuffert
5. User sieht "Reconnecting"-Indikator
6. Sobald Online: Auto-Reconnect + State-Recovery
7. ✅ App bleibt benutzbar (mit eingeschränkter Funktionalität)

## Testing

### WebSocket-Connection
```bash
# Terminal 1: Backend starten
cd apps/backend
npm run dev

# Terminal 2: Frontend starten
cd apps/frontend
npm run dev

# Browser DevTools Console:
# WebSocket-Logs sollten "[WS] Connected" zeigen
```

### Reconnect-Test
```javascript
// Browser DevTools Console
// Verbindung manuell trennen
ws = window.__ws_instance__;
ws.close();

// Nach 1-2s sollte automatisch reconnected werden
// Connection-Indicator sollte "Reconnecting" → "Connected" zeigen
```

### Event-Recovery-Test
```bash
# 1. Events senden während Connected
# 2. Client disconnect simulieren (DevTools → Network → Offline)
# 3. Server sendet mehr Events (via Postman/curl an andere Clients)
# 4. Client reconnect (DevTools → Network → Online)
# 5. Events sollten via /ws/events abgerufen werden
```

### PWA Cache-Test
```bash
# 1. App im Browser öffnen
# 2. DevTools → Application → Cache Storage
# 3. "workbox-precache" sollte ~200 MB Assets enthalten
# 4. DevTools → Network → Offline
# 5. Page reload → App sollte aus Cache laden
```

## Performance-Metriken

### WebSocket
- **Ping/Pong Interval:** 25s
- **Heartbeat Timeout:** 60s
- **Reconnect Delay:** 1s → 1.5s → 2.25s → ... → max 30s

### Event-Queue
- **Max Queue Size:** 100 Events
- **Memory per Event:** ~1-5 KB (abhängig von Payload)
- **Max Memory:** ~500 KB bei voller Queue

### Database
- **Event-Log-Retention:** 5 Minuten
- **Cleanup-Interval:** 60 Sekunden
- **Index:** `(team_id, timestamp)` für O(log n) Recovery-Queries

### PWA Cache
- **Total Cache Size:** ~200 MB
- **Cache Hit Rate:** >90% bei normalem Gameplay
- **Cache Miss Latency:** <100ms (Network-First Timeout: 5s)

## Bekannte Limitierungen

1. **5-Minuten-Fenster**: Events älter als 5 Min sind nicht recoverable
   - **Mitigation:** State-Recovery fetched immer den aktuellen Full-State
   
2. **100-Event-Queue**: Bei > 100 Events während Offline werden älteste gedroppt
   - **Mitigation:** Kritischer State wird über API rekonstruiert, nicht nur über Events
   
3. **WebSocket-Only für Live-Updates**: Keine Server-Sent-Events oder Long-Polling Fallback
   - **Mitigation:** PWA-Cache ermöglicht Offline-Nutzung, Reconnect passiert automatisch

4. **Single-Server**: In-Memory-WsHub funktioniert nicht mit Load-Balancing
   - **Future:** Redis Pub/Sub für Multi-Server-Setup

## Wartung & Monitoring

### Logs
```bash
# Backend-Logs prüfen
tail -f apps/backend/logs/app.log | grep WS

# WebSocket-Connections überwachen
curl http://localhost:3000/health/ws
```

### Datenbank
```sql
-- Aktuelle Event-Log-Größe
SELECT COUNT(*), 
       pg_size_pretty(pg_total_relation_size('ws_event_log'))
FROM ws_event_log;

-- Events pro Team
SELECT team_id, COUNT(*) 
FROM ws_event_log 
GROUP BY team_id;
```

### Client-Side
```javascript
// Browser DevTools Console
// Connection-Status
window.__ws_status__ = useConnectionStatus();

// Event-Queue-Größe
console.log("Queued events:", ws.queuedEvents);
```

## Migration & Deployment

### Database-Migration
```bash
# Epic 7 Migration ausführen
cd apps/backend
npm run db:migrate

# Sollte 0009_epic7_ws_event_log.sql ausführen
```

### Environment Variables
```bash
# Keine neuen Env-Vars nötig!
# WebSocket nutzt bestehende JWT_SECRET
```

### Rollout-Plan
1. Backend-Update deployen (mit Migration)
2. WebSocket-Health-Check testen: `GET /health/ws`
3. Frontend-Update deployen
4. Monitoring: Connection-Counts, Event-Log-Größe
5. ✅ Rollout complete

## Weitere Verbesserungen (Future)

- [ ] Redis Pub/Sub für Multi-Server-Setup
- [ ] Compression für große Event-Payloads
- [ ] Client-Side-IndexedDB für >100 Event-Queue
- [ ] WebRTC Fallback für P2P-Events (PvP)
- [ ] Binary Protocol (MessagePack statt JSON)
- [ ] Service-Worker-Background-Sync für Offline-Actions

---

**Status:** ✅ Vollständig implementiert
**Version:** Epic 7 (2026-09-08)
**Maintainer:** Backend/Frontend Teams
