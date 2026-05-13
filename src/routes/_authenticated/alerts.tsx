import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, daysUntil } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/alerts")({
  component: AlertsPage,
});

function AlertsPage() {
  const { data } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const { data: meds } = await supabase
        .from("medicines")
        .select("*, categories(name)")
        .eq("is_active", true);
      const all = meds ?? [];
      return {
        rupture: all.filter((m: any) => m.quantity <= m.min_threshold && m.expiration_date >= today),
        expiring: all.filter((m: any) => m.expiration_date >= today && m.expiration_date <= in30.toISOString().slice(0, 10)),
        expired: all.filter((m: any) => m.expiration_date < today),
      };
    },
  });

  const Section = ({
    title,
    icon: Icon,
    items,
    tone,
    formatLine,
  }: {
    title: string;
    icon: typeof AlertTriangle;
    items: any[];
    tone: "danger" | "warning" | "expired";
    formatLine: (m: any) => string;
  }) => {
    const tones = {
      danger: "border-warning/30 bg-warning/5",
      warning: "border-warning/30 bg-warning/5",
      expired: "border-destructive/30 bg-destructive/5",
    };
    const iconTones = {
      danger: "text-warning bg-warning/15",
      warning: "text-warning bg-warning/15",
      expired: "text-destructive bg-destructive/15",
    };
    return (
      <div className={`rounded-xl border p-5 ${tones[tone]}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`size-9 rounded-lg flex items-center justify-center ${iconTones[tone]}`}>
            <Icon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground">{items.length} médicament(s)</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Aucune alerte active</p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((m) => (
              <li key={m.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.categories?.name ?? ""} · code {m.code}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground whitespace-nowrap">{formatLine(m)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alertes</h1>
        <p className="text-sm text-muted-foreground mt-1">Surveillance des stocks et péremptions</p>
      </div>
      <Section
        title="Stock faible / Rupture"
        icon={AlertTriangle}
        items={data?.rupture ?? []}
        tone="danger"
        formatLine={(m) => `${m.quantity} / ${m.min_threshold} unités`}
      />
      <Section
        title="Expiration imminente (< 30 jours)"
        icon={Clock}
        items={data?.expiring ?? []}
        tone="warning"
        formatLine={(m) => `Expire dans ${daysUntil(m.expiration_date)} j (${formatDate(m.expiration_date)})`}
      />
      <Section
        title="Médicaments expirés"
        icon={XCircle}
        items={data?.expired ?? []}
        tone="expired"
        formatLine={(m) => `Expiré le ${formatDate(m.expiration_date)}`}
      />
    </div>
  );
}
