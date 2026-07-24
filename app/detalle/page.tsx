"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface GastoRaw {
  id: string;
  monto: number;
  es_abono: boolean;
  descripcion: string | null;
  fecha: string;
  macro: string;
  categoria: string;
  categoria_id: string;
  responsable: string;
  ambito: string;
  cuota_numero: number | null;
  cuota_total: number | null;
}

interface ResponsableNode {
  nombre: string;
  porDia: Map<number, number>;
  total: number;
}

interface CategoriaNode {
  nombre: string;
  responsables: Map<string, ResponsableNode>;
  porDia: Map<number, number>;
  total: number;
}

interface MacroNode {
  nombre: string;
  categorias: Map<string, CategoriaNode>;
  porDia: Map<number, number>;
  total: number;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export default function DetallePage() {
  const [año, setAño] = useState(new Date().getFullYear());
  const [mesIdx, setMesIdx] = useState(new Date().getMonth()); // 0-11
  const [gastosRaw, setGastosRaw] = useState<GastoRaw[]>([]);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [soloDiasConGasto, setSoloDiasConGasto] = useState(true);
  const [pending, setPending] = useState(true);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [celdaSeleccionada, setCeldaSeleccionada] = useState<{
    macro: string;
    categoria: string;
    responsable: string;
    dia: number;
  } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cuotaTip, setCuotaTip] = useState<{ text: string; x: number; y: number } | null>(null);

  const fetchGastos = async () => {
    setPending(true);
    const mesInicio = new Date(año, mesIdx, 1);
    const mesFin = new Date(año, mesIdx + 1, 1);
    const mesInicioStr = mesInicio.toISOString().slice(0, 10);
    const mesFinStr = mesFin.toISOString().slice(0, 10);

    const { data } = await supabase
      .from("gastos")
      .select(
        `
        id, monto, es_abono, descripcion, fecha, categoria_id, ambito, cuota_numero, cuota_total,
        categorias ( nombre, categorias_macro ( nombre ) ),
        usuarios ( nombre )
      `
      )
      .gte("fecha", mesInicioStr)
      .lt("fecha", mesFinStr)
      .order("fecha", { ascending: true });

    const parsed: GastoRaw[] = (data || []).map((g: any) => ({
      id: g.id,
      monto: g.monto,
      es_abono: g.es_abono || false,
      descripcion: g.descripcion,
      fecha: g.fecha,
      macro: g.categorias?.categorias_macro?.nombre || "Sin clasificar",
      categoria: g.categorias?.nombre || "Sin categoría",
      categoria_id: g.categoria_id,
      ambito: g.ambito || "ninguno",
      responsable: g.usuarios?.nombre || "Desconocido",
      cuota_numero: g.cuota_numero ?? null,
      cuota_total: g.cuota_total ?? null,
    }));

    setGastosRaw(parsed);
    setPending(false);
  };

  useEffect(() => {
    fetchGastos();
  }, [año, mesIdx]);

  // Construir árbol macro -> categoria -> responsable -> día
  const { arbol, diasConGasto, totalPorDia, totalGeneral } = useMemo(() => {
    const arbol = new Map<string, MacroNode>();
    const totalPorDia = new Map<number, number>();
    let totalGeneral = 0;

    for (const g of gastosRaw) {
      // Los abonos no son gasto: es plata entregada a la otra persona.
      // Se listan aparte, fuera de la grilla.
      if (g.es_abono) continue;
      const dia = parseInt(g.fecha.slice(8, 10));
      const montoG = g.monto;

      if (!arbol.has(g.macro)) {
        arbol.set(g.macro, { nombre: g.macro, categorias: new Map(), porDia: new Map(), total: 0 });
      }
      const macroNode = arbol.get(g.macro)!;

      if (!macroNode.categorias.has(g.categoria)) {
        macroNode.categorias.set(g.categoria, {
          nombre: g.categoria,
          responsables: new Map(),
          porDia: new Map(),
          total: 0,
        });
      }
      const catNode = macroNode.categorias.get(g.categoria)!;

      if (!catNode.responsables.has(g.responsable)) {
        catNode.responsables.set(g.responsable, {
          nombre: g.responsable,
          porDia: new Map(),
          total: 0,
        });
      }
      const respNode = catNode.responsables.get(g.responsable)!;

      respNode.porDia.set(dia, (respNode.porDia.get(dia) || 0) + montoG);
      respNode.total += montoG;

      catNode.porDia.set(dia, (catNode.porDia.get(dia) || 0) + montoG);
      catNode.total += montoG;

      macroNode.porDia.set(dia, (macroNode.porDia.get(dia) || 0) + montoG);
      macroNode.total += montoG;

      totalPorDia.set(dia, (totalPorDia.get(dia) || 0) + montoG);
      totalGeneral += montoG;
    }

    const diasConGasto = Array.from(totalPorDia.keys()).sort((a, b) => a - b);

    return { arbol, diasConGasto, totalPorDia, totalGeneral };
  }, [gastosRaw]);

  // Días a mostrar: todos los del mes (calendario real) o solo los que tienen gasto
  const diasDelMes = useMemo(() => {
    const totalDias = new Date(año, mesIdx + 1, 0).getDate();
    const todos = Array.from({ length: totalDias }, (_, i) => i + 1);
    return soloDiasConGasto ? todos.filter((d) => diasConGasto.includes(d)) : todos;
  }, [año, mesIdx, diasConGasto, soloDiasConGasto]);

  const nombreDia = (dia: number) => {
    const fecha = new Date(año, mesIdx, dia);
    return DIAS_SEMANA[fecha.getDay()];
  };

  // Al mostrar todos los días, hacer scroll automático hasta el primer día con gasto
  useEffect(() => {
    if (!soloDiasConGasto && diasConGasto.length > 0 && tableScrollRef.current) {
      const primerDia = diasConGasto[0];
      const idxColumna = diasDelMes.indexOf(primerDia);
      if (idxColumna >= 0) {
        const fixedColsWidth = 150 + 100 + 72; // categoría + responsable + total
        const colWidth = 72;
        const scrollTarget = Math.max(0, fixedColsWidth + idxColumna * colWidth - fixedColsWidth - colWidth);
        tableScrollRef.current.scrollLeft = scrollTarget;
      }
    } else if (tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = 0;
    }
  }, [soloDiasConGasto, diasDelMes, diasConGasto]);

  const macrosOrdenados = Array.from(arbol.values()).sort((a, b) => b.total - a.total);

  const totalesPorResponsable = useMemo(() => {
    const totales = new Map<string, number>();
    gastosRaw.forEach((g) => {
      if (g.es_abono) return;
      totales.set(g.responsable, (totales.get(g.responsable) || 0) + g.monto);
    });
    return totales;
  }, [gastosRaw]);

  const abonosDelMes = useMemo(() => gastosRaw.filter((g) => g.es_abono), [gastosRaw]);

  const toggle = (key: string) => {
    const newSet = new Set(expandidos);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setExpandidos(newSet);
  };

  const expandirTodo = () => {
    const keys = new Set<string>();
    macrosOrdenados.forEach((m) => {
      keys.add(m.nombre);
      m.categorias.forEach((c) => {
        const catKey = `${m.nombre}__${c.nombre}`;
        keys.add(catKey);
      });
    });
    setExpandidos(keys);
  };

  const contraerTodo = () => setExpandidos(new Set());

  const cambiarMes = (delta: number) => {
    let nuevoMes = mesIdx + delta;
    let nuevoAño = año;
    if (nuevoMes < 0) {
      nuevoMes = 11;
      nuevoAño -= 1;
    } else if (nuevoMes > 11) {
      nuevoMes = 0;
      nuevoAño += 1;
    }
    setMesIdx(nuevoMes);
    setAño(nuevoAño);
  };

  if (pending) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  const colWidth = 72;

  return (
    <div
      className="space-y-3 w-screen relative left-1/2 -translate-x-1/2 max-w-none px-4"
      style={{ maxWidth: "100vw" }}
    >
      <h1 className="text-[18px] font-bold px-1">Detalle de gastos del mes</h1>

      {/* Navegación de mes */}
      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={() => cambiarMes(-1)}
            className="px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] font-bold"
          >
            ← Anterior
          </button>
          <div className="text-[15px] font-bold text-[var(--charcoal)] capitalize">
            {MESES[mesIdx]} {año}
          </div>
          <button
            onClick={() => cambiarMes(1)}
            className="px-3 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] font-bold"
          >
            Siguiente →
          </button>
        </div>
      </Card>

      {/* Buscador de gastos */}
      <Card>
        <input
          type="text"
          placeholder="🔍 Buscar gasto por título..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda.trim() && (
          <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
            {gastosRaw
              .filter((g) =>
                (g.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())
              )
              .map((g) => (
                <div
                  key={g.id}
                  className="flex justify-between items-center text-[12px] p-2 rounded-lg bg-[var(--paper-raised-2)]"
                >
                  <div>
                    <div className="font-semibold">{g.descripcion || "Sin título"}</div>
                    <div className="text-[10px] text-[var(--ink-soft)]">
                      {g.macro} › {g.categoria} · {g.responsable} · día{" "}
                      {parseInt(g.fecha.slice(8, 10))}
                    </div>
                  </div>
                  <span className="font-bold">{fmt(g.monto)}</span>
                </div>
              ))}
            {gastosRaw.filter((g) =>
              (g.descripcion || "").toLowerCase().includes(busqueda.toLowerCase())
            ).length === 0 && (
              <div className="text-[12px] text-[var(--ink-faint)] text-center py-2">
                Sin resultados este mes
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Cajas de total por responsable */}
      <div className="grid grid-cols-2 gap-3">
        <Card title="Gloria">
          <div className="text-[20px] font-bold text-[var(--accent)]">
            {fmt(totalesPorResponsable.get("Gloria Roa") || 0)}
          </div>
        </Card>
        <Card title="Alberto">
          <div className="text-[20px] font-bold text-[var(--accent)]">
            {fmt(totalesPorResponsable.get("Alberto Garrido") || 0)}
          </div>
        </Card>
      </div>

      {/* Abonos: no son gasto, se entregan a la otra persona para saldar el mes */}
      {abonosDelMes.length > 0 && (
        <Card title="Abonos del mes">
          <div className="space-y-2">
            {abonosDelMes.map((a) => (
              <div key={a.id} className="flex justify-between items-center gap-3 text-[13px]">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.descripcion || "Abono"}</div>
                  <div className="text-[11px] text-[var(--mid)]">
                    {a.responsable} ·{" "}
                    {new Date(a.fecha + "T00:00:00").toLocaleDateString("es-CL", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
                <span className="font-bold shrink-0 text-[var(--green)]">{fmt(a.monto)}</span>
              </div>
            ))}
            <div className="text-[11px] text-[var(--mid)] pt-1">
              No suman al gasto del mes: descuentan de lo que esa persona debe pagar.
            </div>
          </div>
        </Card>
      )}

      {/* Expandir/Contraer todo + Total */}
      <Card accent>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={expandirTodo}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] text-[12px] font-bold"
            >
              Expandir todo
            </button>
            <button
              onClick={contraerTodo}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] text-[12px] font-bold"
            >
              Contraer todo
            </button>
            <button
              onClick={() => setSoloDiasConGasto(!soloDiasConGasto)}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] text-[12px] font-bold"
            >
              {soloDiasConGasto ? "Expandir días ↔" : "Contraer días ↔"}
            </button>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-[var(--mid)]">Total mes</div>
            <div className="text-[18px] font-bold text-[var(--accent)]">{fmt(totalGeneral)}</div>
          </div>
        </div>
      </Card>

      {/* Grilla tipo planilla, scroll horizontal */}
      {macrosOrdenados.length === 0 ? (
        <Card>
          <div className="text-center text-[14px] text-[var(--mid)] py-8">Sin gastos este mes</div>
        </Card>
      ) : (
        <>
          {!soloDiasConGasto && (
            <div className="text-[11px] text-[var(--mid)] px-1 -mb-1">
              ← Desliza horizontalmente para ver todos los días • los días con gasto están resaltados
            </div>
          )}
          <div ref={tableScrollRef} className="border border-[var(--border)] rounded-lg overflow-x-auto bg-[var(--paper-raised)]">
          <table className="border-collapse text-[12px] text-[var(--ink)]" style={{ minWidth: "100%" }}>
            <thead>
              <tr className="bg-[var(--accent)] text-white sticky top-0 z-20">
                <th
                  className="text-left px-3 py-2 font-bold sticky left-0 bg-[var(--accent)] z-10"
                  style={{ minWidth: 150 }}
                >
                  Categoría
                </th>
                <th className="text-left px-2 py-2 font-bold" style={{ minWidth: 100 }}>
                  Responsable
                </th>
                <th className="text-right px-3 py-2 font-bold" style={{ minWidth: colWidth }}>
                  Total
                </th>
                {diasDelMes.map((dia) => {
                  const tieneGasto = diasConGasto.includes(dia);
                  return (
                  <th
                    key={dia}
                    className={`text-right px-2 py-2 font-bold ${
                      tieneGasto ? "bg-[var(--gold-bg)] text-[var(--charcoal)]" : ""
                    }`}
                    style={{ minWidth: colWidth }}
                  >
                    <div className="leading-tight">
                      <div className={`text-[10px] font-normal capitalize ${tieneGasto ? "opacity-70" : "opacity-80"}`}>
                        {nombreDia(dia)}
                      </div>
                      <div>{dia}</div>
                    </div>
                  </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {macrosOrdenados.map((macro) => {
                const macroExpanded = expandidos.has(macro.nombre);
                const categoriasOrdenadas = Array.from(macro.categorias.values()).sort(
                  (a, b) => b.total - a.total
                );

                return (
                  <React.Fragment key={macro.nombre}>
                    {/* Fila de macro */}
                    <tr
                      onClick={() => toggle(macro.nombre)}
                      className="bg-[var(--accent-bg)] cursor-pointer hover:bg-[var(--accent-bg)]/70 border-t border-[var(--border)]"
                    >
                      <td
                        className="px-3 py-2 font-bold sticky left-0 bg-[var(--accent-bg)] z-10"
                        style={{ minWidth: 150 }}
                      >
                        <span className="mr-1">{macroExpanded ? "▼" : "▶"}</span>
                        {macro.nombre}
                      </td>
                      <td className="px-2 py-2"></td>
                      <td className="text-right px-3 py-2 font-bold">{fmt(macro.total)}</td>
                      {diasDelMes.map((dia) => (
                        <td
                          key={dia}
                          className={`text-right px-2 py-2 ${
                            diasConGasto.includes(dia) ? "bg-[var(--gold-bg)]/50" : ""
                          }`}
                        >
                          {macro.porDia.get(dia) ? fmt(macro.porDia.get(dia)!) : ""}
                        </td>
                      ))}
                    </tr>

                    {/* Filas de categoría (si macro expandido) */}
                    {macroExpanded &&
                      categoriasOrdenadas.map((cat) => {
                        const catKey = `${macro.nombre}__${cat.nombre}`;
                        const catExpanded = expandidos.has(catKey);
                        const responsablesOrdenados = Array.from(cat.responsables.values()).sort(
                          (a, b) => a.nombre.localeCompare(b.nombre)
                        );

                        return (
                          <React.Fragment key={catKey}>
                            <tr
                              onClick={() => toggle(catKey)}
                              className="cursor-pointer hover:bg-[var(--accent-bg)]/20 border-t border-[var(--border)]/50"
                            >
                              <td
                                className="px-3 py-1.5 pl-8 sticky left-0 bg-[var(--paper-raised)] z-10 text-[var(--charcoal)]"
                                style={{ minWidth: 150 }}
                              >
                                <span className="mr-1 text-[10px]">{catExpanded ? "▼" : "▶"}</span>
                                {cat.nombre}
                              </td>
                              <td className="px-2 py-1.5"></td>
                              <td className="text-right px-3 py-1.5 font-semibold">{fmt(cat.total)}</td>
                              {diasDelMes.map((dia) => (
                                <td
                                  key={dia}
                                  className={`text-right px-2 py-1.5 text-[var(--mid)] ${
                                    diasConGasto.includes(dia) ? "bg-[var(--gold-bg)]/50" : ""
                                  }`}
                                >
                                  {cat.porDia.get(dia) ? fmt(cat.porDia.get(dia)!) : ""}
                                </td>
                              ))}
                            </tr>

                            {/* Filas de gastos individuales (si categoría expandida) */}
                            {catExpanded &&
                              gastosRaw
                                .filter(
                                  (g) =>
                                    !g.es_abono &&
                                    g.macro === macro.nombre &&
                                    g.categoria === cat.nombre
                                )
                                .map((gasto) => {
                                  const gasto_dia = parseInt(gasto.fecha.slice(8, 10));
                                  return (
                                    <tr
                                      key={gasto.id}
                                      className="border-t border-[var(--border)]/30 bg-[var(--paper-raised-2)]"
                                    >
                                      <td
                                        className="px-3 py-1 pl-14 sticky left-0 bg-[var(--paper-raised-2)] z-10 text-[11px] text-[var(--mid)] truncate"
                                        style={{ minWidth: 150, maxWidth: 150 }}
                                        title={gasto.descripcion || "Sin descripción"}
                                      >
                                        {gasto.descripcion || "Sin descripción"}
                                        {gasto.cuota_total && gasto.cuota_total > 1 && (
                                          <span
                                            className="ml-1.5 px-1.5 py-0.5 rounded bg-[var(--indigo-bg)] text-[var(--indigo)] font-semibold text-[10px] cursor-help"
                                            onMouseEnter={(e) =>
                                              setCuotaTip({
                                                text: `Cuota ${gasto.cuota_numero} de ${gasto.cuota_total}`,
                                                x: e.clientX,
                                                y: e.clientY,
                                              })
                                            }
                                            onMouseMove={(e) =>
                                              setCuotaTip({
                                                text: `Cuota ${gasto.cuota_numero} de ${gasto.cuota_total}`,
                                                x: e.clientX,
                                                y: e.clientY,
                                              })
                                            }
                                            onMouseLeave={() => setCuotaTip(null)}
                                          >
                                            cuota {gasto.cuota_numero}/{gasto.cuota_total}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-2 py-1 text-[11px] font-medium text-[var(--charcoal)]">
                                        {gasto.responsable}
                                      </td>
                                      <td className="text-right px-3 py-1 text-[11px] font-semibold">
                                        {fmt(gasto.monto)}
                                      </td>
                                      {diasDelMes.map((dia) => (
                                        <td
                                          key={dia}
                                          className={`text-right px-2 py-1 text-[11px] text-[var(--mid)] ${
                                            dia === gasto_dia ? "font-bold text-[var(--accent)]" : ""
                                          }`}
                                        >
                                          {dia === gasto_dia ? fmt(gasto.monto) : ""}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--accent)] text-white border-t-2 border-[var(--accent)] sticky bottom-0">
                <td className="px-3 py-2 font-bold sticky left-0 bg-[var(--accent)] z-10" style={{ minWidth: 150 }}>
                  TOTAL
                </td>
                <td className="px-2 py-2"></td>
                <td className="text-right px-3 py-2 font-bold">{fmt(totalGeneral)}</td>
                {diasDelMes.map((dia) => (
                  <td key={dia} className="text-right px-2 py-2 font-bold">
                    {fmt(totalPorDia.get(dia) || 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          </div>
        </>
      )}

      {/* Modal editar/eliminar gastos de la celda seleccionada */}
      {celdaSeleccionada && (
        <ModalGastosCelda
          celda={celdaSeleccionada}
          gastosRaw={gastosRaw}
          onCerrar={() => setCeldaSeleccionada(null)}
          onCambio={fetchGastos}
        />
      )}

      {/* Tooltip de cuota: instantáneo y del color índigo (no el nativo lento y gris).
          Se renderiza por portal a document.body porque el div raíz tiene un transform
          (-translate-x-1/2) que rompería el position:fixed del tooltip. */}
      {cuotaTip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[100] px-2.5 py-1 rounded-lg bg-[var(--indigo)] text-white font-semibold text-[12px] shadow-lg pointer-events-none whitespace-nowrap"
            style={{ left: cuotaTip.x + 12, top: cuotaTip.y + 12 }}
          >
            {cuotaTip.text}
          </div>,
          document.body
        )}
    </div>
  );
}

function ModalGastosCelda({
  celda,
  gastosRaw,
  onCerrar,
  onCambio,
}: {
  celda: { macro: string; categoria: string; responsable: string; dia: number };
  gastosRaw: GastoRaw[];
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const gastosDeLaCelda = gastosRaw.filter(
    (g) =>
      g.macro === celda.macro &&
      g.categoria === celda.categoria &&
      g.responsable === celda.responsable &&
      parseInt(g.fecha.slice(8, 10)) === celda.dia
  );

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [montoEdit, setMontoEdit] = useState("");
  const [descEdit, setDescEdit] = useState("");
  const [ambitoEdit, setAmbitoEdit] = useState("ninguno");

  const iniciarEdicion = (g: GastoRaw) => {
    setEditandoId(g.id);
    setMontoEdit(String(g.monto));
    setDescEdit(g.descripcion || "");
    setAmbitoEdit(g.ambito || "ninguno");
  };

  const guardarEdicion = async (id: string) => {
    if (!descEdit.trim()) {
      alert("El título es obligatorio");
      return;
    }

    const { error } = await supabase
      .from("gastos")
      .update({ monto: parseFloat(montoEdit), descripcion: descEdit, ambito: ambitoEdit })
      .eq("id", id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }

    setEditandoId(null);
    onCambio();
  };

  const eliminarGasto = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return;

    const { error } = await supabase.from("gastos").delete().eq("id", id);

    if (error) {
      alert("Error al eliminar: " + error.message);
      return;
    }

    onCambio();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCerrar}
    >
      <div
        className="bg-[var(--paper-raised)] text-[var(--ink)] rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-[14px]">{celda.categoria}</div>
            <div className="text-[12px] text-[var(--mid)]">
              {celda.responsable} • día {celda.dia}
            </div>
          </div>
          <button onClick={onCerrar} className="text-[var(--mid)] text-[18px]">
            ✕
          </button>
        </div>

        <div className="space-y-2">
          {gastosDeLaCelda.length === 0 ? (
            <div className="text-[13px] text-[var(--mid)] text-center py-4">Sin gastos</div>
          ) : (
            gastosDeLaCelda.map((g) =>
              editandoId === g.id ? (
                <div key={g.id} className="border border-[var(--accent)] rounded-lg p-2 space-y-2">
                  <input
                    type="number"
                    value={montoEdit}
                    onChange={(e) => setMontoEdit(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[var(--border)] rounded text-[13px]"
                    placeholder="Monto"
                  />
                  <input
                    type="text"
                    value={descEdit}
                    onChange={(e) => setDescEdit(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[var(--border)] rounded text-[13px]"
                    placeholder="Título (obligatorio)"
                    required
                  />
                  <select
                    value={ambitoEdit}
                    onChange={(e) => setAmbitoEdit(e.target.value)}
                    className="w-full px-2 py-1.5 border border-[var(--border)] rounded text-[13px]"
                  >
                    <option value="ninguno">Ámbito: Ninguno</option>
                    <option value="casa">Ámbito: Casa</option>
                    <option value="parcela">Ámbito: Parcela</option>
                    <option value="ambos">Ámbito: Ambos</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={() => guardarEdicion(g.id)}
                      className="flex-1 px-2 py-1.5 bg-[var(--green-bg)] text-[var(--green)] rounded text-[12px] font-bold"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditandoId(null)}
                      className="px-3 py-1.5 bg-[var(--accent-bg)] text-[var(--mid)] rounded text-[12px] font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  key={g.id}
                  className="flex justify-between items-center border border-[var(--border)] rounded-lg p-2"
                >
                  <div>
                    <div className="font-bold text-[13px]">{fmt(g.monto)}</div>
                    <div className="text-[11px] text-[var(--mid)]">
                      {g.descripcion || "Sin descripción"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => iniciarEdicion(g)}
                      className="text-[11px] px-2 py-1 bg-[var(--accent-bg)] text-[var(--accent)] rounded font-bold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarGasto(g.id)}
                      className="text-[11px] px-2 py-1 bg-[var(--red-bg)] text-[var(--red)] rounded font-bold"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
