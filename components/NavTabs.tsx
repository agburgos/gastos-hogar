"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/", label: "Inicio" },
  { href: "/nuevo", label: "Nuevo" },
  { href: "/gastos", label: "Gastos" },
  { href: "/detalle", label: "Detalle gastos" },
  { href: "/resumen", label: "Resumen" },
  { href: "/balance", label: "Balance" },
  { href: "/deudas", label: "Deudas" },
  { href: "/revisar", label: "Revisar" },
  { href: "/ajustes", label: "Ajustes" },
];

export default function NavTabs({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const primerNombre = nombre.split(" ")[0];

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--paper)]/80 backdrop-blur-xl border-b border-[var(--rule)]">
        <div className="max-w-[480px] lg:max-w-full mx-auto flex items-center justify-between px-4 py-3.5">
          <Link href="/" className="text-[17px] font-bold tracking-tight text-[var(--ink)]">
            Casa <span className="text-[var(--accent)]">·</span> Garrido Roa
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-medium text-[var(--ink-soft)] hidden sm:inline">{primerNombre}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-[12px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[57px] z-40 bg-[var(--paper)]/80 backdrop-blur-xl border-b border-[var(--rule)] overflow-x-auto">
        <div className="max-w-[480px] lg:max-w-full mx-auto flex px-3 gap-1 py-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "bg-[var(--accent)] text-white" : "text-[var(--ink-soft)] hover:text-[var(--ink)] hover:bg-white/5"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
