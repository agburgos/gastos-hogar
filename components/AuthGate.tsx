"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import LoginForm from "./LoginForm";
import NavTabs from "./NavTabs";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [nombre, setNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setNombre(null);
      return;
    }
    supabase
      .from("usuarios")
      .select("nombre")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => setNombre(data?.nombre ?? null));
  }, [session]);

  if (loading) return null;

  if (!session) return <LoginForm />;

  return (
    <>
      <NavTabs nombre={nombre ?? session.user.email ?? ""} />
      <div className="max-w-[480px] w-full mx-auto px-4 pt-4 pb-10">{children}</div>
    </>
  );
}
