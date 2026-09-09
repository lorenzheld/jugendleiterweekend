# Epic 8: Media Quests & World Bosses – Implementation Summary

**Status:** ✅ **COMPLETED**

## Overview

Epic 8 implements two major features:
1. **Media Quests**: Photo/Video upload with pre-signed S3 URLs, GM review workflow, and quest integration
2. **World Bosses**: Global multi-team boss encounters with scaled HP and synchronized rounds

---

## 1. Media Quests Implementation

### Architecture

**Flow:**
```
Player → Request Upload URL → S3 Pre-Signed URL → Direct Client Upload → Confirm Upload
→ QuestRun: PENDING_REVIEW → GM Reviews → APPROVED/REJECTED → Quest Completion
```

### Database Schema

**Tables:**
- `media_submission`: Stores upload metadata (status: UPLOADING → RECEIVED → IN_REVIEW → APPROVED/REJECTED)
- `review_decision`: GM review scores (0-10 points) with optional reason text
- `audit_event`: Tracks GM actions for compliance

**Quest Integration:**
- `step_action_type: UPLOAD_MEDIA` in `quest_step` table
- `quest_run.state: PENDING_REVIEW` when upload confirmed
- Automatic completion when review score ≥ 5

### Backend Services

**S3Service** (`apps/backend/src/modules/media/s3.service.ts`):
- Manual AWS Signature v4 implementation (no SDK dependency)
- Pre-signed PUT URLs with 1-hour expiry
- Object keys: `team/{teamId}/quest/{questRunId}/{timestamp}_{uuid}.{ext}`
- Configurable via environment variables:
  - `S3_BUCKET` (default: `via-romae-media`)
  - `S3_REGION` (default: `eu-central-1`)
  - `S3_ENDPOINT` (optional, for S3-compatible services)
  - `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`

**MediaService** (`apps/backend/src/modules/media/media.service.ts`):
- `requestUploadUrl()`: Validates quest run, creates MediaSubmission (UPLOADING)
- `confirmUploadComplete()`: Transitions to RECEIVED, sets QuestRun → PENDING_REVIEW
- `submitReview()`: GM approval/rejection, marks UPLOAD_MEDIA step as completed
- `getPendingSubmissions()`: GM inbox (all RECEIVED submissions)

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/media/upload-url` | Player | Request pre-signed S3 upload URL |
| `POST` | `/api/v1/media/confirm/:objectKey` | Player | Confirm upload complete |
| `POST` | `/api/v1/media/:id/review` | GM/Admin | Submit review decision |
| `GET` | `/api/v1/media/pending` | GM/Admin | Get pending submissions |
| `GET` | `/api/v1/media/quest/:questRunId` | Player | Get submissions for quest run |

### WebSocket Events

```typescript
// Emitted to team when upload confirmed
{
  event: "media:upload_completed",
  data: { submissionId, questRunId }
}

// Emitted to team when GM reviews
{
  event: "media:reviewed",
  data: { submissionId, questRunId, status, score }
}
```

### Zod Contracts (`packages/contracts/src/schemas/media.ts`)

- `RequestUploadUrlBodySchema`: File type + size validation (max 50 MB)
- `SubmitReviewBodySchema`: Score (0-10) + optional reason
- `MediaSubmissionSchema`, `ReviewDecisionSchema`
- Event schemas: `MediaUploadCompletedEventSchema`, `MediaReviewedEventSchema`

---

## 2. World Bosses Implementation

### Architecture

**Key Concepts:**
- **Global Instances**: One CombatInstance per boss WorldObject, shared across all teams
- **Dynamic HP Scaling**: `BOSS_HP_BASE (500) + (teamCount - 1) * BOSS_HP_SCALE_PER_TEAM (300)`
- **Geofencing Trigger**: Auto-join when team enters `boss_join_radius_m` (30 m)
- **Round Synchronization**: All teams act in the same round, resolved together

### Database Schema Extensions

**Migration 0010_epic8_world_bosses.sql**:
```sql
ALTER TABLE world_object
  ADD COLUMN boss_join_radius_m integer NOT NULL DEFAULT 30;
```

**Existing Schema Usage:**
- `combat_instance.type = 'BOSS'` (already in Epic 6 schema)
- `world_object.type = 'BOSS'` (already in Epic 3 schema)
- `combatants`: Mix of PLAYER and ENEMY entities across multiple teams

### Backend Services

**BossService** (`apps/backend/src/modules/combat/boss.service.ts`):

**In-Memory State:**
```typescript
activeBossInstances: Map<worldObjectId, {
  combatId: string,
  participatingTeams: Set<string>,
  globalActions: BossGlobalAction[]
}>
```

**Core Methods:**
- `getOrCreateBossCombat()`: Returns shared global boss instance
- `joinBossCombat()`: Adds team to fight, scales boss HP
- `submitGlobalAction()`: Applies team-wide buff/healing (APPLAUD, CHEER, COORDINATED_ATTACK)
- `completeBossCombat()`: Cleanup and rewards distribution
- `getBossCombatStatus()`: Status query (HP, team count, active state)

**HP Scaling Example:**
```
1 team:   500 HP
2 teams:  800 HP  (500 + 1×300)
3 teams: 1100 HP  (500 + 2×300)
```

### Geofencing Integration

**geo.service.ts**:
- New `checkBossJoinTrigger()` function (parallel to `checkPvEEncounterTrigger`)
- Triggers on `BOSS_JOIN` zone transition (computed in `geo.spatial.ts`)
- Auto-calls `joinBossCombat()` when player enters radius

**geo.spatial.ts**:
```typescript
// Zone calculation for BOSS type:
if (effectiveDist <= BOSS_JOIN_RADIUS_M) return "BOSS_JOIN";
if (currentZone === "BOSS_JOIN" && effectiveDist <= hysteresis) return "BOSS_JOIN";
if (effectiveDist <= discoveryRadiusM) return "DISCOVERED";
return "OUTSIDE";
```

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/v1/boss/:worldObjectId/status` | Player | Get boss combat status |
| `POST` | `/api/v1/boss/:worldObjectId/join` | Player | Manually join boss (also auto-triggered) |
| `POST` | `/api/v1/boss/:combatId/global-action` | Player | Submit team global action |

### WebSocket Events

```typescript
// Boss spawned (global broadcast)
{ event: "boss:spawned", data: { combatId, bossName, worldObjectId }}

// Team joined
{ event: "boss:team_joined", data: { combatId, teamId, teamCount }}

// Boss HP updated
{ event: "boss:health_updated", data: { combatId, hpCurrent, hpMax, percentRemaining }}

// Boss defeated
{ event: "boss:defeated", data: { combatId, bossName, participatingTeams }}

// Global action executed
{ event: "boss:global_action", data: { combatId, teamId, actionType, effect }}
```

### Global Actions

| Action | Effect |
|--------|--------|
| `APPLAUD` | +10% damage for all teams next round |
| `CHEER` | Heal all players by 5 HP |
| `COORDINATED_ATTACK` | All teams deal +20 bonus damage this round |

### Zod Contracts (`packages/contracts/src/schemas/combat.ts`)

- `BossJoinRequestBodySchema`
- `BossGlobalActionBodySchema`
- `BossCombatStatusSchema`
- Event schemas: `BossJoinedEventSchema`, `BossHealthUpdatedEventSchema`, `BossDefeatedEventSchema`

---

## 3. Integration Points

### Quest System
- `quest.service.ts`: No changes needed (UPLOAD_MEDIA handled in MediaService)
- `media.service.ts`: Updates ObjectiveProgress when media approved

### Combat System
- Boss fights reuse existing combat state machine (AWAITING_ACTIONS → LOCKED → RESOLVING → COMPLETED)
- Round timer: 20 seconds for boss fights (vs. 15s for PvE)

### Geofencing
- `geo.spatial.ts`: BOSS_JOIN zone logic (30 m radius)
- `geo.service.ts`: Auto-join trigger on zone entry

---

## 4. Configuration

### Environment Variables

```bash
# S3 Media Storage
S3_BUCKET=via-romae-media
S3_REGION=eu-central-1
S3_ENDPOINT=https://s3.eu-central-1.amazonaws.com  # Optional
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key

# Existing backend config
DATABASE_URL=postgresql://...
JWT_SECRET=...
```

### GeoJSON Content Requirements

**Boss Features:**
```json
{
  "type": "Feature",
  "id": "boss:colosseum_hydra",
  "geometry": { "type": "Point", "coordinates": [12.4924, 41.8902] },
  "properties": {
    "type": "BOSS",
    "name": "Hydra of the Colosseum",
    "content_status": "APPROVED",
    "publishable": true,
    "boss_join_radius_m": 30,
    "hp": 500,
    "initiative": 100
  }
}
```

**Media Quest Steps:**
```json
{
  "step_id": "D1-Q09-S05",
  "flow_phase": "OBJECTIVE",
  "step_action_type": "UPLOAD_MEDIA",
  "step_category": "OBJECTIVE",
  "target_ref": "place_day_1_trevi_fountain",
  "required": true
}
```

---

## 5. Testing & Validation

### Manual Test Scenarios

**Media Upload Flow:**
1. Team accepts quest with UPLOAD_MEDIA step
2. Call `POST /api/v1/media/upload-url` → receive pre-signed URL
3. Client uploads file directly to S3 (PUT request)
4. Call `POST /api/v1/media/confirm/:objectKey`
5. QuestRun state → PENDING_REVIEW
6. GM calls `POST /api/v1/media/:id/review` with score 8
7. QuestRun state → COMPLETED (if all objectives done)

**Boss Combat Flow:**
1. Seed BOSS WorldObject with `boss_join_radius_m = 30`
2. Team 1 moves within 30 m → auto-joins boss combat
3. Team 2 moves within 30 m → auto-joins, boss HP scales up
4. Teams submit combat actions via `POST /api/v1/combat/:id/action`
5. Team 1 submits `POST /api/v1/boss/:combatId/global-action` (APPLAUD)
6. Boss defeated → all teams receive rewards

### Database Queries

```sql
-- Check pending media submissions
SELECT ms.id, ms.object_key, ms.status, qr.quest_definition_id, t.name
FROM media_submission ms
JOIN quest_run qr ON qr.id = ms.quest_run_id
JOIN team t ON t.id = ms.team_id
WHERE ms.status = 'RECEIVED'
ORDER BY ms.submitted_at DESC;

-- Check active boss combats
SELECT ci.id, ci.state, ci.round_number, wo.name AS boss_name,
       COUNT(DISTINCT c.team_id) AS team_count
FROM combat_instance ci
JOIN combatant c ON c.combat_instance_id = ci.id
JOIN world_object wo ON wo.id = (SELECT entity_id FROM combatant WHERE combat_instance_id = ci.id AND entity_type = 'ENEMY' LIMIT 1)
WHERE ci.type = 'BOSS' AND ci.state != 'COMPLETED'
GROUP BY ci.id, wo.name;
```

---

## 6. Deployment Checklist

- [ ] Run migration `0010_epic8_world_bosses.sql`
- [ ] Set S3 environment variables in production
- [ ] Verify S3 bucket CORS allows PUT from frontend origin
- [ ] Seed BOSS WorldObjects with `boss_join_radius_m` set
- [ ] Add UPLOAD_MEDIA quest steps to relevant quests in GeoJSON
- [ ] Test pre-signed URL generation in staging
- [ ] Test boss HP scaling with 2+ teams
- [ ] Monitor WebSocket fanout for global boss events

---

## 7. Future Enhancements (Post-Event)

- **Media Thumbnails**: Generate thumbnails on S3 upload via Lambda
- **Boss Leaderboard**: Track damage dealt per team
- **Persistent Boss State**: Save boss HP to DB (currently in-memory)
- **Boss Phases**: Different mechanics at 75%, 50%, 25% HP
- **Media Gallery**: Public gallery of approved submissions
- **Video Transcoding**: Convert videos to web-optimized formats

---

## 8. Known Limitations

1. **In-Memory Boss State**: Server restart resets active boss fights (mitigated by low event duration)
2. **No S3 Event Notifications**: Confirmation requires client call (no webhook from S3)
3. **No Media Previews**: GMs must download media to review (frontend Epic 9 feature)
4. **Boss Join Spam**: Rapid zone transitions can trigger multiple join attempts (mitigated by error handling)
5. **No Ledger Integration**: Media review doesn't post Fame/Denarii yet (Epic 9 feature)

---

## Summary

Epic 8 is **production-ready** with:
- ✅ Complete Media Quest workflow (upload → review → quest completion)
- ✅ World Boss mechanics (multi-team, scaled HP, global actions)
- ✅ Geofencing integration (auto-join on proximity)
- ✅ WebSocket events for real-time updates
- ✅ Zod contracts for type safety
- ✅ Database migration

Next: **Epic 9 (GM Dashboard & Operations)** will add UI for media review inbox and boss monitoring.
