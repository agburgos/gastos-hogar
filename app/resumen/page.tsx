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

export default function ResumenPage() {
  const [datos, setDatos] = useState<GastoMacro[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(ymdLocal(new Date()).slice(0, 7));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const mesInicio = `${mesSeleccionado}-01`;
      const mesProximo = new Date(parseInt(mesSeleccionado.slice(0, 4)), parseInt(mesSeleccionado.slice(5, 7)), 1);
      mesProximo.setMonth(mesProximo.getMonth() + 1);
      const mesFinStr = ymdLocal(mesProximo).slice(0, 7);

      const { data } = await supabase
        .from("gasto_macro_mensual")
        .select("macro, mes, total_gastado")
        .gte("mes", mesInicio)
        .lt("mes", `${mesFinStr}-01`)
        .order("macro");

      setDatos(data || []);
      setLoading(false);
    };

    fetch();
  }, [mesSeleccionado]);

  const agrupadoPorMacro = Array.from(
    new Map(datos.map((d) => [d.macro, d.total_gastado])).entries()
  ).map(([macro, total]) => ({ macro, total }));

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
    </div>
  );
}
