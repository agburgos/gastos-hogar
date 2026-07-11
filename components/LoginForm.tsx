"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recordarme, setRecordarme] = useState(false);

  useEffect(() => {
    const emailGuardado = localStorage.getItem("email_recordado");
    if (emailGuardado) {
      setEmail(emailGuardado);
      setRecordarme(true);
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (recordarme) {
      localStorage.setItem("email_recordado", email);
    } else {
      localStorage.removeItem("email_recordado");
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Email o contraseña incorrectos" : error.message);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <div className="w-full max-w-[340px] rise-in">
        <div className="mb-10 text-center">
          <div className="text-[28px] font-extrabold tracking-tight text-[var(--ink)]">Casa</div>
          <div className="text-[13px] font-medium text-[var(--ink-soft)] mt-1">Garrido · Roa</div>
        </div>

        <form onSubmit={onSubmit} className="bg-[var(--paper-raised)] rounded-2xl p-5">
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
          <div className="mb-3.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recordarme}
                onChange={(e) => setRecordarme(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-[13px] text-[var(--ink-soft)]">Recordarme en este dispositivo</span>
            </label>
          </div>
          {error && <p className="text-[13px] font-medium text-[var(--red)] mb-3.5">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-[15px] font-semibold rounded-full text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
