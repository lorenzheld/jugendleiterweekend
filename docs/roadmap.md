
# 3. Meilensteine (Epics) für die Implementierung

Diese isolierten, chronologischen Epics sind so strukturiert, dass sie in vertikalen Schnitten (Slices) entwickelt werden können, wie im GDD (Kapitel 41, Vibe-Coding) gefordert. Der Ausgangspunkt ist die Single Source of Truth `docs/Via_Romae_GameObjects_v0.8.geojson` (Schema `via-romae/game-geojson/v0.8`).

---

### Epic 1: Content Data Pipeline & PostGIS Seeding
*Ziel: Alle Game-Inhalte aus dem GeoJSON vollständig und validiert in die Datenbank bringen.*

*   **Monorepo-Setup:** React PWA, Fastify Backend, geteilte Zod-Contracts (`packages/contracts`). CI/CD Grundgerüst (Lint, Build, Typecheck).
*   **Datenbank-Setup:** PostgreSQL + PostGIS mit Drizzle ORM. Migration für alle Kern-Tabellen (WorldObject, QuestDefinition, QuestStep, QuestStation, PlayArea).
*   **Zod-GeoJSON-Schema:** Typsicheres Schema für `location_candidate`, `quest_definition`, `enemy_encounter` und `navigation_challenge` Features.
*   **Seed-Script (`npm run seed`):**
    *   Einlesen der `Via_Romae_GameObjects_v0.8.geojson`.
    *   Validierung jedes Features gegen das Zod-Schema; fehlerhafte Features werden geloggt und übersprungen.
    *   **Produktions-Filter:** Nur Features mit `content_status: "APPROVED"` und `publishable: true` werden importiert. Der Filter ist in `NODE_ENV=production` unveränderlich aktiv.
    *   Idempotentes Upsert via `feature.id` als `external_id` (z. B. `location:place_day_1_acquedotto_vergine`).
    *   Mapping der GeoJSON-Strukturen auf DB-Tabellen: `quest_step_refs` → `QuestStep`, `quest_stations` → `QuestStation`.
    *   Fehlende Radius-Werte werden mit den `implementation_defaults` aus dem GeoJSON-Metadaten-Block aufgefüllt.
*   **Seed-Bericht:** Ausgabe der Anzahl importierter, übersprungener und fehlerhafter Features je Feature-Typ.
*   **API-Grundgerüst:** Deterministischer Error-Handler, Health-Endpoint.

---

### Epic 2: Geofencing & Spatial Engine
*Ziel: Die räumliche Spiellogik auf Basis der im GeoJSON definierten Radien implementieren.*

*   **PostGIS-Queries:** Implementierung der serverseitigen `effectiveDistance`-Berechnung mit GPS-Genauigkeitstoleranzen.
*   **Drei-Radien-Logik** (Werte aus GeoJSON `implementation_defaults`):
    *   `discovery_radius_m` (55 m): WorldObject-Marker wird auf der Karte sichtbar.
    *   `interaction_radius_m` (15 m): Interaktions-Trigger wird aktiv (NPC-Dialog, Quest annehmen, Rätsel lösen).
    *   `exit_hysteresis_radius_m` (25 m): Interaktion bleibt aktiv bis zum Verlassen des größeren Radius – verhindert Flicker.
    *   `enemy_aggro_radius_m` (20 m): PvE-Encounter-Trigger (aus GeoJSON `enemy_encounter` Features).
    *   `boss_join_radius_m` (30 m): Boss-Beitrittsschwelle für globale Boss-Instanzen.
*   **Standort-Update-Endpoint:** Spieler-GPS-Position wird serverseitig empfangen, mit PostGIS gegen alle WorldObjects der Tages-PlayArea verglichen.
*   **Event-Emission:** Bei Radius-Eintritt/-Austritt werden WebSocket-Events an betroffene Team-Clients ausgesendet.

---

### Epic 3: Identity, Team & Base Map
*Ziel: Login, Team-Bildung und erste sichtbare Spielwelt.*

*   *Backend:* Auth-Service (Login mit Zugangscodes), Session-Management, Rollen (PLAYER, GM, ADMIN).
*   *Frontend:* PWA-Setup, Login-Screen, Team-Lobby-UI.
*   *Map:* Integration von MapLibre GL JS. Rendern der Basemap (MapTiler/OSM). Spieler-Standort (Geolocation API). Anzeige von WorldObject-Markern ab `discovery_radius_m = 55 m`.
*   *PlayArea:* Tagesgrenzen-Polygone aus DB als Overlay auf der Karte rendern.

---

### Epic 4: Quest Engine & Flow Phases
*Ziel: Die vollständige Quest-Ablaufsteuerung auf Basis der `flow_phase`-Struktur aus dem GeoJSON implementieren.*

*   **Flow-Phase State-Machine** (aus `quest_step_refs.flow_phase`):
    1.  `DISCOVER` → NPC oder Ort erscheint im `discovery_radius_m`; Marker auf Karte sichtbar.
    2.  `DIALOGUE` → Gesprächs-UI startet bei Eintritt in `interaction_radius_m` (step_action_type: `TALK_TO_NPC`).
    3.  `ACCEPT` → Team nimmt Quest an (step_action_type: `ACCEPT_QUEST`); Quest erscheint im aktiven Slot (max. 3).
    4.  `OBJECTIVE` → Spielbare Schritte werden sequenziell abgearbeitet:
        *   `REACH_LOCATION`: GPS-Validierung via PostGIS.
        *   `ANSWER_QUESTION` / `SOLVE_PUZZLE`: Eingabe der `expected_answer` aus `QuestStation`; Team-synchronisierte Bestätigung (alle Mitglieder müssen online sein).
        *   `DEFEAT_ENEMY`: Trigger für Combat-Instance (Epic 5) via `enemy_hook` aus `QuestStation`.
        *   `UPLOAD_MEDIA`: Pre-Signed S3-URL Workflow (Epic 8).
    5.  `COMPLETE` → Abschluss-Dialog (`TALK_TO_NPC`), Ledger-Buchung (Ruhm, Denare), QuestRun-Status → COMPLETED.
*   **Versteckte Quests (HIDDEN):** Werden nur durch Erfüllung des DISCOVER-Schritts aufgedeckt, erscheinen nicht in der Standard-Questliste.
*   **Quest-Slot-Prüfung:** Max. 3 aktive Quests pro Team.
*   *UI:* Bottom-Sheets für Interaktionen, Dialog-UI mit Team-Synchronisation (alle Mitglieder sehen denselben Dialogzustand).

---

### Epic 5: Inventory & Economy
*Ziel: Das ökonomische System und das Inventar spielbar machen.*

*   *Backend:* Append-only Ledger für Ruhm und Denare mit Idempotency-Keys.
*   *Data:* Inventar-Modell (Persönlich max. 20, Team max. 40 Items).
*   *Features:* Loot-Zuweisung nach Quest-Abschluss oder Enemy-`DEFEAT_ENEMY`-Schritt, Ausrüsten von Items (Werte-Berechnung via Ausrüstungs-Slots).
*   *Handel:* Store-UI (gebundene an WorldObject-Typ STORE), Kauf/Verkauf (15% N-Item Regel), atomare Team-zu-Team Handels-Transaktion.

---

### Epic 6: Combat System (PvE & PvP)
*Ziel: Rundenbasiertes Kampfsystem – ausgelöst durch `DEFEAT_ENEMY` step_action_type oder PvP-Annäherung.*

*   **PvE-Encounter:** CombatInstance wird gestartet, wenn ein `DEFEAT_ENEMY`-QuestStep aktiv ist und das Team den `enemy_aggro_radius_m` (20 m) eines `enemy_encounter`-Features betritt.
*   **PvE State-Machine:** `INITIALIZING` → `AWAITING_ACTIONS` → `LOCKED` → `RESOLVING` → `COMPLETED`. 15-Sekunden-Timer (Server-Autorität), Aktions-Lock, Initiative, Schadensformeln mit Buffs/Debuffs.
*   **Lifecycle:** Downed-Status, HP-Regeneration außerhalb des Kampfes, Team-Wipe & Respawn.
*   **PvP:** 60 m Sichtbarkeit, 20 m Angriffsradius. 20-Sekunden Warn-Screen (PvPChallenge: WARNING → COMBAT/ESCAPED). GPS-Validierung der Flucht. PvP-Loot, Denar-Abzug bei Downed/Wipe. Safe-Zones (WorldObject-Typ SAFE_ZONE) deaktivieren PvP-Trigger.
*   *Frontend:* Combat-UI (Fullscreen), Aktions-Buttons, Combat Log (Feedback in 2–4 Sekunden).

---

### Epic 7: Realtime & Offline-Resilienz
*Ziel: Stabile Verbindung und fehlertolerante Echtzeit-Synchronisation.*

*   *WebSockets:* Integration für Live-State (Combat-Runden, Team-Updates, QuestStep-Fortschritt, PvP-Warnungen).
*   *Resilienz:* Reconnect-Logik (Abrufen fehlender Events, Wiederherstellen von Combat-Locks und Dialog-Knoten nach Verbindungsabbruch).
*   *Caching:* PWA Service-Worker finalisieren (Caching von ~200 MB statischen Assets, Audio-Sprites, Bilder, Karten-Tiles).

---

### Epic 8: Media Quests & World Bosses
*Ziel: Event-Highlights und asynchrone Medienquests implementieren.*

*   **Media (step_action_type: `UPLOAD_MEDIA`):** Pre-Signed S3-URLs für direkten Foto/Video-Upload. `QuestRun`-Status → `PENDING_REVIEW` nach Upload. `MediaSubmission` & `ReviewDecision` Workflow.
*   **World Bosses:** Globale CombatInstance für Boss-Features aus dem GeoJSON (WorldObject-Typ BOSS, `boss_join_radius_m: 30 m`). Skalierte HP, Runden-Synchronisation über mehrere Teams, globale Mechaniken (z. B. „Applaudieren" als Gruppen-Aktion).

---

### Epic 9: GM Dashboard & Operations
*Ziel: Vollständiges Werkzeug für Spielleiter zum Überwachen und Eingreifen.*

*   *Admin UI:* Eigenes Frontend-Build (Desktop-First). Live-Map mit Team-Standorten und WorldObject-Overlays.
*   *Media Inbox:* UI für GMs zum Bewerten von Fotos/Videos (0–10 Punkte) und Auslösen von Ledger-Buchungen.
*   *Commands:* Reversible, Audit-geloggte Commands (AuditEvent-Tabelle): Quest-Reset, HP-Override, Standort-Override, Denar-Korrektur.
*   *Seed-Control:* GM kann einen Re-Seed aus dem aktuellen GeoJSON triggern (Staging und Event-Tag-Deployment).
*   *Event Lifecycle:* Start/Pause/End Event, Tageszusammenfassung, Leaderboard-Freeze, Final-Reveal.

---

### Epic 10: Balancing, Playtest & Polish
*Ziel: Finaler Content-Import, Playtest und Event-Reife.*

*   **Content-Freeze:** Einpflegen des finalen GeoJSON (v0.9), sobald alle `content_status: "APPROVED"` Features vorliegen. Re-Seeding auf Staging und Produktion.
*   **Vibe-Coding Playtest** (ENT-41, Pfäffikon): Vollständiger Flow Beitritt → DISCOVER → Quest ACCEPT → OBJECTIVE (REACH_LOCATION + ANSWER_QUESTION) → DEFEAT_ENEMY → COMPLETE → Reconnect nach Verbindungsabbruch.
*   **UI/UX Polish:** Marmor/Bronze Design, Chiaroscuro Assets (Higgsfield), Audio-Sprites (Howler.js).
*   **Lasttests:** Simultane GPS-Updates von ~13 Spielern, PostGIS-Query-Performance unter Last, WebSocket-Fanout bei globalen Boss-Events.
*   **DB-Migrations-Tests:** Destructive-Migration-Simulation auf Staging vor dem Event.