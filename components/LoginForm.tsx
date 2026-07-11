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
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-[360px] rise-in">
        <div className="mb-10">
          <div className="display text-[52px] italic font-medium leading-none" style={{ color: "var(--ink)" }}>
            Casa
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.25em] mt-1" style={{ color: "var(--coral)" }}>
            Garrido · Roa
          </div>
        </div>

        <form onSubmit={onSubmit}>
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
          {error && <p className="text-[13px] font-semibold text-[var(--red)] mb-3.5">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-base font-bold rounded-sm text-white disabled:opacity-50 border-2 border-[var(--ink)] hover:shadow-[3px_3px_0_var(--lime)] active:translate-y-[1px] transition-all"
            style={{ background: "var(--gradient)" }}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
