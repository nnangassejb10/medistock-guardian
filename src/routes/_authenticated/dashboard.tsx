import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Pill,
  AlertCircle,
  Clock,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatXAF, fromNow } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: typeof Pill;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const tones: Record<string, string> = {
    default: "bg-primary/10 text-primary border-primary/20",
    danger: "bg-destructive/10 text-destructive border-destructive/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    success: "bg-success/10 text-success border-success/20",
  };
  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {label}
          </div>
          <div className="text-3xl font-bold mt-2">{value}</div>
          {hint && (
            <div className="text-xs text-muted-foreground mt-1">{hint}</div>
          )}
        </div>
        <div className={`size-10 rounded-lg border flex items-center justify-center ${tones[tone]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const { data, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const today = new Date();
      const in30 = new Date(); in30.setDate(in30.getDate() + 30);
      const last7 = new Date(); last7.setDate(last7.getDate() - 7);
      const last30 = new Date(); last30.setDate(last30.getDate() - 30);

      const [meds, lowStock, expiringSoon, movements7d, recentMoves, categories, notifsCount] =
        await Promise.all([
          supabase.from("medicines").select("id, quantity, unit_price, category_id, name, min_threshold").eq("is_active", true),
          supabase.rpc as any, // placeholder
          supabase.from("medicines").select("id, name, expiration_date").lte("expiration_date", in30.toISOString().slice(0, 10)).gte("expiration_date", today.toISOString().slice(0, 10)),
          supabase.from("stock_movements").select("movement_type, quantity, created_at").gte("created_at", last7.toISOString()),
          supabase.from("stock_movements").select("id, movement_type, quantity, created_at, medicines(name), profiles(full_name)").order("created_at", { ascending: false }).limit(5),
          supabase.from("categories").select("id, name, color"),
          supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
        ]);

      const allMeds = meds.data ?? [];
      const lowCount = allMeds.filter((m: any) => m.quantity <= m.min_threshold).length;
      const totalValue = allMeds.reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);

      // 7-day chart
      const dayMap = new Map<string, { entree: number; sortie: number }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(5, 10);
        dayMap.set(key, { entree: 0, sortie: 0 });
      }
      (movements7d.data ?? []).forEach((m: any) => {
        const key = new Date(m.created_at).toISOString().slice(5, 10);
        const cur = dayMap.get(key);
        if (cur) {
          if (m.movement_type === "entree") cur.entree += m.quantity;
          if (m.movement_type === "sortie") cur.sortie += m.quantity;
        }
      });
      const chart7d = Array.from(dayMap.entries()).map(([day, v]) => ({ day, ...v }));

      // categories pie
      const cats = categories.data ?? [];
      const catMap = new Map(cats.map((c: any) => [c.id, { name: c.name, color: c.color, value: 0 }]));
      allMeds.forEach((m: any) => {
        const c = catMap.get(m.category_id);
        if (c) (c as any).value += m.quantity;
      });
      const pie = Array.from(catMap.values()).filter((c: any) => c.value > 0);

      return {
        totalMeds: allMeds.length,
        lowCount,
        expiringCount: (expiringSoon.data ?? []).length,
        totalValue,
        chart7d,
        pie,
        recentMoves: recentMoves.data ?? [],
      };
    },
  });

  // realtime
  useEffect(() => {
    const ch = supabase
      .channel("dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "medicines" }, () => refetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refetch]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground mt-1">Vue d'ensemble en temps réel de la pharmacie</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Pill} label="Médicaments" value={data?.totalMeds ?? "—"} hint="Total actifs" />
        <StatCard icon={AlertCircle} label="Rupture / faible" value={data?.lowCount ?? "—"} hint="Sous le seuil minimal" tone="danger" />
        <StatCard icon={Clock} label="Expirent < 30j" value={data?.expiringCount ?? "—"} hint="À surveiller" tone="warning" />
        <StatCard icon={Wallet} label="Valeur du stock" value={data ? formatXAF(data.totalValue) : "—"} hint="Total estimé" tone="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Mouvements de stock (7 derniers jours)</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.chart7d ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="entree" name="Entrées" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sortie" name="Sorties" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-5">
          <h3 className="font-semibold mb-4">Répartition par catégorie</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data?.pie ?? []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {(data?.pie ?? []).map((entry: any, i: number) => (
                    <Cell key={i} fill={entry.color || "var(--primary)"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Derniers mouvements</h3>
        {(data?.recentMoves ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun mouvement enregistré</p>
        ) : (
          <ul className="divide-y divide-border">
            {(data?.recentMoves ?? []).map((m: any) => (
              <li key={m.id} className="py-3 flex items-center gap-3">
                <div className={`size-9 rounded-lg flex items-center justify-center ${m.movement_type === "entree" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {m.movement_type === "entree" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{m.medicines?.name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {m.movement_type === "entree" ? "Entrée" : m.movement_type === "sortie" ? "Sortie" : m.movement_type} · {m.quantity} unités · par {m.profiles?.full_name ?? "—"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{fromNow(m.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
