import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setLoading(false);

    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(mode === "signin" ? "Connexion réussie" : "Compte créé");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="/images/hcsgl-logo.png"
            alt="Logo Pharmacie Hôpital de Coopération Sino-Gabonaise"
            className="w-32 h-32 object-contain mb-5 drop-shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight text-blue-200 max-w-sm">
            Pharmacie Hôpital de la Coopération Sino-Gabonaise de Libreville
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Gestion de Stock — PharmaHCSGL
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold mb-1">
            {mode === "signin" ? "Connexion" : "Créer un compte"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Accédez à votre espace sécurisé"
              : "Le premier compte créé devient super administrateur"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Dr. Jean Mboumba"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="vous@hopital.ga"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="text-primary hover:underline"
              >
                Pas de compte ? S'inscrire
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary hover:underline"
              >
                Déjà un compte ? Se connecter
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Application sécurisée — Ministère de la Santé du Gabon
        </p>
      </div>
    </div>
  );
}
