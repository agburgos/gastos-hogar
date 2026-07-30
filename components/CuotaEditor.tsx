"use client";

import { useEffect, useState } from "react";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Fila {
  id: string;
  fecha: string;
  monto: number;
  descripcion: string | null;
  categoria_id: string;
  responsable_id: string;
  ambito: string | null;
  beneficiario_id: string | null;
  cuota_numero: number | null;
  cuota_total: number | null;
}

export default function CuotaEditor({
  grupoId,
  onClose,
  onSaved,
}: {
  grupoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [totalCuotas, setTotalCuotas] = useState(1);
  const [montoCuota, setMontoCuota] = useState("");

  const hoy = new Date();
  const mesActualStr = ymdLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));

  useEffect(() => {
    const cargar = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("gastos")
        .select(
          "id, fecha, monto, descripcion, categoria_id, responsable_id, ambito, beneficiario_id, cuota_numero, cuota_total"
        )
        .eq("cuota_grupo_id", grupoId)
        .order("fecha", { ascending: true });

      const rows = (data || []) as Fila[];
      setFilas(rows);
      setFechaInicio(rows[0]?.fecha ?? ymdLocal(hoy));
      setTotalCuotas(rows.length || 1);
      setMontoCuota(String(rows[0]?.monto ?? ""));
      setLoading(false);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  const base = filas[0];

  // Genera las fechas del nuevo calendario (para la vista previa)
  const fechasNuevas = (() => {
    if (!fechaInicio) return [];
    const d0 = new Date(fechaInicio + "T00:00:00");
    const out: string[] = [];
    for (let i = 0; i < Math.max(0, totalCuotas); i++) {
      out.push(ymdLocal(new Date(d0.getFullYear(), d0.getMonth() + i, d0.getDate())));
    }
    return out;
  })();

  const guardar = async () => {
    if (!base || !fechaInicio) return;
    setSaving(true);
    try {
      const monto = Math.round(parseFloat(montoCuota) || 0);
      const total = Math.max(1, Math.floor(totalCuotas));

      // borrar todas las filas del grupo y recrear el calendario completo
      const { error: delErr } = await supabase.from("gastos").delete().eq("cuota_grupo_id", grupoId);
      if (delErr) throw delErr;

      const nuevas = fechasNuevas.slice(0, total).map((f, i) => ({
        monto,
        descripcion: base.descripcion,
        categoria_id: base.categoria_id,
        responsable_id: base.responsable_id,
        ambito: base.ambito || "ninguno",
        beneficiario_id: base.beneficiario_id,
        fecha: f,
        compartido: true,
        cuota_grupo_id: grupoId,
        cuota_numero: i + 1,
        cuota_total: total,
      }));
      const { error: insErr } = await supabase.from("gastos").insert(nuevas);
      if (insErr) throw insErr;

      onSaved();
      onClose();
    } catch (e: any) {
      alert("Error al guardar: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const cancelarFaltantes = async () => {
    // dejar solo las cuotas ya pasadas (fecha < mes actual)
    setSaving(true);
    try {
      const pasadas = filas.filter((r) => r.fecha < mesActualStr);
      const futuras = filas.filter((r) => r.fecha >= mesActualStr);
      if (futuras.length > 0) {
        const { error } = await supabase
          .from("gastos")
          .delete()
          .in(
            "id",
            futuras.map((r) => r.id)
          );
        if (error) throw error;
      }
      if (pasadas.length > 0) {
        await supabase
          .from("gastos")
          .update({ cuota_total: pasadas.length })
          .in(
            "id",
            pasadas.map((r) => r.id)
          );
      }
      onSaved();
      onClose();
    } catch (e: any) {
      alert("Error: " + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="bg-[var(--paper)] rounded-2xl p-5 w-full max-w-[420px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="text-center text-[14px] text-[var(--ink-soft)] py-8">Cargando...</div>
        ) : !base ? (
          <div className="text-center text-[14px] text-[var(--ink-soft)] py-8">No se encontró la cuota.</div>
        ) : (
          <>
            <div className="text-[16px] font-bold mb-1">{base.descripcion || "Cuotas"}</div>
            <div className="text-[12px] text-[var(--ink-soft)] mb-4">
              Actualmente: {filas.length} cuota{filas.length === 1 ? "" : "s"}
            </div>

            <label className="text-[13px] font-semibold block mb-1.5">Fecha de inicio (primera cuota)</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded text-[14px] mb-4"
            />

            <label className="text-[13px] font-semibold block mb-1.5">Número de cuotas</label>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setTotalCuotas((n) => Math.max(1, n - 1))}
                className="px-3 py-2 rounded bg-[var(--accent-bg)] text-[var(--accent)] font-bold"
              >
                −
              </button>
              <input
                type="number"
                min="1"
                value={totalCuotas}
                onChange={(e) => setTotalCuotas(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded text-[14px] text-center"
              />
              <button
                type="button"
                onClick={() => setTotalCuotas((n) => n + 1)}
                className="px-3 py-2 rounded bg-[var(--accent-bg)] text-[var(--accent)] font-bold"
              >
                +
              </button>
            </div>

            <label className="text-[13px] font-semibold block mb-1.5">Monto por cuota</label>
            <input
              type="number"
              value={montoCuota}
              onChange={(e) => setMontoCuota(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded text-[14px] mb-3"
            />

            {fechasNuevas.length > 0 && parseFloat(montoCuota) > 0 && (
              <div className="text-[12px] text-[var(--ink-soft)] mb-4 bg-[var(--paper-raised)] rounded-lg p-2.5">
                <div className="font-semibold mb-1">
                  Quedará: {totalCuotas} cuotas de {fmt(parseFloat(montoCuota))} · total{" "}
                  {fmt(totalCuotas * parseFloat(montoCuota))}
                </div>
                <div>
                  Desde{" "}
                  {new Date(fechasNuevas[0] + "T00:00:00").toLocaleDateString("es-CL", {
                    month: "short",
                    year: "numeric",
                  })}{" "}
                  hasta{" "}
                  {new Date(fechasNuevas[fechasNuevas.length - 1] + "T00:00:00").toLocaleDateString("es-CL", {
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <button
                onClick={guardar}
                disabled={saving}
                className="w-full py-3 rounded-full bg-[var(--accent)] text-white font-semibold text-[15px] disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={cancelarFaltantes}
                disabled={saving}
                className="w-full py-2.5 rounded-full bg-[var(--red-bg)] text-[var(--red)] font-semibold text-[13px] disabled:opacity-50"
              >
                Cancelar las cuotas que faltan
              </button>
              <button onClick={onClose} className="w-full py-2 text-[13px] text-[var(--ink-soft)]">
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
