"use client";

import { useEffect, useState } from "react";
import { Card, Btn, Empty } from "@/components/ui";
import { fmt, fmtDateHora } from "@/lib/format";
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

export default function RevisarPage() {
  const [gastos, setGastos] = useState<GastoRevisar[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [loading, setLoading] = useState(true);
  const [macroSeleccionado, setMacroSeleccionado] = useState<string | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [newCategoriaId, setNewCategoriaId] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      // traer gastos por revisar
      const { data: gastosData } = await supabase
        .from("gastos")
        .select("id, monto, descripcion, responsable_id, fecha, categoria_id")
        .eq("revisar", true)
        .order("monto", { ascending: false });

      setGastos(gastosData || []);

      // traer macros
      const { data: macrosData } = await supabase
        .from("categorias_macro")
        .select("id, nombre")
        .neq("nombre", "Sin Clasificar")
        .order("orden");

      setMacros(macrosData || []);

      setLoading(false);
    };

    fetch();
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

  const handleGuardar = async (gastoId: string) => {
    if (!newCategoriaId) {
      alert("Selecciona una categoría");
      return;
    }

    const { error } = await supabase
      .from("gastos")
      .update({
        categoria_id: newCategoriaId,
        revisar: false,
      })
      .eq("id", gastoId);

    if (error) {
      console.error(error);
      alert("Error al guardar");
      return;
    }

    setGastos(gastos.filter((g) => g.id !== gastoId));
    setEditandoId(null);
    setMacroSeleccionado(null);
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

  return (
    <div className="space-y-3">
      <div className="text-[13px] text-[var(--mid)] px-4 py-2 bg-[var(--accent-bg)] rounded-lg">
        {gastos.length} gasto{gastos.length > 1 ? "s" : ""} por clasificar
      </div>

      {gastos.map((gasto) => {
        const isEditing = editandoId === gasto.id;

        return (
          <Card key={gasto.id} accent={isEditing}>
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[14px] font-bold">{fmt(gasto.monto)}</div>
                  {gasto.descripcion && (
                    <div className="text-[13px] text-[var(--mid)]">{gasto.descripcion}</div>
                  )}
                  <div className="text-[11px] text-[var(--mid)]">{gasto.fecha}</div>
                </div>
              </div>

              {!isEditing ? (
                <button
                  onClick={() => {
                    setEditandoId(gasto.id);
                    setMacroSeleccionado(null);
                    setNewCategoriaId(null);
                  }}
                  className="text-[13px] text-[var(--accent)] font-bold"
                >
                  → Clasificar
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
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => {
                            setMacroSeleccionado(null);
                            setNewCategoriaId(null);
                          }}
                          className="text-[11px] text-[var(--accent)] font-bold px-2 py-1 border border-[var(--border)] rounded"
                        >
                          ← Atrás
                        </button>
                        <div className="text-[11px] text-[var(--mid)] py-1">
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
                          onClick={() => handleGuardar(gasto.id)}
                          className="w-full mt-2 px-3 py-2 bg-[var(--green-bg)] text-[var(--green)] text-[12px] font-bold rounded"
                        >
                          Guardar
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
