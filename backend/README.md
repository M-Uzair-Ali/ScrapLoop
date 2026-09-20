# ScrapLoop Backend (Phase 0 + Phase 1)

Express + TypeScript API, PostgreSQL + PostGIS for geospatial data, JWT auth.

## What's implemented in Phase 0

- Full DB schema (see `src/db/migrations/001_init.sql`) covering the whole design doc: users,
  collector profiles, listings, listing items, matches, transactions, ratings, price snapshots, areas.
- A tiny migration runner (`npm run migrate`) — no external migration framework needed yet.
- Auth: `POST /auth/signup`, `POST /auth/login` (bcrypt + JWT), role-aware (household/collector).
- `GET /users/me` — returns profile, plus collector_profile if role is collector.
- `docker-compose.yml` for local Postgres+PostGIS and Redis (Redis isn't wired into code yet —
  that lands in Phase 3 with the pricing engine).

This has been installed and compiled (`npm install && npx tsc`) with **zero type errors**, and the
server boots and listens correctly. It has not been run against a live database in this environment —
do that on your machine with the steps below.

## Setup

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install deps
npm install

# 3. Configure env
cp .env.example .env
# edit .env if you changed docker-compose ports/creds

# 4. Run migrations
npm run migrate

# 5. Start the dev server (auto-reloads)
npm run dev
```

Server runs on `http://localhost:4000` by default. Check `GET /health`.

## Try it

```bash
# Sign up a household
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "03001234567",
    "password": "test1234",
    "name": "Ayesha",
    "role": "household",
    "location": { "lat": 33.6844, "lng": 73.0479 }
  }'

# Sign up a collector
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "03009876543",
    "password": "test1234",
    "name": "Imran",
    "role": "collector",
    "location": { "lat": 33.6850, "lng": 73.0490 },
    "collector_profile": {
      "categories_bought": ["newspaper", "iron"],
      "service_radius_km": 5,
      "capacity_kg_per_day": 150
    }
  }'

# Use the returned token
curl http://localhost:4000/users/me -H "Authorization: Bearer <token>"
```

## What's implemented in Phase 1

- `src/services/matching.ts` — the actual scoring engine. Finds candidate collectors via a PostGIS
  `ST_DWithin` query against **each collector's own** `service_radius_km` (not a fixed global
  radius), filters to ones with category overlap, then scores by:
  `0.4 × categoryMatchRatio + 0.3 × proximity + 0.15 × weightValue + 0.15 × rating`
  See the top-level design doc §5 for the full rationale.
- `POST /listings` — household creates a listing (with one or more items). Runs the matching
  engine synchronously after the listing commits, and creates `matches` rows (status `notified`)
  for the top 3 scored collectors.
- `GET /listings/nearby` — collector's matched feed: their active `notified`/`viewed` matches,
  joined with listing items and household info.
- `GET /listings/:id` — shared detail view.
- `POST /matches/:id/accept` — **race-to-accept**: locks the row with `FOR UPDATE`, so if two
  collectors hit accept near-simultaneously, only the first succeeds; the second gets a 409 with
  a clear message. All other pending matches on that listing are marked `expired`.
- `POST /matches/:id/decline`.
- `PATCH /listings/:id/cancel` — household cancels their own open listing.

## Try the full matching flow

```bash
# Get tokens for a household and a collector from Phase 0's signup flow, then:

# Household posts a listing
curl -X POST http://localhost:4000/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <household_token>" \
  -d '{
    "location": { "lat": 33.6844, "lng": 73.0479 },
    "description": "Pickup anytime after 5pm",
    "items": [
      { "category": "newspaper", "estimated_weight_kg": 8 },
      { "category": "iron", "estimated_weight_kg": 5 }
    ]
  }'
# → { "listing": {...}, "matched_collectors": 1, "candidates_considered": 1 }

# Collector checks their feed
curl http://localhost:4000/listings/nearby -H "Authorization: Bearer <collector_token>"

# Collector accepts (use the match_id from the feed response above)
curl -X POST http://localhost:4000/matches/<match_id>/accept \
  -H "Authorization: Bearer <collector_token>"
```

## What's next (Phase 2)

- FCM push notification on match instead of poll-on-open
- Batch matching window (Hungarian algorithm) as an upgrade over the current greedy scored match
- Transaction logging (`POST /transactions` — actual weight/price on completed pickup)
- Ratings

See the top-level design doc for the full roadmap.
