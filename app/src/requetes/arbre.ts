import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type Emplacement = {
  tour: number;
  position: number;
  idMatch: number | null;
  /** Équipe désignée sans match : exempt au premier tour, ou qualifié choisi après une annulation. */
  idDesignee: number | null;
  designee: string | null;
  /** Le qualifié de l'emplacement, s'il est connu : l'équipe désignée, sinon le vainqueur du match. */
  idQualifie: number | null;
  qualifie: string | null;
};

/** Les emplacements de l'arbre d'une phase d'élimination (O2), du premier tour à la finale. */
export async function arbreDeLaPhase(idPhase: number) {
  return [
    ...(await db.execute<Emplacement>(sql`
      SELECT x.tour, x.position, x.id_match AS "idMatch",
             x.id_equipe_qualifiee AS "idDesignee", ed.nom AS designee,
             x.qualifie AS "idQualifie", eq.nom AS qualifie
      FROM (
        SELECT e.*,
               coalesce(e.id_equipe_qualifiee,
                        (SELECT d.id_equipe FROM match m JOIN disputer d ON d.id_match = m.id_match
                         WHERE m.id_match = e.id_match AND m.statut = 'termine'
                         ORDER BY d.score DESC LIMIT 1)) AS qualifie
        FROM app.emplacement_arbre e WHERE e.id_phase = ${idPhase}
      ) x
      LEFT JOIN equipe ed ON ed.id_equipe = x.id_equipe_qualifiee
      LEFT JOIN equipe eq ON eq.id_equipe = x.qualifie
      ORDER BY x.tour, x.position`)),
  ];
}
