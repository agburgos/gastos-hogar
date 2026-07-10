"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, Btn, Badge } from "@/components/ui";
import { fmt, ymdLocal } from "@/lib/format";
import { supabase } from "@/lib/supabase";

interface Macro {
  id: string;
  nombre: string;
}

interface Categoria {
  id: string;
  nombre: string;
}

export default function NuevoPage() {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(ymdLocal(new Date()));
  const [compartido, setCompartido] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [macroSeleccionada, setMacroSeleccionada] = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [cuotas, setCuotas] = useState(false);
  const [numCuotas, setNumCuotas] = useState(1);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user?.id || null);

      const { data: macrosData } = await supabase
        .from("categorias_macro")
        .select("id, nombre")
        .neq("nombre", "Sin Clasificar")
        .order("orden");

      if (macrosData) setMacros(macrosData);
    };

    init();
  }, []);

  const handleMacroSelect = async (macroId: string) => {
    setMacroSeleccionada(macroId);
    setCategoriaSeleccionada(null);

    const { data: cats } = await supabase
      .from("categorias")
      .select("id, nombre")
      .eq("macro_id", macroId)
      .order("orden");

    if (cats) setCategorias(cats);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!monto || !categoriaSeleccionada || !user) {
      alert("Monto y categoría requeridos");
      return;
    }

    setLoading(true);

    try {
      const parsedMonto = parseFloat(monto);
      const filas = [];

      if (cuotas && numCuotas > 1) {
        const cuotaGrupoId = crypto.randomUUID();
        const fechaDate = new Date(fecha + "T00:00:00");

        for (let i = 0; i < numCuotas; i++) {
          const nextFecha = new Date(fechaDate);
          nextFecha.setMonth(nextFecha.getMonth() + i);
          filas.push({
            monto: parsedMonto,
            descripcion,
            categoria_id: categoriaSeleccionada,
            responsable_id: user,
            fecha: ymdLocal(nextFecha),
            compartido,
            cuota_grupo_id: cuotaGrupoId,
            cuota_numero: i + 1,
            cuota_total: numCuotas,
          });
        }
      } else {
        filas.push({
          monto: parsedMonto,
          descripcion,
          categoria_id: categoriaSeleccionada,
          responsable_id: user,
          fecha,
          compartido,
        });
      }

      const { error } = await supabase.from("gastos").insert(filas);

      if (error) {
        console.error(error);
        alert("Error al guardar gasto: " + error.message);
        return;
      }

      // trigger para notificaciones (a implementar después)
      // const macro = macros.find(m => m.id === macroSeleccionada);
      // if (macro) {
      //   await fetch("/api/gastos/check-umbral", {
      //     method: "POST",
      //     body: JSON.stringify({
      //       categoria_macro_id: macroSeleccionada,
      //       mes: fecha.slice(0, 7),
      //     }),
      //   });
      // }

      router.push("/");
    } catch (err) {
      console.error(err);
      alert("Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Monto */}
      <Card title="Monto">
        <input
          type="number"
          step="0.01"
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          autoFocus
          className="w-full text-4xl font-bold text-[var(--charcoal)] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2"
        />
      </Card>

      {/* Selección de categoría: 2 taps */}
      {!macroSeleccionada ? (
        <Card title="Categoría">
          <div className="flex flex-wrap gap-2">
            {macros.map((macro) => (
              <button
                key={macro.id}
                type="button"
                onClick={() => handleMacroSelect(macro.id)}
                className="flex-1 min-w-[48%] px-3 py-2.5 rounded-lg bg-[var(--accent-bg)] text-[var(--accent)] font-bold text-[13px] hover:bg-[var(--accent)] hover:text-white transition-colors"
              >
                {macro.nombre}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card title="Categoría">
          <div className="mb-3">
            <button
              type="button"
              onClick={() => {
                setMacroSeleccionada(null);
                setCategoriaSeleccionada(null);
              }}
              className="text-[13px] text-[var(--accent)] font-bold mb-3"
            >
              ← Volver
            </button>
            <div className="flex flex-wrap gap-2">
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoriaSeleccionada(cat.id)}
                  className={`flex-1 min-w-[48%] px-3 py-2.5 rounded-lg font-bold text-[13px] transition-colors ${
                    categoriaSeleccionada === cat.id
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--accent-bg)] text-[var(--accent)]"
                  }`}
                >
                  {cat.nombre}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Fecha */}
      <Card title="Fecha">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2"
        />
      </Card>

      {/* Compartido */}
      <Card title="Gasto">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={compartido}
            onChange={(e) => setCompartido(e.target.checked)}
            className="w-5 h-5"
          />
          <span className="text-[14px]">{compartido ? "Compartido entre ambos" : "Gasto personal"}</span>
        </label>
      </Card>

      {/* Cuotas */}
      {!cuotas ? (
        <Card>
          <button
            type="button"
            onClick={() => setCuotas(true)}
            className="w-full text-[14px] text-[var(--accent)] font-bold text-center py-2"
          >
            + En cuotas
          </button>
        </Card>
      ) : (
        <Card title="Cuotas">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-[14px]">Número de cuotas:</label>
              <input
                type="number"
                min="2"
                value={numCuotas}
                onChange={(e) => setNumCuotas(parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-1 border border-[var(--border)] rounded text-[14px]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setCuotas(false);
                setNumCuotas(1);
              }}
              className="text-[12px] text-[var(--mid)] underline"
            >
              Cancelar cuotas
            </button>
          </div>
        </Card>
      )}

      {/* Descripción */}
      <Card title="Descripción (opcional)">
        <textarea
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Supermercado D&S"
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--border)] focus:border-[var(--accent)] focus:outline-none pb-2 resize-none"
          rows={2}
        />
      </Card>

      {/* Resumen antes de guardar */}
      {categoriaSeleccionada && (
        <Card accent>
          <div className="text-[14px] space-y-1">
            <div>
              <strong>{fmt(parseFloat(monto) || 0)}</strong> — {categorias.find((c) => c.id === categoriaSeleccionada)?.nombre}
            </div>
            <div className="text-[12px] text-[var(--mid)]">{fecha}</div>
            {cuotas && numCuotas > 1 && <div className="text-[12px] text-[var(--mid)]">En {numCuotas} cuotas</div>}
          </div>
        </Card>
      )}

      {/* Botón enviar */}
      <Btn type="submit" disabled={loading || !monto || !categoriaSeleccionada}>
        {loading ? "Guardando..." : "Guardar"}
      </Btn>
    </form>
  );
}
