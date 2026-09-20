import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// POST /matches/:id/accept — race-to-accept: first collector to accept locks the listing;
// all other pending matches for that listing are marked expired.
router.post("/:id/accept", requireAuth, requireRole("collector"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: matchRows } = await client.query(
      `SELECT m.id, m.listing_id, m.status, l.status AS listing_status
       FROM matches m
       JOIN listings l ON l.id = m.listing_id
       WHERE m.id = $1 AND m.collector_id = $2
       FOR UPDATE`,
      [req.params.id, req.auth!.userId]
    );
    const match = matchRows[0];

    if (!match) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Match not found" });
    }
    if (match.listing_status === "accepted" || match.listing_status === "completed") {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "This listing has already been accepted by another collector" });
    }
    if (match.status !== "notified" && match.status !== "viewed") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This match is no longer available" });
    }

    await client.query(
      `UPDATE matches SET status = 'accepted', responded_at = now() WHERE id = $1`,
      [match.id]
    );
    await client.query(
      `UPDATE matches SET status = 'expired', responded_at = now()
       WHERE listing_id = $1 AND id != $2 AND status IN ('notified', 'viewed')`,
      [match.listing_id, match.id]
    );
    await client.query(
      `UPDATE listings SET status = 'accepted', updated_at = now() WHERE id = $1`,
      [match.listing_id]
    );

    await client.query("COMMIT");
    res.json({ ok: true, listing_id: match.listing_id });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to accept match" });
  } finally {
    client.release();
  }
});

// POST /matches/:id/decline
router.post("/:id/decline", requireAuth, requireRole("collector"), async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE matches SET status = 'declined', responded_at = now()
     WHERE id = $1 AND collector_id = $2 AND status IN ('notified', 'viewed')
     RETURNING id`,
    [req.params.id, req.auth!.userId]
  );
  if (rows.length === 0) {
    return res.status(404).json({ error: "Match not found or already responded to" });
  }
  res.json({ ok: true });
});

export default router;
