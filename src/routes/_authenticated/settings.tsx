import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (profile) { setFullName(profile.full_name); setPhone(profile.phone ?? ""); }
  }, [profile]);

  const saveProfile = async () => {
    if (!profile) return;
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("id", profile.id);
    if (error) return toast.error(error.message);
    toast.success("Profil mis à jour");
    refreshProfile();
  };

  const changePassword = async () => {
    if (password.length < 6) return toast.error("6 caractères minimum");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(error.message);
    toast.success("Mot de passe modifié");
    setPassword("");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-1">Profil et sécurité</p>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">Profil</h3>
        <div className="space-y-2"><Label>Nom complet</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
        <div className="space-y-2"><Label>Email</Label><Input value={profile?.email ?? ""} disabled /></div>
        <div className="space-y-2"><Label>Téléphone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <Button onClick={saveProfile}>Enregistrer</Button>
      </div>

      <div className="bg-card border rounded-xl p-6 space-y-4">
        <h3 className="font-semibold">Mot de passe</h3>
        <div className="space-y-2"><Label>Nouveau mot de passe</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button onClick={changePassword} variant="secondary">Modifier le mot de passe</Button>
      </div>
    </div>
  );
}
