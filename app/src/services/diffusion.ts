import { pousserMatch } from "./graphe";

/**
 * Ce qui se passe après le commit PostgreSQL d'une opération du moteur. PostgreSQL fait foi : rien
 * ici ne peut faire échouer la saisie.
 */
export async function apresCommit(cible: { idTournoi: number; idMatch?: number }) {
  // EF-14 : la flèche « qui a battu qui » du match suit son résultat.
  // NEO4J_PUSH=off : posé par les tests d'intégration, qui partagent l'unique base Neo4j avec la démo.
  if (cible.idMatch && process.env.NEO4J_PUSH !== "off") await pousserMatch(cible.idMatch);
}
