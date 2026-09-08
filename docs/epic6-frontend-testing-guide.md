# Epic 6 Combat System - Frontend Testing Guide

## Voraussetzungen

Bevor du das Combat-System im Frontend testen kannst, stelle sicher dass:

1. **Backend läuft:**
   ```bash
   cd apps/backend
   npm run dev
   ```

2. **Frontend läuft:**
   ```bash
   cd apps/frontend
   npm run dev
   ```

3. **Datenbank ist migriert:**
   ```bash
   cd apps/backend
   npm run db:migrate
   ```

4. **Test-Daten sind vorhanden:**
   - Mindestens 1 Team mit Spielern
   - Mindestens 1 Enemy WorldObject mit Type "ENEMY"
   - Optional: QuestDefinition mit DEFEAT_ENEMY QuestStep

## Test-Szenarien

### 1. PvE Combat Test (Manuell über API)

**Schritt 1: Login und Token holen**
```bash
# Login als Spieler
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "player1", "password": "dein_passwort"}'

# Speichere den Token aus der Response
export TOKEN="eyJhbGc..."
```

**Schritt 2: Combat manuell starten (für Testing)**

Erstelle einen Test-Script oder nutze den Backend-Test:
```bash
cd apps/backend
npx tsx scripts/test-combat.ts
```

Dieser Script:
- ✅ Erstellt Test-Team und Enemy
- ✅ Startet PvE Combat
- ✅ Reicht Spieler-Aktion ein
- ✅ Resolved die Runde
- ✅ Zeigt Combat-Logs
- ✅ Testet HP-Regeneration

**Schritt 3: Combat-Status abrufen**
```bash
# Aktuelles Combat für dein Team abrufen
curl -X GET http://localhost:3000/api/v1/combat/team/active \
  -H "Authorization: Bearer $TOKEN"

# Oder spezifisches Combat abrufen
curl -X GET http://localhost:3000/api/v1/combat/{COMBAT_ID} \
  -H "Authorization: Bearer $TOKEN"
```

**Schritt 4: Aktion einreichen**
```bash
curl -X POST http://localhost:3000/api/v1/combat/{COMBAT_ID}/action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "ATTACK",
    "targetId": "{ENEMY_COMBATANT_ID}",
    "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### 2. Frontend Integration Test

**Integration ins bestehende Frontend:**

1. **In `apps/frontend/src/pages/lobby.page.tsx` oder Haupt-Component:**

```typescript
import { useCombat } from "@/hooks/use-combat";
import { CombatScreen } from "@/components/combat/combat-screen";
import { PvPChallengeWarning } from "@/components/combat/pvp-challenge-warning";

// In deiner Component:
const { activeCombat, submitAction, logs } = useCombat(playerId, token);

// Render Combat Screen wenn aktiv:
{activeCombat && (
  <CombatScreen
    combat={activeCombat}
    playerId={playerId}
    onSubmitAction={submitAction}
    onClose={() => {
      // Combat beenden oder minimieren
    }}
  />
)}
```

2. **WebSocket-Events hinzufügen:**

In deinem WebSocket-Handler (z.B. in einem useEffect):

```typescript
useEffect(() => {
  if (!ws || !token) return;

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.event) {
      case "combat:started":
        // Combat-UI öffnen
        fetchActiveCombat();
        break;

      case "combat:round_resolved":
        // Logs anzeigen, Combat-State aktualisieren
        setLogs((prev) => [...prev, ...data.data.logs]);
        fetchActiveCombat();
        break;

      case "combat:completed":
        // Victory/Defeat-Screen zeigen
        setTimeout(() => {
          setActiveCombat(null);
        }, 3000);
        break;

      case "pvp:challenge_started":
        // PvP-Warning zeigen
        setPvPChallenge(data.data);
        break;
    }
  };
}, [ws, token]);
```

### 3. PvE-Encounter Test (via GPS-Trigger)

**Vollständiger Flow:**

1. **Quest mit DEFEAT_ENEMY Step erstellen** (via Seed oder DB):
   ```sql
   -- In deiner DB oder via Seed-Script
   INSERT INTO quest_step (quest_definition_id, step_id, sequence, flow_phase, step_action_type, target_ref)
   VALUES ('quest-uuid', 'D1-Q01-S03', 3, 'OBJECTIVE', 'DEFEAT_ENEMY', 'enemy:test_combat_enemy');
   ```

2. **Quest aktivieren:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/quests/{QUEST_ID}/accept \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **GPS-Update in Nähe des Enemies senden:**
   ```bash
   # Koordinaten innerhalb von 20m zum Enemy
   curl -X POST http://localhost:3000/api/v1/geo/location \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "lat": 41.9028,
       "lng": 12.4964,
       "accuracy": 10
     }'
   ```

4. **Combat sollte automatisch starten!**
   - Backend prüft `enemy_aggro_radius_m` (20m)
   - Validiert aktiven DEFEAT_ENEMY QuestStep
   - Startet Combat-Instance
   - Sendet `combat:started` WebSocket-Event
   - Frontend zeigt Combat-Screen

### 4. PvP-Challenge Test

**Zwei Teams benötigt:**

1. **Team A (Attacker) nähert sich Team B (Defender):**
   
   ```bash
   # Team A sendet Location-Update in Nähe von Team B
   curl -X POST http://localhost:3000/api/v1/geo/location \
     -H "Authorization: Bearer $TOKEN_TEAM_A" \
     -d '{"lat": 41.9028, "lng": 12.4964, "accuracy": 5}'
   ```

2. **Backend prüft automatisch:**
   - Distanz zwischen Teams (<60m → sichtbar)
   - Keine Safe-Zone
   - Startet `pvp_challenge` mit State `WARNING`

3. **20-Sekunden Countdown:**
   - Beide Teams sehen PvP-Warning-Screen
   - Defender kann fliehen (>20m) oder Safe-Zone erreichen

4. **Nach 20 Sekunden:**
   - GPS-Validierung
   - Entweder `ESCAPED` oder `COMBAT` startet

**PvP-Escape testen:**
```bash
# Defender sendet Location-Update weit weg
curl -X POST http://localhost:3000/api/v1/geo/location \
  -H "Authorization: Bearer $TOKEN_TEAM_B" \
  -d '{"lat": 41.9050, "lng": 12.5000, "accuracy": 5}'
# > 20m Distanz → Challenge State wird ESCAPED
```

**Safe-Zone testen:**
```bash
# Erstelle Safe-Zone WorldObject
INSERT INTO world_object (external_id, type, name, lat, lng, interaction_radius_m, publishable)
VALUES ('safe:spawn', 'SAFE_ZONE', 'Spawn Point', 41.9030, 12.4970, 50, true);

# Defender bewegt sich in Safe-Zone
curl -X POST http://localhost:3000/api/v1/geo/location \
  -H "Authorization: Bearer $TOKEN_TEAM_B" \
  -d '{"lat": 41.9030, "lng": 12.4970, "accuracy": 5}'
# Challenge wird ESCAPED mit reason "safe_zone"
```

### 5. Combat-UI Interaktionen testen

**Im Browser:**

1. **Action-Buttons:**
   - ✅ Attack-Button → Target-Selection funktioniert
   - ✅ Defend-Button → Keine Target-Selection
   - ✅ Skill-Button → (Future: Skill-Menu)
   - ✅ Flee-Button → Nur PvE, in PvP disabled

2. **HP-Bars:**
   - ✅ Zeigen korrekten HP-Prozentsatz
   - ✅ Farben: Grün >50%, Gelb 25-50%, Rot <25%
   - ✅ Downed-Status zeigt 💀

3. **Combat-Log:**
   - ✅ Zeigt letzte 5 Einträge
   - ✅ Damage-Logs in Rot
   - ✅ State-Changes in Gelb
   - ✅ Actions in Grau

4. **Round-Timer:**
   - ✅ State wechselt nach 15 Sekunden
   - ✅ "Waiting for other players..." wenn Action eingereicht

### 6. Team-Wipe & Respawn testen

```bash
# Setze alle Spieler auf niedriges HP
UPDATE player SET hp_current = 5 WHERE team_id = 'test-team-id';

# Starte Combat → Alle Spieler sollten downed werden
# Backend ruft automatisch handleTeamWipe() auf:
# - Alle Spieler → 50% HP (50)
# - Status → ACTIVE
# - -50 Denare Strafe
# - team:wiped WebSocket-Event
```

### 7. HP-Regeneration testen

```bash
# Nach Combat (State: COMPLETED):
# regenerateHPOutOfCombat() wird periodisch aufgerufen
# +5 HP pro Sekunde bis max 100 HP

# Prüfen:
SELECT hp_current FROM player WHERE id = 'player-id';
# Sollte langsam steigen wenn nicht im Combat
```

## Debugging

**Browser DevTools:**

```javascript
// Combat-Status checken
fetch('/api/v1/combat/team/active', {
  headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
}).then(r => r.json()).then(console.log);

// WebSocket-Messages loggen
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  console.log('WS Event:', data);
};
```

**Backend Logs:**

```bash
# Terminal wo Backend läuft zeigt:
# - "Combat {id} started"
# - "Round resolved with {n} logs"
# - "PvP challenge {id} escalated to COMBAT"
# - "Team {id} wiped, respawning"
```

**Datenbank prüfen:**

```sql
-- Alle aktiven Combats
SELECT * FROM combat_instance WHERE state != 'COMPLETED';

-- Combat-Teilnehmer
SELECT c.*, p.hp_current 
FROM combatant c 
LEFT JOIN player p ON c.entity_id = p.id 
WHERE c.combat_instance_id = 'combat-id';

-- Combat-Aktionen
SELECT * FROM combat_action WHERE combat_instance_id = 'combat-id';

-- PvP-Challenges
SELECT * FROM pvp_challenge WHERE state = 'WARNING';
```

## Erwartete Ergebnisse

### ✅ PvE Combat funktioniert wenn:
- Combat startet bei Eintritt in enemy_aggro_radius_m (20m)
- Nur wenn aktiver DEFEAT_ENEMY QuestStep vorhanden
- Spieler können Aktionen einreichen
- Runden werden nach 15 Sekunden automatisch resolved
- Combat-Logs werden generiert
- HP wird korrekt reduziert
- Downed-Status wird gesetzt bei HP <= 0
- Loot wird bei Sieg vergeben

### ✅ PvP funktioniert wenn:
- Challenge startet bei <60m Nähe zwischen Teams
- 20-Sekunden Warning wird angezeigt
- Escape möglich durch >20m Distanz oder Safe-Zone
- Combat startet nach 20s wenn noch in Reichweite
- PvP-Combat erlaubt kein Flee

### ✅ Combat-UI funktioniert wenn:
- Fullscreen-Overlay wird angezeigt
- HP-Bars zeigen korrekte Werte
- Action-Buttons funktionieren
- Target-Selection für Angriffe
- Combat-Log wird aktualisiert
- State-Changes werden angezeigt

### ✅ Lifecycle funktioniert wenn:
- Team-Wipe respawnt alle mit 50% HP
- HP regeneriert außerhalb Combat (+5/s)
- WebSocket-Events kommen an
- Combat-State bleibt synchron

## Troubleshooting

**Problem: "Combat not found"**
→ Combat-ID falsch oder Combat bereits completed

**Problem: "Team is already in combat"**
→ Aktuelles Combat beenden oder warten bis completed

**Problem: "Step not found or not a DEFEAT_ENEMY step"**
→ Quest hat keinen aktiven DEFEAT_ENEMY Step oder Step nicht im QuestRun

**Problem: "No active combat"**
→ Noch kein Combat gestartet oder bereits abgeschlossen

**Problem: "WebSocket events not arriving"**
→ WS-Connection prüfen, Token valide?, Team-ID korrekt?

**Problem: "Round auto-lock not working"**
→ Backend-Timer läuft, nach 15 Sekunden sollte es automatisch locken

---

**Happy Testing! ⚔️**
