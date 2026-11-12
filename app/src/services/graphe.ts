import { pg } from "@/db/client";
import { cypher } from "@/db/neo4j";
import { CYPHER_EQUIPES, CYPHER_VICTOIRES, SQL_EQUIPES, SQL_VICTOIRES } from "./importer-copie";

// EF-14, § 6.3 : à la fin d'un match, l'app pousse sa flèche A_BATTU dans Neo4j, après le commit
// PostgreSQL, avec les requêtes d'importer.py recopiées telles quelles. PostgreSQL fait foi :
// `npm run sync:neo4j` (importer.py --reset) reconstruit tout le graphe et rattrape une panne.

type Executer = (requete: string, params?: Record<string, unknown>) => Promise<unknown>;

/** Même conversion que `_texte` d'importer.py : les requêtes CYPHER reçoivent du texte, dates en ISO. */
function enTexte(ligne: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(ligne).map(([cle, v]) => [
      cle,
      v === null || v === undefined
        ? null
        : typeof v === "boolean"
          ? String(v)
          : String(v).replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}).*$/, "$1T$2"),
    ]),
  );
}

/**
 * Remet la flèche d'un match d'accord avec PostgreSQL. On supprime d'abord la flèche du match : si une
 * correction a changé le vainqueur (EF-08) ou si le match n'est plus terminé, l'ancienne ne reste pas.
 * Ne lève jamais : si Neo4j est indisponible, l'erreur est journalisée et la saisie du score a déjà réussi.
 */
export async function pousserMatch(idMatch: number, executer: Executer = cypher) {
  try {
    await executer(`MATCH ()-[r:A_BATTU {id_match: $id}]->() DELETE r`, { id: idMatch });
    const victoires = await pg.unsafe(`${SQL_VICTOIRES} AND m.id_match = $1`, [idMatch]);
    if (victoires.length === 0) return; // pas terminé (ou annulé) : pas de flèche
    const v = victoires[0];
    // Une équipe créée dans l'app n'a pas encore de nœud : CYPHER["victoires"] fait un MATCH, pas un MERGE.
    const equipes = await pg.unsafe(`${SQL_EQUIPES} WHERE e.id_equipe IN ($1, $2)`, [
      v.id_vainqueur,
      v.id_perdant,
    ]);
    await executer(CYPHER_EQUIPES, { lignes: equipes.map(enTexte) });
    await executer(CYPHER_VICTOIRES, { lignes: victoires.map(enTexte) });
  } catch (e) {
    console.error(
      `Neo4j : la flèche du match ${idMatch} n'a pas pu être mise à jour (rattrapage : npm run sync:neo4j).`,
      e,
    );
  }
}
