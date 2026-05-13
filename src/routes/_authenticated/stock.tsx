import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { fromNow } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/stock")({
  component: StockPage,
});

function StockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gestion du stock</h1>
        <p className="text-sm text-muted-foreground mt-1">Entrées, sorties et historique des mouvements</p>
      </div>

      <Tabs defaultValue="entree">
        <TabsList>
          <TabsTrigger value="entree"><TrendingUp className="size-4" /> Entrées</TabsTrigger>
          <TabsTrigger value="sortie"><TrendingDown className="size-4" /> Sorties</TabsTrigger>
          <TabsTrigger value="history"><History className="size-4" /> Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="entree" className="mt-4">
          <MovementForm type="entree" />
        </TabsContent>
        <TabsContent value="sortie" className="mt-4">
          <MovementForm type="sortie" />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <HistoryView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MovementForm({ type }: { type: "entree" | "sortie" }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [medicineId, setMedicineId] = useState("");
  const [quantity, setQuantity] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [unitPrice, setUnitPrice] = useState<number>(0);

  const { data: meds = [] } = useQuery({
    queryKey: ["medicines-light"],
    queryFn: async () => (await supabase.from("medicines").select("id,name,quantity,unit_price").eq("is_active", true).order("name")).data ?? [],
  });

  const submit = async () => {
    if (!medicineId || quantity <= 0) {
      toast.error("Sélectionnez un médicament et une quantité valide");
      return;
    }
    const { error } = await supabase.from("stock_movements").insert({
      medicine_id: medicineId,
      movement_type: type,
      quantity,
      quantity_before: 0, // overwritten by trigger
      quantity_after: 0,
      unit_price: unitPrice || null,
      reason: reason || null,
      reference: reference || null,
      performed_by: user?.id,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(type === "entree" ? "Entrée enregistrée" : "Sortie enregistrée");
    setMedicineId(""); setQuantity(0); setReason(""); setReference(""); setUnitPrice(0);
    qc.invalidateQueries({ queryKey: ["medicines"] });
    qc.invalidateQueries({ queryKey: ["medicines-light"] });
    qc.invalidateQueries({ queryKey: ["movements-history"] });
  };

  const selected = meds.find((m: any) => m.id === medicineId);

  return (
    <div className="bg-card border rounded-xl p-6 max-w-2xl">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Médicament *</Label>
          <Select value={medicineId} onValueChange={(v) => { setMedicineId(v); const m: any = meds.find((x: any) => x.id === v); if (m) setUnitPrice(Number(m.unit_price)); }}>
            <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
            <SelectContent>
              {meds.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} (stock actuel: {m.quantity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <div className="text-xs text-muted-foreground bg-muted/40 rounded p-3">
            Stock actuel: <strong className="text-foreground">{(selected as any).quantity}</strong> unités
            {type === "sortie" && quantity > (selected as any).quantity && (
              <span className="text-destructive ml-2">⚠ Stock insuffisant</span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Quantité *</Label>
            <Input type="number" min={1} value={quantity || ""} onChange={(e) => setQuantity(+e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{type === "entree" ? "Prix unitaire achat" : "Prix unitaire"} (FCFA)</Label>
            <Input type="number" value={unitPrice || ""} onChange={(e) => setUnitPrice(+e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Référence ({type === "entree" ? "bon de commande" : "ordonnance"})</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{type === "entree" ? "Motif / Fournisseur" : "Destinataire / Service / Motif"}</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
        <Button onClick={submit} className="w-full">
          Valider {type === "entree" ? "l'entrée" : "la sortie"}
        </Button>
      </div>
    </div>
  );
}

function HistoryView() {
  const { data: moves = [] } = useQuery({
    queryKey: ["movements-history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_movements")
        .select("*, medicines(name, code), profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Médicament</th>
            <th className="px-4 py-3 font-medium text-right">Quantité</th>
            <th className="px-4 py-3 font-medium text-right">Avant → Après</th>
            <th className="px-4 py-3 font-medium">Par</th>
            <th className="px-4 py-3 font-medium">Réf.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {moves.map((m: any) => (
            <tr key={m.id} className="hover:bg-muted/30">
              <td className="px-4 py-3 text-muted-foreground">{fromNow(m.created_at)}</td>
              <td className="px-4 py-3">
                <span className={`inline-block px-2 py-0.5 rounded text-xs border ${
                  m.movement_type === "entree" ? "bg-success/15 text-success border-success/30" :
                  m.movement_type === "sortie" ? "bg-destructive/15 text-destructive border-destructive/30" :
                  "bg-warning/15 text-warning border-warning/30"
                }`}>
                  {m.movement_type}
                </span>
              </td>
              <td className="px-4 py-3 font-medium">{m.medicines?.name}</td>
              <td className="px-4 py-3 text-right tabular-nums">{m.quantity}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{m.quantity_before} → {m.quantity_after}</td>
              <td className="px-4 py-3 text-muted-foreground">{m.profiles?.full_name ?? "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{m.reference ?? "—"}</td>
            </tr>
          ))}
          {moves.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Aucun mouvement</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
