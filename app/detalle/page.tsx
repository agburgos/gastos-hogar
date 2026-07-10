"use client";

import { useEffect, useState } from "react";
import { Card, Badge } from "@/components/ui";
import { fmt, fmtDate, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Gasto {
  id: string;
  monto: number;
  descripcion: string | null;
  categoria_nombre: string;
  responsable_nombre: string;
  fecha: string;
  compartido: boolean;
}

interface GastoAgrupado {
  [macroNombre: string]: {
    subtotal: number;
    gastos: {
      [categoriaNombre: string]: {
        subtotal: number;
        gastos: Gasto[];
      };
    };
  };
}

export default function DetallePage() {
  const [mesSeleccionado, setMesSeleccionado] = useState(ymdLocal(new Date()).slice(0, 7));
  const [gastos, setGastos] = useState<GastoAgrupado>({});
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [expandidosCategoria, setExpandidosCategoria] = useState<Set<string>>(new Set());
  const [filtroMacro, setFiltroMacro] = useState<string>("");
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setPending(true);
      const [año, mes] = mesSeleccionado.split("-");
      const mesInicio = new Date(parseInt(año), parseInt(mes) - 1, 1);
      const mesFin = new Date(parseInt(año), parseInt(mes), 1);
      const mesInicioStr = mesInicio.toISOString().slice(0, 10);
      const mesFinStr = mesFin.toISOString().slice(0, 10);

      // Traer gastos con detalles de categorías
      const { data } = await supabase
        .from("gastos")
        .select(
          `
          id,
          monto,
          descripcion,
          fecha,
          compartido,
          categoria_id,
          responsable_id,
          categorias (
            nombre,
            categorias_macro (
              nombre
            )
          ),
          usuarios (
            nombre
          )
        `
        )
        .gte("fecha", mesInicioStr)
        .lt("fecha", mesFinStr)
        .order("fecha", { ascending: false });

      // Agrupar por macro -> categoria
      const agrupado: GastoAgrupado = {};

      data?.forEach((g: any) => {
        const macroNombre = g.categorias?.categorias_macro?.nombre || "Sin clasificar";
        const categoriaNombre = g.categorias?.nombre || "Sin categoría";
        const responsableNombre = g.usuarios?.nombre || "Desconocido";

        if (!agrupado[macroNombre]) {
          agrupado[macroNombre] = { subtotal: 0, gastos: {} };
        }

        if (!agrupado[macroNombre].gastos[categoriaNombre]) {
          agrupado[macroNombre].gastos[categoriaNombre] = { subtotal: 0, gastos: [] };
        }

        const gasto: Gasto = {
          id: g.id,
          monto: g.monto,
          descripcion: g.descripcion,
          categoria_nombre: categoriaNombre,
          responsable_nombre: responsableNombre,
          fecha: g.fecha,
          compartido: g.compartido,
        };

        agrupado[macroNombre].gastos[categoriaNombre].gastos.push(gasto);
        agrupado[macroNombre].gastos[categoriaNombre].subtotal += g.monto;
        agrupado[macroNombre].subtotal += g.monto;
      });

      setGastos(agrupado);
      setPending(false);
    };

    fetch();
  }, [mesSeleccionado]);

  const toggleMacro = (macro: string) => {
    const newSet = new Set(expandidos);
    if (newSet.has(macro)) {
      newSet.delete(macro);
    } else {
      newSet.add(macro);
    }
    setExpandidos(newSet);
  };

  const toggleCategoria = (key: string) => {
    const newSet = new Set(expandidosCategoria);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandidosCategoria(newSet);
  };

  const macrosEnFiltro = filtroMacro ? [filtroMacro] : Object.keys(gastos);
  const totalGeneral = macrosEnFiltro.reduce((sum, macro) => sum + (gastos[macro]?.subtotal || 0), 0);

  if (pending) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
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

      {/* Filtro de clasificación */}
      <Card title="Filtrar por categoría">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFiltroMacro("")}
            className={`px-3 py-2 rounded-lg text-[12px] font-bold transition-colors ${
              filtroMacro === ""
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--accent-bg)] text-[var(--accent)]"
            }`}
          >
            Todas
          </button>
          {Object.keys(gastos).map((macro) => (
            <button
              key={macro}
              onClick={() => setFiltroMacro(macro)}
              className={`px-3 py-2 rounded-lg text-[12px] font-bold transition-colors ${
                filtroMacro === macro
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-bg)] text-[var(--accent)]"
              }`}
            >
              {macro}
            </button>
          ))}
        </div>
      </Card>

      {/* Total general */}
      <Card accent>
        <div className="flex justify-between items-center">
          <div className="text-[12px] text-[var(--mid)]">Total</div>
          <div className="text-2xl font-bold text-[var(--accent)]">{fmt(totalGeneral)}</div>
        </div>
      </Card>

      {/* Tabla de gastos */}
      <div className="space-y-1">
        {macrosEnFiltro.map((macro) => {
          const macroData = gastos[macro];
          if (!macroData) return null;

          const isExpanded = expandidos.has(macro);

          return (
            <div key={macro} className="border border-[var(--border)] rounded-lg overflow-hidden">
              {/* Fila de macrocategoría */}
              <button
                onClick={() => toggleMacro(macro)}
                className="w-full px-4 py-3 bg-[var(--accent-bg)] hover:bg-[var(--accent)] hover:text-white transition-colors flex justify-between items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[18px]">{isExpanded ? "▼" : "▶"}</span>
                  <span className="font-bold text-[14px]">{macro}</span>
                </div>
                <span className="font-bold text-[15px]">{fmt(macroData.subtotal)}</span>
              </button>

              {/* Categorías (expandible) */}
              {isExpanded && (
                <div className="bg-[var(--warm-white)] border-t border-[var(--border)]">
                  {Object.entries(macroData.gastos).map(([categoria, catData]) => {
                    const catKey = `${macro}-${categoria}`;
                    const catExpanded = expandidosCategoria.has(catKey);

                    return (
                      <div key={catKey} className="border-b border-[var(--border)] last:border-b-0">
                        {/* Fila de categoría */}
                        <button
                          onClick={() => toggleCategoria(catKey)}
                          className="w-full px-6 py-2.5 bg-[var(--accent-bg)]/30 hover:bg-[var(--accent-bg)] transition-colors flex justify-between items-center text-[13px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px]">{catExpanded ? "▼" : "▶"}</span>
                            <span className="font-semibold text-[var(--charcoal)]">{categoria}</span>
                          </div>
                          <span className="font-bold text-[var(--charcoal)]">{fmt(catData.subtotal)}</span>
                        </button>

                        {/* Gastos individuales (expandible) */}
                        {catExpanded && (
                          <div className="bg-white">
                            {catData.gastos.map((gasto) => (
                              <div
                                key={gasto.id}
                                className="px-8 py-2.5 border-t border-[var(--border)]/50 flex justify-between items-start text-[12px] hover:bg-[var(--accent-bg)]/20 transition-colors"
                              >
                                <div className="flex-1">
                                  <div className="text-[var(--charcoal)] font-medium">
                                    {gasto.descripcion || "Sin descripción"}
                                  </div>
                                  <div className="text-[11px] text-[var(--mid)] mt-0.5">
                                    {gasto.responsable_nombre} • {fmtDate(gasto.fecha)}
                                  </div>
                                </div>
                                <div className="text-right ml-2">
                                  <div className="font-bold">{fmt(gasto.monto)}</div>
                                  {!gasto.compartido && (
                                    <Badge color="gray">Personal</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
