import { sql } from "drizzle-orm";
import { db, pg } from "@/db/client";

/** Vide toutes les tables (public et app) et remet les séquences à 1. */
export async function viderLaBase() {
  await pg.unsafe(`
    TRUNCATE app.emplacement_arbre, app.reglage_phase, app.reglage_tournoi, app.utilisateur,
             marquer, manche, disputer, match, inscrire, appartenir, joueur, equipe, phase, tournoi, jeu
    RESTART IDENTITY CASCADE`);
}

// Petites fabriques de données pour les tests d'intégration. Chacune rend l'id créé.

export async function creerJeu(nom = "Valorant") {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO jeu (nom, editeur) VALUES (${nom}, 'Éditeur') RETURNING id_jeu AS id`,
  );
  return r.id;
}

export async function creerEquipe(idJeu: number, nom: string) {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO equipe (id_jeu, nom, tag, pays, cree_le)
        VALUES (${idJeu}, ${nom}, ${nom.slice(0, 4).toUpperCase()}, 'FR', '2020-01-01') RETURNING id_equipe AS id`,
  );
  return r.id;
}

export async function creerJoueur(pseudo: string) {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO joueur (pseudo, nom, prenom, pays, ne_le)
        VALUES (${pseudo}, 'Nom', 'Prénom', 'FR', '2000-01-01') RETURNING id_joueur AS id`,
  );
  return r.id;
}

export async function appartenir(
  idJoueur: number,
  idEquipe: number,
  entree: string,
  sortie: string | null = null,
) {
  await db.execute(
    sql`INSERT INTO appartenir (id_joueur, id_equipe, date_entree, date_sortie, role)
        VALUES (${idJoueur}, ${idEquipe}, ${entree}, ${sortie}, 'titulaire')`,
  );
}

export async function creerTournoi(idJeu: number, nom: string, debut = "2026-01-10", fin = "2026-01-14") {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO tournoi (id_jeu, nom, lieu, date_debut, date_fin, dotation)
        VALUES (${idJeu}, ${nom}, 'en ligne', ${debut}, ${fin}, 1000) RETURNING id_tournoi AS id`,
  );
  return r.id;
}

export async function creerPhase(idTournoi: number, type: "poules" | "elimination", ordre: number) {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO phase (id_tournoi, type, ordre) VALUES (${idTournoi}, ${type}, ${ordre}) RETURNING id_phase AS id`,
  );
  return r.id;
}

export async function inscrire(idTournoi: number, idEquipe: number, teteDeSerie: number | null = null) {
  await db.execute(
    sql`INSERT INTO inscrire (id_tournoi, id_equipe, date_inscription, tete_de_serie)
        VALUES (${idTournoi}, ${idEquipe}, '2026-01-01', ${teteDeSerie})`,
  );
}

/** Un match terminé a–b au score donné (sans manches). */
export async function matchTermine(
  idPhase: number,
  a: number,
  b: number,
  scoreA: number,
  scoreB: number,
  quand = "2026-01-10 10:00:00",
  forfaitDe: number | null = null,
) {
  const [r] = await db.execute<{ id: number }>(
    sql`INSERT INTO match (id_phase, date_heure, format, statut)
        VALUES (${idPhase}, ${quand}, 3, 'termine') RETURNING id_match AS id`,
  );
  await db.execute(
    sql`INSERT INTO disputer (id_match, id_equipe, score, forfait) VALUES
        (${r.id}, ${a}, ${scoreA}, ${forfaitDe === a}), (${r.id}, ${b}, ${scoreB}, ${forfaitDe === b})`,
  );
  return r.id;
}
