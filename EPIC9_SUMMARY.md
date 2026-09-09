# Epic 9: GM Dashboard & Operations – Implementation Summary

**Status**: ✅ Completed  
**Date**: 2026-09-09

## Overview

Epic 9 provides a comprehensive Game Master (GM) dashboard and operations toolkit for managing the JLW 2026 event. The implementation includes live monitoring, administrative commands, media review workflow, and event lifecycle controls.

---

## Backend Implementation

### 1. Database Schema Extensions

**Migration**: `0011_epic9_gm_operations.sql`

- **Event State Table**: Tracks global event lifecycle (`NOT_STARTED`, `ACTIVE`, `PAUSED`, `ENDED`)
- **Audit Events**: Enhanced with indexes for efficient GM command logging
- **GM Command Types**: Enum for command categorization
- **Indexes**: Added for performance on media status, quest states, and audit queries

### 2. Services

#### `GMCommandService` (`gm-commands.service.ts`)
Reversible, audit-logged administrative commands:
- **Quest Reset**: Reset quest runs to `ACTIVE` state
- **HP Override**: Direct team HP modification
- **Location Override**: Manual player coordinate setting
- **Currency Correction**: Add/remove FAME or DENARII with audit trail

All commands are logged to `audit_event` table with actor, action, and payload.

#### `EventLifecycleService` (`event-lifecycle.service.ts`)
Global event state management:
- **START/PAUSE/RESUME/END**: Event state transitions with validation
- **Leaderboard**: Real-time team rankings by FAME → DENARII
- **Event Summary**: Aggregated statistics (teams, quests, duration, currency)
- **Leaderboard Freeze**: Independent toggle for final rankings

#### `SeedControlService` (`seed-control.service.ts`)
On-demand GeoJSON re-seed:
- Triggers full re-seed from `Via_Romae_GameObjects_v0.8.geojson`
- Content filter: `APPROVED` + `publishable` only (production mode always enforced)
- Returns detailed report (imported/skipped/errors)
- Audit-logged

#### `GMDashboardService` (`gm-dashboard.service.ts`)
Live data aggregation for dashboard:
- **Player Positions**: All active player coordinates with team context
- **Team Status**: HP, Fame, Denarii, active quest count per team
- **World Objects**: All WorldObjects with coordinates for map overlay

#### `MediaService` (extended)
Enhanced media review workflow:
- **submitReview**: Now posts LedgerEntry based on score (1-10 FAME, 7-10 bonus Denarii)
- **getPendingSubmissions**: Filter for `RECEIVED` status (GM inbox)

### 3. API Routes

All routes under `/api/v1/gm` prefix (requires authentication):

#### GM Commands (`gm-commands.routes.ts`)
- `POST /commands/quest-reset` – Reset quest run
- `POST /commands/hp-override` – Override team HP
- `POST /commands/location-override` – Override player location
- `POST /commands/currency-correction` – Add/remove currency
- `GET /audit-log` – Fetch audit log with pagination & filters

#### Event Lifecycle (`event-lifecycle.routes.ts`)
- `GET /event/state` – Current event state
- `POST /event/start` – Start event
- `POST /event/pause` – Pause event
- `POST /event/resume` – Resume event
- `POST /event/end` – End event & freeze leaderboard
- `GET /event/leaderboard` – Live team rankings
- `GET /event/summary` – Event statistics
- `POST /event/leaderboard-freeze` – Toggle leaderboard freeze

#### GM Dashboard (`gm-dashboard.routes.ts`)
- `GET /dashboard/player-positions` – All player coordinates
- `GET /dashboard/team-status` – All team stats
- `GET /dashboard/world-objects` – All WorldObjects for map
- `GET /dashboard/media-inbox` – Pending media submissions

#### Seed Control (`seed-control.routes.ts`)
- `POST /seed/trigger` – Trigger GeoJSON re-seed

---

## Frontend Implementation

### GM Client App Structure

**Location**: `apps/gm-client/`

Desktop-first, landscape layout with:
- **Live Map**: MapLibre GL with player positions, WorldObject overlays, and legend
- **Media Inbox**: Pending submissions with score slider (0-10) and feedback
- **Command Panel**: Administrative commands with form validation
- **Leaderboard**: Team rankings and event summary statistics
- **Event Controls**: START/PAUSE/RESUME/END buttons in header
- **Team Status Sidebar**: Real-time team HP, currency, and quest count

### Components

#### `DashboardLayout.tsx`
Main layout shell: header, sidebar, tabs, and content area.

#### `LiveMap.tsx`
MapLibre GL integration:
- Player markers (blue dots) with popup (name, team, last update)
- WorldObject markers (color-coded by type: green=published, red=boss, amber=enemy, gray=draft)
- Map legend and live statistics
- Auto-refresh every 5s via React Query

#### `MediaInbox.tsx`
Media review workflow:
- List of pending submissions (left panel)
- Media preview and review form (right panel)
- Score slider (0-10) with visual thresholds (0-4 rejected, 5-10 approved)
- Optional reason field for feedback
- Submit review → triggers `MediaService.submitReview` → awards FAME/Denarii

#### `CommandPanel.tsx`
GM command execution:
- HP Override: Team ID + new HP value
- Currency Correction: Team ID + currency type (FAME/DENARII) + amount + reason
- Location Override: Player ID + lat/lng
- Quest Reset: Quest Run ID
- Success/error feedback with auto-dismiss

#### `EventControls.tsx`
Event lifecycle buttons:
- Dynamic buttons based on current state (`NOT_STARTED` → Start, `ACTIVE` → Pause/End, `PAUSED` → Resume/End)
- State badge with color coding (gray/green/yellow/red)
- Confirmation prompt for END action

#### `TeamStatusPanel.tsx`
Sidebar panel with team cards:
- Team name, HP, Fame, Denarii, active quest count
- Visual indication for inactive teams (faded)

#### `LeaderboardPanel.tsx`
Full-screen leaderboard view:
- Event summary cards (total teams, quests completed, duration, top team)
- Team rankings table (rank, name, Fame, Denarii, quests)
- Medals for top 3 teams (🥇🥈🥉)

### Configuration

**API Base URL**: Set via `VITE_API_BASE_URL` env var (defaults to `http://localhost:3000`)

**Auth**: Uses `localStorage.getItem("gm_token")` for JWT bearer token

**Refresh Interval**: 5 seconds for live data queries (configurable in QueryClient)

---

## Contracts (Shared Schemas)

**Location**: `packages/contracts/src/schemas/gm.ts`

Zod schemas for type-safe API communication:

- **Commands**: `ResetQuestBody`, `OverrideHPBody`, `OverrideLocationBody`, `CorrectCurrencyBody`
- **Event**: `EventState`, `EventLifecycleState`, `EventSummary`, `TeamLeaderboardEntry`
- **Seed**: `SeedReport`
- **Dashboard**: `PlayerPosition`, `TeamStatus`, `WorldObjectMarker`, `MediaSubmissionWithTeam`
- **Audit**: `AuditLogEntry`, `GMCommandType`
- **WebSocket (future)**: `GMPlayerLocationUpdateEvent`, `GMTeamStatusUpdateEvent`

---

## Usage

### Starting the GM Client

```bash
cd apps/gm-client
npm run dev
```

Access at: `http://localhost:5174`

### Backend Development

GM routes are automatically registered in `apps/backend/src/index.ts`:

```typescript
await server.register(gmCommandsRoutes, { prefix: "/api/v1/gm" });
await server.register(eventLifecycleRoutes, { prefix: "/api/v1/gm" });
await server.register(gmDashboardRoutes, { prefix: "/api/v1/gm" });
await server.register(seedControlRoutes, { prefix: "/api/v1/gm" });
```

### Running Migrations

```bash
cd apps/backend
npm run migrate
```

Apply `0011_epic9_gm_operations.sql` to enable event state and audit enhancements.

---

## Key Features

### 1. Live Map
- Real-time player tracking with 5s refresh
- WorldObject overlay with publishable status
- Click markers for details (player name, team, object type)

### 2. Media Review
- Streamlined inbox for pending submissions
- Score-based reward system (1-10 FAME, 7-10 bonus Denarii)
- Automatic quest step completion on approval

### 3. GM Commands
- Reversible interventions with full audit trail
- HP/location/currency overrides for emergency corrections
- Quest reset for stuck teams

### 4. Event Lifecycle
- State machine: `NOT_STARTED → ACTIVE → PAUSED → ENDED`
- Leaderboard freeze on event end
- Duration tracking and summary statistics

### 5. Seed Control
- On-demand GeoJSON re-seed via UI (future) or direct API call
- Production-safe content filter (APPROVED + publishable only)
- Detailed report with import counts

### 6. Audit Logging
- Every GM command logged with actor, action, target, and payload
- Queryable via `/audit-log` endpoint with pagination & filters
- Supports forensic investigation and compliance

---

## Security & Authorization

**Current Implementation**: All `/api/v1/gm` routes require JWT authentication via `server.authenticate` preHandler.

**Future Enhancements**:
- Role-based access control (RBAC) to restrict GM endpoints to `ADMIN` role
- Rate limiting on sensitive commands (HP override, currency correction)
- Multi-factor authentication (MFA) for event lifecycle actions

---

## Testing

### Manual Testing

1. **Start Event**: Use Event Controls → Start Event
2. **Review Media**: Navigate to Media Inbox → Select submission → Score → Submit
3. **Execute Command**: Navigate to Commands → Select HP Override → Enter team ID → Execute
4. **View Leaderboard**: Navigate to Leaderboard → Verify rankings and summary

### API Testing

Use `curl` or Postman with JWT token:

```bash
# Get event state
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/gm/event/state

# Start event
curl -X POST -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/gm/event/start

# Get leaderboard
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/gm/event/leaderboard
```

---

## Future Enhancements

### Planned for Next Iteration

1. **Real-time WebSocket Updates**:
   - Broadcast player location updates to GM dashboard
   - Push team status changes on HP/currency updates
   - Live event state transitions

2. **Enhanced Media Preview**:
   - S3-signed URLs for direct image/video display
   - Thumbnail generation for fast loading
   - Media download for local archival

3. **Command History**:
   - Timeline view of all GM actions
   - Rollback/undo for reversible commands
   - Export audit log to CSV

4. **Advanced Analytics**:
   - Team activity heatmaps
   - Quest completion timelines
   - Player engagement metrics

5. **Mobile GM App**:
   - Simplified UI for on-the-go monitoring
   - Push notifications for critical events

---

## Dependencies

### Backend
- `fastify` – HTTP server
- `drizzle-orm` – Database ORM
- `@jlw/contracts` – Shared schemas

### Frontend
- `react` – UI framework
- `react-query` – Data fetching & caching
- `maplibre-gl` – Map rendering
- `tailwindcss` – Styling

---

## Notes

- **Desktop-First**: GM dashboard optimized for landscape monitors (1920×1080+)
- **Auto-Refresh**: All dashboard data refreshes every 5 seconds for near-real-time monitoring
- **Audit Trail**: Every GM action is logged; consider retention policies for production
- **Seed Safety**: Re-seed always enforces production content filter (APPROVED + publishable)

---

## Conclusion

Epic 9 provides a robust, production-ready GM toolkit for managing the JLW 2026 event. The implementation balances real-time monitoring, administrative control, and audit compliance, enabling GMs to confidently oversee and intervene in the game experience.

**Next Steps**:
1. Deploy GM client to dedicated subdomain (`gm.jlw2026.example.com`)
2. Configure RBAC for GM-only access
3. Train GMs on command usage and event lifecycle workflow
4. Set up monitoring/alerting for audit log anomalies

---

**Author**: AI Assistant  
**Date**: 2026-09-09  
**Epic**: 9 – GM Dashboard & Operations
