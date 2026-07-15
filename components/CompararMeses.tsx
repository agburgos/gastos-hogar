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

const AMBITOS = [
  { value: "todos", label: "Todos" },
  { value: "casa", label: "Casa" },
  { value: "parcela", label: "Parcela" },
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default function CompararMeses() {
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [macroSel, setMacroSel] = useState<string>("total");
  const [subSel, setSubSel] = useState<string>("todas");
  const [ambitoSel, setAmbitoSel] = useState<string>("todos");
  const [nMeses, setNMeses] = useState(6);
  const [datos, setDatos] = useState<{ label: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

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
      const meses: { año: number; mes: number; label: string }[] = [];
      for (let i = nMeses - 1; i >= 0; i--) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
        meses.push({ año: d.getFullYear(), mes: d.getMonth(), label: MESES_CORTOS[d.getMonth()] });
      }

      const inicio = new Date(meses[0].año, meses[0].mes, 1);
      const fin = new Date(meses[meses.length - 1].año, meses[meses.length - 1].mes + 1, 1);

      let query = supabase
        .from("gastos")
        .select("monto, es_abono, fecha, ambito, categoria_id, categorias ( macro_id )")
        .gte("fecha", inicio.toISOString().slice(0, 10))
        .lt("fecha", fin.toISOString().slice(0, 10));

      const { data } = await query;

      const porMes = new Map<string, number>();
      meses.forEach((m) => porMes.set(`${m.año}-${m.mes}`, 0));

      (data || []).forEach((g: any) => {
        // filtro ámbito: "ambos" siempre cuenta para casa y parcela
        if (ambitoSel !== "todos" && g.ambito !== ambitoSel && g.ambito !== "ambos") return;
        // filtro macro
        if (macroSel !== "total" && g.categorias?.macro_id !== macroSel) return;
        // filtro subcategoría
        if (subSel !== "todas" && g.categoria_id !== subSel) return;

        const f = new Date(g.fecha + "T00:00:00");
        const key = `${f.getFullYear()}-${f.getMonth()}`;
        if (porMes.has(key)) {
          porMes.set(key, (porMes.get(key) || 0) + (g.es_abono ? -g.monto : g.monto));
        }
      });

      setDatos(meses.map((m) => ({ label: m.label, total: porMes.get(`${m.año}-${m.mes}`) || 0 })));
      setLoading(false);
    };

    cargar();
  }, [macroSel, subSel, ambitoSel, nMeses]);

  const max = Math.max(...datos.map((d) => d.total), 1);

  return (
    <div className="rise-in">
      <h2 className="text-[15px] font-bold mb-3">Comparar meses</h2>

      <div className="flex flex-wrap gap-2 mb-2">
        <select
          value={macroSel}
          onChange={(e) => setMacroSel(e.target.value)}
          className="!w-auto text-[12px] !py-1.5 !px-2"
        >
          <option value="total">Total general</option>
          {macros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>

        {categorias.length > 0 && (
          <select
            value={subSel}
            onChange={(e) => setSubSel(e.target.value)}
            className="!w-auto text-[12px] !py-1.5 !px-2"
          >
            <option value="todas">Todas las subcategorías</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        )}

        <select
          value={ambitoSel}
          onChange={(e) => setAmbitoSel(e.target.value)}
          className="!w-auto text-[12px] !py-1.5 !px-2"
        >
          {AMBITOS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        <select
          value={nMeses}
          onChange={(e) => setNMeses(parseInt(e.target.value))}
          className="!w-auto text-[12px] !py-1.5 !px-2"
        >
          <option value={3}>3 meses</option>
          <option value={6}>6 meses</option>
          <option value={12}>12 meses</option>
        </select>
      </div>

      {loading ? (
        <div className="text-[13px] text-[var(--ink-soft)] py-6">Cargando...</div>
      ) : (
        <div className="bg-[var(--paper-raised)] rounded-2xl p-4 flex items-end gap-2 sm:gap-4 h-[160px] mt-2">
          {datos.map((d, i) => {
            const h = max > 0 ? Math.max((d.total / max) * 100, d.total > 0 ? 4 : 0) : 0;
            const isLast = i === datos.length - 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-[10px] font-semibold text-[var(--ink-soft)] mb-1 whitespace-nowrap">
                  {d.total > 0 ? fmt(d.total).replace("$", "") : ""}
                </div>
                <div
                  className="w-full rounded-t-md transition-all duration-500 ease-out"
                  style={{
                    height: `${h}%`,
                    background: isLast ? "var(--accent)" : "rgba(255,255,255,0.18)",
                    minHeight: d.total > 0 ? 4 : 0,
                  }}
                />
                <div className="text-[10px] font-semibold uppercase text-[var(--ink-soft)] mt-1.5">{d.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
