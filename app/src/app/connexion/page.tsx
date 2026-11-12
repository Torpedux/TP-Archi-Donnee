import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionConnexion } from "@/app/actions";
import { Champ, FormAction } from "@/composants/formulaire";
import { Titre } from "@/composants/page";
import { compteCourant } from "@/lib/session";

export const metadata: Metadata = { title: "Connexion" };

export default async function Connexion() {
  if (await compteCourant()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm">
      <Titre>Connexion</Titre>
      <FormAction action={actionConnexion} libelle="Se connecter" className="grid gap-4">
        <Champ libelle="E-mail" name="email" type="email" autoComplete="email" required className="w-full" />
        <Champ
          libelle="Mot de passe"
          name="motDePasse"
          type="password"
          autoComplete="current-password"
          required
          className="w-full"
        />
      </FormAction>
      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-foreground underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
