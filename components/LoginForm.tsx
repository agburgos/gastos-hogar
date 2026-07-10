"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--linen)" }}>
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <div className="text-2xl font-extrabold tracking-tight" style={{ color: "var(--accent)" }}>
            Gastos Hogar
          </div>
          <div className="text-sm font-semibold text-[var(--mid)] -mt-0.5">Garrido Roa</div>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-[var(--warm-white)] rounded-2xl p-5 border border-[var(--border)] shadow-md"
        >
          <div className="mb-3.5">
            <label>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="username"
            />
          </div>
          <div className="mb-3.5">
            <label>Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-[13px] text-[var(--red)] mb-3.5">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-base font-bold rounded-xl text-white disabled:opacity-50"
            style={{ background: "var(--gradient)" }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
