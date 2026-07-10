"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface GastoRaw {
  id: string;
  monto: number;
  descripcion: string | null;
  fecha: string;
  macro: string;
  categoria: string;
  categoria_id: string;
  responsable: string;
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
        id, monto, descripcion, fecha, categoria_id,
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
      descripcion: g.descripcion,
      fecha: g.fecha,
      macro: g.categorias?.categorias_macro?.nombre || "Sin clasificar",
      categoria: g.categorias?.nombre || "Sin categoría",
      categoria_id: g.categoria_id,
      responsable: g.usuarios?.nombre || "Desconocido",
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
      const dia = parseInt(g.fecha.slice(8, 10));

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

      respNode.porDia.set(dia, (respNode.porDia.get(dia) || 0) + g.monto);
      respNode.total += g.monto;

      catNode.porDia.set(dia, (catNode.porDia.get(dia) || 0) + g.monto);
      catNode.total += g.monto;

      macroNode.porDia.set(dia, (macroNode.porDia.get(dia) || 0) + g.monto);
      macroNode.total += g.monto;

      totalPorDia.set(dia, (totalPorDia.get(dia) || 0) + g.monto);
      totalGeneral += g.monto;
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
          <div ref={tableScrollRef} className="border border-[var(--border)] rounded-lg overflow-x-auto bg-white">
          <table className="border-collapse text-[12px]" style={{ minWidth: "100%" }}>
            <thead>
              <tr className="bg-[var(--gradient)] text-white sticky top-0">
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
                    className={`text-right px-2 py-2 font-bold ${tieneGasto ? "bg-[var(--gold)]/30" : ""}`}
                    style={{ minWidth: colWidth }}
                  >
                    <div className="leading-tight">
                      <div className="text-[10px] font-normal opacity-80 capitalize">{nombreDia(dia)}</div>
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
                            diasConGasto.includes(dia) ? "bg-[var(--gold)]/10" : ""
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
                                className="px-3 py-1.5 pl-8 sticky left-0 bg-white z-10 text-[var(--charcoal)]"
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
                                    diasConGasto.includes(dia) ? "bg-[var(--gold)]/10" : ""
                                  }`}
                                >
                                  {cat.porDia.get(dia) ? fmt(cat.porDia.get(dia)!) : ""}
                                </td>
                              ))}
                            </tr>

                            {/* Filas de responsable (si categoría expandida), ordenadas alfabéticamente */}
                            {catExpanded &&
                              responsablesOrdenados.map((resp) => (
                                <tr
                                  key={`${catKey}__${resp.nombre}`}
                                  className="border-t border-[var(--border)]/30 bg-[var(--linen)]/40"
                                >
                                  <td
                                    className="px-3 py-1 pl-14 sticky left-0 bg-[var(--linen)] z-10 text-[11px] text-[var(--mid)]"
                                    style={{ minWidth: 150 }}
                                  >
                                    —
                                  </td>
                                  <td className="px-2 py-1 text-[11px] font-medium text-[var(--charcoal)]">
                                    {resp.nombre}
                                  </td>
                                  <td className="text-right px-3 py-1 text-[11px] font-semibold">
                                    {fmt(resp.total)}
                                  </td>
                                  {diasDelMes.map((dia) => {
                                    const monto = resp.porDia.get(dia);
                                    return (
                                      <td
                                        key={dia}
                                        onClick={() =>
                                          monto &&
                                          setCeldaSeleccionada({
                                            macro: macro.nombre,
                                            categoria: cat.nombre,
                                            responsable: resp.nombre,
                                            dia,
                                          })
                                        }
                                        className={`text-right px-2 py-1 text-[11px] text-[var(--mid)] ${
                                          monto ? "cursor-pointer underline decoration-dotted hover:bg-[var(--accent-bg)]" : ""
                                        }`}
                                      >
                                        {monto ? fmt(monto) : ""}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[var(--charcoal)] text-white border-t-2 border-[var(--accent)] sticky bottom-0">
                <td className="px-3 py-2 font-bold sticky left-0 bg-[var(--charcoal)] z-10" style={{ minWidth: 150 }}>
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

  const iniciarEdicion = (g: GastoRaw) => {
    setEditandoId(g.id);
    setMontoEdit(String(g.monto));
    setDescEdit(g.descripcion || "");
  };

  const guardarEdicion = async (id: string) => {
    const { error } = await supabase
      .from("gastos")
      .update({ monto: parseFloat(montoEdit), descripcion: descEdit || null })
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
        className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto p-4 space-y-3"
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
                    placeholder="Descripción"
                  />
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
