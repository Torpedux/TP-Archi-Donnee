import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { actionConnexion } from "@/app/actions";
import { Champ, FormAction } from "@/composants/formulaire";
import { Titre } from "@/composants/page";
import { COMPTES_DEMO } from "@/init/demo";
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
      {process.env.DEMO === "1" && (
        <section aria-labelledby="demo" className="mt-8 rounded-lg border bg-card p-4">
          <h2
            id="demo"
            className="mb-1 text-sm font-semibold tracking-widest text-muted-foreground uppercase"
          >
            Comptes de démo
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Entrer en un clic, sans rien taper.</p>
          <ul className="grid gap-3">
            {COMPTES_DEMO.map((c) => (
              <li key={c.email}>
                <FormAction
                  action={actionConnexion}
                  caches={{ email: c.email, motDePasse: c.motDePasse }}
                  libelle={`Entrer comme ${c.libelle.toLowerCase()}`}
                  variante="outline"
                  className="flex flex-wrap items-center gap-x-3 gap-y-1"
                >
                  <span className="basis-full text-xs text-muted-foreground">
                    {c.libelle} · {c.detail} · {c.email} / {c.motDePasse}
                  </span>
                </FormAction>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-6 text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-foreground underline underline-offset-4">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
