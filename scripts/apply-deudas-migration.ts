import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

(async () => {
  const migrationPath = path.join(process.cwd(), "supabase", "migration_deudas.sql");
  const sql = fs.readFileSync(migrationPath, "utf-8");

  // Split by semicolon and execute each statement
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Executing ${statements.length} statements...\n`);

  for (const stmt of statements) {
    const { error } = await supabase.rpc("exec", { sql: stmt });
    if (error) {
      console.log(`⚠ Statement: ${stmt.slice(0, 50)}...`);
      console.log(`  Error: ${error.message}`);
    } else {
      console.log(`✓ ${stmt.slice(0, 70)}...`);
    }
  }

  console.log("\n✓ Migration completed");
})().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
