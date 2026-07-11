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

const AMBITOS = [
  { value: "ninguno", label: "Ninguno" },
  { value: "casa", label: "Casa" },
  { value: "parcela", label: "Parcela" },
  { value: "ambos", label: "Ambos" },
];

const USUARIOS = [
  { id: "9a7597c3-de3c-4cdc-9bdf-78dde625cff0", nombre: "Gloria" },
  { id: "6268104e-7c3c-4643-b4f6-7eb44a636f03", nombre: "Alberto" },
];

export default function NuevoPage() {
  const router = useRouter();
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(ymdLocal(new Date()));
  const [mesSelector, setMesSelector] = useState<"actual" | "proximo">("actual");
  const [compartido, setCompartido] = useState(true);
  const [descripcion, setDescripcion] = useState("");
  const [ambito, setAmbito] = useState("ninguno");
  const [macroSeleccionada, setMacroSeleccionada] = useState<string | null>(null);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string | null>(null);
  const [cuotas, setCuotas] = useState(false);
  const [numCuotas, setNumCuotas] = useState(1);
  const [recurrente, setRecurrente] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [user, setUser] = useState<string | null>(null);
  const [responsableSeleccionado, setResponsableSeleccionado] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id || null;
      setUser(userId);
      setResponsableSeleccionado(userId);

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

    if (!monto || !categoriaSeleccionada || !responsableSeleccionado) {
      alert("Monto y categoría requeridos");
      return;
    }

    if (!descripcion.trim()) {
      alert("El título del gasto es obligatorio");
      return;
    }

    setLoading(true);

    try {
      const parsedMonto = parseFloat(monto);
      const filas = [];

      let fechaBase = new Date(fecha + "T00:00:00");
      if (mesSelector === "proximo") {
        fechaBase.setMonth(fechaBase.getMonth() + 1);
      }

      if (cuotas && numCuotas > 1) {
        const cuotaGrupoId = crypto.randomUUID();

        for (let i = 0; i < numCuotas; i++) {
          const nextFecha = new Date(fechaBase);
          nextFecha.setMonth(nextFecha.getMonth() + i);
          filas.push({
            monto: parsedMonto,
            descripcion,
            categoria_id: categoriaSeleccionada,
            responsable_id: responsableSeleccionado,
            fecha: ymdLocal(nextFecha),
            compartido,
            ambito,
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
          responsable_id: responsableSeleccionado,
          fecha: ymdLocal(fechaBase),
          compartido,
          ambito,
          recurrente,
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
    <form onSubmit={handleSubmit} className="space-y-3 pb-4">
      {/* Monto */}
      <div className="rise-in bg-[var(--paper-raised)] rounded-2xl pt-6 pb-7 mb-2 text-center">
        <div className="text-[12px] font-semibold text-[var(--ink-soft)] mb-2">¿Cuánto fue?</div>
        <div className="flex items-center justify-center gap-1">
          <span className="text-[26px] font-bold text-[var(--ink-soft)]">$</span>
          <input
            type="number"
            step="0.01"
            placeholder="0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            className="!bg-transparent !border-none !p-0 text-[52px] font-extrabold text-[var(--ink)] text-center w-[55%] leading-none"
          />
        </div>
      </div>

      {/* Selección de categoría: 2 taps */}
      {!macroSeleccionada ? (
        <Card title="Categoría">
          <div className="flex flex-wrap gap-2">
            {macros.map((macro) => (
              <button
                key={macro.id}
                type="button"
                onClick={() => handleMacroSelect(macro.id)}
                className="flex-1 min-w-[48%] px-3 py-2.5 rounded-sm bg-[var(--indigo-bg)] text-[var(--indigo)] font-bold text-[13px] hover:bg-[var(--indigo)] hover:text-white transition-colors"
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
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2 mb-3"
        />
        <div className="text-[12px] text-[var(--ink-soft)] mb-2">¿Este mes o el próximo?</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMesSelector("actual")}
            className={`flex-1 px-3 py-2 rounded-lg font-semibold text-[13px] transition-colors ${
              mesSelector === "actual"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--accent-bg)] text-[var(--accent)]"
            }`}
          >
            Este mes
          </button>
          <button
            type="button"
            onClick={() => setMesSelector("proximo")}
            className={`flex-1 px-3 py-2 rounded-lg font-semibold text-[13px] transition-colors ${
              mesSelector === "proximo"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--accent-bg)] text-[var(--accent)]"
            }`}
          >
            Próximo mes
          </button>
        </div>
      </Card>

      {/* Compartido */}
      <Card title="Gasto">
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={compartido}
              onChange={(e) => setCompartido(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-[14px]">{compartido ? "Compartido entre ambos" : "Gasto personal"}</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={recurrente}
              onChange={(e) => setRecurrente(e.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-[14px]">{recurrente ? "Gasto recurrente (cada mes)" : "Gasto único"}</span>
          </label>
        </div>
      </Card>

      {/* Responsable */}
      <Card title="¿Quién gastó?">
        <div className="flex gap-2">
          {USUARIOS.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setResponsableSeleccionado(u.id)}
              className={`flex-1 px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                responsableSeleccionado === u.id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-bg)] text-[var(--accent)]"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
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

      {/* Título (obligatorio) */}
      <Card title="Título del gasto *">
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Supermercado D&S"
          required
          className="w-full text-[14px] bg-transparent border-b-2 border-[var(--accent)] focus:outline-none pb-2"
        />
      </Card>

      {/* Ámbito: casa, parcela, ambos, ninguno */}
      <Card title="Ámbito">
        <div className="flex flex-wrap gap-2">
          {AMBITOS.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setAmbito(a.value)}
              className={`flex-1 min-w-[45%] px-3 py-2 rounded-lg font-bold text-[13px] transition-colors ${
                ambito === a.value
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--accent-bg)] text-[var(--accent)]"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
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
      <Btn type="submit" disabled={loading || !monto || !categoriaSeleccionada || !descripcion.trim()}>
        {loading ? "Guardando..." : "Guardar"}
      </Btn>
    </form>
  );
}
