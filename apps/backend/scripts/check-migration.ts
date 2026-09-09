import { sql } from "drizzle-orm";
import { db } from "../src/db/client.js";

async function main() {
  try {
    // Check if column exists
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'world_object' 
      AND column_name = 'boss_join_radius_m'
    `);

    if (result.rows.length > 0) {
      console.log("✅ Migration successful: boss_join_radius_m column exists");
    } else {
      console.log("❌ Migration pending: boss_join_radius_m column does NOT exist");
      console.log("Applying migration manually...");
      
      await db.execute(sql`
        ALTER TABLE world_object
          ADD COLUMN IF NOT EXISTS boss_join_radius_m integer NOT NULL DEFAULT 30
      `);
      
      console.log("✅ Migration applied successfully");
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

main();
