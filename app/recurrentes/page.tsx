"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Empty } from "@/components/ui";
import { fmt, ymdLocal, norm } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Recurrente {
  id: string;
  descripcion: string;
  monto: number;
  fecha: string;
  responsable_id: string;
  responsable: string;
  macro: string;
  categoria: string;
  meses: number; // en cuántos meses aparece este gasto (por título + responsable)
  desde: string; // primera fecha registrada
  duplicado: boolean;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function RecurrentesPage() {
  const hoy = new Date();
  const [año, setAño] = useState(hoy.getFullYear());
  const [mesIdx, setMesIdx] = useState(hoy.getMonth());
  const [items, setItems] = useState<Recurrente[]>([]);
  const [loading, setLoading] = useState(true);
  const [persona, setPersona] = useState<"todos" | "Gloria Roa" | "Alberto Garrido">("todos");

  const mesActualInicio = ymdLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const mesInicio = ymdLocal(new Date(año, mesIdx, 1));
  const mesFin = ymdLocal(new Date(año, mesIdx + 1, 1));
  const esMesPasado = mesInicio < mesActualInicio;

  const cargar = async () => {
    setLoading(true);

    const { data: usuariosData } = await supabase.from("usuarios").select("id, nombre");
    const nombrePorId = new Map((usuariosData || []).map((u: any) => [u.id, u.nombre]));

    // Todos los recurrentes (para contar meses y primera fecha por título + responsable)
    const { data } = await supabase
      .from("gastos")
      .select("id, descripcion, monto, fecha, responsable_id, categorias ( nombre, categorias_macro ( nombre ) )")
      .eq("recurrente", true)
      .eq("es_abono", false)
      .order("fecha", { ascending: true });

    const filas = (data || []) as any[];
    const clave = (g: any) => `${norm(g.descripcion || "")}|${g.responsable_id}`;

    const historial = new Map<string, { meses: Set<string>; desde: string }>();
    filas.forEach((g) => {
      const k = clave(g);
      const h = historial.get(k) || { meses: new Set<string>(), desde: g.fecha };
      h.meses.add(g.fecha.slice(0, 7));
      if (g.fecha < h.desde) h.desde = g.fecha;
      historial.set(k, h);
    });

    const delMes = filas.filter((g) => g.fecha >= mesInicio && g.fecha < mesFin);
    const repetidos = new Map<string, number>();
    delMes.forEach((g) => repetidos.set(clave(g), (repetidos.get(clave(g)) || 0) + 1));

    const parsed: Recurrente[] = delMes
      .map((g) => {
        const h = historial.get(clave(g))!;
        return {
          id: g.id,
          descripcion: (g.descripcion || "Sin título").trim(),
          monto: g.monto,
          fecha: g.fecha,
          responsable_id: g.responsable_id,
          responsable: nombrePorId.get(g.responsable_id) || "Desconocido",
          macro: g.categorias?.categorias_macro?.nombre || "Sin clasificar",
          categoria: g.categorias?.nombre || "Sin categoría",
          meses: h.meses.size,
          desde: h.desde,
          duplicado: (repetidos.get(clave(g)) || 0) > 1,
        };
      })
      .sort((a, b) => b.monto - a.monto);

    setItems(parsed);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [año, mesIdx]);

  const cambiarMes = (delta: number) => {
    const d = new Date(año, mesIdx + delta, 1);
    setAño(d.getFullYear());
    setMesIdx(d.getMonth());
  };

  // Deja de repetir: este y los meses siguientes ya no son recurrentes; las copias de meses futuros se borran.
  const dejarDeRepetir = async (r: Recurrente) => {
    if (
      !confirm(
        `¿Dejar de repetir "${r.descripcion}"?\n\nEste mes queda como gasto normal y se borran las copias de meses futuros. Los meses pasados no se tocan.`
      )
    )
      return;

    // Este mes: se identifica por id (la descripción puede tener espacios finales en la base)
    const { data: esteMes, error: e1 } = await supabase
      .from("gastos")
      .update({ recurrente: false })
      .eq("id", r.id)
      .select("id");
    if (e1) return alert("Error: " + e1.message);
    if (!esteMes || esteMes.length === 0) {
      return alert("No se pudo modificar: la base de datos no permite cambiar este gasto (permisos).");
    }

    const { data: futuras } = await supabase
      .from("gastos")
      .select("id, descripcion")
      .eq("recurrente", true)
      .eq("responsable_id", r.responsable_id)
      .gte("fecha", mesFin);
    const ids = (futuras || []).filter((f: any) => norm(f.descripcion || "") === norm(r.descripcion)).map((f: any) => f.id);
    if (ids.length > 0) {
      const { error: e2 } = await supabase.from("gastos").delete().in("id", ids);
      if (e2) return alert("Error al borrar copias futuras: " + e2.message);
    }
    await cargar();
  };

  const visibles = items.filter((i) => persona === "todos" || i.responsable === persona);
  const total = visibles.reduce((s, i) => s + i.monto, 0);
  const totalGloria = items.filter((i) => i.responsable === "Gloria Roa").reduce((s, i) => s + i.monto, 0);
  const totalAlberto = items.filter((i) => i.responsable === "Alberto Garrido").reduce((s, i) => s + i.monto, 0);
  const hayDuplicados = visibles.some((i) => i.duplicado);

  return (
    <div className="space-y-3 pb-8">
      <h1 className="text-[18px] font-bold px-1">Gastos recurrentes</h1>

      <div className="flex items-center gap-3">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold text-[var(--ink-soft)] capitalize min-w-[120px] text-center">
          {MESES[mesIdx]} {año}
        </span>
        <button
          onClick={() => cambiarMes(1)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          ›
        </button>
        <span className="ml-auto text-[13px] font-bold">{fmt(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card title="Gloria">
          <div className="text-[18px] font-bold text-[var(--accent)]">{fmt(totalGloria)}</div>
        </Card>
        <Card title="Alberto">
          <div className="text-[18px] font-bold text-[var(--accent)]">{fmt(totalAlberto)}</div>
        </Card>
      </div>

      <div className="flex gap-2">
        {([
          { v: "todos", label: "Ambos" },
          { v: "Gloria Roa", label: "Gloria" },
          { v: "Alberto Garrido", label: "Alberto" },
        ] as const).map((p) => (
          <button
            key={p.v}
            onClick={() => setPersona(p.v)}
            className={`flex-1 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
              persona === p.v ? "bg-[var(--accent)] text-white" : "bg-[var(--accent-bg)] text-[var(--accent)]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {hayDuplicados && (
        <div className="text-[12px] text-[var(--red)] bg-[var(--red-bg)] rounded-lg px-3 py-2 font-semibold">
          ⚠ Hay gastos recurrentes repetidos este mes (mismo título). Revísalos en Gastos.
        </div>
      )}

      {loading ? (
        <Card>
          <div className="text-center text-[14px] text-[var(--ink-soft)]">Cargando...</div>
        </Card>
      ) : visibles.length === 0 ? (
        <Empty icon="↻" text="Sin gastos recurrentes este mes" />
      ) : (
        <div className="bg-[var(--paper-raised)] rounded-2xl divide-y divide-[var(--rule)]">
          {visibles.map((r) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[14px] font-semibold">{r.descripcion}</span>
                  {r.duplicado && <Badge color="red">⚠ Repetido</Badge>}
                </div>
                <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                  {r.macro} › {r.categoria} · {r.responsable}
                </div>
                <div className="text-[11px] text-[var(--ink-faint)] mt-0.5">
                  Desde{" "}
                  {new Date(r.desde + "T00:00:00").toLocaleDateString("es-CL", { month: "short", year: "numeric" })} ·{" "}
                  {r.meses} mes{r.meses === 1 ? "" : "es"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[15px] font-bold">{fmt(r.monto)}</span>
                {!esMesPasado && (
                  <button
                    onClick={() => dejarDeRepetir(r)}
                    className="text-[11px] px-2 py-1 rounded-full bg-[var(--red-bg)] text-[var(--red)] font-semibold"
                  >
                    Dejar de repetir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
