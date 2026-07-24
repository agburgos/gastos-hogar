"use client";

import { useEffect, useState } from "react";
import { Card, Badge, Empty } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Gasto {
  id: string;
  monto: number;
  descripcion: string | null;
  fecha: string;
  compartido: boolean;
  recurrente: boolean;
  es_abono: boolean;
  ambito: string;
  categoria_id: string;
  categoria_nombre: string;
  macro_nombre: string;
  responsable_nombre: string;
  cuota_numero: number | null;
  cuota_total: number | null;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default function GastosPage() {
  const [año, setAño] = useState(new Date().getFullYear());
  const [mesIdx, setMesIdx] = useState(new Date().getMonth());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [montoEdit, setMontoEdit] = useState("");
  const [descEdit, setDescEdit] = useState("");

  const generarRecurrentes = async () => {
    const mesAnterior = new Date(año, mesIdx - 1, 1);
    const mesPrevioInicio = mesAnterior.toISOString().slice(0, 10);
    const mesPrevioFin = new Date(año, mesIdx, 1).toISOString().slice(0, 10);

    // Traer gastos recurrentes del mes anterior
    const { data: recurrentes } = await supabase
      .from("gastos")
      .select("id, monto, descripcion, categoria_id, responsable_id, compartido, ambito")
      .eq("recurrente", true)
      .gte("fecha", mesPrevioInicio)
      .lt("fecha", mesPrevioFin);

    if (!recurrentes || recurrentes.length === 0) return;

    // Para cada recurrente, verificar si existe en este mes
    const mesActualInicio = new Date(año, mesIdx, 1).toISOString().slice(0, 10);
    for (const gasto of recurrentes) {
      const { data: existe } = await supabase
        .from("gastos")
        .select("id")
        .eq("descripcion", gasto.descripcion)
        .eq("responsable_id", gasto.responsable_id)
        .gte("fecha", mesActualInicio)
        .limit(1);

      // Si no existe, crear
      if (!existe || existe.length === 0) {
        const proximaFecha = new Date(año, mesIdx, 1);
        await supabase.from("gastos").insert({
          monto: gasto.monto,
          descripcion: gasto.descripcion,
          categoria_id: gasto.categoria_id,
          responsable_id: gasto.responsable_id,
          fecha: ymdLocal(proximaFecha),
          compartido: gasto.compartido,
          ambito: gasto.ambito || "ninguno",
          recurrente: true,
        });
      }
    }
  };

  const cargar = async () => {
    setLoading(true);
    await generarRecurrentes();

    const mesInicio = new Date(año, mesIdx, 1);
    const mesFin = new Date(año, mesIdx + 1, 1);

    const { data } = await supabase
      .from("gastos")
      .select(
        `
        id, monto, descripcion, fecha, compartido, recurrente, es_abono, ambito, categoria_id, cuota_numero, cuota_total,
        categorias ( nombre, categorias_macro ( nombre ) ),
        usuarios ( nombre )
      `
      )
      .gte("fecha", mesInicio.toISOString().slice(0, 10))
      .lt("fecha", mesFin.toISOString().slice(0, 10))
      .order("fecha", { ascending: false });

    const parsed: Gasto[] = (data || []).map((g: any) => ({
      id: g.id,
      monto: g.monto,
      descripcion: g.descripcion,
      fecha: g.fecha,
      compartido: g.compartido,
      recurrente: g.recurrente || false,
      es_abono: g.es_abono || false,
      ambito: g.ambito || "ninguno",
      categoria_id: g.categoria_id,
      categoria_nombre: g.categorias?.nombre || "Sin categoría",
      macro_nombre: g.categorias?.categorias_macro?.nombre || "Sin clasificar",
      responsable_nombre: g.usuarios?.nombre || "Desconocido",
      cuota_numero: g.cuota_numero ?? null,
      cuota_total: g.cuota_total ?? null,
    }));

    setGastos(parsed);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, [año, mesIdx]);

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

  const iniciarEdicion = (g: Gasto) => {
    setEditandoId(g.id);
    setMontoEdit(String(g.monto));
    setDescEdit(g.descripcion || "");
  };

  const guardarEdicion = async (id: string) => {
    if (!descEdit.trim()) {
      alert("El título es obligatorio");
      return;
    }
    const { error } = await supabase
      .from("gastos")
      .update({ monto: parseFloat(montoEdit), descripcion: descEdit })
      .eq("id", id);

    if (error) {
      alert("Error al editar: " + error.message);
      return;
    }
    setEditandoId(null);
    await cargar();
  };

  const eliminarGasto = async (id: string) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    const { error } = await supabase.from("gastos").delete().eq("id", id);
    if (error) {
      alert("Error al eliminar: " + error.message);
      return;
    }
    await cargar();
  };

  const marcarRecurrente = async (g: Gasto) => {
    if (g.recurrente) {
      alert("Este gasto ya es recurrente.");
      return;
    }
    if (!confirm(`Se generarán 12 meses de "${g.descripcion}" con el mismo monto (${fmt(g.monto)}), atribuidos a ${g.responsable_nombre}. ¿Confirmar?`)) {
      return;
    }

    // marcar el gasto original como recurrente
    await supabase.from("gastos").update({ recurrente: true }).eq("id", g.id);

    // generar las próximas 11 ocurrencias (el mes actual ya existe)
    const cuotaGrupoId = crypto.randomUUID();
    const fechaOriginal = new Date(g.fecha + "T00:00:00");
    const filas = [];
    for (let i = 1; i <= 11; i++) {
      const f = new Date(fechaOriginal.getFullYear(), fechaOriginal.getMonth() + i, fechaOriginal.getDate());
      filas.push({
        monto: g.monto,
        descripcion: g.descripcion,
        categoria_id: g.categoria_id,
        responsable_id: undefined, // se resuelve abajo via responsable original
        fecha: ymdLocal(f),
        compartido: g.compartido,
        ambito: g.ambito,
        recurrente: true,
        cuota_grupo_id: cuotaGrupoId,
      });
    }

    // necesitamos el responsable_id real, no el nombre — lo recuperamos del gasto original
    const { data: original } = await supabase.from("gastos").select("responsable_id").eq("id", g.id).single();
    if (!original) return;

    const filasConResponsable = filas.map((f) => ({ ...f, responsable_id: original.responsable_id }));

    const { error } = await supabase.from("gastos").insert(filasConResponsable);
    if (error) {
      alert("Error al generar recurrencias: " + error.message);
      return;
    }

    await cargar();
  };

  const gastosFiltrados = busqueda.trim()
    ? gastos.filter((g) =>
        (g.descripcion || "").toLowerCase().includes(busqueda.toLowerCase().trim())
      )
    : gastos;

  // Los abonos no son gasto (es plata entregada a la otra persona), no suman al total.
  const total = gastosFiltrados.reduce((sum, g) => sum + (g.es_abono ? 0 : g.monto), 0);

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--ink-soft)]">Cargando...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 pb-8">
      {/* Navegación de mes */}
      <div className="flex items-center gap-3 mb-2">
        <button
          onClick={() => cambiarMes(-1)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white/12 transition-colors"
        >
          ‹
        </button>
        <span className="text-[13px] font-semibold text-[var(--ink-soft)] capitalize min-w-[120px] text-center">
          {MESES[mesIdx]} {año}
        </span>
        <button
          onClick={() => cambiarMes(1)}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white/12 transition-colors"
        >
          ›
        </button>
        <span className="ml-auto text-[13px] font-bold text-[var(--ink)]">{fmt(total)}</span>
      </div>

      <input
        type="text"
        placeholder="🔍 Buscar gasto por título..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {gastos.length === 0 ? (
        <Empty icon="📭" text="Sin gastos este mes" />
      ) : gastosFiltrados.length === 0 ? (
        <Empty icon="🔍" text={`Sin resultados para "${busqueda}"`} />
      ) : (
        <div className="bg-[var(--paper-raised)] rounded-2xl divide-y divide-[var(--rule)]">
          {gastosFiltrados.map((g) =>
            editandoId === g.id ? (
              <div key={g.id} className="p-4 space-y-2">
                <input
                  type="number"
                  value={montoEdit}
                  onChange={(e) => setMontoEdit(e.target.value)}
                  placeholder="Monto"
                />
                <input
                  type="text"
                  value={descEdit}
                  onChange={(e) => setDescEdit(e.target.value)}
                  placeholder="Título (obligatorio)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => guardarEdicion(g.id)}
                    className="flex-1 py-2 rounded-full bg-[var(--green-bg)] text-[var(--green)] text-[13px] font-semibold"
                  >
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditandoId(null)}
                    className="px-4 py-2 rounded-full bg-white/8 text-[var(--ink-soft)] text-[13px] font-semibold"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div key={g.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-semibold truncate">{g.descripcion || "Sin título"}</span>
                    {g.recurrente && <Badge color="gold">↻</Badge>}
                    {g.es_abono && <Badge color="green">Abono</Badge>}
                    {g.cuota_total && g.cuota_total > 1 && (
                      <Badge color="teal">cuota {g.cuota_numero}/{g.cuota_total}</Badge>
                    )}
                  </div>
                  <div className="text-[12px] text-[var(--ink-soft)] mt-0.5">
                    {g.macro_nombre} › {g.categoria_nombre} · {g.responsable_nombre}
                  </div>
                  <div className="text-[11px] text-[var(--ink-faint)] mt-0.5">
                    {new Date(g.fecha + "T00:00:00").toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    {!g.compartido && " · Personal"}
                    {g.ambito !== "ninguno" && ` · ${g.ambito}`}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-[15px] font-bold ${g.es_abono ? "text-[var(--green)]" : ""}`}>
                    {fmt(g.monto)}
                  </span>
                  <div className="flex gap-1">
                    {!g.recurrente && (
                      <button
                        onClick={() => marcarRecurrente(g)}
                        title="Marcar como recurrente"
                        className="text-[11px] px-2 py-1 rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] font-semibold"
                      >
                        ↻
                      </button>
                    )}
                    <button
                      onClick={() => iniciarEdicion(g)}
                      className="text-[11px] px-2 py-1 rounded-full bg-white/8 text-[var(--ink-soft)] hover:text-[var(--ink)] font-semibold"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminarGasto(g.id)}
                      className="text-[11px] px-2 py-1 rounded-full bg-[var(--red-bg)] text-[var(--red)] font-semibold"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
