"use client";

import { useEffect, useState } from "react";
import { Card, Btn, Badge } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

const GLORIA_ID = "9a7597c3-de3c-4cdc-9bdf-78dde625cff0";
const ALBERTO_ID = "6268104e-7c3c-4643-b4f6-7eb44a636f03";

interface Deuda {
  id: string;
  nombre: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  cuota_mensual: number | null;
  fecha_inicio: string;
  fecha_vencimiento: string | null;
  responsable_id: string;
  acreedor_id: string | null;
  descripcion: string | null;
  activa: boolean;
}

function nombrePorId(id: string | null) {
  if (id === GLORIA_ID) return "Gloria";
  if (id === ALBERTO_ID) return "Alberto";
  return "—";
}

export default function DeudasPage() {
  const [deudas, setDeudas] = useState<Deuda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    monto_total: "",
    cuota_mensual: "",
    fecha_vencimiento: "",
    descripcion: "",
    deudor_id: "",
    acreedor_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const cargarDeudas = async () => {
    const { data } = await supabase
      .from("deuda_saldos")
      .select("*")
      .order("activa", { ascending: false })
      .order("saldo_pendiente", { ascending: false });

    setDeudas(data || []);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user?.id || null;
      setUserId(uid);
      setFormData((f) => ({
        ...f,
        deudor_id: uid || "",
        acreedor_id: uid === GLORIA_ID ? ALBERTO_ID : GLORIA_ID,
      }));
      await cargarDeudas();
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.deudor_id || !formData.acreedor_id) {
      alert("Selecciona deudor y acreedor");
      return;
    }

    if (formData.deudor_id === formData.acreedor_id) {
      alert("El deudor y el acreedor deben ser distintos");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("deudas").insert({
      nombre: formData.nombre,
      monto_total: parseFloat(formData.monto_total),
      cuota_mensual: formData.cuota_mensual ? parseFloat(formData.cuota_mensual) : null,
      fecha_vencimiento: formData.fecha_vencimiento || null,
      descripcion: formData.descripcion || null,
      responsable_id: formData.deudor_id,
      acreedor_id: formData.acreedor_id,
    });

    if (error) {
      alert("Error: " + error.message);
      setSaving(false);
      return;
    }

    await cargarDeudas();
    setFormData({
      nombre: "",
      monto_total: "",
      cuota_mensual: "",
      fecha_vencimiento: "",
      descripcion: "",
      deudor_id: userId || "",
      acreedor_id: userId === GLORIA_ID ? ALBERTO_ID : GLORIA_ID,
    });
    setShowForm(false);
    setSaving(false);
  };

  const handlePagar = async (deuda: Deuda) => {
    const montoAPagar = prompt(`¿Cuánto se abona? (máximo ${fmt(deuda.saldo_pendiente)})`);
    if (!montoAPagar) return;

    const parsed = parseFloat(montoAPagar);
    if (isNaN(parsed) || parsed <= 0 || parsed > deuda.saldo_pendiente) {
      alert("Monto inválido");
      return;
    }

    const nuevoMontoPagado = deuda.monto_pagado + parsed;
    const { error } = await supabase
      .from("deudas")
      .update({ monto_pagado: nuevoMontoPagado })
      .eq("id", deuda.id);

    if (error) {
      alert("Error al actualizar deuda: " + error.message);
      return;
    }

    await cargarDeudas();
  };

  const handleEliminar = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar deuda "${nombre}"?`)) return;
    const { error } = await supabase.from("deudas").delete().eq("id", id);
    if (error) {
      alert("Error: " + error.message);
      return;
    }
    await cargarDeudas();
  };

  // Lo que YO debo (soy deudor) vs lo que ME deben (soy acreedor)
  const yoDebo = deudas.filter((d) => d.responsable_id === userId && d.saldo_pendiente > 0);
  const meDeben = deudas.filter((d) => d.acreedor_id === userId && d.saldo_pendiente > 0);
  const pagadas = deudas.filter((d) => d.saldo_pendiente === 0);

  const totalYoDebo = yoDebo.reduce((sum, d) => sum + d.saldo_pendiente, 0);
  const totalMeDeben = meDeben.reduce((sum, d) => sum + d.saldo_pendiente, 0);

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  const DeudaCard = ({ deuda, esDeudor }: { deuda: Deuda; esDeudor: boolean }) => (
    <Card accent>
      <div className="space-y-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="font-bold text-[14px]">{deuda.nombre}</div>
            <div className="text-[12px] text-[var(--mid)]">
              {nombrePorId(deuda.responsable_id)} le debe a {nombrePorId(deuda.acreedor_id)}
            </div>
            {deuda.descripcion && (
              <div className="text-[11px] text-[var(--mid)] mt-1">{deuda.descripcion}</div>
            )}
          </div>
          <button
            onClick={() => handleEliminar(deuda.id, deuda.nombre)}
            className="text-[10px] px-1.5 py-1 bg-[var(--red-bg)] text-[var(--red)] rounded font-bold"
          >
            Eliminar
          </button>
        </div>

        <div className="text-[13px] space-y-1">
          <div className="flex justify-between">
            <span>Monto total:</span>
            <span className="font-bold">{fmt(deuda.monto_total)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pagado:</span>
            <span>{fmt(deuda.monto_pagado)}</span>
          </div>
          <div className="flex justify-between text-[var(--red)]">
            <span>Pendiente:</span>
            <span className="font-bold">{fmt(deuda.saldo_pendiente)}</span>
          </div>
        </div>

        {deuda.cuota_mensual && (
          <div className="text-[12px] text-[var(--mid)]">Cuota: {fmt(deuda.cuota_mensual)}/mes</div>
        )}

        {esDeudor && (
          <button
            onClick={() => handlePagar(deuda)}
            className="w-full mt-2 px-3 py-2 bg-[var(--green-bg)] text-[var(--green)] text-[12px] font-bold rounded"
          >
            Abonar
          </button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3">
        <Card title="Yo debo">
          <div className="text-[18px] font-bold text-[var(--red)]">{fmt(totalYoDebo)}</div>
        </Card>
        <Card title="Me deben">
          <div className="text-[18px] font-bold text-[var(--green)]">{fmt(totalMeDeben)}</div>
        </Card>
      </div>

      {/* Lo que yo debo */}
      {yoDebo.length > 0 && (
        <>
          <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider px-1">
            Yo debo
          </div>
          {yoDebo.map((d) => (
            <DeudaCard key={d.id} deuda={d} esDeudor={true} />
          ))}
        </>
      )}

      {/* Lo que me deben */}
      {meDeben.length > 0 && (
        <>
          <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider px-1">
            Me deben
          </div>
          {meDeben.map((d) => (
            <DeudaCard key={d.id} deuda={d} esDeudor={false} />
          ))}
        </>
      )}

      {yoDebo.length === 0 && meDeben.length === 0 && (
        <Card>
          <div className="text-center text-[14px] text-[var(--mid)] py-8">Sin deudas pendientes</div>
        </Card>
      )}

      {pagadas.length > 0 && (
        <div className="text-[11px] text-[var(--mid)] px-1">{pagadas.length} deuda(s) pagada(s)</div>
      )}

      {/* Formulario */}
      {!showForm ? (
        <Btn onClick={() => setShowForm(true)}>+ Nueva deuda</Btn>
      ) : (
        <Card title="Registrar deuda" accent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Ej: México, MBA, Coche"
              value={formData.nombre}
              onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px]"
              required
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-[var(--mid)]">Quién debe</label>
                <select
                  value={formData.deudor_id}
                  onChange={(e) => setFormData({ ...formData, deudor_id: e.target.value })}
                  className="w-full px-2 py-2 border border-[var(--border)] rounded-lg text-[13px]"
                >
                  <option value={GLORIA_ID}>Gloria</option>
                  <option value={ALBERTO_ID}>Alberto</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-[var(--mid)]">A quién</label>
                <select
                  value={formData.acreedor_id}
                  onChange={(e) => setFormData({ ...formData, acreedor_id: e.target.value })}
                  className="w-full px-2 py-2 border border-[var(--border)] rounded-lg text-[13px]"
                >
                  <option value={GLORIA_ID}>Gloria</option>
                  <option value={ALBERTO_ID}>Alberto</option>
                </select>
              </div>
            </div>

            <input
              type="number"
              step="1000"
              placeholder="Monto total"
              value={formData.monto_total}
              onChange={(e) => setFormData({ ...formData, monto_total: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px]"
              required
            />

            <input
              type="number"
              step="100"
              placeholder="Cuota mensual (opcional)"
              value={formData.cuota_mensual}
              onChange={(e) => setFormData({ ...formData, cuota_mensual: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px]"
            />

            <input
              type="date"
              placeholder="Fecha vencimiento (opcional)"
              value={formData.fecha_vencimiento}
              onChange={(e) => setFormData({ ...formData, fecha_vencimiento: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px]"
            />

            <textarea
              placeholder="Descripción (opcional)"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] resize-none"
              rows={2}
            />

            <div className="flex gap-2">
              <Btn type="submit" disabled={saving} variant="sm-secondary">
                {saving ? "Guardando..." : "Guardar"}
              </Btn>
              <Btn type="button" variant="sm-ghost" onClick={() => setShowForm(false)}>
                Cancelar
              </Btn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
