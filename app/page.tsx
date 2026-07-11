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

interface SubAlerta {
  nombre: string;
  macroNombre: string;
  total_gastado: number;
  objetivo: number;
  pct: number;
}

export default function DashboardPage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(ymdLocal(new Date()).slice(0, 7));
  const [macros, setMacros] = useState<MacroData[]>([]);
  const [ingreso, setIngreso] = useState<number>(0);
  const [gloria, setGloria] = useState(0);
  const [alberto, setAlberto] = useState(0);
  const [deudasGloria, setDeudasGloria] = useState(0);
  const [deudasAlberto, setDeudasAlberto] = useState(0);
  const [alertasSub, setAlertasSub] = useState<SubAlerta[]>([]);
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

      // Traer deudas (deudor/acreedor) — deuda neta que cada uno debe (descontando lo que le deben)
      const { data: deudas } = await supabase
        .from("deuda_saldos")
        .select("responsable_id, acreedor_id, saldo_pendiente");

      let gloriaDebeNeto = 0;
      let albertoDebeNeto = 0;

      deudas?.forEach((d: any) => {
        const saldo = d.saldo_pendiente || 0;
        if (saldo <= 0) return;
        if (d.responsable_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
          gloriaDebeNeto += saldo;
        } else if (d.responsable_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
          albertoDebeNeto += saldo;
        }
        if (d.acreedor_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
          gloriaDebeNeto -= saldo;
        } else if (d.acreedor_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
          albertoDebeNeto -= saldo;
        }
      });

      setDeudasGloria(gloriaDebeNeto);
      setDeudasAlberto(albertoDebeNeto);

      // Alertas por subcategoría (con presupuesto propio: pct_objetivo o monto_objetivo)
      const { data: subs } = await supabase
        .from("categorias")
        .select("id, nombre, pct_objetivo, monto_objetivo, categorias_macro ( nombre )")
        .or("pct_objetivo.not.is.null,monto_objetivo.not.is.null");

      if (subs && subs.length > 0) {
        const { data: gastosPorSub } = await supabase
          .from("gastos")
          .select("categoria_id, monto")
          .gte("fecha", mesInicioStr)
          .lt("fecha", mesFinStr);

        const sumaPorSub = new Map<string, number>();
        gastosPorSub?.forEach((g: any) => {
          sumaPorSub.set(g.categoria_id, (sumaPorSub.get(g.categoria_id) || 0) + g.monto);
        });

        const ingresoActual = ingresoData?.monto || 0;
        const alertas: SubAlerta[] = [];

        subs.forEach((s: any) => {
          const gastado = sumaPorSub.get(s.id) || 0;
          let objetivo = 0;
          if (s.monto_objetivo) {
            objetivo = s.monto_objetivo;
          } else if (s.pct_objetivo && ingresoActual > 0) {
            objetivo = ingresoActual * s.pct_objetivo;
          }
          if (objetivo <= 0) return;

          const pct = (gastado / objetivo) * 100;
          if (pct >= 80) {
            alertas.push({
              nombre: s.nombre,
              macroNombre: s.categorias_macro?.nombre || "",
              total_gastado: gastado,
              objetivo,
              pct,
            });
          }
        });

        setAlertasSub(alertas.sort((a, b) => b.pct - a.pct));
      } else {
        setAlertasSub([]);
      }

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

  const mesLabel = new Date(parseInt(mesSeleccionado.slice(0, 4)), parseInt(mesSeleccionado.slice(5, 7)) - 1, 1)
    .toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <div className="pb-24">
      {/* HERO editorial: mes + total, tipografía enorme, sin caja */}
      <div className="rise-in -mx-4 px-4 pt-2 pb-8 mb-6" style={{ background: "var(--gradient)" }}>
        <label className="!text-white/70">Mes en curso</label>
        <input
          type="month"
          value={mesSeleccionado}
          onChange={(e) => setMesSeleccionado(e.target.value)}
          className="!bg-transparent !border-none !text-white !p-0 !text-[13px] font-semibold w-auto mb-3"
          style={{ colorScheme: "dark" }}
        />
        <div className="display text-[15vw] sm:text-[64px] leading-[0.85] font-black text-white capitalize -ml-0.5">
          {mesLabel.split(" ")[0]}
        </div>
        <div className="flex items-end justify-between mt-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">Gastado</div>
            <div className="display text-[38px] italic font-medium text-white leading-none">{fmt(totalGasto)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70">Gloria / Alberto</div>
            <div className="text-[15px] font-bold text-white">{fmt(gloria)} · {fmt(alberto)}</div>
          </div>
        </div>
      </div>

      {/* Balance: tratamiento único, no card */}
      {montoAPagar > 0 ? (
        <div className="slide-in mb-8 flex items-center gap-4">
          <div
            className="display text-[46px] italic font-black leading-none shrink-0"
            style={{ color: "var(--coral)" }}
          >
            →
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight">{resumenPago}</div>
            <div className="display text-[24px] font-bold" style={{ color: "var(--coral)" }}>
              {fmt(montoAPagar)}
            </div>
          </div>
        </div>
      ) : (
        <div className="slide-in mb-8 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: "var(--lime)" }} />
          <span className="display text-[18px] italic">Cuentas balanceadas</span>
        </div>
      )}

      {/* ALERTAS DE SUBCATEGORÍA */}
      {alertasSub.length > 0 && (
        <Card title="Alertas de presupuesto" accent>
          <div className="space-y-3">
            {alertasSub.map((a) => (
              <div key={a.nombre} className="flex justify-between items-center text-[13px]">
                <div>
                  <div className="font-semibold">{a.nombre}</div>
                  <div className="text-[11px] text-[var(--mid)]">
                    {a.macroNombre} • {fmt(a.total_gastado)} / {fmt(a.objetivo)}
                  </div>
                </div>
                <Badge color={a.pct >= 100 ? "red" : "yellow"}>{Math.round(a.pct)}%</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* DEUDAS */}
      {(deudasGloria > 0 || deudasAlberto > 0) && (
        <Card title="Deudas pendientes">
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
              <Link href="/deudas" className="underline decoration-[var(--lime)] decoration-2 underline-offset-2">
                Ver detalles
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* PRESUPUESTO POR CATEGORÍA: grid asimétrico, no stack uniforme */}
      {ingreso > 0 && macros.length > 0 && (
        <>
          <h2 className="display text-[22px] italic font-medium mb-4 mt-2">Presupuesto</h2>
          <div className="grid grid-cols-2 gap-x-5 gap-y-6">
            {macros.map((macro, i) => {
              const pct = ingreso > 0 ? (macro.total_gastado / (ingreso * macro.pct_objetivo)) * 100 : 0;
              const objetivo = ingreso * macro.pct_objetivo;
              const restante = objetivo - macro.total_gastado;
              // asimetría: cada 3er item ocupa el ancho completo
              const wide = i % 3 === 0;

              return (
                <div key={macro.id} className={`rise-in ${wide ? "col-span-2" : "col-span-1"}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[13px] font-bold">{macro.nombre}</span>
                    <Badge color={pct >= 100 ? "red" : pct >= 80 ? "yellow" : "green"}>{Math.round(pct)}%</Badge>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex justify-between mt-1.5 text-[11px] text-[var(--mid)]">
                    <span>{fmt(macro.total_gastado)}</span>
                    <span>{restante > 0 ? `+${fmt(restante)}` : `−${fmt(Math.abs(restante))}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Botón flotante nuevo gasto */}
      <div className="fixed bottom-6 right-4 left-4 max-w-[480px] mx-auto z-30">
        <Link href="/nuevo">
          <Btn>+ Nuevo gasto</Btn>
        </Link>
      </div>
    </div>
  );
}
