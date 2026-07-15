"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, ProgressBar, Badge, Btn } from "@/components/ui";
import CompararMeses from "@/components/CompararMeses";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface MacroData {
  id: string;
  nombre: string;
  pct_objetivo: number;
  total_gastado: number;
}

interface DeudaResumen {
  id: string;
  nombre: string;
  saldo_pendiente: number;
  pagando: boolean;
  responsable_id: string;
  cuotaEsteMes?: number;
  cuotasRestantes?: number;
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
  const [deudasResumen, setDeudasResumen] = useState<DeudaResumen[]>([]);
  const [deudasDeclaradas, setDeudasDeclaradas] = useState<DeudaResumen[]>([]);
  const [deudaTotalGeneral, setDeudaTotalGeneral] = useState(0);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setPending(true);
      const [año, mes] = mesSeleccionado.split("-");
      const mesInicio = new Date(parseInt(año), parseInt(mes) - 1, 1);
      const mesFin = new Date(parseInt(año), parseInt(mes), 1);
      const mesInicioStr = mesInicio.toISOString().slice(0, 10);
      const mesFinStr = mesFin.toISOString().slice(0, 10);

      // Generar recurrentes automáticamente
      const mesAnterior = new Date(parseInt(año), parseInt(mes) - 2, 1);
      const mesPrevioInicio = mesAnterior.toISOString().slice(0, 10);
      const mesPrevioFin = mesInicio.toISOString().slice(0, 10);

      const { data: recurrentes } = await supabase
        .from("gastos")
        .select("id, monto, descripcion, categoria_id, responsable_id, compartido, ambito")
        .eq("recurrente", true)
        .gte("fecha", mesPrevioInicio)
        .lt("fecha", mesPrevioFin);

      if (recurrentes && recurrentes.length > 0) {
        for (const gasto of recurrentes) {
          const { data: existe } = await supabase
            .from("gastos")
            .select("id")
            .eq("descripcion", gasto.descripcion)
            .eq("responsable_id", gasto.responsable_id)
            .gte("fecha", mesInicioStr)
            .lt("fecha", mesFinStr)
            .limit(1);

          if (!existe || existe.length === 0) {
            const proximaFecha = mesInicio.toISOString().slice(0, 10);
            await supabase.from("gastos").insert({
              monto: gasto.monto,
              descripcion: gasto.descripcion,
              categoria_id: gasto.categoria_id,
              responsable_id: gasto.responsable_id,
              fecha: proximaFecha,
              compartido: gasto.compartido,
              ambito: gasto.ambito || "ninguno",
              recurrente: true,
            });
          }
        }
      }

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
        .select("responsable_id, monto, compartido, es_abono")
        .gte("fecha", mesInicioStr)
        .lt("fecha", mesFinStr);

      let gloriaGastó = 0;
      let albertoGastó = 0;

      allGastos?.forEach((g: any) => {
        if (g.compartido) {
          const monto = g.es_abono ? -g.monto : g.monto;
          if (g.responsable_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
            gloriaGastó += monto;
          } else if (g.responsable_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
            albertoGastó += monto;
          }
        }
      });

      setGloria(gloriaGastó);
      setAlberto(albertoGastó);

      // Auto-descuento: para deudas activas, calcular cuántos meses han pasado
      // desde que se activó el pago y descontar esa cantidad de cuotas del saldo.
      // No depende de gastos generados — es puro cálculo de fechas.
      // También calculamos cuánto corresponde SOLO a este mes (para el balance mensual,
      // que no debe incluir el saldo total del préstamo, solo la cuota del mes).
      const { data: deudasParaSync } = await supabase
        .from("deuda_saldos")
        .select(
          "id, monto_total, monto_pagado, cuota_mensual, fecha_activacion_pago, pagando, responsable_id, acreedor_id"
        )
        .eq("pagando", true)
        .not("cuota_mensual", "is", null)
        .not("fecha_activacion_pago", "is", null);

      const cuotasEsteMesPorDeuda: {
        id: string;
        responsable_id: string;
        acreedor_id: string | null;
        cuotaEsteMes: number;
        cuotaMensual: number;
      }[] = [];

      if (deudasParaSync && deudasParaSync.length > 0) {
        const hoy = new Date();
        for (const d of deudasParaSync) {
          const inicio = new Date(d.fecha_activacion_pago + "T00:00:00");
          const mesesTranscurridos =
            (hoy.getFullYear() - inicio.getFullYear()) * 12 +
            (hoy.getMonth() - inicio.getMonth()) +
            1;
          const cuotasPasadas = Math.max(0, mesesTranscurridos);
          const montoPagadoAntes = Math.min(
            Math.max(0, cuotasPasadas - 1) * d.cuota_mensual,
            d.monto_total
          );
          const calculadoPorFechas = Math.min(cuotasPasadas * d.cuota_mensual, d.monto_total);
          // Los abonos manuales pueden superar el calendario de cuotas:
          // el auto-descuento solo puede AUMENTAR el pagado, nunca reducirlo.
          const totalCalculado = Math.max(calculadoPorFechas, d.monto_pagado);
          // Lo abonado por sobre el calendario descuenta la cuota de este mes:
          // si la deuda ya se pagó por adelantado, este mes no se debe nada.
          const abonadoExtra = Math.max(0, d.monto_pagado - calculadoPorFechas);
          const cuotaEsteMes = Math.max(
            0,
            calculadoPorFechas - montoPagadoAntes - abonadoExtra
          );

          cuotasEsteMesPorDeuda.push({
            id: d.id,
            responsable_id: d.responsable_id,
            acreedor_id: d.acreedor_id,
            cuotaEsteMes,
            cuotaMensual: d.cuota_mensual,
          });

          if (totalCalculado !== d.monto_pagado) {
            await supabase
              .from("deudas")
              .update({ monto_pagado: totalCalculado })
              .eq("id", d.id);
          }
        }
      }

      // Traer TODAS las deudas (vista deuda_saldos calcula saldo_pendiente correctamente)
      const { data: deudasDetalle } = await supabase
        .from("deuda_saldos")
        .select("id, nombre, saldo_pendiente, pagando, responsable_id, acreedor_id")
        .gt("saldo_pendiente", 0)
        .order("saldo_pendiente", { ascending: false });

      const cuotasPorId = new Map(cuotasEsteMesPorDeuda.map((d) => [d.id, d]));
      const deudaspagando = (deudasDetalle?.filter((d: any) => d.pagando) || []).map((d: any) => {
        const info = cuotasPorId.get(d.id);
        return {
          ...d,
          cuotaEsteMes: info?.cuotaEsteMes,
          cuotasRestantes: info?.cuotaMensual
            ? Math.ceil(d.saldo_pendiente / info.cuotaMensual)
            : undefined,
        };
      });
      setDeudasResumen(deudaspagando);

      const deudasNoActivas = deudasDetalle?.filter((d: any) => !d.pagando) || [];
      setDeudasDeclaradas(deudasNoActivas);

      // Total de TODAS las deudas (sumen o no al balance del mes)
      const totalDeudaGeneral = (deudasDetalle || []).reduce(
        (sum: number, d: any) => sum + (d.saldo_pendiente || 0),
        0
      );
      setDeudaTotalGeneral(totalDeudaGeneral);

      let gloriaDebeNeto = 0;
      let albertoDebeNeto = 0;

      // Balance del mes: solo la cuota de ESTE mes por cada deuda activa, no el saldo total
      cuotasEsteMesPorDeuda.forEach((d) => {
        const cuota = d.cuotaEsteMes;
        if (cuota <= 0) return;
        if (d.responsable_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
          gloriaDebeNeto += cuota;
        } else if (d.responsable_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
          albertoDebeNeto += cuota;
        }
        if (d.acreedor_id === "9a7597c3-de3c-4cdc-9bdf-78dde625cff0") {
          gloriaDebeNeto -= cuota;
        } else if (d.acreedor_id === "6268104e-7c3c-4643-b4f6-7eb44a636f03") {
          albertoDebeNeto -= cuota;
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
          .select("categoria_id, monto, es_abono")
          .gte("fecha", mesInicioStr)
          .lt("fecha", mesFinStr);

        const sumaPorSub = new Map<string, number>();
        gastosPorSub?.forEach((g: any) => {
          const monto = g.es_abono ? -g.monto : g.monto;
          sumaPorSub.set(g.categoria_id, (sumaPorSub.get(g.categoria_id) || 0) + monto);
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

  const [añoSel, mesSelIdx] = mesSeleccionado.split("-").map(Number);
  const mesLabel = new Date(añoSel, mesSelIdx - 1, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  const cambiarMesSel = (delta: number) => {
    const d = new Date(añoSel, mesSelIdx - 1 + delta, 1);
    setMesSeleccionado(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="pb-24">
      {/* HERO sobrio: mes + total */}
      <div className="rise-in mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={() => cambiarMesSel(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white/12 transition-colors"
          >
            ‹
          </button>
          <span className="text-[13px] font-semibold text-[var(--ink-soft)] capitalize min-w-[120px] text-center">
            {mesLabel}
          </span>
          <button
            type="button"
            onClick={() => cambiarMesSel(1)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white/12 transition-colors"
          >
            ›
          </button>
        </div>
        <div className="text-[13px] font-semibold text-[var(--ink-soft)] mb-1">Gastado este mes</div>
        <div className="text-[48px] font-extrabold text-[var(--ink)] leading-none tracking-tight">{fmt(totalGasto)}</div>
        <div className="text-[13px] font-medium text-[var(--ink-soft)] mt-2">
          Gloria {fmt(gloria)} · Alberto {fmt(alberto)}
        </div>
      </div>

      {/* Balance */}
      {montoAPagar > 0 ? (
        <div className="slide-in mb-6 bg-[var(--paper-raised)] rounded-2xl p-4 flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-[15px] font-bold"
            style={{ background: "var(--accent)" }}
          >
            →
          </div>
          <div>
            <div className="text-[14px] font-semibold leading-tight">{resumenPago}</div>
            <div className="text-[20px] font-extrabold" style={{ color: "var(--accent)" }}>
              {fmt(montoAPagar)}
            </div>
          </div>
        </div>
      ) : (
        <div className="slide-in mb-6 bg-[var(--paper-raised)] rounded-2xl p-4 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "var(--green)" }} />
          <span className="text-[14px] font-semibold">Cuentas balanceadas</span>
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
      {(deudasGloria > 0 || deudasAlberto > 0 || deudasDeclaradas.length > 0 || deudaTotalGeneral > 0) && (
        <Card title="Deudas">
          <div className="space-y-3 text-[14px]">
            {deudaTotalGeneral > 0 && (
              <div className="flex justify-between items-center pb-2 border-b border-[var(--rule)]">
                <span className="font-semibold">Total deuda (todas):</span>
                <span className="font-bold text-[15px]">{fmt(deudaTotalGeneral)}</span>
              </div>
            )}

            {(deudasGloria > 0 || deudasAlberto > 0) && (
              <div className="space-y-2">
                <div className="text-[12px] text-[var(--ink-soft)] font-medium">Debe pagar (activo):</div>
                {deudasGloria > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Gloria debe:</span>
                    <span className="font-bold text-[var(--red)]">{fmt(deudasGloria)}</span>
                  </div>
                )}
                {deudasAlberto > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Alberto debe:</span>
                    <span className="font-bold text-[var(--red)]">{fmt(deudasAlberto)}</span>
                  </div>
                )}
              </div>
            )}

            {deudasResumen.length > 0 && (
              <div className="pt-2 border-t border-[var(--rule)]">
                <div className="text-[12px] text-[var(--ink-soft)] mb-1.5 font-medium">Pagos automáticos activos:</div>
                <div className="space-y-1.5">
                  {deudasResumen.map((d) => (
                    <div key={d.id} className="flex justify-between items-center text-[12px]">
                      <div>
                        <div className="text-[var(--mid)] font-medium">{d.nombre}</div>
                        {d.cuotasRestantes !== undefined && (
                          <div className="text-[10px] text-[var(--ink-faint)]">
                            {d.cuotasRestantes} cuota{d.cuotasRestantes !== 1 ? "s" : ""} restante
                            {d.cuotasRestantes !== 1 ? "s" : ""}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {d.cuotaEsteMes !== undefined && (
                          <div className="font-bold">{fmt(d.cuotaEsteMes)}</div>
                        )}
                        <Badge color="green">↻</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {deudasDeclaradas.length > 0 && (
              <div className="pt-2 border-t border-[var(--rule)]">
                <div className="text-[12px] text-[var(--ink-soft)] mb-1.5 font-medium">
                  Declaradas (aún no se pagan):
                </div>
                <div className="space-y-1">
                  {deudasDeclaradas.map((d) => (
                    <div key={d.id} className="flex justify-between items-center text-[12px]">
                      <span className="text-[var(--mid)]">{d.nombre}</span>
                      <span className="text-[var(--ink-faint)]">{fmt(d.saldo_pendiente)}</span>
                    </div>
                  ))}
                </div>
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

      {/* PRESUPUESTO POR CATEGORÍA */}
      {ingreso > 0 && macros.length > 0 && (
        <div className="mb-2">
          <h2 className="text-[15px] font-bold mb-3 mt-2">Presupuesto</h2>
          <div className="bg-[var(--paper-raised)] rounded-2xl divide-y divide-[var(--rule)]">
            {macros.map((macro) => {
              const pct = ingreso > 0 ? (macro.total_gastado / (ingreso * macro.pct_objetivo)) * 100 : 0;
              const objetivo = ingreso * macro.pct_objetivo;
              const restante = objetivo - macro.total_gastado;

              return (
                <div key={macro.id} className="p-4">
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-[14px] font-semibold">{macro.nombre}</span>
                    <Badge color={pct >= 100 ? "red" : pct >= 80 ? "yellow" : "green"}>{Math.round(pct)}%</Badge>
                  </div>
                  <ProgressBar pct={pct} />
                  <div className="flex justify-between mt-1.5 text-[12px] text-[var(--ink-soft)]">
                    <span>{fmt(macro.total_gastado)}</span>
                    <span>{restante > 0 ? `+${fmt(restante)}` : `−${fmt(Math.abs(restante))}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-4" />
      <CompararMeses />

      {/* Botón flotante nuevo gasto */}
      <div className="fixed bottom-6 right-4 left-4 max-w-[480px] mx-auto z-30">
        <Link href="/nuevo">
          <Btn>+ Nuevo gasto</Btn>
        </Link>
      </div>
    </div>
  );
}
