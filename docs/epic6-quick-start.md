# 🚀 Epic 6 Combat System - Quick Start Guide

## Schnelltest (5 Minuten)

### 1. Backend starten
```bash
cd apps/backend
npm run dev
```

### 2. Test-Script ausführen
```bash
# In separatem Terminal
cd apps/backend
npx tsx scripts/test-combat.ts
```

**Erwartetes Ergebnis:**
```
🧪 Testing Combat System...

1️⃣ Setting up test team and player...
   ✅ Using existing test team: abc-123...
   ✅ Using player: def-456...

2️⃣ Setting up test enemy...
   ✅ Using existing enemy: ghi-789 (Test Bandit)

3️⃣ Starting PvE combat...
   ✅ Combat started: combat-id-123
   - Type: PVE
   - State: AWAITING_ACTIONS
   - Round: 1
   - Combatants: 2
     - Player Name (PLAYER): 100/100 HP
     - Test Bandit (ENEMY): 50/50 HP

4️⃣ Submitting player actions...
   ✅ Action submitted: ATTACK → ghi-789...

5️⃣ Waiting 2 seconds before resolving round...
   Resolving round...
   ✅ Round resolved! 2 log entries:
     [DAMAGE] Player Name attacks Test Bandit for 15 damage!
     [DAMAGE] Test Bandit attacks Player Name for 12 damage!

6️⃣ Checking combat state after round...
   - State: AWAITING_ACTIONS
   - Round: 2
     - Player Name: 88/100 HP
     - Test Bandit: 35/50 HP

7️⃣ Testing HP regeneration (combat completed)...
   Before regen: 88 HP
   After regen: 93 HP
   ✅ Regeneration working!

✅ All tests passed!
```

### 3. Frontend-Integration (Optional)

**In deiner Main-Component:**

```typescript
import { useCombat } from "@/hooks/use-combat";
import { CombatScreen } from "@/components/combat/combat-screen";

function GamePage() {
  const { activeCombat, submitAction } = useCombat(playerId, token);

  return (
    <>
      {/* Dein normales UI */}
      <GameMap />
      <QuestHUD />

      {/* Combat-Overlay */}
      {activeCombat && (
        <CombatScreen
          combat={activeCombat}
          playerId={playerId}
          onSubmitAction={submitAction}
          onClose={() => {/* minimieren oder beenden */}}
        />
      )}
    </>
  );
}
```

## API-Endpunkte testen

### Combat starten (via GPS-Trigger)

```bash
# 1. Login
TOKEN=$(curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"player1","password":"test"}' \
  | jq -r '.token')

# 2. GPS-Update in Nähe eines Enemies senden
# (Combat startet automatisch wenn DEFEAT_ENEMY Quest aktiv)
curl -X POST http://localhost:3000/api/v1/geo/location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 41.9028,
    "lng": 12.4964,
    "accuracy": 10
  }'
```

### Aktives Combat abrufen

```bash
curl -X GET http://localhost:3000/api/v1/combat/team/active \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Aktion einreichen

```bash
# Target-ID aus combat.combatants nehmen (Enemy)
curl -X POST http://localhost:3000/api/v1/combat/{COMBAT_ID}/action \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "actionType": "ATTACK",
    "targetId": "{ENEMY_COMBATANT_ID}",
    "idempotencyKey": "'$(uuidgen)'"
  }' | jq
```

### Runde manuell auflösen (Testing)

```bash
curl -X POST http://localhost:3000/api/v1/combat/{COMBAT_ID}/resolve \
  -H "Authorization: Bearer $TOKEN" | jq
```

## WebSocket-Events empfangen

```javascript
// Im Browser DevTools Console:
const ws = new WebSocket('ws://localhost:3000/api/v1/geo/ws?token=' + token);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('📡', data.event, data.data);
  
  switch (data.event) {
    case 'combat:started':
      console.log('⚔️ Combat started!', data.data);
      break;
    case 'combat:round_resolved':
      console.log('🎲 Round resolved:', data.data.logs);
      break;
    case 'combat:completed':
      console.log('🏆 Combat completed!');
      break;
    case 'pvp:challenge_started':
      console.log('⚠️ PvP Challenge!', data.data);
      break;
  }
};
```

## Häufige Probleme

### ❌ "No active combat"
**Lösung:** Combat erst starten via GPS-Trigger oder Test-Script

### ❌ "Step not found or not a DEFEAT_ENEMY step"
**Lösung:** Quest mit DEFEAT_ENEMY Step muss aktiv sein
```sql
-- Prüfen:
SELECT * FROM quest_step 
WHERE step_action_type = 'DEFEAT_ENEMY' 
AND quest_definition_id IN (
  SELECT quest_definition_id FROM quest_run 
  WHERE state = 'ACTIVE' AND team_id = 'your-team-id'
);
```

### ❌ "Combat is not accepting actions"
**Lösung:** Combat ist im State LOCKED oder RESOLVING - warten bis AWAITING_ACTIONS

### ❌ "Team is already in combat"
**Lösung:** Aktuelles Combat erst beenden lassen

## Nächste Schritte

1. **PvE testen:** 
   - Erstelle Quest mit DEFEAT_ENEMY Step
   - Aktiviere Quest
   - Bewege dich in Nähe eines Enemies (20m)
   - Combat startet automatisch

2. **PvP testen:**
   - Zwei Teams in Nähe bringen (<60m)
   - PvP-Challenge wird automatisch erstellt
   - 20 Sekunden Countdown
   - Defender kann fliehen oder Safe-Zone erreichen

3. **Frontend-UI testen:**
   - Integriere CombatScreen in deine App
   - Teste alle Action-Buttons
   - Prüfe HP-Bars und Combat-Log

4. **Lifecycle testen:**
   - Team-Wipe auslösen (alle Spieler down)
   - Respawn prüfen (50% HP, -50 Denare)
   - HP-Regeneration nach Combat beobachten

## Dokumentation

- 📘 **Vollständige Doku:** `docs/epic6-combat-system.md`
- 🧪 **Testing-Guide:** `docs/epic6-frontend-testing-guide.md`
- ✅ **Code-Review:** `docs/epic6-code-review.md`

---

**Ready to fight! ⚔️**
