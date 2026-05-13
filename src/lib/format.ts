export function formatXAF(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n) + " FCFA";
}

export function formatDate(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fromNow(s: string | Date): string {
  const d = typeof s === "string" ? new Date(s) : s;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `il y a ${Math.floor(diff / 86400)} j`;
  return formatDate(d);
}

export function daysUntil(s: string): number {
  return Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
}

export function stockStatus(qty: number, min: number, expiration: string) {
  const days = daysUntil(expiration);
  if (days < 0) return { label: "Expiré", color: "bg-destructive/20 text-destructive border-destructive/30" };
  if (qty === 0) return { label: "Rupture", color: "bg-destructive/20 text-destructive border-destructive/30" };
  if (qty <= min) return { label: "Faible", color: "bg-warning/20 text-warning border-warning/30" };
  if (days <= 30) return { label: "Expire bientôt", color: "bg-warning/20 text-warning border-warning/30" };
  return { label: "Disponible", color: "bg-success/20 text-success border-success/30" };
}
