import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db/client";

/** Un match vu « à plat » : ses deux équipes (a = plus petit id), scores et contexte. */
export type MatchResume = {
  idMatch: number;
  dateHeure: string;
  format: number;
  statut: "prevu" | "en_cours" | "termine" | "annule";
  idPhase: number;
  phaseType: "poules" | "elimination";
  idTournoi: number;
  tournoi: string;
  idA: number;
  nomA: string;
  tagA: string;
  scoreA: number | null;
  forfaitA: boolean;
  idB: number;
  nomB: string;
  tagB: string;
  scoreB: number | null;
  forfaitB: boolean;
};

const SELECT_MATCH = sql`
  SELECT m.id_match AS "idMatch", m.date_heure AS "dateHeure", m.format, m.statut,
         ph.id_phase AS "idPhase", ph.type AS "phaseType", t.id_tournoi AS "idTournoi", t.nom AS tournoi,
         a.id_equipe AS "idA", ea.nom AS "nomA", ea.tag AS "tagA", a.score AS "scoreA", a.forfait AS "forfaitA",
         b.id_equipe AS "idB", eb.nom AS "nomB", eb.tag AS "tagB", b.score AS "scoreB", b.forfait AS "forfaitB"
  FROM match m
  JOIN phase ph   ON ph.id_phase = m.id_phase
  JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi
  JOIN disputer a ON a.id_match = m.id_match
  JOIN disputer b ON b.id_match = m.id_match AND b.id_equipe > a.id_equipe
  JOIN equipe ea  ON ea.id_equipe = a.id_equipe
  JOIN equipe eb  ON eb.id_equipe = b.id_equipe`;

export async function matchs(filtre: SQL, suite: SQL = sql`ORDER BY m.date_heure, m.id_match`) {
  return [...(await db.execute<MatchResume>(sql`${SELECT_MATCH} WHERE ${filtre} ${suite}`))];
}

export const matchsDeLaPhase = (idPhase: number) => matchs(sql`m.id_phase = ${idPhase}`);
export const matchsEnDirect = () => matchs(sql`m.statut = 'en_cours'`);
export const derniersResultats = (n = 8) =>
  matchs(sql`m.statut = 'termine'`, sql`ORDER BY m.date_heure DESC, m.id_match DESC LIMIT ${n}`);

export async function matchParId(idMatch: number): Promise<MatchResume | undefined> {
  return (await matchs(sql`m.id_match = ${idMatch}`))[0];
}

export type MancheDetail = {
  idManche: number;
  numero: number;
  carte: string;
  pointsA: number;
  pointsB: number;
};

/** Les manches d'un match, avec les points de chaque équipe (RG10, RG11). */
export async function manchesDuMatch(idMatch: number, idA: number, idB: number) {
  return [
    ...(await db.execute<MancheDetail>(sql`
      SELECT ma.id_manche AS "idManche", ma.numero, ma.carte, pa.points AS "pointsA", pb.points AS "pointsB"
      FROM manche ma
      JOIN marquer pa ON pa.id_manche = ma.id_manche AND pa.id_equipe = ${idA}
      JOIN marquer pb ON pb.id_manche = ma.id_manche AND pb.id_equipe = ${idB}
      WHERE ma.id_match = ${idMatch}
      ORDER BY ma.numero`)),
  ];
}
