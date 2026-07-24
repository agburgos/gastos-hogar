"use client";

import { useEffect, useState } from "react";
import { fmt } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Macro {
  id: string;
  nombre: string;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Serie {
  id: string;
  nombre: string;
  color: string;
}

interface MesCol {
  key: string;
  label: string;
  esFuturo: boolean;
  esActual: boolean;
  total: number;
  porSerie: Map<string, number>; // seriesId -> monto
}

const AMBITOS = [
  { value: "todos", label: "Todos" },
  { value: "casa", label: "Casa" },
  { value: "parcela", label: "Parcela" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Paleta estable: cada clasificación conserva su color por su posición.
const PALETA = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899",
  "#84cc16", "#f97316", "#6366f1", "#06b6d4", "#a855f7", "#eab308", "#64748b",
];

export default function CompararMeses() {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [macroSel, setMacroSel] = useState<string>("total");
  const [subSel, setSubSel] = useState<string>("todas");
  const [ambitoSel, setAmbitoSel] = useState<string>("todos");
  const [nMeses, setNMeses] = useState(6);
  const [meses, setMeses] = useState<MesCol[]>([]);
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesHover, setMesHover] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const initCategorias = async () => {
      const { data } = await supabase
        .from("categorias_macro")
        .select("id, nombre")
        .neq("nombre", "Sin Clasificar")
        .order("orden");
      setMacros(data || []);
    };
    initCategorias();
  }, []);

  useEffect(() => {
    const cargarSubs = async () => {
      if (macroSel === "total") {
        setCategorias([]);
        setSubSel("todas");
        return;
      }
      const { data } = await supabase
        .from("categorias")
        .select("id, nombre")
        .eq("macro_id", macroSel)
        .order("orden");
      setCategorias(data || []);
      setSubSel("todas");
    };
    cargarSubs();
  }, [macroSel]);

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const hoy = new Date();

      // Meses base: nMeses pasados + el actual
      const mesesBase: { año: number; mes: number }[] = [];
      for (let i = nMeses - 1; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        mesesBase.push({ año: d.getFullYear(), mes: d.getMonth() });
      }
      const inicio = new Date(mesesBase[0].año, mesesBase[0].mes, 1);
      // Traemos hasta 12 meses hacia adelante para proyectar cuotas comprometidas
      const finFuturo = new Date(hoy.getFullYear(), hoy.getMonth() + 13, 1);

      const { data } = await supabase
        .from("gastos")
        .select("monto, es_abono, fecha, ambito, categoria_id, categorias ( macro_id, nombre, categorias_macro ( nombre ) )")
        .gte("fecha", inicio.toISOString().slice(0, 10))
        .lt("fecha", finFuturo.toISOString().slice(0, 10));

      // Definir las series (dimensión a apilar) y su color estable
      let seriesDef: Serie[] = [];
      if (macroSel === "total") {
        seriesDef = macros.map((m, i) => ({ id: m.id, nombre: m.nombre, color: PALETA[i % PALETA.length] }));
      } else if (subSel === "todas") {
        seriesDef = categorias.map((c, i) => ({ id: c.id, nombre: c.nombre, color: PALETA[i % PALETA.length] }));
      } else {
        const nombre = categorias.find((c) => c.id === subSel)?.nombre || "Seleccionada";
        const idx = categorias.findIndex((c) => c.id === subSel);
        seriesDef = [{ id: subSel, nombre, color: PALETA[(idx >= 0 ? idx : 0) % PALETA.length] }];
      }

      // Función: a qué serie pertenece un gasto (o null si se filtra fuera)
      const serieDe = (g: any): string | null => {
        if (ambitoSel !== "todos" && g.ambito !== ambitoSel && g.ambito !== "ambos") return null;
        if (macroSel === "total") return g.categorias?.macro_id || null;
        if (g.categorias?.macro_id !== macroSel) return null;
        if (subSel !== "todas" && g.categoria_id !== subSel) return null;
        return g.categoria_id;
      };

      // Acumular por mes -> serie
      const acumPorMes = new Map<string, Map<string, number>>();
      const mesActualKey = `${hoy.getFullYear()}-${hoy.getMonth()}`;
      const futurosConDato = new Set<string>();

      (data || []).forEach((g: any) => {
        if (g.es_abono) return;
        const sid = serieDe(g);
        if (!sid) return;
        const f = new Date(g.fecha + "T00:00:00");
        const key = `${f.getFullYear()}-${f.getMonth()}`;
        if (!acumPorMes.has(key)) acumPorMes.set(key, new Map());
        const m = acumPorMes.get(key)!;
        m.set(sid, (m.get(sid) || 0) + g.monto);
        // ¿es un mes futuro (posterior al actual)?
        if (f.getFullYear() > hoy.getFullYear() || (f.getFullYear() === hoy.getFullYear() && f.getMonth() > hoy.getMonth())) {
          futurosConDato.add(key);
        }
      });

      // Construir columnas: meses base + meses futuros que tengan datos (proyección de cuotas)
      const keysBase = mesesBase.map((m) => `${m.año}-${m.mes}`);
      const keysFuturo = Array.from(futurosConDato).sort((a, b) => {
        const [ay, am] = a.split("-").map(Number);
        const [by, bm] = b.split("-").map(Number);
        return ay * 12 + am - (by * 12 + bm);
      });
      const todasKeys = [...keysBase, ...keysFuturo];

      const cols: MesCol[] = todasKeys.map((key) => {
        const [año, mes] = key.split("-").map(Number);
        const porSerie = acumPorMes.get(key) || new Map();
        let total = 0;
        porSerie.forEach((v) => (total += v));
        return {
          key,
          label: MESES_CORTOS[mes] + (mes === 0 ? ` ${String(año).slice(2)}` : ""),
          esFuturo: key !== mesActualKey && keysFuturo.includes(key),
          esActual: key === mesActualKey,
          total,
          porSerie,
        };
      });

      // Solo mostrar series que tengan algún valor en el rango visible
      const seriesConDato = seriesDef.filter((s) =>
        cols.some((c) => (c.porSerie.get(s.id) || 0) > 0)
      );

      setSeries(seriesConDato);
      setMeses(cols);
      setLoading(false);
    };

    cargar();
  }, [macroSel, subSel, ambitoSel, nMeses, macros, categorias]);

  const max = Math.max(...meses.map((m) => m.total), 1);
  const colHover = meses.find((m) => m.key === mesHover);

  return (
    <div className="rise-in">
      <h2 className="text-[15px] font-bold mb-3">Comparar meses</h2>

      <div className="flex flex-wrap gap-2 mb-2">
        <select value={macroSel} onChange={(e) => setMacroSel(e.target.value)} className="!w-auto text-[12px] !py-1.5 !px-2">
          <option value="total">Total general</option>
          {macros.map((m) => (
            <option key={m.id} value={m.id}>{m.nombre}</option>
          ))}
        </select>

        {categorias.length > 0 && (
          <select value={subSel} onChange={(e) => setSubSel(e.target.value)} className="!w-auto text-[12px] !py-1.5 !px-2">
            <option value="todas">Todas las subcategorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        )}

        <select value={ambitoSel} onChange={(e) => setAmbitoSel(e.target.value)} className="!w-auto text-[12px] !py-1.5 !px-2">
          {AMBITOS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        <select value={nMeses} onChange={(e) => setNMeses(parseInt(e.target.value))} className="!w-auto text-[12px] !py-1.5 !px-2">
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
        </select>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--ink-soft)] py-6">Cargando...</div>
      ) : (
        <div className="bg-[var(--paper-raised)] rounded-2xl p-4 relative">
          {/* Tooltip compacto que sigue el cursor (como la foto, pero chico) */}
          {colHover && colHover.total > 0 && (
            <div
              className="fixed z-50 w-[220px] bg-[var(--paper)] border border-[var(--border)] rounded-xl p-2.5 shadow-lg pointer-events-none"
              style={{
                left: Math.min(tipPos.x + 14, (typeof window !== "undefined" ? window.innerWidth : 400) - 232),
                top: tipPos.y + 14,
              }}
            >
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[12px] font-bold capitalize">{colHover.label}</span>
                <span className="text-[12px] font-bold">{fmt(colHover.total)}</span>
              </div>
              <div className="space-y-0.5 max-h-[160px] overflow-y-auto">
                {series
                  .map((s) => ({ s, v: colHover.porSerie.get(s.id) || 0 }))
                  .filter((x) => x.v > 0)
                  .sort((a, b) => b.v - a.v)
                  .map(({ s, v }) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                        <span className="truncate">{s.nombre}</span>
                      </span>
                      <span className="font-semibold shrink-0">{fmt(v)}</span>
                    </div>
                  ))}
              </div>
              {colHover.esFuturo && (
                <div className="text-[10px] text-[var(--ink-soft)] mt-1.5">Proyección por cuotas</div>
              )}
            </div>
          )}

          {/* Barras apiladas */}
          <div className="flex items-end gap-1.5 sm:gap-2.5 h-[180px]">
            {meses.map((m) => {
              const hTotal = max > 0 ? Math.max((m.total / max) * 100, m.total > 0 ? 3 : 0) : 0;
              return (
                <div
                  key={m.key}
                  className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
                  onMouseEnter={(e) => {
                    setMesHover(m.key);
                    setTipPos({ x: e.clientX, y: e.clientY });
                  }}
                  onMouseMove={(e) => setTipPos({ x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setMesHover(null)}
                  onClick={(e) => {
                    setTipPos({ x: e.clientX, y: e.clientY });
                    setMesHover((prev) => (prev === m.key ? null : m.key));
                  }}
                >
                  <div className="text-[9px] font-semibold text-[var(--ink-soft)] mb-1 whitespace-nowrap">
                    {m.total > 0 ? fmt(m.total).replace("$", "") : ""}
                  </div>
                  {/* columna apilada */}
                  <div
                    className={`w-full rounded-t-md overflow-hidden flex flex-col-reverse transition-all duration-300 ${
                      m.esActual ? "ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--paper-raised)]" : ""
                    } ${m.esFuturo ? "opacity-60" : ""}`}
                    style={{ height: `${hTotal}%`, minHeight: m.total > 0 ? 3 : 0 }}
                  >
                    {series.map((s) => {
                      const v = m.porSerie.get(s.id) || 0;
                      if (v <= 0) return null;
                      const segH = m.total > 0 ? (v / m.total) * 100 : 0;
                      return (
                        <div
                          key={s.id}
                          style={{
                            height: `${segH}%`,
                            background: s.color,
                            backgroundImage: m.esFuturo
                              ? "repeating-linear-gradient(45deg, rgba(255,255,255,0.25) 0 3px, transparent 3px 6px)"
                              : undefined,
                          }}
                        />
                      );
                    })}
                  </div>
                  <div
                    className={`text-[9px] font-semibold uppercase mt-1.5 whitespace-nowrap ${
                      m.esActual ? "text-[var(--accent)]" : m.esFuturo ? "text-[var(--ink-faint)]" : "text-[var(--ink-soft)]"
                    }`}
                  >
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leyenda */}
          {series.length > 1 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-4 pt-3 border-t border-[var(--border)]">
              {series.map((s) => (
                <span key={s.id} className="flex items-center gap-1.5 text-[11px] text-[var(--ink-soft)]">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  {s.nombre}
                </span>
              ))}
            </div>
          )}

          {meses.some((m) => m.esFuturo) && (
            <div className="flex items-center gap-1.5 text-[10px] text-[var(--ink-faint)] mt-2">
              <span
                className="inline-block w-3 h-3 rounded-sm shrink-0 opacity-60"
                style={{
                  background: "var(--ink-faint)",
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 4px)",
                }}
              />
              Meses futuros = proyección por cuotas ya comprometidas
            </div>
          )}
        </div>
      )}
    </div>
  );
}
