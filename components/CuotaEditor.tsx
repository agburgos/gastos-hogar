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
  const [cuotasFaltan, setCuotasFaltan] = useState(1);
  const [montoCuota, setMontoCuota] = useState("");

  // primer día del mes actual: lo pasado (fecha < esto) ya se pagó; lo demás falta
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
      const restantes = rows.filter((r) => r.fecha >= mesActualStr);
      setCuotasFaltan(restantes.length || 1);
      setMontoCuota(String(restantes[0]?.monto ?? rows[0]?.monto ?? ""));
      setLoading(false);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoId]);

  const pasadas = filas.filter((r) => r.fecha < mesActualStr);
  const restantes = filas.filter((r) => r.fecha >= mesActualStr);
  const base = filas[0];

  const guardar = async () => {
    if (!base) return;
    setSaving(true);
    try {
      const monto = Math.round(parseFloat(montoCuota) || 0);
      const nFaltan = Math.max(0, Math.floor(cuotasFaltan));
      const nuevoTotal = pasadas.length + nFaltan;

      // 1) borrar las cuotas restantes (futuras) actuales del grupo
      const idsRestantes = restantes.map((r) => r.id);
      if (idsRestantes.length > 0) {
        const { error } = await supabase.from("gastos").delete().in("id", idsRestantes);
        if (error) throw error;
      }

      // 2) recrear nFaltan cuotas, una por mes desde el mes actual
      if (nFaltan > 0) {
        const dia = base.fecha.slice(8, 10);
        const nuevas = [];
        for (let i = 0; i < nFaltan; i++) {
          const f = new Date(hoy.getFullYear(), hoy.getMonth() + i, parseInt(dia));
          nuevas.push({
            monto,
            descripcion: base.descripcion,
            categoria_id: base.categoria_id,
            responsable_id: base.responsable_id,
            ambito: base.ambito || "ninguno",
            beneficiario_id: base.beneficiario_id,
            fecha: ymdLocal(f),
            compartido: true,
            cuota_grupo_id: grupoId,
            cuota_numero: pasadas.length + i + 1,
            cuota_total: nuevoTotal,
          });
        }
        const { error } = await supabase.from("gastos").insert(nuevas);
        if (error) throw error;
      }

      // 3) actualizar el total en las cuotas ya pasadas (para que el X/Y cuadre)
      if (pasadas.length > 0) {
        const { error } = await supabase
          .from("gastos")
          .update({ cuota_total: nuevoTotal })
          .in(
            "id",
            pasadas.map((r) => r.id)
          );
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (e: any) {
      alert("Error al guardar: " + (e.message || e));
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
              {pasadas.length} ya pagada{pasadas.length === 1 ? "" : "s"} · {restantes.length} por pagar
            </div>

            <label className="text-[13px] font-semibold block mb-1.5">Cuotas que faltan</label>
            <div className="flex items-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => setCuotasFaltan((n) => Math.max(0, n - 1))}
                className="px-3 py-2 rounded bg-[var(--accent-bg)] text-[var(--accent)] font-bold"
              >
                −
              </button>
              <input
                type="number"
                min="0"
                value={cuotasFaltan}
                onChange={(e) => setCuotasFaltan(Math.max(0, parseInt(e.target.value) || 0))}
                className="flex-1 px-3 py-2 border border-[var(--border)] rounded text-[14px] text-center"
              />
              <button
                type="button"
                onClick={() => setCuotasFaltan((n) => n + 1)}
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
              className="w-full px-3 py-2 border border-[var(--border)] rounded text-[14px] mb-2"
            />
            {cuotasFaltan > 0 && parseFloat(montoCuota) > 0 && (
              <div className="text-[12px] text-[var(--ink-soft)] mb-4">
                Total restante: {fmt(cuotasFaltan * parseFloat(montoCuota))} · nuevo total de cuotas:{" "}
                {pasadas.length + cuotasFaltan}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={guardar}
                disabled={saving}
                className="w-full py-3 rounded-full bg-[var(--accent)] text-white font-semibold text-[15px] disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              <button
                onClick={() => setCuotasFaltan(0)}
                className="w-full py-2.5 rounded-full bg-[var(--red-bg)] text-[var(--red)] font-semibold text-[13px]"
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
