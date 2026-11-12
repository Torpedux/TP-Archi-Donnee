// Copié depuis modele/neo4j/requetes.cypher (Aurel) : Q6 à Q8, sans les lignes `:param` du Browser ni
// le point-virgule final (cahier O14). Les paramètres $equipe et $autre sont passés par le driver.
// Ne pas modifier ici : src/services/graphe.test.ts échoue si le texte s'écarte du fichier d'Aurel.

/** Q6. Qui a battu qui : les équipes battues par une équipe donnée (RG9, RG11 ; forfaits signalés, RG12). */
export const Q6 = `MATCH (:Equipe {nom: $equipe})-[r:A_BATTU]->(p:Equipe)
RETURN p.nom AS battue, r.tournoi AS tournoi, r.phase_type AS phase,
       toString(r.score_vainqueur) + '-' + toString(r.score_perdant) AS score,
       r.forfait AS par_forfait, r.date_heure AS le
ORDER BY r.date_heure`;

/** Q7. Chaîne de victoires jusqu'à trois niveaux, forfaits exclus, plus court chemin par équipe (RG9, RG11). */
export const Q7 = `MATCH p = (a:Equipe {nom: $equipe})-[:A_BATTU*1..3]->(x:Equipe)
WHERE x <> a AND all(r IN relationships(p) WHERE NOT r.forfait)
WITH x, p ORDER BY length(p)
WITH x, head(collect(p)) AS p
RETURN x.nom AS domine_indirectement, length(p) AS niveaux,
       [n IN nodes(p) | n.nom] AS chaine
ORDER BY niveaux, domine_indirectement`;

/** Q8. Adversaires communs de deux équipes, et le résultat de chacune contre eux (RG9). */
export const Q8 = `MATCH (a:Equipe {nom: $equipe})-[ra:A_BATTU]-(x:Equipe)-[rb:A_BATTU]-(b:Equipe {nom: $autre})
WHERE x <> a AND x <> b
RETURN x.nom AS adversaire_commun,
       collect(DISTINCT CASE WHEN startNode(ra) = a THEN 'victoire' ELSE 'défaite' END) AS bilan_a,
       collect(DISTINCT CASE WHEN startNode(rb) = b THEN 'victoire' ELSE 'défaite' END) AS bilan_b`;
