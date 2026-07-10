"use client";

import { useEffect, useState } from "react";
import { Card, Btn, Badge } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Deuda {
  id: string;
  nombre: string;
  monto_total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  cuota_mensual: number | null;
  fecha_inicio: string;
  fecha_vencimiento: string | null;
  descripcion: string | null;
  activa: boolean;
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
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("deuda_saldos")
        .select("*")
        .order("activa", { ascending: false })
        .order("saldo_pendiente", { ascending: false });

      setDeudas(data || []);
      setLoading(false);
    };

    fetch();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user?.id) {
      alert("No autenticado");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("deudas").insert({
      nombre: formData.nombre,
      monto_total: parseFloat(formData.monto_total),
      cuota_mensual: formData.cuota_mensual ? parseFloat(formData.cuota_mensual) : null,
      fecha_vencimiento: formData.fecha_vencimiento || null,
      descripcion: formData.descripcion || null,
      responsable_id: session.session.user.id,
    });

    if (error) {
      alert("Error: " + error.message);
      setSaving(false);
      return;
    }

    // Recargar deudas
    const { data } = await supabase
      .from("deuda_saldos")
      .select("*")
      .order("activa", { ascending: false })
      .order("saldo_pendiente", { ascending: false });

    setDeudas(data || []);
    setFormData({
      nombre: "",
      monto_total: "",
      cuota_mensual: "",
      fecha_vencimiento: "",
      descripcion: "",
    });
    setShowForm(false);
    setSaving(false);
  };

  const handlePagar = async (deudaId: string, monto: number) => {
    const montoAPagar = prompt(`¿Cuánto deseas pagar? (máximo ${fmt(monto)})`);
    if (!montoAPagar) return;

    const parsed = parseFloat(montoAPagar);
    if (isNaN(parsed) || parsed <= 0 || parsed > monto) {
      alert("Monto inválido");
      return;
    }

    // Registrar pago como gasto
    const { data: deuda } = await supabase
      .from("deudas")
      .select("monto_pagado")
      .eq("id", deudaId)
      .single();

    if (!deuda) return;

    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user?.id) return;

    // Obtener categoría "Deudas"
    const { data: cat } = await supabase
      .from("categorias")
      .select("id")
      .eq("nombre", "Deudas")
      .limit(1)
      .single();

    if (!cat) {
      alert("Error: No se encontró categoría 'Deudas'");
      return;
    }

    // Insertar gasto de pago
    const { error: gastoError } = await supabase.from("gastos").insert({
      monto: parsed,
      descripcion: `Pago de deuda: ${deudas.find((d) => d.id === deudaId)?.nombre}`,
      categoria_id: cat.id,
      responsable_id: session.session.user.id,
      fecha: ymdLocal(new Date()),
      compartido: true,
    });

    if (gastoError) {
      alert("Error al registrar pago: " + gastoError.message);
      return;
    }

    // Actualizar deuda
    const nuevoMontoPagado = deuda.monto_pagado + parsed;
    const { error: updateError } = await supabase
      .from("deudas")
      .update({ monto_pagado: nuevoMontoPagado })
      .eq("id", deudaId);

    if (updateError) {
      alert("Error al actualizar deuda: " + updateError.message);
      return;
    }

    // Recargar
    const { data } = await supabase
      .from("deuda_saldos")
      .select("*")
      .order("activa", { ascending: false })
      .order("saldo_pendiente", { ascending: false });

    setDeudas(data || []);
  };

  const totalDeudado = deudas.reduce((sum, d) => sum + d.saldo_pendiente, 0);

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Resumen */}
      {totalDeudado > 0 && (
        <Card accent>
          <div className="text-[14px]">
            <div className="text-[var(--mid)] text-[12px] mb-1">Total adeudado</div>
            <div className="text-2xl font-bold text-[var(--red)]">{fmt(totalDeudado)}</div>
          </div>
        </Card>
      )}

      {/* Deudas */}
      {deudas.length === 0 ? (
        <Card>
          <div className="text-center text-[14px] text-[var(--mid)] py-8">
            Sin deudas registradas
          </div>
        </Card>
      ) : (
        deudas.map((deuda) => {
          const pctPagado = (deuda.monto_pagado / deuda.monto_total) * 100;

          return (
            <Card key={deuda.id} accent={deuda.saldo_pendiente > 0}>
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-[14px]">{deuda.nombre}</div>
                    {deuda.descripcion && (
                      <div className="text-[12px] text-[var(--mid)]">{deuda.descripcion}</div>
                    )}
                  </div>
                  {deuda.saldo_pendiente === 0 && <Badge color="green">Pagado</Badge>}
                </div>

                <div className="text-[13px] space-y-1">
                  <div className="flex justify-between">
                    <span>Monto:</span>
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
                  <div className="text-[12px] text-[var(--mid)]">
                    Cuota: {fmt(deuda.cuota_mensual)}/mes
                  </div>
                )}

                {deuda.saldo_pendiente > 0 && (
                  <button
                    onClick={() => handlePagar(deuda.id, deuda.saldo_pendiente)}
                    className="w-full mt-2 px-3 py-2 bg-[var(--green-bg)] text-[var(--green)] text-[12px] font-bold rounded"
                  >
                    Pagar
                  </button>
                )}
              </div>
            </Card>
          );
        })
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
              <Btn
                type="button"
                variant="sm-ghost"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Btn>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
