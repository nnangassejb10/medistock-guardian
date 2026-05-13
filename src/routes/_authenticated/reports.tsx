import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatXAF, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { data: stockData } = useQuery({
    queryKey: ["report-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("medicines")
        .select("name, code, quantity, unit_price, expiration_date, categories(name)")
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const exportCSV = () => {
    if (!stockData) return;
    const rows = [
      ["Code", "Nom", "Catégorie", "Quantité", "Prix unitaire", "Valeur totale", "Expiration"].join(";"),
      ...stockData.map((m: any) =>
        [m.code, m.name, m.categories?.name ?? "", m.quantity, m.unit_price, Number(m.quantity) * Number(m.unit_price), m.expiration_date].join(";")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `rapport-stock-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalValue = (stockData ?? []).reduce((s: number, m: any) => s + Number(m.quantity) * Number(m.unit_price), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rapports</h1>
        <p className="text-sm text-muted-foreground mt-1">État du stock et exports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <div className="text-xs uppercase text-muted-foreground">Médicaments</div>
          <div className="text-3xl font-bold mt-2">{stockData?.length ?? 0}</div>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <div className="text-xs uppercase text-muted-foreground">Valeur totale</div>
          <div className="text-3xl font-bold mt-2">{formatXAF(totalValue)}</div>
        </div>
        <div className="bg-card border rounded-xl p-5 flex flex-col gap-2">
          <div className="text-xs uppercase text-muted-foreground">Export</div>
          <Button onClick={exportCSV} className="mt-1"><Download className="size-4" /> Télécharger CSV</Button>
        </div>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <h3 className="font-semibold">État du stock actuel</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium text-right">Qté</th>
              <th className="px-4 py-3 font-medium text-right">Prix</th>
              <th className="px-4 py-3 font-medium text-right">Valeur</th>
              <th className="px-4 py-3 font-medium">Exp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(stockData ?? []).map((m: any) => (
              <tr key={m.code}>
                <td className="px-4 py-2 font-mono text-xs">{m.code}</td>
                <td className="px-4 py-2 font-medium">{m.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{m.categories?.name ?? "—"}</td>
                <td className="px-4 py-2 text-right tabular-nums">{m.quantity}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatXAF(Number(m.unit_price))}</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatXAF(Number(m.quantity) * Number(m.unit_price))}</td>
                <td className="px-4 py-2 text-muted-foreground">{formatDate(m.expiration_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
