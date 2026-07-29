"use client";

import { useEffect, useState } from "react";
import { Card, Empty } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface GastoMacro {
  macro: string;
  mes: string;
  total_gastado: number;
}

interface CuotaGasto {
  id: string;
  descripcion: string | null;
  monto: number;
  cuota_numero: number | null;
  cuota_total: number | null;
  responsable_nombre: string;
}

export default function ResumenPage() {
  const [datos, setDatos] = useState<GastoMacro[]>([]);
  const [cuotas, setCuotas] = useState<CuotaGasto[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(ymdLocal(new Date()).slice(0, 7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // Ojo: el mes del selector viene 1-based ("2026-07"); el constructor de Date
      // espera 0-based, así que hay que restar 1 o la ventana se corre un mes.
      const [añoSel, mesSel] = mesSeleccionado.split("-").map(Number);
      const mesInicio = ymdLocal(new Date(añoSel, mesSel - 1, 1));
      const mesFin = ymdLocal(new Date(añoSel, mesSel, 1));

      const { data } = await supabase
        .from("gasto_macro_mensual")
        .select("macro, mes, total_gastado")
        .gte("mes", mesInicio)
        .lt("mes", mesFin)
        .order("macro");

      setDatos(data || []);

      // Gastos en cuotas del mes (para listarlos con su X/Y)
      const { data: usuariosData } = await supabase.from("usuarios").select("id, nombre");
      const nombrePorId = new Map((usuariosData || []).map((u: any) => [u.id, u.nombre]));

      const { data: cuotasData } = await supabase
        .from("gastos")
        .select("id, descripcion, monto, cuota_numero, cuota_total, responsable_id")
        .gte("fecha", mesInicio)
        .lt("fecha", mesFin)
        .gt("cuota_total", 1)
        .order("descripcion");

      setCuotas(
        (cuotasData || []).map((g: any) => ({
          id: g.id,
          descripcion: g.descripcion,
          monto: g.monto,
          cuota_numero: g.cuota_numero,
          cuota_total: g.cuota_total,
          responsable_nombre: nombrePorId.get(g.responsable_id) || "Desconocido",
        }))
      );
      setLoading(false);
    };

    fetch();
  }, [mesSeleccionado]);

  // Sumar por macro: si la vista devuelve más de una fila con el mismo nombre
  // (varios meses, o dos macros homónimas) no se puede sobrescribir, hay que acumular.
  const totalesPorMacro = new Map<string, number>();
  datos.forEach((d) => {
    totalesPorMacro.set(d.macro, (totalesPorMacro.get(d.macro) || 0) + d.total_gastado);
  });
  const agrupadoPorMacro = Array.from(totalesPorMacro.entries()).map(([macro, total]) => ({
    macro,
    total,
  }));

  const total = agrupadoPorMacro.reduce((sum, d) => sum + d.total, 0);

  return (
    <div className="space-y-3">
      <Card title="Mes">
        <input
          type="month"
          value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2"
        />
      </Card>

      {loading ? (
        <Card>
          <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
        </Card>
      ) : agrupadoPorMacro.length === 0 ? (
        <Empty text="Sin gastos en este mes" />
      ) : (
        <Card title="Gastos por Categoría">
          <div className="space-y-2 text-[14px]">
            {agrupadoPorMacro.map((d) => (
              <div key={d.macro} className="flex justify-between">
                <span>{d.macro}</span>
                <span className="font-bold">{fmt(d.total)}</span>
              </div>
            ))}
            <div className="h-px bg-[var(--border)] my-2" />
            <div className="flex justify-between font-bold">
              <span>Total:</span>
              <span>{fmt(total)}</span>
            </div>
          </div>
        </Card>
      )}

      {!loading && cuotas.length > 0 && (
        <Card title="Gastos en cuotas">
          <div className="space-y-2 text-[14px]">
            {cuotas.map((c) => (
              <div key={c.id} className="flex justify-between items-center gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate">{c.descripcion || "Sin título"}</span>
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-[var(--teal-bg)] text-[var(--teal)] font-semibold text-[11px]">
                      cuota {c.cuota_numero}/{c.cuota_total}
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--mid)]">{c.responsable_nombre}</div>
                </div>
                <span className="font-bold shrink-0">{fmt(c.monto)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
