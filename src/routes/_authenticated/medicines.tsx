import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { formatXAF, formatDate, stockStatus } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/medicines")({
  component: MedicinesPage,
});

interface Medicine {
  id: string;
  name: string;
  code: string;
  category_id: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  expiration_date: string;
  supplier_id: string | null;
  lot_number: string | null;
  location: string | null;
  min_threshold: number;
  is_active: boolean;
  categories?: { name: string; color: string };
  suppliers?: { name: string };
}

function MedicinesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole(["super_admin", "admin", "pharmacien", "gestionnaire_stock"]);
  const canDelete = hasRole(["super_admin", "admin"]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<Medicine> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: meds = [] } = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medicines")
        .select("*, categories(name, color), suppliers(name)")
        .order("name");
      if (error) throw error;
      return data as Medicine[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });

  const filtered = meds.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
  });

  const handleSave = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name?.trim(),
      code: editing.code?.trim(),
      category_id: editing.category_id || null,
      supplier_id: editing.supplier_id || null,
      quantity: Number(editing.quantity ?? 0),
      unit_price: Number(editing.unit_price ?? 0),
      min_threshold: Number(editing.min_threshold ?? 10),
      expiration_date: editing.expiration_date,
      description: editing.description ?? null,
      lot_number: editing.lot_number ?? null,
      location: editing.location ?? null,
    };
    if (!payload.name || !payload.code || !payload.expiration_date) {
      toast.error("Nom, code et date d'expiration requis");
      return;
    }

    let res;
    if (editing.id) {
      res = await supabase.from("medicines").update(payload).eq("id", editing.id);
    } else {
      const { data: u } = await supabase.auth.getUser();
      res = await supabase.from("medicines").insert({ ...payload, created_by: u.user?.id } as any);
    }
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(editing.id ? "Médicament modifié" : "Médicament ajouté");
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["medicines"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce médicament ?")) return;
    const { error } = await supabase.from("medicines").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimé");
    qc.invalidateQueries({ queryKey: ["medicines"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Médicaments</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} produit(s)</p>
        </div>
        {canEdit && (
          <Button onClick={() => { setEditing({ min_threshold: 10, quantity: 0, unit_price: 0 }); setOpen(true); }}>
            <Plus className="size-4" /> Ajouter
          </Button>
        )}
      </div>

      <div className="bg-card border rounded-xl">
        <div className="p-4 border-b">
          <div className="relative max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou code..."
              className="pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Nom</th>
                <th className="px-4 py-3 font-medium">Catégorie</th>
                <th className="px-4 py-3 font-medium text-right">Quantité</th>
                <th className="px-4 py-3 font-medium text-right">Prix</th>
                <th className="px-4 py-3 font-medium">Expiration</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((m) => {
                const status = stockStatus(m.quantity, m.min_threshold, m.expiration_date);
                return (
                  <tr key={m.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{m.code}</td>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {m.categories?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{m.quantity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatXAF(Number(m.unit_price))}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(m.expiration_date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs border ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {canEdit && (
                          <Button size="icon" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                            <Pencil className="size-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Aucun médicament</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier" : "Ajouter"} un médicament</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Code *</Label>
                <Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={editing.category_id ?? ""} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select value={editing.supplier_id ?? ""} onValueChange={(v) => setEditing({ ...editing, supplier_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantité initiale</Label>
                <Input type="number" value={editing.quantity ?? 0} onChange={(e) => setEditing({ ...editing, quantity: +e.target.value })} disabled={!!editing.id} />
              </div>
              <div className="space-y-2">
                <Label>Prix unitaire (FCFA)</Label>
                <Input type="number" value={editing.unit_price ?? 0} onChange={(e) => setEditing({ ...editing, unit_price: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Seuil minimal</Label>
                <Input type="number" value={editing.min_threshold ?? 10} onChange={(e) => setEditing({ ...editing, min_threshold: +e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date d'expiration *</Label>
                <Input type="date" value={editing.expiration_date ?? ""} onChange={(e) => setEditing({ ...editing, expiration_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Numéro de lot</Label>
                <Input value={editing.lot_number ?? ""} onChange={(e) => setEditing({ ...editing, lot_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Emplacement</Label>
                <Input value={editing.location ?? ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
