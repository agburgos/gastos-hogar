"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ProgressBar, Badge, Btn } from "@/components/ui";
import { fmt } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface MacroData {
  id: string;
  nombre: string;
  pct_objetivo: number;
  total_gastado: number;
}

export default function DashboardPage() {
  const [macros, setMacros] = useState<MacroData[]>([]);
  const [ingreso, setIngreso] = useState<number>(0);
  const [balance, setBalance] = useState<{ gloria: number; alberto: number } | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // traer macrocategorías con gastos de este mes
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data: macroData, error: macroErr } = await supabase
        .from("categorias_macro")
        .select("id, nombre, pct_objetivo")
        .neq("nombre", "Sin Clasificar")
        .order("orden", { ascending: true });

      if (macroErr) {
        console.error(macroErr);
        setPending(false);
        return;
      }

      // traer gasto_macro_mensual para el mes actual
      const { data: gastos, error: gastosErr } = await supabase
        .from("gasto_macro_mensual")
        .select("macro_id, total_gastado")
        .gte("mes", mesInicio.toISOString().slice(0, 10));

      if (gastosErr) {
        console.error(gastosErr);
        setPending(false);
        return;
      }

      const gastoMap = new Map(gastos?.map((g: any) => [g.macro_id, g.total_gastado]) || []);
      const enriched = macroData.map((m: any) => ({
        ...m,
        total_gastado: gastoMap.get(m.id) || 0,
      }));
      setMacros(enriched);

      // traer ingreso mensual vigente
      const { data: ingresoData } = await supabase
        .from("ingreso_mensual")
        .select("monto")
        .lte("vigente_desde", mesInicio.toISOString().slice(0, 10))
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .single();

      if (ingresoData) setIngreso(ingresoData.monto);

      // traer balance
      const { data: balanceData } = await supabase
        .from("balance_mensual")
        .select("pagado_gloria, pagado_alberto")
        .gte("mes", mesInicio.toISOString().slice(0, 10))
        .single();

      if (balanceData) {
        setBalance({
          gloria: balanceData.pagado_gloria || 0,
          alberto: balanceData.pagado_alberto || 0,
        });
      }

      setPending(false);
    };

    fetch();
  }, []);

  if (pending) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  const totalGasto = macros.reduce((sum, m) => sum + m.total_gastado, 0);
  const pctUsado = ingreso > 0 ? (totalGasto / ingreso) * 100 : 0;

  return (
    <div className="space-y-3">
      {/* Resumen de balance */}
      {balance && (
        <Card title="Balance">
          <div className="space-y-2 text-[14px]">
            <div className="flex justify-between">
              <span>Gloria:</span>
              <span className="font-bold">{fmt(balance.gloria)}</span>
            </div>
            <div className="flex justify-between">
              <span>Alberto:</span>
              <span className="font-bold">{fmt(balance.alberto)}</span>
            </div>
            <div className="h-px bg-[var(--border)] my-2" />
            <div className="flex justify-between">
              <span>Total gastado:</span>
              <span className="font-bold">{fmt(totalGasto)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ingreso:</span>
              <span className="font-bold">{fmt(ingreso)}</span>
            </div>
            <div className="flex justify-between">
              <span>Disponible:</span>
              <span className={`font-bold ${ingreso - totalGasto >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                {fmt(ingreso - totalGasto)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Presupuesto por macrocategoría */}
      {macros.map((macro) => {
        const pct = ingreso > 0 ? (macro.total_gastado / (ingreso * macro.pct_objetivo)) * 100 : 0;
        const objetivo = ingreso * macro.pct_objetivo;
        const restante = objetivo - macro.total_gastado;

        return (
          <Card key={macro.id} title={macro.nombre} accent={pct > 80}>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px] text-[var(--mid)]">
                <span>
                  {fmt(macro.total_gastado)} / {fmt(objetivo)}
                </span>
                <Badge color={pct >= 100 ? "red" : pct >= 80 ? "yellow" : "green"}>
                  {Math.round(pct)}%
                </Badge>
              </div>
              <ProgressBar pct={pct} />
              <div className="text-[11px] text-[var(--mid)]">
                {restante > 0 ? `Disponible: ${fmt(restante)}` : `Excedido: ${fmt(Math.abs(restante))}`}
              </div>
            </div>
          </Card>
        );
      })}

      {/* Botón flotante nuevo gasto */}
      <div className="fixed bottom-20 right-4 left-4">
        <Link href="/nuevo">
          <Btn>+ Nuevo gasto</Btn>
        </Link>
      </div>
    </div>
  );
}
