"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/", label: "inicio", n: "01" },
  { href: "/nuevo", label: "nuevo", n: "02" },
  { href: "/detalle", label: "detalle", n: "03" },
  { href: "/resumen", label: "resumen", n: "04" },
  { href: "/balance", label: "balance", n: "05" },
  { href: "/deudas", label: "deudas", n: "06" },
  { href: "/revisar", label: "revisar", n: "07" },
  { href: "/ajustes", label: "ajustes", n: "08" },
];

export default function NavTabs({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const primerNombre = nombre.split(" ")[0];

  return (
    <>
      <header className="sticky top-0 z-50 bg-[var(--paper)]/95 backdrop-blur-sm border-b-2 border-[var(--ink)]">
        <div className="max-w-[480px] lg:max-w-full mx-auto flex items-end justify-between px-4 pt-4 pb-3">
          <Link href="/" className="leading-none">
            <div className="display text-[26px] font-medium italic tracking-tight text-[var(--ink)]">
              Casa
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--coral)] -mt-1">
              Garrido · Roa
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)] hidden sm:inline">
              hola, {primerNombre}
            </span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink)] border-2 border-[var(--ink)] px-2.5 py-1 rounded-sm hover:bg-[var(--ink)] hover:text-[var(--paper)] transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <nav className="sticky top-[65px] z-40 bg-[var(--paper)] border-b border-[var(--rule)] overflow-x-auto">
        <div className="max-w-[480px] lg:max-w-full mx-auto flex px-2">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="group relative px-3 py-2.5 whitespace-nowrap"
              >
                <span
                  className={`flex items-baseline gap-1 transition-all ${
                    active
                      ? "display italic text-[15px] font-semibold text-[var(--ink)]"
                      : "text-[13px] font-medium text-[var(--ink-faint)] group-hover:text-[var(--ink-soft)]"
                  }`}
                >
                  <span className="text-[9px] font-mono opacity-50">{tab.n}</span>
                  {tab.label}
                </span>
                {active && (
                  <span
                    className="absolute left-2 right-2 -bottom-[1px] h-[3px] rise-in"
                    style={{ background: "var(--lime)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
