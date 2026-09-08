# 2. Grobes Datenbankschema

Das Schema ist relational aufgebaut und nutzt PostgreSQL. Kritische Werte (Geld, Ruhm) verwenden ein *Ledger-Muster* (Append-only). Geodaten nutzen PostGIS `geometry(Point, 4326)` oder Polygone.

## Kern-Entitäten & Beziehungen

### A. Identity & Access
*   **Account:** `id`, `username`, `accessCode` (verschlüsselt), `role` (PLAYER, GM, ADMIN), `createdAt`.
*   **Session:** `id`, `accountId`, `token`, `expiresAt`, `deviceId`.

### B. Player & Team (Teilweise autoritativer Zustand)
*   **Team:** `id`, `name`, `fame` (aus Ledger aggregiert), `denarii` (aus Ledger aggregiert), `inventoryCapacity`.
*   **Player:** `id`, `accountId`, `teamId` (FK), `class` (Enum: Gardist, Mönch...), `hpCurrent`, `status` (ACTIVE, DOWNED), `lastLocation` (PostGIS Point, nur temporär gespeichert).

### C. World & GIS
*   **WorldObject:** `id`, `external_id` (natürlicher Schlüssel aus GeoJSON `feature.id`, z. B. `location:place_day_1_acquedotto_vergine`), `type` (NPC, ENEMY, STORE, BOSS, SAFE_ZONE), `name`, `day` (DAY_1, DAY_2, …), `geometry` (PostGIS `geometry(Point, 4326)`), `discovery_radius_m` (int, default 55), `interaction_radius_m` (int, default 15), `exit_hysteresis_radius_m` (int, default 25), `content_status` (Enum: DRAFT, FIELD_CHECK_REQUIRED, APPROVED), `publishable` (bool), `contentVersion`.
    *   **Geofencing-Semantik:** `interaction_radius_m` ist der Aktivierungs-Trigger (15 m). `exit_hysteresis_radius_m` (25 m) verhindert Flicker beim Verlassen. `discovery_radius_m` (55 m) macht den Marker auf der Karte sichtbar.
*   **PlayArea:** `id`, `day`, `geometry` (PostGIS Polygon für Tagesgrenzen).

### D. Quests & Narrative
*   **QuestDefinition:** `id`, `external_id` (Quest-ID aus GeoJSON, z. B. `D1-Q09`), `title`, `type` (REGULAR, HIDDEN, LONG_TERM, MEDIA).
*   **QuestRun:** `id`, `teamId` (FK), `questDefinitionId` (FK), `state` (ACTIVE, PENDING_REVIEW, COMPLETED…), `startedAt`.
*   **ObjectiveProgress:** `id`, `questRunId` (FK), `objectiveId`, `status`, `progressCount`.

*   **QuestStep:** Repräsentiert einen einzelnen Schritt aus `quest_step_refs` im GeoJSON.
    *   `id`, `questDefinitionId` (FK), `step_id` (externer Schlüssel, z. B. `D1-Q09-S05`), `sequence` (int), `flow_phase` (Enum: **DISCOVER**, **DIALOGUE**, **ACCEPT**, **OBJECTIVE**, **COMPLETE**), `step_action_type` (Enum: **REACH_LOCATION**, **ANSWER_QUESTION**, **SOLVE_PUZZLE**, **DEFEAT_ENEMY**, **DISCOVER_NPC**, **TALK_TO_NPC**, **ACCEPT_QUEST**, **UPLOAD_MEDIA**), `step_category` (FLOW_ACTION, OBJECTIVE), `target_ref` (string, Verweis auf WorldObject.external_id oder QuestDefinition.external_id), `required` (bool).
    *   **Flow-Phase-Semantik:** DISCOVER → NPC/Ort erscheint auf der Karte; DIALOGUE → Gespräch startet; ACCEPT → Team nimmt Quest an; OBJECTIVE → spielbare Schritte (Reisen, Antworten, Kämpfen); COMPLETE → Abschluss-Bestätigung.

*   **QuestStation:** Repräsentiert die räumliche Rätselstation aus `quest_stations` im GeoJSON (ein WorldObject kann mehrere Stationen für verschiedene Quests haben).
    *   `id`, `worldObjectId` (FK), `questDefinitionId` (FK), `sequence` (int, Position der Station innerhalb der Quest), `role` (z. B. START, ZWISCHENSTATION, ZIEL), `observable_evidence` (text – was Spieler am Ort sehen sollen), `location_question` (text – die zu beantwortende Frage), `expected_answer` (text), `access_fallback_note` (text – Hinweis für GMs falls Ort unzugänglich ist), `enemy_hook` (string, optionaler Verweis auf Enemy-Encounter).

### E. Economy, Items & Ledger (Wirtschaft)
*   **ItemInstance:** `id`, `definitionId` (Referenz auf statischen Content), `ownerId` (TeamId oder PlayerId), `slot` (WEAPON, ARMOR...), `isEquipped`, `isBound`.
*   **LedgerEntry:** `id`, `teamId` (FK), `playerId` (FK, optional), `currencyType` (FAME, DENARII), `amount` (+/- int), `source` (QUEST, COMBAT, TRADE), `idempotencyKey` (verhindert Doppelbuchungen), `createdAt`.

### F. Combat & PvP
*   **CombatInstance:** `id`, `type` (PVE, PVP, BOSS), `state` (AWAITING_ACTIONS, LOCKED, RESOLVING, COMPLETED), `roundNumber`, `startedAt`.
*   **Combatant:** `id`, `combatInstanceId` (FK), `entityType` (PLAYER, ENEMY), `entityId`, `teamId`, `hpCurrent`.
*   **CombatAction (Eingänge):** `id`, `combatInstanceId`, `roundNumber`, `actorId`, `actionType`, `targetId`, `isLocked`.
*   **PvPChallenge:** `id`, `attackerTeamId`, `defenderTeamId`, `state` (WARNING, ESCAPED, COMBAT), `expiresAt`.

### G. Media & Admin
*   **MediaSubmission:** `id`, `teamId`, `questRunId`, `objectKey` (S3 Pfad), `status` (UPLOADING, RECEIVED, IN_REVIEW, APPROVED, REJECTED), `submittedAt`.
*   **ReviewDecision:** `id`, `submissionId` (FK), `reviewerId` (GM FK), `score`, `reason`, `decidedAt`.
*   **AuditEvent:** `id`, `actorId` (GM), `action`, `targetRefs`, `payload` (JSONB), `createdAt`.
