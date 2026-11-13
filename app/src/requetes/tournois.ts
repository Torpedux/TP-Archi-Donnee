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

/** Les tournois qu'un compte gère : tous pour l'admin, les siens pour un organisateur. */
export async function tournoisGeres(idOrganisateur: number | null) {
  return [
    ...(await db.execute<TournoiResume>(sql`
      ${SELECT_TOURNOI}
      WHERE ${idOrganisateur}::int IS NULL OR rt.id_organisateur = ${idOrganisateur}
      ORDER BY (rt.id_tournoi IS NULL), t.date_debut DESC, t.nom`)),
  ];
}

/** Les équipes du jeu du tournoi qui n'y sont pas encore inscrites (RG4, RG5). */
export async function equipesInscriptibles(idTournoi: number) {
  return [
    ...(await db.execute<{ idEquipe: number; nom: string }>(sql`
      SELECT e.id_equipe AS "idEquipe", e.nom
      FROM equipe e JOIN tournoi t ON t.id_jeu = e.id_jeu
      WHERE t.id_tournoi = ${idTournoi}
        AND NOT EXISTS (SELECT 1 FROM inscrire i WHERE i.id_tournoi = t.id_tournoi AND i.id_equipe = e.id_equipe)
      ORDER BY e.nom`)),
  ];
}

/** Les tournois aux inscriptions ouvertes sur le jeu d'une équipe, avec « déjà inscrite ? ». */
export async function tournoisOuvertsPour(idEquipe: number) {
  return [
    ...(await db.execute<{ idTournoi: number; nom: string; dateDebut: string; inscrite: boolean }>(sql`
      SELECT t.id_tournoi AS "idTournoi", t.nom, t.date_debut AS "dateDebut",
             EXISTS (SELECT 1 FROM inscrire i WHERE i.id_tournoi = t.id_tournoi AND i.id_equipe = e.id_equipe) AS inscrite
      FROM equipe e
      JOIN tournoi t ON t.id_jeu = e.id_jeu
      JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi AND rt.etat = 'inscriptions'
      WHERE e.id_equipe = ${idEquipe}
      ORDER BY t.date_debut`)),
  ];
}

/** EF-16 : les inscriptions « en attente », c'est-à-dire sans tête de série, par tournoi ouvert. */
export async function inscriptionsEnAttente(idOrganisateur: number | null) {
  return [
    ...(await db.execute<{ idTournoi: number; nom: string; enAttente: number; inscrites: number }>(sql`
      SELECT t.id_tournoi AS "idTournoi", t.nom,
             count(i.id_equipe) FILTER (WHERE i.tete_de_serie IS NULL)::int AS "enAttente",
             count(i.id_equipe)::int AS inscrites
      FROM tournoi t
      JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi AND rt.etat = 'inscriptions'
      LEFT JOIN inscrire i ON i.id_tournoi = t.id_tournoi
      WHERE ${idOrganisateur}::int IS NULL OR rt.id_organisateur = ${idOrganisateur}
      GROUP BY t.id_tournoi ORDER BY t.date_debut`)),
  ];
}
