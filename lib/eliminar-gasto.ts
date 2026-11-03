import { supabase } from "@/lib/supabase";
import { ymdLocal } from "@/lib/format";

// Elimina un gasto. Si era recurrente, además corta la cadena: las copias automáticas
// (generarRecurrentes) se crean a partir del mes anterior, así que si el mes anterior
// sigue marcado como recurrente la fila reaparece al recargar. Desmarcamos solo la
// bandera del gemelo del mes anterior (misma descripción y responsable); no se borra nada.
export async function eliminarGasto(id: string): Promise<{ ok: boolean; error?: string }> {
  const { data: fila, error: eSel } = await supabase
    .from("gastos")
    .select("descripcion, responsable_id, fecha, recurrente")
    .eq("id", id)
    .single();
  if (eSel || !fila) return { ok: false, error: "No se encontró el gasto: " + (eSel?.message ?? "") };

  const { data, error } = await supabase.from("gastos").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: "Error al eliminar: " + error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "No se pudo eliminar: la base de datos no permite borrar este gasto (permisos)." };
  }

  if (fila.recurrente) {
    const [a, m] = (fila.fecha as string).split("-").map(Number);
    const mesActual = ymdLocal(new Date(a, m - 1, 1));
    const mesAnterior = ymdLocal(new Date(a, m - 2, 1));
    await supabase
      .from("gastos")
      .update({ recurrente: false })
      .eq("recurrente", true)
      .eq("responsable_id", fila.responsable_id)
      .eq("descripcion", fila.descripcion)
      .gte("fecha", mesAnterior)
      .lt("fecha", mesActual);
  }

  return { ok: true };
}
