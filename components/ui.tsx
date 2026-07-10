export function Card({ title, children, accent = false }: { title?: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`bg-[var(--warm-white)] rounded-2xl p-4 mb-3 border shadow-[0_1px_3px_rgba(0,0,0,0.06),0_8px_24px_rgba(31,122,92,0.06)] ${
        accent ? "border-[var(--accent-light)] border-l-[4px]" : "border-[var(--border)]"
      }`}
    >
      {title && (
        <div className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-wider mb-3">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

export function Empty({ icon, text, sub }: { icon?: string; text: string; sub?: string }) {
  return (
    <div className="text-center py-10 px-5 text-[var(--mid)]">
      {icon && <div className="text-5xl mb-3">{icon}</div>}
      <div className="text-[15px] font-medium">{text}</div>
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
    gray: "bg-[var(--accent-bg)] text-[var(--accent)]",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)]",
    gold: "bg-[var(--gold-bg)] text-[var(--gold)]",
  };
  return (
    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full tracking-wide ${colors[color]}`}>
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
    primary: "text-white py-3.5 text-base font-bold rounded-xl w-full shadow-md shadow-[rgba(31,122,92,0.25)]",
    secondary: "bg-[var(--accent-bg)] text-[var(--accent)] py-3.5 text-base font-bold rounded-xl w-full",
    ghost: "bg-transparent border-[1.5px] border-[var(--border)] text-[var(--charcoal)] py-2.5 text-sm font-bold rounded-xl w-full",
    danger: "bg-[var(--red-bg)] text-[var(--red)] py-2.5 text-sm font-bold rounded-xl w-full",
    green: "bg-[var(--green-bg)] text-[var(--green)] py-3.5 text-base font-bold rounded-xl w-full",
    teal: "bg-[var(--teal-bg)] text-[var(--teal)] py-3.5 text-base font-bold rounded-xl w-full",
    "sm-secondary": "bg-[var(--accent-bg)] text-[var(--accent)] py-2 px-3.5 text-[13px] font-bold rounded-lg",
    "sm-green": "bg-[var(--green-bg)] text-[var(--green)] py-2 px-3.5 text-[13px] font-bold rounded-lg",
    "sm-primary": "text-white py-2 px-3.5 text-[13px] font-bold rounded-lg",
    "sm-teal": "bg-[var(--teal-bg)] text-[var(--teal)] py-2 px-3.5 text-[13px] font-bold rounded-lg",
    "sm-ghost": "bg-transparent border-[1.5px] border-[var(--border)] text-[var(--charcoal)] py-2 px-3.5 text-[13px] font-bold rounded-lg",
  };
  const gradientStyle = variant === "primary" || variant === "sm-primary" ? { background: "var(--gradient)" } : undefined;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={gradientStyle}
      className={`active:opacity-80 transition-opacity disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100);
  const color = pct >= 100 ? "var(--red)" : pct >= 80 ? "var(--yellow)" : "var(--green)";
  return (
    <div className="w-full h-2 rounded-full bg-[var(--accent-bg)] overflow-hidden">
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  );
}
