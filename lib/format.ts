export function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CL');
}

export function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtHora(d: string): string {
  return new Date(d).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}

export function fmtDateHora(d: string): string {
  return `${fmtDate(d)}, ${fmtHora(d)}`;
}

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
