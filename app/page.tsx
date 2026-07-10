"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ProgressBar, Badge, Btn } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface MacroData {
  id: string;
  nombre: string;
  pct_objetivo: number;
  total_gastado: number;
}

export default function DashboardPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(ymdLocal(new Date()).slice(0, 7));
  const [macros, setMacros] = useState<MacroData[]>([]);
  const [ingreso, setIngreso] = useState<number>(0);
  const [gloria, setGloria] = useState(0);
  const [alberto, setAlberto] = useState(0);
  const [deudasGloria, setDeudasGloria] = useState(0);
  const [deudasAlberto, setDeudasAlberto] = useState(0);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setPending(true);
      const [año, mes] = mesSeleccionado.split("-");
      const mesInicio = new Date(parseInt(año), parseInt(mes) - 1, 1);
      const mesFin = new Date(parseInt(año), parseInt(mes), 1);
      const mesInicioStr = mesInicio.toISOString().slice(0, 10);
      const mesFinStr = mesFin.toISOString().slice(0, 10);

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
        .gte("mes", mesInicioStr)
        .lt("mes", mesFinStr);

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
        .lte("vigente_desde", mesInicioStr)
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .single();

      if (ingresoData) setIngreso(ingresoData.monto);

      // Traer gastos compartidos por persona para este mes
      const { data: allGastos } = await supabase
        .from("gastos")
        .select("responsable_id, monto, compartido")
        .gte("fecha", mesInicioStr)
        .lt("fecha", mesFinStr);

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

      // Traer deudas totales por responsable
      const { data: deudas } = await supabase
        .from("deudas")
        .select("responsable_id, saldo_pendiente");

      let gloriaDeudas = 0;
      let albertoDeudas = 0;

      deudas?.forEach((d: any) => {
        if (d.responsable_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
          gloriaDeudas += d.saldo_pendiente || 0;
        } else if (d.responsable_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
          albertoDeudas += d.saldo_pendiente || 0;
        }
      });

      setDeudasGloria(gloriaDeudas);
      setDeudasAlberto(albertoDeudas);

      setPending(false);
    };

    fetch();
  }, [mesSeleccionado]);

  if (pending) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  const totalGasto = gloria + alberto;
  const mitad = totalGasto / 2;
  const saldoGloria = gloria - mitad - deudasGloria; // Positivo = le deben
  const saldoAlberto = alberto - mitad - deudasAlberto;

  let resumenPago = "";
  let montoAPagar = 0;
  if (saldoGloria > 0) {
    resumenPago = "Alberto debe pagar a Gloria";
    montoAPagar = saldoGloria;
  } else if (saldoAlberto > 0) {
    resumenPago = "Gloria debe pagar a Alberto";
    montoAPagar = saldoAlberto;
  }

  return (
    <div className="space-y-3">
      {/* Selector de mes */}
      <Card title="Mes">
        <input
          type="month"
          value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2"
        />
      </Card>

      {/* RESUMEN MENSUAL */}
      <Card title="RESUMEN GASTOS" accent>
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
            <span>Total:</span>
            <span>{fmt(totalGasto)}</span>
          </div>
          <div className="flex justify-between text-[12px] text-[var(--mid)]">
            <span>Mitad:</span>
            <span>{fmt(mitad)}</span>
          </div>
        </div>
      </Card>

      {/* DEUDAS */}
      {(deudasGloria > 0 || deudasAlberto > 0) && (
        <Card title="DEUDAS PENDIENTES">
          <div className="space-y-2 text-[14px]">
            {deudasGloria > 0 && (
              <div className="flex justify-between">
                <span>Gloria debe:</span>
                <span className="font-bold text-[var(--red)]">{fmt(deudasGloria)}</span>
              </div>
            )}
            {deudasAlberto > 0 && (
              <div className="flex justify-between">
                <span>Alberto debe:</span>
                <span className="font-bold text-[var(--red)]">{fmt(deudasAlberto)}</span>
              </div>
            )}
            <div className="text-[11px] text-[var(--mid)]">
              <Link href="/deudas" className="text-[var(--accent)] underline">
                Ver detalles
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* QUIÉN DEBE PAGAR (con deudas consideradas) */}
      {montoAPagar > 0 && (
        <Card accent>
          <div className="text-center">
            <div className="text-[12px] text-[var(--mid)] mb-2">Balance final</div>
            <div className="text-[15px] font-bold mb-1">{resumenPago}</div>
            <Badge color="red">{fmt(montoAPagar)}</Badge>
          </div>
        </Card>
      )}

      {saldoGloria === 0 && saldoAlberto === 0 && (
        <Card accent>
          <div className="text-center">
            <Badge color="green">✓ Balanceado</Badge>
          </div>
        </Card>
      )}

      {/* PRESUPUESTO POR CATEGORÍA */}
      {ingreso > 0 && (
        <>
          <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider px-4 py-2">
            Presupuesto por categoría
          </div>

          {macros.map((macro) => {
            const pct =
              ingreso > 0 ? (macro.total_gastado / (ingreso * macro.pct_objetivo)) * 100 : 0;
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
                    {restante > 0
                      ? `Disponible: ${fmt(restante)}`
                      : `Excedido: ${fmt(Math.abs(restante))}`}
                  </div>
                </div>
              </Card>
            );
          })}
        </>
      )}

      {/* Botón flotante nuevo gasto */}
      <div className="fixed bottom-20 right-4 left-4 max-w-[480px] mx-auto">
        <Link href="/nuevo">
          <Btn>+ Nuevo gasto</Btn>
        </Link>
      </div>
    </div>
  );
}
