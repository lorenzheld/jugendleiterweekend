# 1. High-Level Systemarchitektur

Gemäss den Spezifikationen (Kapitel 34 & 38) wird das System als **Modularer Monolith** konzipiert. Dies minimiert die operative Komplexität für ein Event mit begrenzter Teilnehmerzahl (~13 Spieler + GMs), sichert aber durch strikte Modulgrenzen die Wartbarkeit.

## 1.1 Tech-Stack
*   **Frontend (Player & GM-Admin):**
    *   **Core:** React, TypeScript, Vite.
    *   **Map/GIS:** MapLibre GL JS, `react-maplibre` (Basemap über MapTiler mit OSM-Daten).
    *   **UI-Framework:** Tailwind CSS, shadcn/ui, Radix UI, Lucide Icons.
    *   **State & Data Fetching:** TanStack Query (für Server-State), lokaler React-State (Zustand).
    *   **PWA:** `vite-plugin-pwa` (für Caching, Offline-Assets, App-Shell).
    *   **Validierung:** Zod, React Hook Form.
*   **Backend:**
    *   **Runtime:** Node.js (LTS), TypeScript (Strict-Mode).
    *   **Web Framework:** Fastify (für HTTP REST & WebSockets).
    *   **ORM / Query Builder:** Drizzle ORM.
    *   **Validierung & Contracts:** Zod (geteiltes Package mit Frontend für Type-Safety).
*   **Datenbank & Infrastruktur:**
    *   **Primäre Datenbank:** PostgreSQL mit **PostGIS**-Erweiterung (für räumliche Geometrien und Distanzberechnungen).
    *   **Medien-Speicher:** Privater S3-kompatibler Objektspeicher (EU-Region).
    *   **Deployment:** Docker-Container auf einer verwalteten Containerplattform (kein Kubernetes notwendig).

## 1.2 Architektur-Komponenten
Die Anwendung ist in drei logische Tiers unterteilt:

1.  **Client Tier (PWAs)**
    *   **Player Client:** Mobile-First Hochformat. Stellt die Spielwelt (Karte), UI-Overlays (Kampf, Dialoge, Inventar) dar. Hält keine autoritative Spiellogik.
    *   **GM Client:** Desktop-First Querformat. Erlaubt Systembeobachtung, Map-Tracking, Medien-Review (Inbox) und kontrollierte Eingriffe (Commands).
2.  **API Gateway & Transport Tier (Fastify)**
    *   **REST API:** Für Commands (Statusänderungen mit Idempotency-Keys) und initiale Daten-Snapshots.
    *   **WebSocket Hub:** Für Echtzeit-Events (Runden-Updates im Kampf, PvP-Warnungen, Team-Zustandsänderungen).
3.  **Application Tier (Modularer Monolith)**
    *   **Auth & Session Modul:** Verwaltung der Accounts, Rollen und Token.
    *   **Geo & World Modul:** Verarbeitet PostGIS-Queries, Sichtbarkeiten, Interaktionsradien (Standard 15m, Aggro 20m, etc.).
    *   **Quest & Dialogue Modul:** State-Machine für Quests (Active, Completed, Pending_Review), Dialogbäume.
    *   **Combat & Encounter Modul:** Rundenbasierte Engine (15s Timer, Locks, Initiative, Damage-Calculation), State für PvE, PvP und Bosskämpfe.
    *   **Economy Modul:** Ledger-basiertes System (Append-only) für Ruhm, Denare und Items. Atomare Transaktionen für Handel und Stores.
    *   **Media & Admin Modul:** Pre-Signed S3-URLs, Review-Workflow, Audit-Log (Event-Sourcing-Light für Commands).

## 1.3 GeoJSON Ingestion Pipeline & PostGIS Seeding

Die Single Source of Truth für alle Game-Objekte ist die Datei `docs/Via_Romae_GameObjects_v0.8.geojson` (Schema `via-romae/game-geojson/v0.8`). Diese Datei enthält alle `location_candidate`-, `quest_definition`-, `enemy_encounter`- und `navigation_challenge`-Features der Spielwelt.

### Prozessablauf (Startup / Deployment)

```
[GeoJSON-Datei auf Disk]
        │
        ▼
[1. Schema-Validierung via Zod]
   – Jedes Feature wird gegen ein geteiltes Zod-Schema validiert.
   – Ungültige Features → Fehler-Log, kein Abbruch des gesamten Imports.
        │
        ▼
[2. Filter: Nur publishbare Features]          ← PRODUKTION
   – content_status === "APPROVED"
   – publishable === true
   (In der Entwicklungsumgebung kann der Filter deaktiviert werden,
    um auch DRAFT/FIELD_CHECK_REQUIRED Features zu sehen.)
        │
        ▼
[3. Upsert in PostgreSQL/PostGIS]
   – WorldObject (Koordinaten als geometry(Point, 4326), Radien)
   – QuestStation (observable_evidence, location_question, expected_answer)
   – QuestStep (sequence, flow_phase, step_action_type, target_ref)
   – Idempotenter Upsert via feature.id als natürlicher Schlüssel.
        │
        ▼
[4. Seed-Bericht: importiert / übersprungen / fehlerhaft]
```

### Implementierungsdetails

*   **Trigger:** Das Seeding wird als expliziter npm-Script (`npm run seed`) und als Initialisierungsschritt im Docker-Entrypoint ausgeführt.
*   **Zod-Schema:** Das Schema für GeoJSON-Features wird im geteilten Package (`packages/contracts`) definiert, damit Frontend und Backend dieselben Typen verwenden.
*   **Idempotenz:** Jeder Upsert nutzt die `feature.id` (z. B. `location:place_day_1_acquedotto_vergine`) als stabilen externen Schlüssel (`external_id`). Bei erneutem Seeding werden bestehende Einträge aktualisiert, nicht dupliziert.
*   **Produktions-Filter:** Die `release_rule` aus dem GeoJSON-Metadaten-Block (`"Only features with content_status=APPROVED may be published"`) wird serverseitig als unveränderliche Guard-Clause implementiert und ist nicht per Konfiguration deaktivierbar in `NODE_ENV=production`.
*   **Geofencing-Defaults:** Fehlende Radius-Angaben in einem Feature werden mit den `implementation_defaults` aus dem Metadaten-Block aufgefüllt: `discovery_radius_m: 55`, `interaction_radius_m: 15`, `exit_hysteresis_radius_m: 25`.

