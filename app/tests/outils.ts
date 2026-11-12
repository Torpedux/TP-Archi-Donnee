import { pg } from "@/db/client";

/** Vide toutes les tables (public et app) et remet les séquences à 1. */
export async function viderLaBase() {
  await pg.unsafe(`
    TRUNCATE app.emplacement_arbre, app.reglage_phase, app.reglage_tournoi, app.utilisateur,
             marquer, manche, disputer, match, inscrire, appartenir, joueur, equipe, phase, tournoi, jeu
    RESTART IDENTITY CASCADE`);
}
