export function Card({ title, children, accent = false }: { title?: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className="rise-in mb-3 last:mb-0">
      {title && (
        <h3 className="text-[13px] font-semibold text-[var(--ink-soft)] mb-2 px-0.5">{title}</h3>
      )}
      <div
        className={`bg-[var(--paper-raised)] rounded-2xl p-4 ${accent ? "ring-1 ring-[var(--accent)]/40" : ""}`}
      >
        {children}
      </div>
    </section>
  );
}

export function Empty({ icon, text, sub }: { icon?: string; text: string; sub?: string }) {
  return (
    <div className="text-center py-14 px-5 text-[var(--ink-soft)] rise-in">
      {icon && <div className="text-4xl mb-3 opacity-60">{icon}</div>}
      <div className="text-[16px] font-semibold text-[var(--ink)]">{text}</div>
      {sub && <div className="text-[13px] mt-1">{sub}</div>}
    </div>
  );
}

export function Badge({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "green" | "yellow" | "red" | "gray" | "teal" | "gold";
}) {
  const colors: Record<string, string> = {
    green: "bg-[var(--green-bg)] text-[var(--green)]",
    yellow: "bg-[var(--yellow-bg)] text-[var(--yellow)]",
    red: "bg-[var(--red-bg)] text-[var(--red)]",
    gray: "bg-white/8 text-[var(--ink-soft)]",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)]",
    gold: "bg-[var(--accent-bg)] text-[var(--accent)]",
  };
  return (
    <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full tracking-wide ${colors[color]}`}>
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className = "",
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "green" | "teal" | "sm-secondary" | "sm-green" | "sm-primary" | "sm-teal" | "sm-ghost";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
}) {
  const variants: Record<string, string> = {
    primary: "text-white py-3.5 text-[15px] font-semibold rounded-full w-full",
    secondary: "bg-white/10 text-[var(--ink)] py-3.5 text-[15px] font-semibold rounded-full w-full",
    ghost: "bg-transparent border border-white/15 text-[var(--ink)] py-2.5 text-sm font-semibold rounded-full w-full",
    danger: "bg-[var(--red-bg)] text-[var(--red)] py-2.5 text-sm font-semibold rounded-full w-full",
    green: "bg-[var(--green-bg)] text-[var(--green)] py-3.5 text-[15px] font-semibold rounded-full w-full",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)] py-3.5 text-[15px] font-semibold rounded-full w-full",
    "sm-secondary": "bg-white/10 text-[var(--ink)] py-2 px-3.5 text-[13px] font-semibold rounded-full",
    "sm-green": "bg-[var(--green-bg)] text-[var(--green)] py-2 px-3.5 text-[13px] font-semibold rounded-full",
    "sm-primary": "text-white py-2 px-3.5 text-[13px] font-semibold rounded-full",
    "sm-teal": "bg-[var(--teal-bg)] text-[var(--teal)] py-2 px-3.5 text-[13px] font-semibold rounded-full",
    "sm-ghost": "bg-transparent border border-white/15 text-[var(--ink)] py-2 px-3.5 text-[13px] font-semibold rounded-full",
  };
  const bgStyle = variant === "primary" || variant === "sm-primary" ? { background: "var(--accent)" } : undefined;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={bgStyle}
      className={`active:opacity-70 transition-opacity disabled:opacity-40 disabled:pointer-events-none ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow)" : "var(--accent)";
  return (
    <div className="w-full h-[4px] rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
