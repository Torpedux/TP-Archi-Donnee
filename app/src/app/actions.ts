"use server";

import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import type { EtatAction } from "@/composants/formulaire";
import { acteurCourant } from "@/lib/session";
import type { Acteur } from "@/metier/droits";
import { inscrits } from "@/requetes/tournois";
import { attribuerRole, creerCompte } from "@/services/comptes";
import { ajouterJoueur, creerEquipe, creerJoueur, modifierEquipe, sortirJoueur } from "@/services/equipes";
import { creerJeu, modifierJeu, supprimerJeu } from "@/services/jeux";
import {
  annulerMatch,
  corrigerManche,
  declarerForfait,
  designerQualifie,
  genererPhase,
  modifierDateMatch,
  saisirManche,
  supprimerDerniereManche,
} from "@/services/moteur";
import { ErreurMetier } from "@/services/socle";
import {
  ajouterPhase,
  creerTournoi,
  desinscrireEquipe,
  fixerTeteDeSerie,
  inscrireEquipe,
  modifierTournoi,
  ordonnerTetesDeSerie,
  ouvrirInscriptions,
  supprimerPhase,
  supprimerTournoi,
} from "@/services/tournois";

// Chaque action : lit le compte connecté, appelle le service (qui vérifie les droits et valide
// les entrées), et rend l'erreur métier telle quelle. Les règles sont dans src/services et src/metier.
async function executer(
  donnees: FormData | Record<string, unknown>,
  service: (acteur: Acteur, donnees: unknown) => Promise<unknown>,
  ok = "Enregistré.",
): Promise<EtatAction & { resultat?: unknown }> {
  try {
    const entree = donnees instanceof FormData ? Object.fromEntries(donnees) : donnees;
    const resultat = await service(await acteurCourant(), entree);
    revalidatePath("/", "layout");
    return { ok, resultat };
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }
}

// --- Comptes (EF-15) ---------------------------------------------------------------------

async function connecter(fd: FormData): Promise<EtatAction> {
  try {
    await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("motDePasse"),
      redirectTo: "/admin",
    });
    return {};
  } catch (e) {
    if (e instanceof AuthError) return { erreur: "E-mail ou mot de passe incorrect." };
    throw e; // la redirection de succès passe par ici
  }
}

export async function actionConnexion(_: EtatAction, fd: FormData) {
  return connecter(fd);
}

export async function actionInscription(_: EtatAction, fd: FormData) {
  try {
    await creerCompte(Object.fromEntries(fd));
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }
  return connecter(fd);
}

export async function actionDeconnexion() {
  await signOut({ redirectTo: "/" });
}

export async function actionAttribuerRole(_: EtatAction, fd: FormData) {
  return executer(fd, attribuerRole);
}

// --- Jeux (EF-01) ------------------------------------------------------------------------

export async function actionCreerJeu(_: EtatAction, fd: FormData) {
  return executer(fd, creerJeu, "Jeu créé.");
}
export async function actionModifierJeu(_: EtatAction, fd: FormData) {
  return executer(fd, modifierJeu);
}
export async function actionSupprimerJeu(_: EtatAction, fd: FormData) {
  return executer(fd, supprimerJeu, "Jeu supprimé.");
}

// --- Équipes et joueurs (EF-03, EF-04) ---------------------------------------------------

export async function actionCreerEquipe(_: EtatAction, fd: FormData) {
  const r = await executer(fd, creerEquipe);
  if (r.erreur) return r;
  redirect(`/admin/equipes/${r.resultat}`);
}
export async function actionModifierEquipe(_: EtatAction, fd: FormData) {
  return executer(fd, modifierEquipe);
}
export async function actionCreerJoueur(_: EtatAction, fd: FormData) {
  return executer(fd, creerJoueur, "Joueur créé : vous pouvez l'ajouter à l'effectif.");
}
export async function actionAjouterJoueur(_: EtatAction, fd: FormData) {
  return executer(fd, ajouterJoueur, "Joueur ajouté à l'effectif.");
}
export async function actionSortirJoueur(_: EtatAction, fd: FormData) {
  return executer(fd, sortirJoueur, "Sortie enregistrée.");
}

// --- Tournois, phases, inscriptions (EF-02, EF-05) ---------------------------------------

export async function actionCreerTournoi(_: EtatAction, fd: FormData) {
  const r = await executer(fd, creerTournoi);
  if (r.erreur) return r;
  redirect(`/admin/tournois/${r.resultat}`);
}
export async function actionModifierTournoi(_: EtatAction, fd: FormData) {
  return executer(fd, modifierTournoi);
}
export async function actionSupprimerTournoi(_: EtatAction, fd: FormData) {
  const r = await executer(fd, supprimerTournoi);
  if (r.erreur) return r;
  redirect("/admin/tournois");
}
export async function actionAjouterPhase(_: EtatAction, fd: FormData) {
  return executer(fd, ajouterPhase, "Phase ajoutée.");
}
export async function actionSupprimerPhase(_: EtatAction, fd: FormData) {
  return executer(fd, supprimerPhase, "Phase supprimée.");
}
export async function actionOuvrirInscriptions(_: EtatAction, fd: FormData) {
  return executer(fd, ouvrirInscriptions, "Inscriptions ouvertes : le tournoi est public.");
}
export async function actionInscrire(_: EtatAction, fd: FormData) {
  return executer(fd, inscrireEquipe, "Équipe inscrite.");
}
export async function actionDesinscrire(_: EtatAction, fd: FormData) {
  return executer(fd, desinscrireEquipe, "Équipe désinscrite.");
}
export async function actionFixerTete(_: EtatAction, fd: FormData) {
  return executer(fd, fixerTeteDeSerie);
}

/** Monter ou descendre une équipe d'un rang : on renumérote toute la liste (EF-05). */
export async function actionDeplacerTete(_: EtatAction, fd: FormData) {
  const idTournoi = Number(fd.get("idTournoi"));
  const idEquipe = Number(fd.get("idEquipe"));
  const ordre = (await inscrits(idTournoi)).map((e) => e.idEquipe);
  const i = ordre.indexOf(idEquipe);
  const j = i + (fd.get("sens") === "monter" ? -1 : 1);
  if (i < 0 || j < 0 || j >= ordre.length) return {};
  [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
  return executer({ idTournoi, idsEquipes: ordre }, ordonnerTetesDeSerie);
}

// --- Moteur de tournoi (EF-06 à EF-10) ---------------------------------------------------

export async function actionGenererPhase(_: EtatAction, fd: FormData) {
  return executer(fd, genererPhase, "Matchs générés.");
}
export async function actionSaisirManche(_: EtatAction, fd: FormData) {
  return executer(fd, saisirManche, "Manche enregistrée.");
}
export async function actionCorrigerManche(_: EtatAction, fd: FormData) {
  return executer(fd, corrigerManche, "Manche corrigée.");
}
export async function actionSupprimerDerniereManche(_: EtatAction, fd: FormData) {
  return executer(fd, supprimerDerniereManche, "Dernière manche retirée.");
}
export async function actionForfait(_: EtatAction, fd: FormData) {
  return executer(fd, declarerForfait, "Forfait enregistré.");
}
export async function actionAnnulerMatch(_: EtatAction, fd: FormData) {
  return executer(fd, annulerMatch, "Match annulé.");
}
export async function actionDesignerQualifie(_: EtatAction, fd: FormData) {
  return executer(fd, designerQualifie, "Qualifié désigné.");
}
export async function actionDateMatch(_: EtatAction, fd: FormData) {
  return executer(fd, modifierDateMatch, "Match déplacé.");
}
