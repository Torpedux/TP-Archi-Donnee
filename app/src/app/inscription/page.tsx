import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionInscription } from "@/app/actions";
import { Champ, FormAction } from "@/composants/formulaire";
import { Titre } from "@/composants/page";
import { compteCourant } from "@/lib/session";

export const metadata: Metadata = { title: "Créer un compte" };

export default async function Inscription() {
  if (await compteCourant()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm">
      <Titre>Créer un compte</Titre>
      <p className="mb-4 text-sm text-muted-foreground">
        Un compte permet de créer son équipe et de l&apos;inscrire aux tournois ouverts. Le rôle
        d&apos;organisateur est attribué par l&apos;administrateur.
      </p>
      <FormAction action={actionInscription} libelle="Créer mon compte" className="grid gap-4">
        <Champ libelle="Nom affiché" name="nom" autoComplete="name" required className="w-full" />
        <Champ libelle="E-mail" name="email" type="email" autoComplete="email" required className="w-full" />
        <Champ
          libelle="Mot de passe (8 caractères au moins)"
          name="motDePasse"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="w-full"
        />
      </FormAction>
      <p className="mt-6 text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-foreground underline underline-offset-4">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
