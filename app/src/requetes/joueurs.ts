import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type JoueurResume = { idJoueur: number; pseudo: string; prenom: string; nom: string; pays: string };

export async function listeJoueurs(q = "", limite = 100) {
  return [
    ...(await db.execute<JoueurResume & { equipes: string | null }>(sql`
      SELECT j.id_joueur AS "idJoueur", j.pseudo, j.prenom, j.nom, j.pays,
             (SELECT string_agg(e.nom, ', ' ORDER BY e.nom)
              FROM appartenir a JOIN equipe e ON e.id_equipe = a.id_equipe
              WHERE a.id_joueur = j.id_joueur AND a.date_sortie IS NULL) AS equipes
      FROM joueur j
      WHERE j.pseudo ILIKE ${"%" + q + "%"}
      ORDER BY j.pseudo
      LIMIT ${limite}`)),
  ];
}

export async function joueurParId(idJoueur: number) {
  const [j] = await db.execute<JoueurResume & { neLe: string }>(sql`
    SELECT id_joueur AS "idJoueur", pseudo, prenom, nom, pays, ne_le AS "neLe"
    FROM joueur WHERE id_joueur = ${idJoueur}`);
  return j as (JoueurResume & { neLe: string }) | undefined;
}

export type Passage = {
  idEquipe: number;
  equipe: string;
  jeu: string;
  role: string;
  dateEntree: string;
  dateSortie: string | null;
};

/** Le parcours d'un joueur : ses périodes dans chaque équipe (RG7). */
export async function parcoursJoueur(idJoueur: number) {
  return [
    ...(await db.execute<Passage>(sql`
      SELECT e.id_equipe AS "idEquipe", e.nom AS equipe, j.nom AS jeu, a.role,
             a.date_entree AS "dateEntree", a.date_sortie AS "dateSortie"
      FROM appartenir a
      JOIN equipe e ON e.id_equipe = a.id_equipe
      JOIN jeu j    ON j.id_jeu = e.id_jeu
      WHERE a.id_joueur = ${idJoueur}
      ORDER BY a.date_entree DESC`)),
  ];
}

export type MatchJoueur = {
  idMatch: number;
  dateHeure: string;
  idEquipe: number;
  equipe: string;
  role: string;
  idAdversaire: number;
  adversaire: string;
  score: number;
  scoreAdverse: number;
  idTournoi: number;
  tournoi: string;
};

/** Q3. Matchs d'un joueur : ceux de son équipe pendant sa période d'appartenance (RG7, RG9). */
export async function matchsJoueur(idJoueur: number) {
  return [
    ...(await db.execute<MatchJoueur>(sql`
      SELECT m.id_match AS "idMatch", m.date_heure AS "dateHeure", e.id_equipe AS "idEquipe", e.nom AS equipe,
             a.role, adv.id_equipe AS "idAdversaire", adv.nom AS adversaire,
             d.score, o.score AS "scoreAdverse", t.id_tournoi AS "idTournoi", t.nom AS tournoi
      FROM appartenir a
      JOIN equipe e   ON e.id_equipe = a.id_equipe
      JOIN disputer d ON d.id_equipe = a.id_equipe
      JOIN match m    ON m.id_match = d.id_match
      JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
      JOIN equipe adv ON adv.id_equipe = o.id_equipe
      JOIN phase ph   ON ph.id_phase = m.id_phase
      JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi
      WHERE a.id_joueur = ${idJoueur}
        AND m.statut = 'termine'
        AND m.date_heure::date >= a.date_entree
        AND m.date_heure::date <= coalesce(a.date_sortie, 'infinity')
      ORDER BY m.date_heure DESC`)),
  ];
}
