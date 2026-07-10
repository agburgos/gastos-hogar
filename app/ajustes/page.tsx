"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn, Badge } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface IngresoData {
  monto: number;
  vigente_desde: string;
}

export default function AjustesPage() {
  const router = useRouter();
  const [ingreso, setIngreso] = useState<IngresoData | null>(null);
  const [nuevoIngreso, setNuevoIngreso] = useState("");
  const [hasPush, setHasPush] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      // traer ingreso vigente
      const { data: ingresoData } = await supabase
        .from("ingreso_mensual")
        .select("monto, vigente_desde")
        .order("vigente_desde", { ascending: false })
        .limit(1)
        .single();

      if (ingresoData) {
        setIngreso(ingresoData);
        setNuevoIngreso(ingresoData.monto.toString());
      }

      // verificar si hay push subscriptions
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        const { data: pushData } = await supabase
          .from("push_subscriptions")
          .select("id")
          .eq("usuario_id", data.session.user.id)
          .limit(1);

        setHasPush((pushData?.length || 0) > 0);
      }

      setLoading(false);
    };

    init();
  }, []);

  const handleActualizarIngreso = async () => {
    const parsedIngreso = parseFloat(nuevoIngreso);
    if (!parsedIngreso || parsedIngreso <= 0) {
      alert("Ingreso debe ser mayor a 0");
      return;
    }

    setSaving(true);
    const today = ymdLocal(new Date());
    const { error } = await supabase.from("ingreso_mensual").insert({
      monto: parsedIngreso,
      vigente_desde: today,
    });

    if (error) {
      console.error(error);
      alert("Error al actualizar ingreso");
      setSaving(false);
      return;
    }

    alert("Ingreso actualizado desde hoy");
    setIngreso({
      monto: parsedIngreso,
      vigente_desde: today,
    });
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Ingreso mensual */}
      <Card title="Ingreso Mensual">
        {ingreso && (
          <div className="mb-3 text-[13px] text-[var(--mid)]">
            Vigente desde: {ingreso.vigente_desde}
          </div>
        )}
        <div className="space-y-2">
          <input
            type="number"
            step="1000"
            value={nuevoIngreso}
            onChange={(e) => setNuevoIngreso(e.target.value)}
            placeholder="Ingreso"
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-[14px] focus:border-[var(--accent)] focus:outline-none"
          />
          <Btn
            onClick={handleActualizarIngreso}
            disabled={saving || parseFloat(nuevoIngreso) === ingreso?.monto}
            variant="sm-secondary"
          >
            {saving ? "Guardando..." : "Actualizar"}
          </Btn>
        </div>
      </Card>

      {/* Push */}
      <Card title="Notificaciones Push">
        <div className="flex items-center justify-between">
          <span className="text-[14px]">Estado:</span>
          <Badge color={hasPush ? "green" : "gray"}>
            {hasPush ? "Activo" : "Inactivo"}
          </Badge>
        </div>
        {!hasPush && (
          <div className="text-[12px] text-[var(--mid)] mt-2">
            Las notificaciones push se activarán automáticamente cuando instales la app en tu dispositivo.
          </div>
        )}
      </Card>

      {/* Sesión */}
      <Card title="Sesión">
        <Btn onClick={handleLogout} variant="danger">
          Cerrar sesión
        </Btn>
      </Card>

      {/* Info */}
      <Card>
        <div className="text-[11px] text-[var(--mid)] space-y-1">
          <div>Gastos Hogar v0.1.0</div>
          <div>© 2026 Garrido Roa</div>
        </div>
      </Card>
    </div>
  );
}
