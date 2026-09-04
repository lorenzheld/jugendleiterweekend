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
*   **WorldObject:** `id`, `type` (NPC, ENEMY, STORE, BOSS, SAFE_ZONE), `geometry` (PostGIS), `discoveryRadius`, `interactionRadius`, `contentVersion`.
*   **PlayArea:** `id`, `day`, `geometry` (PostGIS Polygon für Tagesgrenzen).

### D. Quests & Narrative
*   **QuestDefinition:** `id`, `title`, `type` (REGULAR, HIDDEN, LONG_TERM, MEDIA).
*   **QuestRun:** `id`, `teamId` (FK), `questDefinitionId` (FK), `state` (ACTIVE, PENDING_REVIEW, COMPLETED...), `startedAt`.
*   **ObjectiveProgress:** `id`, `questRunId` (FK), `objectiveId`, `status`, `progressCount`.

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
