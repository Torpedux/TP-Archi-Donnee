import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export type Resultat = { type: "equipe" | "joueur" | "tournoi"; id: number; libelle: string; detail: string };

/** EF-12 : recherche globale par nom d'équipe, pseudo de joueur, nom de tournoi. */
export async function rechercher(q: string): Promise<Resultat[]> {
  const terme = q.trim();
  if (terme.length < 2) return [];
  const motif = "%" + terme.replace(/[%_\\]/g, "\\$&") + "%";
  return [
    ...(await db.execute<Resultat>(sql`
      (SELECT 'equipe' AS type, e.id_equipe AS id, e.nom AS libelle, j.nom AS detail
       FROM equipe e JOIN jeu j ON j.id_jeu = e.id_jeu
       WHERE e.nom ILIKE ${motif} OR e.tag ILIKE ${motif} ORDER BY e.nom LIMIT 20)
      UNION ALL
      (SELECT 'joueur', id_joueur, pseudo, prenom || ' ' || nom
       FROM joueur WHERE pseudo ILIKE ${motif} ORDER BY pseudo LIMIT 20)
      UNION ALL
      (SELECT 'tournoi', t.id_tournoi, t.nom, j.nom
       FROM tournoi t JOIN jeu j ON j.id_jeu = t.id_jeu
       LEFT JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi
       WHERE t.nom ILIKE ${motif} AND coalesce(rt.etat, 'termine') <> 'brouillon'
       ORDER BY t.nom LIMIT 20)`)),
  ];
}
