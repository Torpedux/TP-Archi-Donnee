import { sql } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { trierClassement, type Duel } from "@/metier/classement";

export type LignePoule = {
  idEquipe: number;
  equipe: string;
  tag: string;
  teteDeSerie: number | null;
  joues: number;
  victoires: number;
  defaites: number;
  manchesGagnees: number;
  manchesPerdues: number;
  difference: number;
};

/**
 * Q1. Classement d'une poule (RG3, RG8, RG9 ; forfait = victoire au score maximal, RG12).
 * Reprise de modele/postgres/requetes.sql, par phase, et les équipes sans match joué y figurent.
 * Le départage final (O4) est fait par metier/classement.
 */
export async function classementPoule(idPhase: number, tx: Tx = db): Promise<LignePoule[]> {
  const lignes = await tx.execute<LignePoule>(sql`
    SELECT e.id_equipe AS "idEquipe", e.nom AS equipe, e.tag, i.tete_de_serie AS "teteDeSerie",
           count(*) FILTER (WHERE m.statut = 'termine')::int                         AS joues,
           count(*) FILTER (WHERE m.statut = 'termine' AND d.score > o.score)::int   AS victoires,
           count(*) FILTER (WHERE m.statut = 'termine' AND d.score < o.score)::int   AS defaites,
           coalesce(sum(d.score) FILTER (WHERE m.statut = 'termine'), 0)::int        AS "manchesGagnees",
           coalesce(sum(o.score) FILTER (WHERE m.statut = 'termine'), 0)::int        AS "manchesPerdues",
           coalesce(sum(d.score - o.score) FILTER (WHERE m.statut = 'termine'), 0)::int AS difference
    FROM phase ph
    JOIN match m    ON m.id_phase = ph.id_phase AND m.statut <> 'annule'
    JOIN disputer d ON d.id_match = m.id_match
    JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
    JOIN equipe e   ON e.id_equipe = d.id_equipe
    LEFT JOIN inscrire i ON i.id_tournoi = ph.id_tournoi AND i.id_equipe = e.id_equipe
    WHERE ph.id_phase = ${idPhase}
    GROUP BY e.id_equipe, e.nom, e.tag, i.tete_de_serie`);
  const duels = await tx.execute<Duel>(sql`
    SELECT v.id_equipe AS vainqueur, p.id_equipe AS perdant
    FROM match m
    JOIN disputer v ON v.id_match = m.id_match
    JOIN disputer p ON p.id_match = m.id_match AND p.id_equipe <> v.id_equipe
    WHERE m.id_phase = ${idPhase} AND m.statut = 'termine' AND v.score > p.score`);
  return trierClassement([...lignes], [...duels]);
}
