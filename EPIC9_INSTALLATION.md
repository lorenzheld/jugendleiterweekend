# Epic 9 Installation & Setup Guide

## Prerequisites

- Node.js 20+ installed
- PostgreSQL 15+ running
- pnpm (or npm) installed
- Git repository cloned

---

## Step 1: Install Dependencies

### Backend
```bash
cd apps/backend
npm install
```

**New dependencies added:**
- `uuid@^9.0.1` - For generating unique identifiers
- `@types/uuid@^9.0.8` - TypeScript types for uuid

### GM Client
```bash
cd apps/gm-client
npm install
```

**All dependencies already present** (maplibre-gl, react-query, etc.)

### Contracts (optional rebuild)
```bash
cd packages/contracts
npm run build
```

---

## Step 2: Database Migration

Apply the Epic 9 migration to add the event_state table and indexes:

```bash
cd apps/backend
npm run db:migrate
```

This will apply `0011_epic9_gm_operations.sql` which:
- Creates `event_lifecycle_state` enum
- Creates `event_state` table with initial row
- Creates `gm_command_type` enum
- Adds indexes on `audit_event`, `media_submission`, `quest_run`

**Verify migration:**
```sql
-- Connect to your PostgreSQL database
psql -U your_user -d your_database

-- Check if event_state table exists
\d event_state

-- Check if initial row exists
SELECT * FROM event_state;

-- Should return:
-- id | state | started_at | paused_at | ended_at | leaderboard_frozen | metadata | updated_at
-- (1 row with state='NOT_STARTED')
```

---

## Step 3: Environment Configuration

### Backend (.env)
```bash
# apps/backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/jlw2026
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
LOG_LEVEL=info
```

### GM Client (.env)
```bash
# apps/gm-client/.env
VITE_API_BASE_URL=http://localhost:3000
```

Copy from example:
```bash
cp apps/gm-client/.env.example apps/gm-client/.env
```

---

## Step 4: Start Services

### Terminal 1: Backend
```bash
cd apps/backend
npm run dev
```

Backend runs on: `http://localhost:3000`

### Terminal 2: GM Client
```bash
cd apps/gm-client
npm run dev
```

GM Dashboard runs on: `http://localhost:5174`

---

## Step 5: Authentication Setup

**Temporary Setup (until GM login UI is built):**

1. Login via standard auth endpoint:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
```

2. Copy the JWT token from response

3. Open GM Dashboard (`http://localhost:5174`)

4. Open Browser DevTools (F12) → Console

5. Set token in localStorage:
```javascript
localStorage.setItem("gm_token", "YOUR_JWT_TOKEN_HERE");
```

6. Refresh the page - Dashboard should now load data

---

## Step 6: Verify Installation

### Manual API Tests

**Option 1: PowerShell (Windows)**
```powershell
cd apps/backend/scripts
.\test-epic9-api.ps1
```

**Option 2: Bash (Linux/macOS)**
```bash
cd apps/backend/scripts
chmod +x test-epic9-api.sh
./test-epic9-api.sh
```

**Option 3: cURL (any platform)**
```bash
# Get event state
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/gm/event/state

# Get team status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/gm/dashboard/team-status

# Get player positions
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/v1/gm/dashboard/player-positions
```

### Expected Results

✅ **Event State**: Should return `{ state: "NOT_STARTED", ... }`

✅ **Team Status**: Should return array of teams (may be empty if no teams exist)

✅ **Player Positions**: Should return array of players with locations (may be empty)

✅ **World Objects**: Should return array of WorldObjects (check if seed was run)

---

## Step 7: Seed Test Data (Optional)

If you need test data:

```bash
cd apps/backend

# Seed world objects and quests from GeoJSON
npm run seed

# Create test account (if not exists)
npm run db:seed
```

---

## Troubleshooting

### Issue: "uuid is not defined"
**Solution:** Run `npm install` in apps/backend (adds uuid package)

### Issue: "Module not found: @jlw/contracts"
**Solution:** 
```bash
cd packages/contracts
npm run build

cd apps/gm-client
npm install
```

### Issue: "Event state not found"
**Solution:** Run migration again:
```bash
cd apps/backend
npm run db:migrate
```

### Issue: "Authorization failed"
**Solution:** Check JWT token in localStorage:
```javascript
console.log(localStorage.getItem("gm_token"));
```

### Issue: "Map not loading"
**Solution:** 
1. Check browser console for errors
2. Verify MapLibre GL CSS is loaded
3. Check if player positions API returns data

### Issue: "CORS error"
**Solution:** Backend CORS is enabled by default. Check if backend is running on port 3000.

---

## Database Schema Verification

Verify all Epic 9 tables and indexes:

```sql
-- Check event_state table
SELECT * FROM event_state;

-- Check audit_event indexes
\d audit_event

-- Should show:
-- idx_audit_event_actor
-- idx_audit_event_action
-- idx_audit_event_created

-- Check media_submission indexes
\d media_submission

-- Should show:
-- idx_media_status
-- idx_media_team

-- Check quest_run indexes
\d quest_run

-- Should show:
-- idx_quest_run_state
-- idx_quest_run_team
```

---

## TypeScript Compilation

Verify TypeScript compiles without errors:

### Backend
```bash
cd apps/backend
npm run typecheck
```

### GM Client
```bash
cd apps/gm-client
npm run typecheck
```

**Expected:** No errors (all should pass)

---

## Production Build

### Backend
```bash
cd apps/backend
npm run build
npm start
```

### GM Client
```bash
cd apps/gm-client
npm run build
npm run preview
```

---

## Next Steps After Installation

1. ✅ Verify all services are running
2. ✅ Run API tests to confirm endpoints work
3. ✅ Open GM Dashboard and verify UI loads
4. ✅ Test event lifecycle (Start → Pause → Resume → End)
5. ✅ Test a GM command (HP override with test team)
6. ✅ Check audit log to verify command logging

---

## Security Recommendations

Before deploying to production:

1. **Add RBAC** - Restrict GM endpoints to admin role only
2. **Add rate limiting** - Prevent command spam
3. **Add MFA** - For event lifecycle actions (Start/End)
4. **Enable HTTPS** - For both backend and GM client
5. **Set up monitoring** - Track audit log for suspicious activity
6. **Rotate JWT secrets** - Use environment-specific secrets
7. **Add IP whitelist** - Restrict GM dashboard access

---

## Support

For issues or questions:
- Check `EPIC9_TEST_RESULTS.md` for known issues
- Check `EPIC9_SUMMARY.md` for implementation details
- Check `apps/gm-client/README.md` for UI guide

---

**Installation Guide Version**: 1.0  
**Last Updated**: 2026-09-09  
**Epic**: 9 – GM Dashboard & Operations
