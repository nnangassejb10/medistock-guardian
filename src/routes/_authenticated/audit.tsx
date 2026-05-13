import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fromNow } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

function AuditPage() {
  const { hasRole } = useAuth();
  const allowed = hasRole(["super_admin", "admin"]);

  const { data: logs = [] } = useQuery({
    queryKey: ["audit-logs"],
    enabled: allowed,
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  if (!allowed) return <div className="text-muted-foreground">Accès réservé aux administrateurs.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Journal d'audit</h1>
        <p className="text-sm text-muted-foreground mt-1">Historique des actions sensibles ({logs.length})</p>
      </div>
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Utilisateur</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Table</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-2 text-muted-foreground">{fromNow(l.created_at)}</td>
                <td className="px-4 py-2">{l.profiles?.full_name ?? "Système"}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-muted-foreground">{l.table_name ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Aucun log enregistré pour le moment</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
