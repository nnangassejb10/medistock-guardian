import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import {
  LayoutDashboard,
  Pill,
  Package,
  AlertTriangle,
  Truck,
  Tags,
  Users,
  FileText,
  ScrollText,
  Settings,
  LogOut,
  Bell,
  Pill as Logo,
} from "lucide-react";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: AppRole[];
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Principal",
    items: [
      { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { to: "/medicines", label: "Médicaments", icon: Pill },
      { to: "/stock", label: "Stock", icon: Package },
      { to: "/alerts", label: "Alertes", icon: AlertTriangle },
    ],
  },
  {
    section: "Gestion",
    items: [
      { to: "/suppliers", label: "Fournisseurs", icon: Truck },
      { to: "/categories", label: "Catégories", icon: Tags },
      { to: "/reports", label: "Rapports", icon: FileText },
    ],
  },
  {
    section: "Administration",
    items: [
      { to: "/users", label: "Utilisateurs", icon: Users, roles: ["super_admin", "admin"] },
      { to: "/audit", label: "Journal d'audit", icon: ScrollText, roles: ["super_admin", "admin"] },
      { to: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Administrateur",
  admin: "Administrateur",
  pharmacien: "Pharmacien",
  medecin: "Médecin",
  gestionnaire_stock: "Gestionnaire de stock",
  caissier: "Caissier",
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, roles, hasRole, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const primaryRole = roles[0];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col fixed inset-y-0 left-0 z-30">
       <div className="min-h-24 flex items-center gap-3 px-4 py-3 border-b border-sidebar-border">
  <img
    src="/images/hcsgl-logo.png"
    alt="Logo PharmaSino-Gab"
    className="w-16 h-16 object-contain shrink-0 drop-shadow-sm"
  />
  <div className="min-w-0">
    <div className="font-bold text-base leading-tight tracking-tight">
      PharmaSino-Gab
    </div>
    <div className="text-[11px] text-muted-foreground leading-snug mt-0.5">
      Pharmacie de l’Hôpital de Coopération Sino-Gabonaise
    </div>
  </div>
</div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {NAV.map((sec) => {
            const visibleItems = sec.items.filter(
              (i) => !i.roles || hasRole(i.roles),
            );
            if (visibleItems.length === 0) return null;
            return (
              <div key={sec.section}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {sec.section}
                </div>
                <ul className="space-y-1">
                  {visibleItems.map((it) => {
                    const active = path === it.to || path.startsWith(it.to + "/");
                    const Icon = it.icon;
                    return (
                      <li key={it.to}>
                        <Link
                          to={it.to}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                            active
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent",
                          )}
                        >
                          <Icon className="size-4" />
                          {it.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
              {(profile?.full_name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{profile?.full_name}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {primaryRole ? ROLE_LABELS[primaryRole] : ""}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-start mt-1 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" /> Déconnexion
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 border-b bg-card/60 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
          <div className="text-sm text-muted-foreground">
            Pharmacie de l’Hôpital de Coopération Sino-Gabonaise
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
