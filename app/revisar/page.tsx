"use client";

import { useEffect, useState } from "react";
import { Card, Empty } from "@/components/ui";
import { fmt, norm } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface GastoRevisar {
  id: string;
  monto: number;
  descripcion: string | null;
  responsable_id: string;
  fecha: string;
  categoria_id: string;
}

interface Categoria {
  id: string;
  nombre: string;
}

interface Macro {
  id: string;
  nombre: string;
}

interface Grupo {
  clave: string;
  descripcion: string;
  gastos: GastoRevisar[];
  total: number;
}

export default function RevisarPage() {
  const [gastos, setGastos] = useState<GastoRevisar[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [macroSeleccionado, setMacroSeleccionado] = useState<string | null>(null);
  const [newCategoriaId, setNewCategoriaId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data: gastosData } = await supabase
      .from("gastos")
      .select("id, monto, descripcion, responsable_id, fecha, categoria_id")
      .eq("revisar", true)
      .order("monto", { ascending: false });

    setGastos(gastosData || []);

    const { data: macrosData } = await supabase
      .from("categorias_macro")
      .select("id, nombre")
      .neq("nombre", "Sin Clasificar")
      .order("orden");

    setMacros(macrosData || []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleMacroSelect = async (macroId: string) => {
    setMacroSeleccionado(macroId);
    setNewCategoriaId(null);

    const { data: cats } = await supabase
      .from("categorias")
      .select("id, nombre")
      .eq("macro_id", macroId)
      .order("orden");

    setCategorias(cats || []);
  };

  const handleGuardarGrupo = async (grupo: Grupo) => {
    if (!newCategoriaId) {
      alert("Selecciona una categoría");
      return;
    }

    setGuardando(true);
    const ids = grupo.gastos.map((g) => g.id);
    const { error } = await supabase
      .from("gastos")
      .update({ categoria_id: newCategoriaId, revisar: false })
      .in("id", ids);

    setGuardando(false);

    if (error) {
      alert("Error al guardar: " + error.message);
      return;
    }

    setGastos((prev) => prev.filter((g) => !ids.includes(g.id)));
    setGrupoAbierto(null);
    setMacroSeleccionado(null);
    setNewCategoriaId(null);
  };

  if (loading) {
    return (
      <Card>
        <div className="text-center text-[14px] text-[var(--mid)]">Cargando...</div>
      </Card>
    );
  }

  if (gastos.length === 0) {
    return <Empty text="Todos los gastos están clasificados ✓" icon="🎉" />;
  }

  // Agrupar por descripción normalizada
  const gruposMap = new Map<string, GastoRevisar[]>();
  gastos.forEach((g) => {
    const clave = (g.descripcion || "sin descripción").toLowerCase().trim();
    if (!gruposMap.has(clave)) gruposMap.set(clave, []);
    gruposMap.get(clave)!.push(g);
  });

  let grupos: Grupo[] = Array.from(gruposMap.entries()).map(([clave, items]) => ({
    clave,
    descripcion: items[0].descripcion || "Sin descripción",
    gastos: items,
    total: items.reduce((sum, g) => sum + g.monto, 0),
  }));

  // Ordenar por cantidad de repeticiones (mayor impacto primero), luego por total
  grupos.sort((a, b) => b.gastos.length - a.gastos.length || b.total - a.total);

  if (busqueda.trim()) {
    grupos = grupos.filter((g) => norm(g.clave).includes(norm(busqueda)));
  }

  return (
    <div className="space-y-3">
      <div className="text-[13px] text-[var(--mid)] px-4 py-2 bg-[var(--accent-bg)] rounded-lg">
        {gastos.length} gasto{gastos.length > 1 ? "s" : ""} en {gruposMap.size} grupo
        {gruposMap.size > 1 ? "s" : ""} por clasificar
      </div>

      <input
        type="text"
        placeholder="🔍 Buscar por título..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      {grupos.map((grupo) => {
        const isOpen = grupoAbierto === grupo.clave;

        return (
          <Card key={grupo.clave} accent={isOpen}>
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[14px] font-bold">{grupo.descripcion}</div>
                  <div className="text-[12px] text-[var(--mid)]">
                    {grupo.gastos.length > 1
                      ? `${grupo.gastos.length} gastos · total ${fmt(grupo.total)}`
                      : fmt(grupo.total)}
                  </div>
                </div>
              </div>

              {!isOpen ? (
                <button
                  onClick={() => {
                    setGrupoAbierto(grupo.clave);
                    setMacroSeleccionado(null);
                    setNewCategoriaId(null);
                  }}
                  className="text-[13px] text-[var(--accent)] font-bold"
                >
                  → Clasificar{grupo.gastos.length > 1 ? ` (${grupo.gastos.length})` : ""}
                </button>
              ) : (
                <div className="space-y-2">
                  {!macroSeleccionado ? (
                    <>
                      <div className="text-[12px] font-bold mb-2">Selecciona categoría:</div>
                      <div className="flex flex-wrap gap-2">
                        {macros.map((macro) => (
                          <button
                            key={macro.id}
                            onClick={() => handleMacroSelect(macro.id)}
                            className="flex-1 min-w-[48%] px-2 py-2 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] font-bold text-[11px] hover:bg-[var(--accent)] hover:text-white transition-colors"
                          >
                            {macro.nombre}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex gap-2 mb-2 items-center">
                        <button
                          onClick={() => {
                            setMacroSeleccionado(null);
                            setNewCategoriaId(null);
                          }}
                          className="text-[11px] text-[var(--accent)] font-bold px-2 py-1 border border-[var(--border)] rounded"
                        >
                          ← Atrás
                        </button>
                        <div className="text-[11px] text-[var(--mid)]">
                          {macros.find((m) => m.id === macroSeleccionado)?.nombre}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {categorias.map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => setNewCategoriaId(cat.id)}
                            className={`flex-1 min-w-[48%] px-2 py-2 rounded text-[11px] font-bold transition-colors ${
                              newCategoriaId === cat.id
                                ? "bg-[var(--accent)] text-white"
                                : "bg-[var(--accent-bg)] text-[var(--accent)]"
                            }`}
                          >
                            {cat.nombre}
                          </button>
                        ))}
                      </div>
                      {newCategoriaId && (
                        <button
                          onClick={() => handleGuardarGrupo(grupo)}
                          disabled={guardando}
                          className="w-full mt-2 px-3 py-2 bg-[var(--green-bg)] text-[var(--green)] text-[12px] font-bold rounded disabled:opacity-50"
                        >
                          {guardando
                            ? "Guardando..."
                            : `Aplicar a ${grupo.gastos.length} gasto${grupo.gastos.length > 1 ? "s" : ""}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
