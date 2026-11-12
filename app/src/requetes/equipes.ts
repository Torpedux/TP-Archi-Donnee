import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type EquipeResume = {
  idEquipe: number;
  nom: string;
  tag: string;
  pays: string;
  idJeu: number;
  jeu: string;
};

export async function listeEquipes(idJeu?: number) {
  return [
    ...(await db.execute<EquipeResume>(sql`
      SELECT e.id_equipe AS "idEquipe", e.nom, e.tag, e.pays, j.id_jeu AS "idJeu", j.nom AS jeu
      FROM equipe e JOIN jeu j ON j.id_jeu = e.id_jeu
      WHERE ${idJeu ?? null}::int IS NULL OR e.id_jeu = ${idJeu ?? null}
      ORDER BY e.nom`)),
  ];
}

export async function equipeParId(idEquipe: number) {
  const [e] = await db.execute<EquipeResume & { creeLe: string }>(sql`
    SELECT e.id_equipe AS "idEquipe", e.nom, e.tag, e.pays, e.cree_le AS "creeLe", j.id_jeu AS "idJeu", j.nom AS jeu
    FROM equipe e JOIN jeu j ON j.id_jeu = e.id_jeu WHERE e.id_equipe = ${idEquipe}`);
  return e as (EquipeResume & { creeLe: string }) | undefined;
}

export type LigneHistorique = {
  idMatch: number;
  dateHeure: string;
  idTournoi: number;
  tournoi: string;
  phase: "poules" | "elimination";
  idAdversaire: number;
  adversaire: string;
  score: number;
  scoreAdverse: number;
  forfaitEquipe: boolean;
  forfaitAdverse: boolean;
};

/** Q2. Historique d'une équipe : ses matchs terminés, triés par date (RG8, RG9). */
export async function historiqueEquipe(idEquipe: number) {
  return [
    ...(await db.execute<LigneHistorique>(sql`
      SELECT m.id_match AS "idMatch", m.date_heure AS "dateHeure", t.id_tournoi AS "idTournoi", t.nom AS tournoi,
             ph.type AS phase, adv.id_equipe AS "idAdversaire", adv.nom AS adversaire,
             d.score, o.score AS "scoreAdverse", d.forfait AS "forfaitEquipe", o.forfait AS "forfaitAdverse"
      FROM disputer d
      JOIN match m    ON m.id_match = d.id_match
      JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
      JOIN equipe adv ON adv.id_equipe = o.id_equipe
      JOIN phase ph   ON ph.id_phase = m.id_phase
      JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi
      WHERE d.id_equipe = ${idEquipe} AND m.statut = 'termine'
      ORDER BY m.date_heure`)),
  ];
}

export type Membre = {
  idJoueur: number;
  pseudo: string;
  prenom: string;
  nom: string;
  role: string;
  dateEntree: string;
  dateSortie: string | null;
};

/** Q4. Composition actuelle d'une équipe : les joueurs sans date de sortie (RG7). */
export async function effectifActuel(idEquipe: number) {
  return [
    ...(await db.execute<Membre>(sql`
      SELECT j.id_joueur AS "idJoueur", j.pseudo, j.prenom, j.nom, a.role,
             a.date_entree AS "dateEntree", a.date_sortie AS "dateSortie"
      FROM appartenir a
      JOIN joueur j ON j.id_joueur = a.id_joueur
      WHERE a.id_equipe = ${idEquipe} AND a.date_sortie IS NULL
      ORDER BY a.date_entree, j.pseudo`)),
  ];
}

/** Les anciens joueurs d'une équipe (période close, RG7). */
export async function anciensJoueurs(idEquipe: number) {
  return [
    ...(await db.execute<Membre>(sql`
      SELECT j.id_joueur AS "idJoueur", j.pseudo, j.prenom, j.nom, a.role,
             a.date_entree AS "dateEntree", a.date_sortie AS "dateSortie"
      FROM appartenir a
      JOIN joueur j ON j.id_joueur = a.id_joueur
      WHERE a.id_equipe = ${idEquipe} AND a.date_sortie IS NOT NULL
      ORDER BY a.date_sortie DESC, j.pseudo`)),
  ];
}

export type Titre = {
  idTournoi: number;
  tournoi: string;
  dateFin: string;
  idEquipe: number;
  vainqueur: string;
};

/**
 * Q5. Palmarès : le vainqueur d'un tournoi est le vainqueur du dernier match terminé de la phase
 * d'ordre maximal (RG3, RG11). Seuls les tournois terminés comptent (sans ligne app = importé, terminé).
 */
export async function palmares(idEquipe?: number) {
  return [
    ...(await db.execute<Titre>(sql`
      SELECT t.id_tournoi AS "idTournoi", t.nom AS tournoi, t.date_fin AS "dateFin",
             v.id_equipe AS "idEquipe", e.nom AS vainqueur
      FROM tournoi t
      LEFT JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi
      JOIN LATERAL (
          SELECT m.id_match
          FROM phase ph
          JOIN match m ON m.id_phase = ph.id_phase AND m.statut = 'termine'
          WHERE ph.id_tournoi = t.id_tournoi
            AND ph.ordre = (SELECT max(ordre) FROM phase WHERE id_tournoi = t.id_tournoi)
          ORDER BY m.date_heure DESC, m.id_match DESC
          LIMIT 1
      ) finale ON true
      JOIN LATERAL (
          SELECT d.id_equipe FROM disputer d WHERE d.id_match = finale.id_match
          ORDER BY d.score DESC LIMIT 1
      ) v ON true
      JOIN equipe e ON e.id_equipe = v.id_equipe
      WHERE coalesce(rt.etat, 'termine') = 'termine'
        AND (${idEquipe ?? null}::int IS NULL OR v.id_equipe = ${idEquipe ?? null})
      ORDER BY t.date_fin DESC, t.nom`)),
  ];
}
