import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos");
  console.error("Asegúrate de tener .env.local con estas variables");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

(async () => {
  // Obtener UUIDs de usuarios
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nombre")
    .in("nombre", ["Gloria Roa", "Alberto Garrido"]);

  if (!usuarios || usuarios.length !== 2) {
    console.error("Error: No se encontraron ambos usuarios");
    process.exit(1);
  }

  const userMap = new Map(usuarios.map((u) => [u.nombre, u.id]));
  const gloriaId = userMap.get("Gloria Roa")!;
  const albertoId = userMap.get("Alberto Garrido")!;

  console.log(`Gloria: ${gloriaId}`);
  console.log(`Alberto: ${albertoId}`);

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
    console.error("Error: No se encontró categoría 'Sin clasificar'");
    process.exit(1);
  }

  const sinClasificarId = sinClasificar.id;

  // Leer Excel
  const excelPath = path.join(process.env.HOME || "/", "Downloads", "Planilla-de-Control-de-Gasto-Familiar-Garrido-Roa.xlsx");

  if (!fs.existsSync(excelPath)) {
    console.error(`Error: No se encontró ${excelPath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(excelPath);
  console.log(`\nHojas encontradas: ${workbook.SheetNames.length}`);

  const detalleSheets = workbook.SheetNames.filter(
    (name) => name.startsWith("Detalle") || name.match(/Detalle\s+\w+/i)
  );

  console.log(`Hojas "Detalle": ${detalleSheets.length}`);

  let totalInsertados = 0;
  let totalRevisar = 0;
  const revisarPorMes = new Map<string, number>();

  // Procesar cada hoja
  for (const sheetName of detalleSheets) {
    console.log(`\nProcesando: ${sheetName}`);

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[];

    // Extraer mes/año del nombre de la hoja o de una celda
    // Ej: "Detalle Agosto 2022"
    const mesMatch = sheetName.match(/(\w+)\s+(\d{4})/i);
    if (!mesMatch) {
      console.log("  ⚠ No se pudo extraer mes/año del nombre de la hoja");
      continue;
    }

    const mesNombre = mesMatch[1];
    const año = mesMatch[2];
    const meses: Record<string, string> = {
      enero: "01",
      febrero: "02",
      marzo: "03",
      abril: "04",
      mayo: "05",
      junio: "06",
      julio: "07",
      agosto: "08",
      septiembre: "09",
      octubre: "10",
      noviembre: "11",
      diciembre: "12",
    };

    const mesNum = meses[mesNombre.toLowerCase()];
    if (!mesNum) {
      console.log(`  ⚠ Mes no reconocido: ${mesNombre}`);
      continue;
    }

    // Parsear filas (columnas: Correlativo, Día, Descripción, Categoría, Monto, Responsable)
    const gastos: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const correlativo = row[0];
      const dia = row[1];
      const descripcion = row[2];
      const categoriaOriginal = row[3];
      const monto = row[4];
      const responsable = row[5];

      // Si no hay correlativo, fin de la tabla
      if (!correlativo) break;

      // Validar datos
      if (!dia || !monto) continue;

      const diaStr = String(dia).padStart(2, "0");
      const fecha = `${año}-${mesNum}-${diaStr}`;

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
        descripcion: descripcion ? String(descripcion) : null,
        categoria_id: categoriaId,
        responsable_id: responsableId,
        fecha,
        compartido: true,
        revisar,
      });

      if (revisar) {
        const mesKey = `${año}-${mesNum}`;
        revisarPorMes.set(mesKey, (revisarPorMes.get(mesKey) || 0) + 1);
      }
    }

    console.log(`  ${gastos.length} gastos encontrados`);

    // Insertar en lotes de 500
    for (let i = 0; i < gastos.length; i += 500) {
      const batch = gastos.slice(i, i + 500);
      const { error } = await supabase.from("gastos").insert(batch);

      if (error) {
        console.error(`  ✗ Error en lote ${i / 500 + 1}:`, error.message);
      } else {
        totalInsertados += batch.length;
        totalRevisar += batch.filter((g) => g.revisar).length;
        console.log(`  ✓ Insertados: ${batch.length}`);
      }
    }
  }

  console.log("\n=== RESUMEN ===");
  console.log(`Total de gastos importados: ${totalInsertados}`);
  console.log(`Gastos por clasificar: ${totalRevisar}`);

  if (revisarPorMes.size > 0) {
    console.log("\nDetalle por mes:");
    Array.from(revisarPorMes.entries())
      .sort()
      .forEach(([mes, count]) => {
        console.log(`  ${mes}: ${count}`);
      });
  }

  console.log("\n✓ Migración completada. Revisa los gastos en app/revisar");
})().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
