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
  console.error("❌ Error: Variables de entorno no encontradas");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  try {
    console.log("📂 Cargando datos de 2026...\n");

    // Usuarios
    const { data: usuarios } = await supabase.from("usuarios").select("id, nombre");
    const userMap = new Map(usuarios?.map((u: any) => [u.nombre, u.id]) || []);
    const gloriaId = userMap.get("Gloria Roa");
    const albertoId = userMap.get("Alberto Garrido");

    if (!gloriaId || !albertoId) {
      console.error("❌ Usuarios no encontrados");
      process.exit(1);
    }

    // Categorías
    const { data: categorias } = await supabase.from("categorias").select("id, nombre");
    const categoriaMap = new Map(
      categorias?.map((c: any) => [c.nombre.toLowerCase().trim(), c.id]) || []
    );

    const { data: sinClasificar } = await supabase
      .from("categorias")
      .select("id")
      .eq("nombre", "Sin clasificar")
      .single();

    const sinClasificarId = sinClasificar?.id;

    // Excel
    const excelPath = path.join(
      process.env.HOME || "/",
      "Downloads",
      "Planilla-de-Control-de-Gasto-Familiar-Garrido-Roa.xlsx"
    );

    if (!fs.existsSync(excelPath)) {
      console.error(`❌ Excel no encontrado: ${excelPath}`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelPath);
    const meses2026 = ["Enero 2026", "Febrero 2026", "Marzo 2026", "Abril 2026", "Mayo 2026", "Junio 2026"];
    const mesNumMap: Record<string, string> = {
      enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
      julio: "07", agosto: "08", septiembre: "09", octubre: "10", noviembre: "11", diciembre: "12",
    };

    let totalInsertados = 0;
    let totalRevisar = 0;

    for (const mesNombre of meses2026) {
      const sheet = workbook.Sheets[mesNombre];
      if (!sheet) continue;

      console.log(`\n📋 ${mesNombre}`);

      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];
      const gastos: any[] = [];

      // Headers en fila 0: Correlativo, Día, Descripción, Categoría, Monto, Responsable
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 6) continue;

        const correlativo = row[0];
        const dia = row[1];
        const descripcion = row[2];
        const categoriaOriginal = row[3];
        const monto = row[4];
        const responsable = row[5];

        // Fin de tabla
        if (!correlativo || correlativo.toString().toLowerCase() === "total") break;
        if (!dia || !monto) continue;

        // Parsear día
        let diaNum = 0;
        if (typeof dia === "number") {
          diaNum = Math.floor(dia);
        } else if (typeof dia === "string") {
          const match = dia.match(/^(\d+)/);
          if (match) diaNum = parseInt(match[1]);
        }

        if (diaNum < 1 || diaNum > 31) continue;

        // Extraer mes del nombre de la hoja
        const mesMatch = mesNombre.match(/(\w+)\s+2026/i);
        if (!mesMatch) continue;

        const mesNum = mesNumMap[mesMatch[1].toLowerCase()] || "01";
        const diaStr = String(diaNum).padStart(2, "0");
        const fecha = `2026-${mesNum}-${diaStr}`;

        // Responsable
        let responsableId = gloriaId;
        if (
          responsable &&
          (String(responsable).toLowerCase().includes("alberto") ||
            String(responsable).toLowerCase().includes("albert"))
        ) {
          responsableId = albertoId;
        }

        // Categoría
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
          monto: parseFloat(String(monto).replace(/[^\d.]/g, "")),
          descripcion: descripcion ? String(descripcion).trim() : "Sin descripción",
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

          if (!error) {
            const revisarCount = lote.filter((g) => g.revisar).length;
            console.log(`  ✓ ${lote.length} gastos (${revisarCount} para revisar)`);
            totalInsertados += lote.length;
            totalRevisar += revisarCount;
          } else {
            console.error(`  ❌ ${error.message}`);
          }
        }
      }
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ CARGA COMPLETADA");
    console.log("=".repeat(50));
    console.log(`Total insertados: ${totalInsertados}`);
    console.log(`Total para revisar: ${totalRevisar}`);
    console.log("\n✨ Los datos de 2026 han sido cargados.");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
})();
