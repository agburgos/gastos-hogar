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

interface Categoria {
  id: string;
  nombre: string;
  orden: number;
  pct_objetivo: number | null;
  monto_objetivo: number | null;
}

interface Macro {
  id: string;
  nombre: string;
  pct_objetivo: number;
  orden: number;
  categorias: Categoria[];
}

export default function AjustesPage() {
  const router = useRouter();
  const [ingreso, setIngreso] = useState<IngresoData | null>(null);
  const [nuevoIngreso, setNuevoIngreso] = useState("");
  const [hasPush, setHasPush] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Mantenedor de categorías
  const [macros, setMacros] = useState<Macro[]>([]);
  const [macroExpandido, setMacroExpandido] = useState<string | null>(null);
  const [nuevaMacroNombre, setNuevaMacroNombre] = useState("");
  const [nuevaMacroPct, setNuevaMacroPct] = useState("");
  const [nuevaSubNombre, setNuevaSubNombre] = useState<{ [macroId: string]: string }>({});
  const [editandoMacro, setEditandoMacro] = useState<string | null>(null);
  const [editandoSub, setEditandoSub] = useState<string | null>(null);

  const cargarCategorias = async () => {
    const { data: macrosData } = await supabase
      .from("categorias_macro")
      .select("id, nombre, pct_objetivo, orden")
      .order("orden");

    if (!macrosData) return;

    const { data: subsData } = await supabase
      .from("categorias")
      .select("id, nombre, macro_id, orden, pct_objetivo, monto_objetivo")
      .order("orden");

    const macrosConSubs: Macro[] = macrosData.map((m: any) => ({
      ...m,
      categorias: (subsData || []).filter((s: any) => s.macro_id === m.id),
    }));

    setMacros(macrosConSubs);
  };

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

      await cargarCategorias();

      setLoading(false);
    };

    init();
  }, []);

  const handleCrearMacro = async () => {
    if (!nuevaMacroNombre.trim()) return;
    const pct = parseFloat(nuevaMacroPct) || 0;
    const orden = macros.length > 0 ? Math.max(...macros.map((m) => m.orden)) + 1 : 0;

    const { error } = await supabase.from("categorias_macro").insert({
      nombre: nuevaMacroNombre.trim(),
      pct_objetivo: pct / 100,
      orden,
    });

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setNuevaMacroNombre("");
    setNuevaMacroPct("");
    await cargarCategorias();
  };

  const handleActualizarMacro = async (id: string, nombre: string, pctObjetivo: number) => {
    const { error } = await supabase
      .from("categorias_macro")
      .update({ nombre, pct_objetivo: pctObjetivo / 100 })
      .eq("id", id);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setEditandoMacro(null);
    await cargarCategorias();
  };

  const handleEliminarMacro = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar macrocategoría "${nombre}" y todas sus subcategorías? Esto fallará si hay gastos asociados.`)) return;

    const { error } = await supabase.from("categorias_macro").delete().eq("id", id);

    if (error) {
      alert("Error: no se puede eliminar (probablemente tiene gastos asociados). " + error.message);
      return;
    }

    await cargarCategorias();
  };

  const handleCrearSub = async (macroId: string) => {
    const nombre = nuevaSubNombre[macroId];
    if (!nombre?.trim()) return;

    const macro = macros.find((m) => m.id === macroId);
    const orden = macro && macro.categorias.length > 0 ? Math.max(...macro.categorias.map((c) => c.orden)) + 1 : 0;

    const { error } = await supabase.from("categorias").insert({
      nombre: nombre.trim(),
      macro_id: macroId,
      orden,
    });

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setNuevaSubNombre({ ...nuevaSubNombre, [macroId]: "" });
    await cargarCategorias();
  };

  const handleActualizarSub = async (id: string, nombre: string, montoObjetivo: string) => {
    const monto = montoObjetivo ? parseFloat(montoObjetivo) : null;

    const { error } = await supabase
      .from("categorias")
      .update({ nombre, monto_objetivo: monto })
      .eq("id", id);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    setEditandoSub(null);
    await cargarCategorias();
  };

  const handleEliminarSub = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar subcategoría "${nombre}"? Esto fallará si hay gastos asociados.`)) return;

    const { error } = await supabase.from("categorias").delete().eq("id", id);

    if (error) {
      alert("Error: no se puede eliminar (probablemente tiene gastos asociados). " + error.message);
      return;
    }

    await cargarCategorias();
  };

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

      {/* Mantenedor de categorías */}
      <Card title="Categorías y presupuesto">
        <div className="space-y-2">
          {macros.map((macro) => {
            const expandido = macroExpandido === macro.id;
            const editando = editandoMacro === macro.id;

            return (
              <div key={macro.id} className="border border-[var(--border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--accent-bg)] px-3 py-2 flex items-center justify-between">
                  {editando ? (
                    <EditarMacroInline
                      macro={macro}
                      onGuardar={handleActualizarMacro}
                      onCancelar={() => setEditandoMacro(null)}
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => setMacroExpandido(expandido ? null : macro.id)}
                        className="flex-1 text-left flex items-center gap-2"
                      >
                        <span className="text-[12px]">{expandido ? "▼" : "▶"}</span>
                        <span className="font-bold text-[13px]">{macro.nombre}</span>
                        <span className="text-[11px] text-[var(--mid)]">
                          ({Math.round(macro.pct_objetivo * 100)}%)
                        </span>
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditandoMacro(macro.id)}
                          className="text-[11px] px-2 py-1 bg-[var(--paper-raised)] rounded text-[var(--accent)] font-bold"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleEliminarMacro(macro.id, macro.nombre)}
                          className="text-[11px] px-2 py-1 bg-[var(--paper-raised)] rounded text-[var(--red)] font-bold"
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {expandido && (
                  <div className="bg-[var(--paper-raised)] p-2 space-y-1.5">
                    {macro.categorias.map((sub) => {
                      const editandoEstaSub = editandoSub === sub.id;
                      return editandoEstaSub ? (
                        <EditarSubInline
                          key={sub.id}
                          sub={sub}
                          onGuardar={handleActualizarSub}
                          onCancelar={() => setEditandoSub(null)}
                        />
                      ) : (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between px-2 py-1.5 bg-[var(--linen)] rounded text-[12px]"
                        >
                          <div>
                            <span>{sub.nombre}</span>
                            {sub.monto_objetivo && (
                              <span className="text-[10px] text-[var(--mid)] ml-2">
                                tope: {fmt(sub.monto_objetivo)}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button
                              onClick={() => setEditandoSub(sub.id)}
                              className="text-[10px] px-1.5 py-0.5 bg-[var(--paper-raised)] rounded text-[var(--accent)] font-bold"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleEliminarSub(sub.id, sub.nombre)}
                              className="text-[10px] px-1.5 py-0.5 bg-[var(--paper-raised)] rounded text-[var(--red)] font-bold"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Nueva subcategoría */}
                    <div className="flex gap-1 pt-1">
                      <input
                        type="text"
                        placeholder="Nueva subcategoría"
                        value={nuevaSubNombre[macro.id] || ""}
                        onChange={(e) =>
                          setNuevaSubNombre({ ...nuevaSubNombre, [macro.id]: e.target.value })
                        }
                        className="flex-1 px-2 py-1.5 border border-[var(--border)] rounded text-[12px]"
                      />
                      <button
                        onClick={() => handleCrearSub(macro.id)}
                        className="px-3 py-1.5 bg-[var(--green-bg)] text-[var(--green)] rounded text-[12px] font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Nueva macrocategoría */}
          <div className="pt-2 space-y-1.5">
            <div className="text-[11px] font-bold text-[var(--accent)] uppercase">Nueva macrocategoría</div>
            <div className="flex gap-1">
              <input
                type="text"
                placeholder="Nombre"
                value={nuevaMacroNombre}
                onChange={(e) => setNuevaMacroNombre(e.target.value)}
                className="flex-1 px-2 py-1.5 border border-[var(--border)] rounded text-[12px]"
              />
              <input
                type="number"
                placeholder="% ingreso"
                value={nuevaMacroPct}
                onChange={(e) => setNuevaMacroPct(e.target.value)}
                className="w-24 px-2 py-1.5 border border-[var(--border)] rounded text-[12px]"
              />
              <button
                onClick={handleCrearMacro}
                className="px-3 py-1.5 bg-[var(--green-bg)] text-[var(--green)] rounded text-[12px] font-bold"
              >
                + Crear
              </button>
            </div>
          </div>
        </div>
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

function EditarMacroInline({
  macro,
  onGuardar,
  onCancelar,
}: {
  macro: Macro;
  onGuardar: (id: string, nombre: string, pct: number) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(macro.nombre);
  const [pct, setPct] = useState(String(Math.round(macro.pct_objetivo * 100)));

  return (
    <div className="flex-1 flex gap-1 items-center">
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="flex-1 px-2 py-1 border border-[var(--border)] rounded text-[12px]"
      />
      <input
        type="number"
        value={pct}
        onChange={(e) => setPct(e.target.value)}
        className="w-16 px-2 py-1 border border-[var(--border)] rounded text-[12px]"
      />
      <button
        onClick={() => onGuardar(macro.id, nombre, parseFloat(pct) || 0)}
        className="text-[11px] px-2 py-1 bg-[var(--green-bg)] text-[var(--green)] rounded font-bold"
      >
        ✓
      </button>
      <button
        onClick={onCancelar}
        className="text-[11px] px-2 py-1 bg-[var(--paper-raised)] rounded text-[var(--mid)] font-bold"
      >
        ✕
      </button>
    </div>
  );
}

function EditarSubInline({
  sub,
  onGuardar,
  onCancelar,
}: {
  sub: Categoria;
  onGuardar: (id: string, nombre: string, monto: string) => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(sub.nombre);
  const [monto, setMonto] = useState(sub.monto_objetivo ? String(sub.monto_objetivo) : "");

  return (
    <div className="flex gap-1 items-center px-2 py-1">
      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        className="flex-1 px-2 py-1 border border-[var(--border)] rounded text-[11px]"
      />
      <input
        type="number"
        placeholder="Tope $"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        className="w-24 px-2 py-1 border border-[var(--border)] rounded text-[11px]"
      />
      <button
        onClick={() => onGuardar(sub.id, nombre, monto)}
        className="text-[10px] px-1.5 py-1 bg-[var(--green-bg)] text-[var(--green)] rounded font-bold"
      >
        ✓
      </button>
      <button
        onClick={onCancelar}
        className="text-[10px] px-1.5 py-1 bg-[var(--paper-raised)] rounded text-[var(--mid)] font-bold"
      >
        ✕
      </button>
    </div>
  );
}
