// Requêtes Cypher — « qui a battu qui » (CONCEPTION.md section 5 : Q6 à Q8, puis extras)
// À coller dans Neo4j Browser (http://localhost:7474) après :
//   python modele/neo4j/importer.py --reset
// Paramètres (à adapter) :
:param equipe => 'Nova';
:param autre  => 'Orbit';

// ------------------------------------------------------------------------------------
// Q6. Qui a battu qui : les équipes battues par une équipe donnée   (RG9, RG11)
//     Les forfaits (RG12) sont signalés.
// ------------------------------------------------------------------------------------
MATCH (:Equipe {nom: $equipe})-[r:A_BATTU]->(p:Equipe)
RETURN p.nom AS battue, r.tournoi AS tournoi, r.phase_type AS phase,
       toString(r.score_vainqueur) + '-' + toString(r.score_perdant) AS score,
       r.forfait AS par_forfait, r.date_heure AS le
ORDER BY r.date_heure;

// Variante : qui a battu cette équipe ?
MATCH (v:Equipe)-[r:A_BATTU]->(:Equipe {nom: $equipe})
RETURN v.nom AS vainqueur, count(r) AS fois, collect(r.tournoi) AS tournois
ORDER BY fois DESC;

// ------------------------------------------------------------------------------------
// Q7. Chaîne de victoires : A a battu B qui a battu C, jusqu'à trois niveaux  (RG9, RG11)
//     Une équipe n'évolue que sur un jeu (RG4) : la chaîne reste dans ce jeu.
//     Victoires jouées uniquement (forfaits exclus).
//     *1..3 = suivre 1, 2 ou 3 flèches A_BATTU. Une même équipe peut être atteinte par
//     plusieurs chemins : on trie les chemins du plus court au plus long, et
//     head(collect(p)) garde le premier, donc le plus court, pour chaque équipe.
// ------------------------------------------------------------------------------------
MATCH p = (a:Equipe {nom: $equipe})-[:A_BATTU*1..3]->(x:Equipe)
WHERE x <> a AND all(r IN relationships(p) WHERE NOT r.forfait)
WITH x, p ORDER BY length(p)
WITH x, head(collect(p)) AS p
RETURN x.nom AS domine_indirectement, length(p) AS niveaux,
       [n IN nodes(p) | n.nom] AS chaine
ORDER BY niveaux, domine_indirectement;

// Q7 bis. La plus courte chaîne entre deux équipes précises (ex. Titans → Orbit,
//         qui ne se sont jamais rencontrées)
MATCH (a:Equipe {nom: 'Titans'}), (b:Equipe {nom: $autre})
MATCH p = shortestPath((a)-[:A_BATTU*..3]->(b))
RETURN [n IN nodes(p) | n.nom] AS chaine,
       [r IN relationships(p) | r.tournoi + ' ' + toString(r.score_vainqueur) + '-' + toString(r.score_perdant)] AS preuves;

// ------------------------------------------------------------------------------------
// Q8. Adversaires communs de deux équipes, et le résultat de chacune contre eux  (RG9)
//     Pas de flèche dans le motif ( -[:A_BATTU]- ) : on prend le match quel que soit
//     le vainqueur. startNode(r) est le vainqueur, ce qui donne victoire ou défaite.
// ------------------------------------------------------------------------------------
MATCH (a:Equipe {nom: $equipe})-[ra:A_BATTU]-(x:Equipe)-[rb:A_BATTU]-(b:Equipe {nom: $autre})
WHERE x <> a AND x <> b
RETURN x.nom AS adversaire_commun,
       collect(DISTINCT CASE WHEN startNode(ra) = a THEN 'victoire' ELSE 'défaite' END) AS bilan_a,
       collect(DISTINCT CASE WHEN startNode(rb) = b THEN 'victoire' ELSE 'défaite' END) AS bilan_b;

// ------------------------------------------------------------------------------------
// Extra 1. Face-à-face entre deux équipes
// ------------------------------------------------------------------------------------
MATCH (a:Equipe {nom: $equipe}), (b:Equipe {nom: $autre})
OPTIONAL MATCH (a)-[g:A_BATTU]->(b)
WITH a, b, count(g) AS victoires_a
OPTIONAL MATCH (b)-[d:A_BATTU]->(a)
RETURN a.nom, victoires_a, count(d) AS victoires_b, b.nom;

// ------------------------------------------------------------------------------------
// Extra 2. Cycles « pierre-feuille-ciseaux » : A bat B, B bat C, C bat A
// ------------------------------------------------------------------------------------
MATCH (a:Equipe)-[:A_BATTU]->(b:Equipe)-[:A_BATTU]->(c:Equipe)-[:A_BATTU]->(a)
WHERE a.id_equipe < b.id_equipe AND a.id_equipe < c.id_equipe   // chaque cycle une fois
RETURN DISTINCT a.jeu AS jeu, a.nom, b.nom, c.nom;

// ------------------------------------------------------------------------------------
// Extra 3. Anciens coéquipiers devenus adversaires  (RG7)
//          Un joueur a quitté une équipe, et sa nouvelle équipe l'a battue ensuite.
// ------------------------------------------------------------------------------------
MATCH (j:Joueur)-[nouv:A_JOUE_POUR]->(n:Equipe)-[r:A_BATTU]->(anc:Equipe)<-[old:A_JOUE_POUR]-(j)
WHERE old.date_sortie IS NOT NULL
  AND date(r.date_heure) >= nouv.date_entree
  AND (nouv.date_sortie IS NULL OR date(r.date_heure) <= nouv.date_sortie)
  AND date(r.date_heure) > old.date_sortie
RETURN j.pseudo AS joueur, anc.nom AS ancienne_equipe, n.nom AS nouvelle_equipe,
       r.tournoi AS tournoi, r.phase_type AS phase,
       toString(r.score_vainqueur) + '-' + toString(r.score_perdant) AS score;

// ------------------------------------------------------------------------------------
// Extra 4. Tombeurs de champions : qui a battu le vainqueur d'un tournoi, ailleurs ?
//          Vainqueur = gagnant du dernier match de la dernière phase (comme Q5).
//          Les 3 premières lignes trouvent la finale de chaque tournoi ; startNode(finale)
//          est le champion. Les suivantes cherchent qui l'a battu dans un autre tournoi.
// ------------------------------------------------------------------------------------
MATCH ()-[f:A_BATTU]->()
WITH f.id_tournoi AS t, f ORDER BY f.phase_ordre DESC, f.date_heure DESC
WITH t, head(collect(f)) AS finale
WITH startNode(finale) AS champion, finale
MATCH (x:Equipe)-[r:A_BATTU]->(champion)
WHERE r.id_tournoi <> finale.id_tournoi
RETURN champion.nom AS champion, finale.tournoi AS titre, x.nom AS l_a_battu, r.tournoi AS dans;
