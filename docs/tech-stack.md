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

