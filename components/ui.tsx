const ACCENTS = ["var(--coral)", "var(--indigo)", "var(--green)"] as const;

function hashAccent(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function Card({ title, children, accent = false }: { title?: string; children: React.ReactNode; accent?: boolean }) {
  const dot = title ? hashAccent(title) : "var(--indigo)";
  return (
    <section className="rise-in mb-7 last:mb-0">
      {title && (
        <div className="flex items-baseline gap-2 mb-3">
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ background: dot }}
          />
          <h3 className="display text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-soft)]">
            {title}
          </h3>
        </div>
      )}
      <div
        className={accent ? "pl-4 border-l-[3px]" : ""}
        style={accent ? { borderColor: dot } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

export function Empty({ icon, text, sub }: { icon?: string; text: string; sub?: string }) {
  return (
    <div className="text-center py-14 px-5 text-[var(--ink-soft)] rise-in">
      {icon && <div className="text-5xl mb-3">{icon}</div>}
      <div className="display text-[19px] italic">{text}</div>
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
    gray: "bg-[var(--indigo-bg)] text-[var(--indigo)]",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)]",
    gold: "bg-[var(--coral-bg)] text-[var(--coral)]",
  };
  return (
    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-sm tracking-wide ${colors[color]}`}>
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
    primary: "text-white py-3.5 text-base font-bold rounded-sm w-full border-2 border-[var(--ink)]",
    secondary: "bg-[var(--indigo-bg)] text-[var(--indigo)] py-3.5 text-base font-bold rounded-sm w-full border-2 border-transparent",
    ghost: "bg-transparent border-2 border-[var(--ink)] text-[var(--ink)] py-2.5 text-sm font-bold rounded-sm w-full",
    danger: "bg-[var(--red-bg)] text-[var(--red)] py-2.5 text-sm font-bold rounded-sm w-full",
    green: "bg-[var(--green-bg)] text-[var(--green)] py-3.5 text-base font-bold rounded-sm w-full",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)] py-3.5 text-base font-bold rounded-sm w-full",
    "sm-secondary": "bg-[var(--indigo-bg)] text-[var(--indigo)] py-2 px-3.5 text-[13px] font-bold rounded-sm",
    "sm-green": "bg-[var(--green-bg)] text-[var(--green)] py-2 px-3.5 text-[13px] font-bold rounded-sm",
    "sm-primary": "text-white py-2 px-3.5 text-[13px] font-bold rounded-sm border-2 border-[var(--ink)]",
    "sm-teal": "bg-[var(--teal-bg)] text-[var(--teal)] py-2 px-3.5 text-[13px] font-bold rounded-sm",
    "sm-ghost": "bg-transparent border-2 border-[var(--rule)] text-[var(--ink)] py-2 px-3.5 text-[13px] font-bold rounded-sm",
  };
  const gradientStyle =
    variant === "primary" || variant === "sm-primary" ? { background: "var(--gradient)" } : undefined;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={gradientStyle}
      className={`active:translate-y-[1px] transition-all disabled:opacity-40 disabled:pointer-events-none hover:shadow-[3px_3px_0_var(--lime)] ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow)" : "var(--green)";
  return (
    <div className="w-full h-[6px] bg-[var(--rule)] overflow-hidden">
      <div
        className="h-full transition-[width] duration-500 ease-out"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
