import { Router } from "express";
import { pool } from "../db/pool";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const userId = req.auth!.userId;

  const userResult = await pool.query(
    `SELECT id, phone_number, name, role, rating_avg, rating_count, created_at,
            ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
     FROM users WHERE id = $1`,
    [userId]
  );
  const user = userResult.rows[0];
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.role === "collector") {
    const profileResult = await pool.query(
      "SELECT * FROM collector_profiles WHERE user_id = $1",
      [userId]
    );
    user.collector_profile = profileResult.rows[0] ?? null;
  }

  res.json({ user });
});

export default router;
