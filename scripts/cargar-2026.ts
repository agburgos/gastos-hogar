import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// Cargar .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
  console.error("Asegúrate de tener .env.local con estas variables");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

(async () => {
  try {
    console.log("📂 Cargando datos de 2026 del Excel...\n");

    // Obtener UUIDs de usuarios
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre");

    if (!usuarios || usuarios.length === 0) {
      console.error("❌ Error: No se encontraron usuarios. Crea Gloria Roa y Alberto Garrido en Supabase primero");
      process.exit(1);
    }

    const userMap = new Map(usuarios.map((u) => [u.nombre, u.id]));
    const gloriaId = userMap.get("Gloria Roa");
    const albertoId = userMap.get("Alberto Garrido");

    if (!gloriaId || !albertoId) {
      console.error("❌ Error: No se encontraron ambos usuarios (Gloria Roa, Alberto Garrido)");
      console.error("Usuarios encontrados:", Array.from(userMap.keys()).join(", "));
      process.exit(1);
    }

    console.log(`✓ Gloria: ${gloriaId}`);
    console.log(`✓ Alberto: ${albertoId}\n`);

    // Leer categorías
    const { data: categorias } = await supabase.from("categorias").select("id, nombre");
    const categoriaMap = new Map(
      categorias?.map((c) => [c.nombre.toLowerCase().trim(), c.id]) || []
    );

    // Categoría "Sin clasificar"
    const { data: sinClasificar } = await supabase
      .from("categorias")
      .select("id")
      .eq("nombre", "Sin clasificar")
      .single();

    if (!sinClasificar) {
      console.error("❌ Error: No se encontró categoría 'Sin clasificar'");
      process.exit(1);
    }

    const sinClasificarId = sinClasificar.id;

    // Leer Excel
    const excelPath = path.join(
      process.env.HOME || "/",
      "Downloads",
      "Planilla-de-Control-de-Gasto-Familiar-Garrido-Roa.xlsx"
    );

    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Error: No se encontró el archivo en ${excelPath}`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelPath);
    console.log(`📋 Hojas encontradas: ${workbook.SheetNames.length}`);

    // Filtrar solo hojas de 2026 (pueden ser "Enero 2026", "Detalle Enero 2026", etc)
    const detalleSheets = workbook.SheetNames.filter(
      (name) => name.includes("2026")
    );

    console.log(`📄 Hojas de 2026: ${detalleSheets.length}\n`);

    if (detalleSheets.length === 0) {
      console.warn("⚠️ No se encontraron hojas Detalle para 2026");
      process.exit(0);
    }

    let totalInsertados = 0;
    let totalRevisar = 0;
    const revisarPorMes = new Map<string, number>();
    const meses: Record<string, string> = {
      enero: "01", febrero: "02", marzo: "03", abril: "04",
      mayo: "05", junio: "06", julio: "07", agosto: "08",
      septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
    };

    // Procesar cada hoja
    for (const sheetName of detalleSheets) {
      console.log(`\n📋 ${sheetName}`);

      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

      // Extraer mes/año: "Detalle Julio 2026" → "07"
      const mesMatch = sheetName.match(/(\w+)\s+(2026)/i);
      if (!mesMatch) continue;

      const mesNombre = mesMatch[1];
      const mesNum = meses[mesNombre.toLowerCase()];
      if (!mesNum) continue;

      const gastos: any[] = [];

      // Parsear filas (columnas: Correlativo, Día, Descripción, Categoría, Monto, Responsable)
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const correlativo = row[0];
        let dia = row[1];
        const descripcion = row[2];
        const categoriaOriginal = row[3];
        const monto = row[4];
        const responsable = row[5];

        // Si no hay correlativo, fin de la tabla
        if (!correlativo) break;

        // Validar datos mínimos
        if (!dia || !monto) continue;

        // Parsear día
        let diaNum = 0;
        if (typeof dia === "number") {
          if (dia > 100) {
            const excelDate = new Date((dia - 25569) * 86400 * 1000);
            diaNum = excelDate.getDate();
          } else {
            diaNum = Math.floor(dia);
          }
        } else if (typeof dia === "string") {
          const match = String(dia).match(/^(\d+)/);
          if (match) diaNum = parseInt(match[1]);
        }

        // Validar día
        if (diaNum < 1 || diaNum > 31) continue;

        const diaStr = String(diaNum).padStart(2, "0");
        const fecha = `2026-${mesNum}-${diaStr}`;

        // Mapear responsable
        let responsableId = gloriaId;
        if (
          responsable &&
          (String(responsable).toLowerCase().includes("alberto") ||
            String(responsable).toLowerCase().includes("albert"))
        ) {
          responsableId = albertoId;
        }

        // Mapear categoría
        let categoriaId = sinClasificarId;
        let revisar = true;

        if (categoriaOriginal) {
          const catKey = String(categoriaOriginal).toLowerCase().trim();
          if (categoriaMap.has(catKey)) {
            categoriaId = categoriaMap.get(catKey)!;
            revisar = false;
          }
        }

        gastos.push({
          monto: parseFloat(monto),
          descripcion: descripcion ? String(descripcion).trim() : null,
          categoria_id: categoriaId,
          responsable_id: responsableId,
          fecha,
          compartido: true,
          revisar,
        });
      }

      // Insertar en lotes
      if (gastos.length > 0) {
        const loteSize = 100;
        for (let i = 0; i < gastos.length; i += loteSize) {
          const lote = gastos.slice(i, i + loteSize);
          const { error } = await supabase.from("gastos").insert(lote);

          if (error) {
            console.error(`  ❌ Error al insertar: ${error.message}`);
          } else {
            const revisarCount = lote.filter((g) => g.revisar).length;
            console.log(`  ✓ Insertados: ${lote.length} gastos (${revisarCount} para revisar)`);
            totalInsertados += lote.length;
            totalRevisar += revisarCount;
            revisarPorMes.set(mesNombre, (revisarPorMes.get(mesNombre) || 0) + revisarCount);
          }
        }
      } else {
        console.log(`  ⚠️ Sin gastos en esta hoja`);
      }
    }

    // Resumen
    console.log("\n" + "=".repeat(50));
    console.log("✅ CARGA COMPLETADA");
    console.log("=".repeat(50));
    console.log(`Total insertados: ${totalInsertados}`);
    console.log(`Total para revisar: ${totalRevisar}`);

    if (revisarPorMes.size > 0) {
      console.log("\nPor mes:");
      for (const [mes, count] of revisarPorMes) {
        console.log(`  ${mes} 2026: ${count} gastos sin categoría`);
      }
    }

    console.log("\n✨ Los datos de 2026 han sido cargados.");
    console.log("🔍 Ve a /revisar en la app para clasificar los gastos sin categoría.");
  } catch (err) {
    console.error("❌ Error inesperado:", err);
    process.exit(1);
  }
})();
