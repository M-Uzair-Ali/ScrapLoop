import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool";
import { AuthTokenPayload } from "../types";

const router = Router();

const signupSchema = z.object({
  phone_number: z.string().min(7).max(20),
  password: z.string().min(6),
  name: z.string().min(1).max(120),
  role: z.enum(["household", "collector"]),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  // only used when role === 'collector'
  collector_profile: z
    .object({
      categories_bought: z.array(z.string()).default([]),
      service_radius_km: z.number().positive().default(3),
      capacity_kg_per_day: z.number().positive().default(100),
      vehicle_type: z.string().optional(),
    })
    .optional(),
});

function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: process.env.JWT_EXPIRES_IN || "30d",
  } as jwt.SignOptions);
}

router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  const { phone_number, password, name, role, location, collector_profile } = parsed.data;

  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT id FROM users WHERE phone_number = $1", [
      phone_number,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "An account with this phone number already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (phone_number, password_hash, name, role, location)
       VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography)
       RETURNING id, phone_number, name, role, created_at`,
      [phone_number, passwordHash, name, role, location.lng, location.lat]
    );
    const user = userResult.rows[0];

    if (role === "collector") {
      const cp = collector_profile ?? {
        categories_bought: [],
        service_radius_km: 3,
        capacity_kg_per_day: 100,
      };
      await client.query(
        `INSERT INTO collector_profiles
           (user_id, categories_bought, service_radius_km, capacity_kg_per_day, vehicle_type)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user.id,
          cp.categories_bought,
          cp.service_radius_km,
          cp.capacity_kg_per_day,
          cp.vehicle_type ?? null,
        ]
      );
    }

    await client.query("COMMIT");

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ token, user });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to create account" });
  } finally {
    client.release();
  }
});

const loginSchema = z.object({
  phone_number: z.string(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }
  const { phone_number, password } = parsed.data;

  const result = await pool.query(
    "SELECT id, phone_number, password_hash, name, role FROM users WHERE phone_number = $1",
    [phone_number]
  );
  const user = result.rows[0];
  if (!user) {
    return res.status(401).json({ error: "Invalid phone number or password" });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid phone number or password" });
  }

  const token = signToken({ userId: user.id, role: user.role });
  delete user.password_hash;
  res.json({ token, user });
});

export default router;
