import fs from "fs";
import path from "path";
import { pool } from "./pool";

/**
 * Very small migration runner: creates a migrations_log table,
 * then runs any .sql file in ./migrations not already logged, in filename order.
 * Good enough for a project this size — swap for node-pg-migrate / Prisma later if desired.
 */
async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations_log (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    const dir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        "SELECT 1 FROM migrations_log WHERE filename = $1",
        [file]
      );
      if (rows.length > 0) {
        console.log(`skip (already applied): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(dir, file), "utf-8");
      console.log(`applying: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO migrations_log (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log(`  ✓ applied ${file}`);
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("Migrations complete.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
