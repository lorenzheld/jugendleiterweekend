
# 3. Meilensteine (Epics) für die Implementierung

Diese isolierten, chronologischen Epics sind so strukturiert, dass sie in vertikalen Schnitten (Slices) entwickelt werden können, wie im GDD (Kapitel 41, Vibe-Coding) gefordert.

### Epic 1: Foundation & Infrastruktur
*   Aufsetzen des Monorepos (React PWA, Fastify Backend, geteilte Zod-Contracts).
*   Datenbank-Setup (PostgreSQL + PostGIS) mit Drizzle ORM Konfiguration.
*   CI/CD Pipeline Grundgerüst (Lint, Build, Typecheck).
*   Implementierung der deterministischen Error-Handler und des API-Grundgerüsts (REST).

### Epic 2: Identity & Map (Der erste Lauf)
*   *Backend:* Auth-Service (Login mit Zugangscodes), Session-Management.
*   *Frontend:* PWA-Setup, Login-Screen, Team-Lobby.
*   *Map:* Integration von MapLibre GL JS. Rendern der Basemap und des Spieler-Standorts (Geolocation API).
*   *Backend:* PostGIS-Validierung (Distanzberechnung `effectiveDistance` mit Genauigkeitstoleranzen).

### Epic 3: Core Game Loop (Quests & World Objects)
*   *Backend:* Laden von statischem Content (Quest-Katalog, Dialoge).
*   *World:* Darstellen von Markern auf der Karte (Sichtbarkeits- und Interaktionsradien implementieren).
*   *Quest-Engine:* Quest annehmen (Slot-Prüfung max. 3), State-Machine (ACTIVE -> COMPLETED).
*   *UI:* Bottom-Sheets für Interaktionen, Dialog-UI (lineare RPG-Dialoge mit Team-Synchronisation).

### Epic 4: Economy & Inventory
*   *Backend:* Implementierung des Append-only Ledgers für Ruhm und Denare.
*   *Data:* Inventar-Modell (Persönlich max 20, Team max 40).
*   *Features:* Loot-Zuweisung, Ausrüsten von Items (inkl. Werte-Berechnung).
*   *Handel:* Store-UI, Kauf/Verkauf von Items (mit 15% N-Item Regel). Implementierung der atomaren Team-zu-Team Handels-Transaktion.

### Epic 5: Combat System V1 (PvE)
*   *Backend:* State-Machine für rundenbasierten Kampf (`INITIALIZING` bis `COMPLETED`).
*   *Mechanik:* 15-Sekunden-Timer (Server-Autorität), Aktions-Lock, Initiative-Berechnung, Schadensformeln (Buffs/Debuffs).
*   *Frontend:* Combat-UI (Fullscreen), Aktions-Buttons, Combat Log (Feedback in 2-4 Sekunden).
*   *Lifecycle:* Downed-Status, HP-Regeneration ausserhalb des Kampfes, Team-Wipe & Respawn-Logik.

### Epic 6: PvP & Dynamische Welt
*   *PvP:* 60m Sichtbarkeit, 20m Angriffsradius. 20-Sekunden Warn-Screen (Flucht-Logik mit GPS-Validierung).
*   *Encounter:* Aggro-Radien (20m) für PvE-Gegner.
*   *Strafen:* PvP-Loot, Denar-Abzug bei Downed/Wipe. Safe-Zones implementieren.

### Epic 7: Realtime & Offline-Resilienz
*   *Infrastruktur:* Integration von WebSockets für Live-State (Combat, Team-Updates).
*   *Resilienz:* Reconnect-Logik implementieren (Abrufen von fehlenden Events, Wiederherstellen von Combat-Locks oder Dialog-Knoten nach Verbindungsabbruch).
*   *Caching:* PWA Service-Worker finalisieren (Caching von 200MB statischen Assets, Audio, Bilder).

### Epic 8: Media Quests & World Bosses (Event Highlights)
*   *Media:* S3 pre-signed URLs für direkten Foto/Video Upload. PENDING_REVIEW Status einbauen.
*   *Bosses:* Globale Instanz für Bosse (z.B. *Il Cannoniere*). Skalierte HP, Runden-Synchronisation über mehrere Teams, Globale Mechaniken (z.B. "Applaudieren").

### Epic 9: GM Dashboard & Operations
*   *Admin UI:* Eigenes Frontend-Build. Live-Map mit Team-Standorten.
*   *Media Inbox:* UI für GMs zum Bewerten von Fotos/Videos (0-10 Punkte-Raster) und Zuweisung von Ledger-Einträgen.
*   *Commands:* Reversible und Audit-geloggte Commands (Recovery, Quest-Reset, Override).
*   *Event Lifecycle:* Start/Pause/End Event, Tageszusammenfassung, Leaderboard-Freeze, Final-Reveal.

### Epic 10: Balancing, Vibe-Coding Playtest & Polish
*   Einpflegen des finalen Content-Bundles (v0.9 JSON/YAML).
*   Umsetzung von "Vibe-Coding" Meilenstein (ENT-41): Playtest in Pfäffikon (Beitritt -> Quest -> Hidden Quest -> Combat -> Reconnect).
*   Feinschliff UI/UX (Marmor/Bronze Design, Chiaroscuro Assets via Higgsfield), Audio-Sprites (Howler.js).
*   Lasttests und Datenbank-Migration-Tests auf Staging.