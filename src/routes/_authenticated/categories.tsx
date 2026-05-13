import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
});

function CategoriesPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canEdit = hasRole(["super_admin", "admin", "pharmacien"]);
  const [editing, setEditing] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["categories-full"],
    queryFn: async () => {
      const [{ data: cats }, { data: meds }] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("medicines").select("category_id"),
      ]);
      const counts = new Map<string, number>();
      (meds ?? []).forEach((m: any) => counts.set(m.category_id, (counts.get(m.category_id) ?? 0) + 1));
      return (cats ?? []).map((c: any) => ({ ...c, medicine_count: counts.get(c.id) ?? 0 }));
    },
  });

  const save = async () => {
    if (!editing?.name) return toast.error("Nom requis");
    const payload = { name: editing.name, description: editing.description ?? null, color: editing.color || "#1E40AF" };
    const res = editing.id
      ? await supabase.from("categories").update(payload).eq("id", editing.id)
      : await supabase.from("categories").insert(payload as any);
    if (res.error) return toast.error(res.error.message);
    toast.success("Enregistré");
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["categories-full"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catégories</h1>
          <p className="text-sm text-muted-foreground mt-1">{items.length} catégorie(s)</p>
        </div>
        {canEdit && <Button onClick={() => { setEditing({ color: "#1E40AF" }); setOpen(true); }}><Plus className="size-4" /> Ajouter</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((c: any) => (
          <div key={c.id} className="bg-card border rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg" style={{ background: c.color }} />
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.medicine_count} médicament(s)</div>
                </div>
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="size-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm("Supprimer ?")) return;
                    const { error } = await supabase.from("categories").delete().eq("id", c.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["categories-full"] });
                  }}><Trash2 className="size-4 text-destructive" /></Button>
                </div>
              )}
            </div>
            {c.description && <p className="text-sm text-muted-foreground mt-3">{c.description}</p>}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Modifier" : "Ajouter"} une catégorie</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-2"><Label>Nom *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="space-y-2"><Label>Couleur</Label><Input type="color" value={editing.color ?? "#1E40AF"} onChange={(e) => setEditing({ ...editing, color: e.target.value })} className="h-10 w-20" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={save}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
