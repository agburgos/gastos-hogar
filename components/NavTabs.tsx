"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const TABS = [
  { href: "/", icon: "📊", label: "Inicio" },
  { href: "/nuevo", icon: "➕", label: "Nuevo" },
  { href: "/resumen", icon: "📅", label: "Resumen" },
  { href: "/balance", icon: "⚖️", label: "Balance" },
  { href: "/deudas", icon: "💳", label: "Deudas" },
  { href: "/revisar", icon: "🏷️", label: "Revisar" },
  { href: "/ajustes", icon: "⚙️", label: "Ajustes" },
];

export default function NavTabs({ nombre }: { nombre: string }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-0 z-50" style={{ background: "var(--gradient)" }}>
        <div className="max-w-[480px] mx-auto flex items-center justify-between px-4 py-3.5">
          <div className="leading-tight">
            <div className="text-[17px] font-extrabold tracking-tight text-white drop-shadow-sm">
              Gastos Hogar
            </div>
            <div className="text-[11px] font-semibold text-white/85 -mt-0.5 tracking-wide">
              Garrido Roa
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs font-medium text-white/85 bg-white/15 rounded-full px-2.5 py-1 max-w-[110px] truncate">
              {nombre}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs font-semibold text-white/85 bg-white/15 rounded-full px-2.5 py-1"
            >
              Salir
            </button>
          </div>
        </div>
      </nav>
      <div className="flex bg-[var(--warm-white)] border-b border-[var(--border)] overflow-x-auto sticky top-[64px] z-40 shadow-sm">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 min-w-[64px] px-1 py-2.5 text-[10.5px] font-semibold text-center whitespace-nowrap border-b-[3px] transition-colors ${
                active
                  ? "text-[var(--accent)] border-[var(--accent)]"
                  : "text-[var(--mid)] border-transparent"
              }`}
            >
              <span className="block text-lg mb-0.5">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </>
  );
}
