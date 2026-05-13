import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ROLES: AppRole[] = ["super_admin", "admin", "pharmacien", "gestionnaire_stock", "medecin", "caissier"];
const LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin", admin: "Administrateur", pharmacien: "Pharmacien",
  gestionnaire_stock: "Gestionnaire stock", medecin: "Médecin", caissier: "Caissier",
};

function UsersPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isSuper = hasRole("super_admin");

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async () => {
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role);
        roleMap.set(r.user_id, arr);
      });
      return (profs ?? []).map((p: any) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const changeRole = async (userId: string, oldRoles: AppRole[], newRole: AppRole) => {
    if (!isSuper) return toast.error("Action réservée au super admin");
    // Remove existing roles, add new
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole } as any);
    if (error) return toast.error(error.message);
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["users-list"] });
  };

  if (!hasRole(["super_admin", "admin"])) {
    return <div className="text-muted-foreground">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground mt-1">{users.length} utilisateur(s)</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Créé le</th>
              <th className="px-4 py-3 font-medium">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u: any) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/15 text-primary font-semibold flex items-center justify-center">
                      {(u.full_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="font-medium">{u.full_name}</div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  {isSuper ? (
                    <Select value={u.roles[0] ?? ""} onValueChange={(v) => changeRole(u.id, u.roles, v as AppRole)}>
                      <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-muted-foreground">{u.roles.map((r: AppRole) => LABELS[r]).join(", ")}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs border ${u.is_active ? "bg-success/15 text-success border-success/30" : "bg-muted text-muted-foreground"}`}>
                    {u.is_active ? "Actif" : "Inactif"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Les nouveaux utilisateurs s'inscrivent depuis la page de connexion. Le premier compte créé devient automatiquement super administrateur.
      </p>
    </div>
  );
}
