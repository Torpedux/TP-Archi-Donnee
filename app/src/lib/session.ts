import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { compteParId } from "@/services/comptes";
import type { Acteur } from "@/metier/droits";

/** Le compte connecté, relu en base (rôle et équipe à jour), ou undefined. Une lecture par requête. */
export const compteCourant = cache(async () => {
  const idUtilisateur = Number((await auth())?.user?.id);
  return Number.isInteger(idUtilisateur) ? compteParId(idUtilisateur) : undefined;
});

/** L'acteur passé aux services : null pour un visiteur. */
export async function acteurCourant(): Promise<Acteur> {
  const c = await compteCourant();
  return c ? { id: c.idUtilisateur, role: c.role, idEquipe: c.idEquipe } : null;
}

/** Pour les pages de gestion : renvoie vers la connexion si personne n'est connecté. */
export async function exigerConnexion() {
  const c = await compteCourant();
  if (!c) redirect("/connexion");
  return { compte: c, acteur: { id: c.idUtilisateur, role: c.role, idEquipe: c.idEquipe } satisfies Acteur };
}
