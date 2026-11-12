import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type Etat = "brouillon" | "inscriptions" | "en_cours" | "termine";

export type TournoiResume = {
  idTournoi: number;
  nom: string;
  lieu: string;
  dateDebut: string;
  dateFin: string;
  dotation: string;
  idJeu: number;
  jeu: string;
  etat: Etat;
  idOrganisateur: number | null;
  nbEquipes: number;
};

// Un tournoi sans réglage vient du générateur : il est terminé.
const SELECT_TOURNOI = sql`
  SELECT t.id_tournoi AS "idTournoi", t.nom, t.lieu, t.date_debut AS "dateDebut", t.date_fin AS "dateFin",
         t.dotation, j.id_jeu AS "idJeu", j.nom AS jeu, coalesce(rt.etat, 'termine') AS etat,
         rt.id_organisateur AS "idOrganisateur",
         (SELECT count(*)::int FROM inscrire i WHERE i.id_tournoi = t.id_tournoi) AS "nbEquipes"
  FROM tournoi t
  JOIN jeu j ON j.id_jeu = t.id_jeu
  LEFT JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi`;

/** Les tournois visibles du public (les brouillons ne le sont pas), filtrables par jeu et par état. */
export async function listeTournois(filtre: { idJeu?: number; etat?: Etat } = {}) {
  return [
    ...(await db.execute<TournoiResume>(sql`
      ${SELECT_TOURNOI}
      WHERE coalesce(rt.etat, 'termine') <> 'brouillon'
        AND (${filtre.idJeu ?? null}::int IS NULL OR t.id_jeu = ${filtre.idJeu ?? null})
        AND (${filtre.etat ?? null}::text IS NULL OR coalesce(rt.etat, 'termine') = ${filtre.etat ?? null})
      ORDER BY t.date_debut DESC, t.nom`)),
  ];
}

export async function tournoiParId(idTournoi: number) {
  const [t] = await db.execute<TournoiResume>(sql`${SELECT_TOURNOI} WHERE t.id_tournoi = ${idTournoi}`);
  return t as TournoiResume | undefined;
}

export type PhaseResume = {
  idPhase: number;
  type: "poules" | "elimination";
  ordre: number;
  format: number | null;
  nbQualifies: number | null;
  nbMatchs: number;
};

export async function phasesDuTournoi(idTournoi: number) {
  return [
    ...(await db.execute<PhaseResume>(sql`
      SELECT ph.id_phase AS "idPhase", ph.type, ph.ordre, rp.format, rp.nb_qualifies AS "nbQualifies",
             (SELECT count(*)::int FROM match m WHERE m.id_phase = ph.id_phase) AS "nbMatchs"
      FROM phase ph
      LEFT JOIN app.reglage_phase rp ON rp.id_phase = ph.id_phase
      WHERE ph.id_tournoi = ${idTournoi}
      ORDER BY ph.ordre`)),
  ];
}

export type Inscrit = {
  idEquipe: number;
  nom: string;
  tag: string;
  pays: string;
  dateInscription: string;
  teteDeSerie: number | null;
};

export async function inscrits(idTournoi: number) {
  return [
    ...(await db.execute<Inscrit>(sql`
      SELECT e.id_equipe AS "idEquipe", e.nom, e.tag, e.pays,
             i.date_inscription AS "dateInscription", i.tete_de_serie AS "teteDeSerie"
      FROM inscrire i JOIN equipe e ON e.id_equipe = i.id_equipe
      WHERE i.id_tournoi = ${idTournoi}
      ORDER BY i.tete_de_serie NULLS LAST, i.date_inscription, e.nom`)),
  ];
}

export async function listeJeux() {
  return [
    ...(await db.execute<{ idJeu: number; nom: string; editeur: string }>(
      sql`SELECT id_jeu AS "idJeu", nom, editeur FROM jeu ORDER BY nom`,
    )),
  ];
}
