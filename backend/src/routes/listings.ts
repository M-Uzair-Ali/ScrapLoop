import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";
import { findAndScoreCandidates, NOTIFY_TOP_N } from "../services/matching";

const router = Router();

// Postgres returns NUMERIC columns as strings (to avoid float precision loss on the wire).
// Every route that sends listing_items back to the client must run rows through this,
// or arithmetic like `.reduce((sum, i) => sum + i.estimated_weight_kg, 0)` on the client
// silently does string concatenation (0 + "5.00" === "05.00") instead of addition.
function normalizeItemRow<T extends { estimated_weight_kg: unknown }>(
  row: T
): T & { estimated_weight_kg: number } {
  return { ...row, estimated_weight_kg: Number(row.estimated_weight_kg) };
}

const SCRAP_CATEGORIES = [
  "newspaper", "cardboard", "mixed_paper", "iron", "steel", "aluminum",
  "copper", "plastic_bottles", "mixed_plastic", "glass", "e_waste", "other",
] as const;

const createListingSchema = z.object({
  description: z.string().max(1000).optional(),
  photo_urls: z.array(z.string()).default([]),
  pickup_window_start: z.string().datetime().optional(),
  pickup_window_end: z.string().datetime().optional(),
  location: z.object({ lat: z.number(), lng: z.number() }),
  items: z
    .array(
      z.object({
        category: z.enum(SCRAP_CATEGORIES),
        estimated_weight_kg: z.number().positive(),
        notes: z.string().max(300).optional(),
      })
    )
    .min(1, "At least one item is required"),
});

// POST /listings — household creates a listing; runs the matching engine synchronously
// and notifies (creates match rows for) the top-N scored collectors.
router.post("/", requireAuth, requireRole("household"), async (req, res) => {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { description, photo_urls, pickup_window_start, pickup_window_end, location, items } =
    parsed.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const listingResult = await client.query(
      `INSERT INTO listings
         (household_id, description, photo_urls, pickup_window_start, pickup_window_end, location)
       VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint($6, $7), 4326)::geography)
       RETURNING id, created_at`,
      [
        req.auth!.userId,
        description ?? null,
        photo_urls,
        pickup_window_start ?? null,
        pickup_window_end ?? null,
        location.lng,
        location.lat,
      ]
    );
    const listing = listingResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO listing_items (listing_id, category, estimated_weight_kg, notes)
         VALUES ($1, $2, $3, $4)`,
        [listing.id, item.category, item.estimated_weight_kg, item.notes ?? null]
      );
    }

    await client.query("COMMIT");

    const totalWeightKg = items.reduce((sum, i) => sum + i.estimated_weight_kg, 0);
    const candidates = await findAndScoreCandidates({
      id: listing.id,
      lat: location.lat,
      lng: location.lng,
      categories: items.map((i) => i.category),
      totalWeightKg,
    });

    const topCandidates = candidates.slice(0, NOTIFY_TOP_N);
    for (const candidate of topCandidates) {
      await pool.query(
        `INSERT INTO matches (listing_id, collector_id, score, status)
         VALUES ($1, $2, $3, 'notified')
         ON CONFLICT (listing_id, collector_id) DO NOTHING`,
        [listing.id, candidate.collectorId, candidate.score]
      );
    }

    if (topCandidates.length > 0) {
      await pool.query(`UPDATE listings SET status = 'matched' WHERE id = $1`, [listing.id]);
    }

    res.status(201).json({
      listing: { id: listing.id, created_at: listing.created_at },
      matched_collectors: topCandidates.length,
      candidates_considered: candidates.length,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to create listing" });
  } finally {
    client.release();
  }
});

// GET /listings/nearby — collector's matched feed
router.get("/nearby", requireAuth, requireRole("collector"), async (req, res) => {
  const { rows: matchRows } = await pool.query(
    `SELECT m.id AS match_id, m.listing_id, m.score, m.status AS match_status, m.notified_at,
            l.description, l.photo_urls, l.pickup_window_start, l.pickup_window_end,
            l.status AS listing_status,
            ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
            hu.name AS household_name, hu.rating_avg AS household_rating
     FROM matches m
     JOIN listings l ON l.id = m.listing_id
     JOIN users hu ON hu.id = l.household_id
     WHERE m.collector_id = $1
       AND m.status IN ('notified', 'viewed')
       AND l.status IN ('open', 'matched')
     ORDER BY m.notified_at DESC`,
    [req.auth!.userId]
  );

  if (matchRows.length === 0) {
    return res.json({ matches: [] });
  }

  const listingIds = matchRows.map((r) => r.listing_id);
  const { rows: itemRows } = await pool.query(
    `SELECT listing_id, category, estimated_weight_kg, notes
     FROM listing_items WHERE listing_id = ANY($1::uuid[])`,
    [listingIds]
  );

  const itemsByListing: Record<string, ReturnType<typeof normalizeItemRow>[]> = {};
  for (const item of itemRows) {
    (itemsByListing[item.listing_id] ??= []).push(normalizeItemRow(item));
  }

  const matches = matchRows.map((m) => ({
    match_id: m.match_id,
    listing_id: m.listing_id,
    score: Number(m.score),
    match_status: m.match_status,
    notified_at: m.notified_at,
    listing_status: m.listing_status,
    description: m.description,
    photo_urls: m.photo_urls,
    pickup_window_start: m.pickup_window_start,
    pickup_window_end: m.pickup_window_end,
    location: { lat: Number(m.lat), lng: Number(m.lng) },
    household: { name: m.household_name, rating_avg: Number(m.household_rating) },
    items: itemsByListing[m.listing_id] ?? [],
  }));

  res.json({ matches });
});

// GET /listings/mine — household's own listings, most recent first, with item breakdown
// and how many collectors were notified/still pending for each (useful for "where does
// this stand" without a separate call per listing).
router.get("/mine", requireAuth, requireRole("household"), async (req, res) => {
  const { rows: listingRows } = await pool.query(
    `SELECT id, description, photo_urls, status, created_at
     FROM listings
     WHERE household_id = $1
     ORDER BY created_at DESC`,
    [req.auth!.userId]
  );

  if (listingRows.length === 0) {
    return res.json({ listings: [] });
  }

  const listingIds = listingRows.map((r) => r.id);

  const { rows: itemRows } = await pool.query(
    `SELECT listing_id, category, estimated_weight_kg, notes
     FROM listing_items WHERE listing_id = ANY($1::uuid[])`,
    [listingIds]
  );
  const itemsByListing: Record<string, ReturnType<typeof normalizeItemRow>[]> = {};
  for (const item of itemRows) {
    (itemsByListing[item.listing_id] ??= []).push(normalizeItemRow(item));
  }

  const { rows: matchCountRows } = await pool.query(
    `SELECT listing_id,
            COUNT(*) FILTER (WHERE status IN ('notified', 'viewed')) AS pending_count,
            COUNT(*) AS total_notified
     FROM matches
     WHERE listing_id = ANY($1::uuid[])
     GROUP BY listing_id`,
    [listingIds]
  );
  const matchCountsByListing: Record<string, { pending: number; total: number }> = {};
  for (const row of matchCountRows) {
    matchCountsByListing[row.listing_id] = {
      pending: Number(row.pending_count),
      total: Number(row.total_notified),
    };
  }

  const listings = listingRows.map((l) => ({
    id: l.id,
    description: l.description,
    photo_urls: l.photo_urls,
    status: l.status,
    created_at: l.created_at,
    items: itemsByListing[l.id] ?? [],
    pending_collectors: matchCountsByListing[l.id]?.pending ?? 0,
    total_notified: matchCountsByListing[l.id]?.total ?? 0,
  }));

  res.json({ listings });
});

// GET /listings/accepted — collector's own accepted pickups (their "jobs"),
// most recently accepted first.
router.get("/accepted", requireAuth, requireRole("collector"), async (req, res) => {
  const { rows: matchRows } = await pool.query(
    `SELECT m.id AS match_id, m.listing_id, m.responded_at,
            l.description, l.photo_urls, l.status AS listing_status, l.created_at,
            hu.name AS household_name, hu.rating_avg AS household_rating
     FROM matches m
     JOIN listings l ON l.id = m.listing_id
     JOIN users hu ON hu.id = l.household_id
     WHERE m.collector_id = $1 AND m.status = 'accepted'
     ORDER BY m.responded_at DESC`,
    [req.auth!.userId]
  );

  if (matchRows.length === 0) {
    return res.json({ accepted: [] });
  }

  const listingIds = matchRows.map((r) => r.listing_id);
  const { rows: itemRows } = await pool.query(
    `SELECT listing_id, category, estimated_weight_kg, notes
     FROM listing_items WHERE listing_id = ANY($1::uuid[])`,
    [listingIds]
  );

  const itemsByListing: Record<string, ReturnType<typeof normalizeItemRow>[]> = {};
  for (const item of itemRows) {
    (itemsByListing[item.listing_id] ??= []).push(normalizeItemRow(item));
  }

  const accepted = matchRows.map((m) => ({
    match_id: m.match_id,
    listing_id: m.listing_id,
    listing_status: m.listing_status,
    responded_at: m.responded_at,
    description: m.description,
    photo_urls: m.photo_urls,
    household: { name: m.household_name, rating_avg: Number(m.household_rating) },
    items: itemsByListing[m.listing_id] ?? [],
  }));

  res.json({ accepted });
});

// GET /listings/:id — shared detail view
router.get("/:id", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.id, l.description, l.photo_urls, l.pickup_window_start, l.pickup_window_end,
            l.status, l.created_at,
            ST_Y(l.location::geometry) AS lat, ST_X(l.location::geometry) AS lng,
            hu.id AS household_id, hu.name AS household_name, hu.rating_avg AS household_rating
     FROM listings l
     JOIN users hu ON hu.id = l.household_id
     WHERE l.id = $1`,
    [req.params.id]
  );
  const listing = rows[0];
  if (!listing) return res.status(404).json({ error: "Listing not found" });

  const { rows: rawItems } = await pool.query(
    `SELECT category, estimated_weight_kg, notes FROM listing_items WHERE listing_id = $1`,
    [req.params.id]
  );
  const items = rawItems.map(normalizeItemRow);

  res.json({
    listing: {
      id: listing.id,
      description: listing.description,
      photo_urls: listing.photo_urls,
      pickup_window_start: listing.pickup_window_start,
      pickup_window_end: listing.pickup_window_end,
      status: listing.status,
      created_at: listing.created_at,
      location: { lat: Number(listing.lat), lng: Number(listing.lng) },
      household: {
        id: listing.household_id,
        name: listing.household_name,
        rating_avg: Number(listing.household_rating),
      },
      items,
    },
  });
});

// PATCH /listings/:id/cancel — household cancels their own open listing
router.patch("/:id/cancel", requireAuth, requireRole("household"), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE listings SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND household_id = $2 AND status IN ('open', 'matched')
     RETURNING id`,
    [req.params.id, req.auth!.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Listing not found, not yours, or already finalized" });
  }
  res.json({ ok: true });
});

export default router;
