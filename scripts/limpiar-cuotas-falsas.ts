import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) process.env[key.trim()] = value.trim();
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Faltan variables de entorno");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  const { data: aBorrar, error: errQuery } = await supabase
    .from("gastos")
    .select("id, monto, descripcion, fecha, responsable_id")
    .like("descripcion", "Cuota:%");

  if (errQuery) {
    console.error("❌ Error al consultar:", errQuery.message);
    process.exit(1);
  }

  if (!aBorrar || aBorrar.length === 0) {
    console.log("✨ No hay gastos 'Cuota: ...' para borrar.");
    process.exit(0);
  }

  console.log(`📋 Se encontraron ${aBorrar.length} gastos falsos:\n`);
  let total = 0;
  aBorrar.forEach((g) => {
    console.log(`  - ${g.descripcion} | ${g.fecha} | $${g.monto.toLocaleString("es-CL")}`);
    total += g.monto;
  });
  console.log(`\n💰 Total a eliminar: $${total.toLocaleString("es-CL")}`);

  const { error: errDelete } = await supabase
    .from("gastos")
    .delete()
    .like("descripcion", "Cuota:%");

  if (errDelete) {
    console.error("❌ Error al borrar:", errDelete.message);
    process.exit(1);
  }

  console.log(`\n✅ ${aBorrar.length} gastos falsos eliminados correctamente.`);
})();
