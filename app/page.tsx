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
  const [gloria, setGloria] = useState(0);
  const [alberto, setAlberto] = useState(0);
  const [totalDeudas, setTotalDeudas] = useState(0);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const now = new Date();
      const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1);
      const mesStr = mesInicio.toISOString().slice(0, 10);

      // Traer macrocategorías
      const { data: macroData } = await supabase
        .from("categorias_macro")
        .select("id, nombre, pct_objetivo")
        .neq("nombre", "Sin Clasificar")
        .order("orden", { ascending: true });

      // Traer gastos de este mes
      const { data: gastos } = await supabase
        .from("gasto_macro_mensual")
        .select("macro_id, total_gastado")
        .gte("mes", mesStr);

      const gastoMap = new Map(gastos?.map((g: any) => [g.macro_id, g.total_gastado]) || []);
      const enriched = macroData?.map((m: any) => ({
        ...m,
        total_gastado: gastoMap.get(m.id) || 0,
      })) || [];
      setMacros(enriched);

      // Traer ingreso
      const { data: ingresoData } = await supabase
        .from("ingreso_mensual")
        .select("monto")
        .lte("vigente_desde", mesStr)
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .single();

      if (ingresoData) setIngreso(ingresoData.monto);

      // Traer balance de gastos compartidos por persona
      const { data: allGastos } = await supabase
        .from("gastos")
        .select("responsable_id, monto, compartido")
        .gte("fecha", mesStr)
        .lt("fecha", new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10));

      let gloriaGastó = 0;
      let albertoGastó = 0;

      allGastos?.forEach((g: any) => {
        if (g.compartido) {
          if (g.responsable_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
            gloriaGastó += g.monto;
          } else if (g.responsable_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
            albertoGastó += g.monto;
          }
        }
      });

      setGloria(gloriaGastó);
      setAlberto(albertoGastó);

      // Traer deudas totales
      const { data: deudas } = await supabase
        .from("deudas")
        .select("saldo_pendiente");

      const totalDeuda = deudas?.reduce((sum: number, d: any) => sum + (d.saldo_pendiente || 0), 0) || 0;
      setTotalDeudas(totalDeuda);

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

  const totalGasto = gloria + alberto;
  const mitad = totalGasto / 2;
  const diferencia = Math.abs(gloria - alberto) / 2;
  const quienDebe = gloria > alberto ? "Alberto" : gloria < alberto ? "Gloria" : "Nadie";

  return (
    <div className="space-y-3">
      {/* RESUMEN MENSUAL */}
      <Card title="RESUMEN MES" accent>
        <div className="space-y-2 text-[14px]">
          <div className="flex justify-between">
            <span>Gloria gastó:</span>
            <span className="font-bold">{fmt(gloria)}</span>
          </div>
          <div className="flex justify-between">
            <span>Alberto gastó:</span>
            <span className="font-bold">{fmt(alberto)}</span>
          </div>
          <div className="h-px bg-[var(--border)] my-2" />
          <div className="flex justify-between font-bold text-[15px]">
            <span>Total gasto:</span>
            <span>{fmt(totalGasto)}</span>
          </div>
          <div className="flex justify-between text-[12px] text-[var(--mid)]">
            <span>Ingreso:</span>
            <span>{fmt(ingreso)}</span>
          </div>
          <div className="flex justify-between text-[12px] text-[var(--mid)]">
            <span>Disponible:</span>
            <span className={ingreso - totalGasto >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"}>
              {fmt(ingreso - totalGasto)}
            </span>
          </div>
        </div>
      </Card>

      {/* QUIÉN DEBE PAGAR */}
      {diferencia > 0 && (
        <Card accent>
          <div className="text-center">
            <div className="text-[12px] text-[var(--mid)] mb-1">Balance de gastos compartidos</div>
            <Badge color={gloria > alberto ? "yellow" : "yellow"}>
              {quienDebe} debe pagar: {fmt(diferencia)}
            </Badge>
          </div>
        </Card>
      )}

      {/* DEUDAS TOTALES */}
      {totalDeudas > 0 && (
        <Card>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-[12px] text-[var(--mid)]">Total deudas pendientes</div>
              <div className="text-[18px] font-bold text-[var(--red)]">{fmt(totalDeudas)}</div>
            </div>
            <Link href="/deudas">
              <Btn variant="sm-secondary">Ver deudas</Btn>
            </Link>
          </div>
        </Card>
      )}

      {/* PRESUPUESTO POR CATEGORÍA */}
      <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider px-4 py-2">
        Presupuesto por categoría
      </div>

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
      <div className="fixed bottom-20 right-4 left-4 max-w-[480px] mx-auto">
        <Link href="/nuevo">
          <Btn>+ Nuevo gasto</Btn>
        </Link>
      </div>
    </div>
  );
}
