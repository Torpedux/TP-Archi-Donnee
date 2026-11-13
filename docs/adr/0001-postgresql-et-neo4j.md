# ADR 0001 — PostgreSQL pour les résultats, Neo4j pour « qui a battu qui »

- **Statut** : accepté
- **Date** : 2026-11-13
- **Auteur** : Aurel · **Relecteurs** : Armand (contexte, options), Thomas (décision, conséquences)

## Contexte

Notre sujet est une plateforme de **tournois e-sport** (voir `CONCEPTION.md`, RG1 à RG12). Des équipes, chacune sur un seul jeu (RG4), s'inscrivent à des tournois (RG5). Elles jouent des matchs en phases, poules puis élimination directe (RG3, RG8). Chaque match oppose deux équipes (RG9) et se découpe en manches (RG10, RG11). Le métier pose deux familles de questions (section 5 de `CONCEPTION.md`) :

| Données | Questions (Q1 à Q8) | Ce qu'il faut garantir |
|---|---|---|
| Jeux, tournois, phases, équipes, joueurs, inscriptions, appartenances | composition d'une équipe (Q4), historique (Q2), matchs d'un joueur (Q3) | unicité des noms et pseudos (RG1, RG4, RG6) ; un joueur dans au plus une équipe par jeu à la fois (RG7) |
| Matchs, scores, manches, forfaits | classement d'une poule (Q1), palmarès (Q5) | **exactement deux équipes** par match, **inscrites** au tournoi (RG9) ; un vainqueur, pas de nul (RG11) ; forfait = score maximal (RG12) |
| **« Qui a battu qui »** | équipes battues (Q6), **chaînes de victoires** (Q7), **adversaires communs** (Q8) | rien de nouveau : c'est une **lecture** des matchs terminés |

Les deux premières lignes demandent des **contraintes et des transactions**. Un score mal saisi fausse le classement d'une poule et le palmarès. La dernière ligne est une **lecture en suivant des liens**, et sa profondeur varie : une chaîne de victoires fait 1, 2 ou 3 sauts.

Volume visé : quelques centaines d'équipes, quelques milliers de joueurs, quelques dizaines de milliers de matchs par saison. Le volume n'est **pas** le problème. Ce qui compte, c'est la **forme** des requêtes et l'**intégrité** des résultats.

## Critères de choix

1. **Intégrité des résultats** : clés étrangères, unicité, `CHECK`, transactions (RG9, RG11, RG12).
2. **Agrégats** : classement de poule, palmarès (Q1, Q5).
3. **Parcours de profondeur variable** : chaînes de victoires, adversaires communs, cycles (Q6 à Q8).
4. **Simplicité pour l'équipe** : vu en cours, se lance avec Docker, peu d'outils à apprendre.
5. **Évolution** : ajouter un attribut (MVP d'un match, agent joué dans une manche) sans tout casser.

## Options considérées

### Option A — PostgreSQL seul

| Critère | Pour notre sujet |
|---|---|
| Intégrité | ✅ `FOREIGN KEY` partout, `UNIQUE (id_tournoi, id_equipe)` pour l'inscription, `CHECK (format IN (1,3,5))`, `CHECK (score >= 0)`, et même une contrainte d'exclusion `EXCLUDE USING gist` contre le chevauchement des périodes d'appartenance (RG7). Une transaction saisit les deux lignes `DISPUTER` d'un match en même temps. |
| Agrégats | ✅ Q1 et Q5 sont des `GROUP BY` et des `RANK() OVER (...)`. |
| Parcours | ⚠️ Possible en `WITH RECURSIVE`, mais pour Q7 il faut d'abord transformer `DISPUTER`, deux lignes par match, en paires vainqueur → perdant. Il faut aussi gérer les cycles à la main (un tableau des équipes visitées), et chaque saut est une auto-jointure. Q8 et la recherche de cycles demandent chacune une requête dédiée, longue à écrire et à relire. |
| Simplicité | ✅ Une seule base. |
| Évolution | ✅ `ALTER TABLE`, ou une colonne `jsonb`. |

C'est la **meilleure base pour 90 % du sujet**. Ce qui la limite, ce sont les requêtes de parcours Q6 à Q8.

### Option B — MongoDB (document)

| Critère | Pour notre sujet |
|---|---|
| Intégrité | ❌ Pas de clés étrangères : rien n'empêche un match de viser une équipe non inscrite au tournoi (RG9), ni un match à trois équipes. L'unicité d'une inscription passe par un index, mais le lien match → inscription, lui, n'est pas vérifié. |
| Agrégats | ⚠️ Q1 se fait avec le pipeline `$unwind` / `$group` / `$sort`, plus verbeux que SQL. |
| Parcours | ⚠️ `$graphLookup` suit une référence récursivement, mais ne rend pas le chemin et ne calcule pas de plus court chemin. |
| Simplicité | ⚠️ Nouvelle technologie, sans gain clair. |
| Évolution | ✅ Schéma souple. |

Le seul endroit où le document serait naturel : **un match avec ses manches imbriquées** (RG10, RG11), puisqu'une manche n'existe pas hors de son match. Mais un match se lit aussi depuis chaque équipe (Q2), depuis chaque joueur (Q3) et depuis chaque poule (Q1). L'imbriquer dans le tournoi ou dans l'équipe le dupliquerait ailleurs. Et la souplesse du schéma ne sert pas : un match a toujours la même forme.

### Option C — Cassandra (colonne large)

| Critère | Pour notre sujet |
|---|---|
| Intégrité | ❌ Ni jointure, ni clé étrangère, ni transaction sur plusieurs tables : RG9 (deux équipes inscrites) est impossible à garantir. |
| Agrégats | ❌ Une table par requête : il faudrait une table `classement_par_poule` mise à jour à la main à chaque score, et défaite à la main en cas de forfait (RG12). |
| Parcours | ❌ Aucun. |
| Simplicité | ❌ Modélisation par requête, cohérence à terme. |
| Évolution | ⚠️ Une nouvelle question = souvent une nouvelle table. |

Cassandra sert à absorber **des milliards d'écritures**, par exemple les événements de jeu en direct toutes les secondes. Nos volumes, des dizaines de milliers de matchs, ne le justifient pas, et on perdrait les jointures dont Q1 à Q5 ont besoin.

### Option D — Neo4j seul (graphe)

| Critère | Pour notre sujet |
|---|---|
| Intégrité | ⚠️ Unicité de propriétés seulement : rien n'empêche un match à trois équipes, un score négatif ou un chevauchement d'appartenances. |
| Agrégats | ⚠️ Faisable en Cypher, moins naturel que SQL pour un classement de poule. |
| Parcours | ✅ C'est sa raison d'être : `(a)-[:A_BATTU*1..3]->(b)`, `shortestPath`, un cycle en une ligne. |
| Simplicité | ⚠️ Moins connu de l'équipe. |
| Évolution | ✅ Ajouter une propriété ou une relation est immédiat. |

### Option E — PostgreSQL + Neo4j (retenue)

PostgreSQL garde **toutes** les données et fait respecter les règles. Neo4j reçoit une **copie** réduite à ce qui se lit en suivant des liens : les équipes, les joueurs, « a battu » et « a joué pour ».

## Synthèse

| Critère | A · PostgreSQL | B · MongoDB | C · Cassandra | D · Neo4j | **E · PG + Neo4j** |
|---|---|---|---|---|---|
| Intégrité (RG9, RG11, RG12) | ✅ | ❌ | ❌ | ⚠️ | ✅ (PG) |
| Agrégats (Q1 à Q5) | ✅ | ⚠️ | ❌ | ⚠️ | ✅ (PG) |
| Parcours (Q6 à Q8) | ⚠️ | ⚠️ | ❌ | ✅ | ✅ (Neo4j) |
| Simplicité | ✅ | ⚠️ | ❌ | ⚠️ | ⚠️ deux bases |
| Évolution | ✅ | ✅ | ⚠️ | ✅ | ✅ |

## Décision

**PostgreSQL est la base de référence. Neo4j est une base de lecture**, réservée au graphe des victoires.

- Toute **écriture** passe par PostgreSQL, et seulement par lui : inscription, saisie d'un score, forfait, transfert d'un joueur.
- Neo4j est **reconstruit à partir de PostgreSQL** par `modele/neo4j/importer.py`. Il ne reçoit que les matchs au statut **terminé**, forfaits compris (RG12). On ne l'écrit jamais à la main.
- Q1 à Q5 se font en **SQL**. Q6 à Q8, ainsi que les cycles et les anciens coéquipiers devenus adversaires, se font en **Cypher** (`modele/neo4j/requetes.cypher`).

Pourquoi pas PostgreSQL seul ? « Qui a battu qui » est la donnée de notre sujet qui **se lit en suivant des liens**, et le métier lui pose des questions ouvertes : qui a battu le champion, et qui avait battu cette équipe-là ? En `WITH RECURSIVE`, chaque nouvelle question est une requête récursive à écrire et à protéger contre les cycles. En Cypher, c'est un motif de deux lignes. Si l'équipe devait réduire sa charge, l'option A resterait le repli : on ne perd rien, puisque tout ce qui est dans Neo4j vient de PostgreSQL.

## Normalisation et dénormalisation

**PostgreSQL est normalisé (3FN).** Chaque fait est stocké une seule fois :
- le score de chaque équipe dans un match est dans `DISPUTER` (RG9), les points de chaque manche dans `MARQUER` (RG11) ;
- le **vainqueur n'est pas stocké** : c'est l'équipe qui a le plus haut score dans `DISPUTER`. RG11 interdit le nul, donc il y en a toujours un ;
- le classement d'une poule et le palmarès ne sont pas stockés : ils se calculent (Q1, Q5).

Une redondance est assumée dès le MCD : `DISPUTER.score`, le nombre de manches gagnées, pourrait se recalculer à partir de `MARQUER`. On le garde parce qu'un **forfait** (RG12) donne un score sans aucune manche jouée. Le score ne peut donc pas toujours se déduire des manches. Le détail est dans le MLD PostgreSQL.

**Neo4j est une dénormalisation volontaire.** Chaque match terminé y devient **une** relation orientée `(:Equipe)-[:A_BATTU]->(:Equipe)`. Le vainqueur, calculé dans PostgreSQL, est **matérialisé** par le sens de la flèche. Voici ce que nous recopions exprès :

| Recopié dans Neo4j | Depuis (MCD) | Pourquoi |
|---|---|---|
| `id_match` sur `A_BATTU` | MATCH | relier un résultat Cypher à sa ligne PostgreSQL ; import idempotent (`MERGE` sur `id_match`) |
| `score_vainqueur`, `score_perdant`, `forfait` | DISPUTER | afficher « 2-1 » sans revenir à PostgreSQL ; exclure les forfaits d'une chaîne si on veut des victoires jouées |
| `date_heure`, `format` | MATCH | filtrer une chaîne par période ; trier |
| `phase_type`, `phase_ordre`, `id_tournoi`, `tournoi` | PHASE, TOURNOI | trouver la finale d'un tournoi (dernier match de la dernière phase), filtrer par tournoi pendant le parcours |
| `jeu` sur `:Equipe` | JEU (via « Évoluer sur », RG4) | une équipe n'a qu'un jeu : une chaîne de victoires reste donc dans un seul jeu, sans filtre |
| `nom`, `tag`, `pays`, `pseudo` | EQUIPE, JOUEUR | lire le résultat d'un parcours sans jointure vers PostgreSQL |

Ces copies ne peuvent pas devenir **durablement** incohérentes. Neo4j n'est jamais écrit directement, et l'import le remet d'accord avec PostgreSQL.

## Conséquences

**Positives**
- Les règles RG1 à RG12 sont garanties en un seul endroit, PostgreSQL, par ses contraintes, ses transactions ou le code qui l'écrit.
- Q6 à Q8 deviennent courtes, lisibles et indépendantes de la profondeur.
- Neo4j se supprime et se reconstruit à tout moment (`importer.py --reset`). Une erreur dans Neo4j ne perd aucune donnée.

**Négatives, et ce qu'on fait**
- **Deux bases à lancer** → un seul `docker-compose.yml` lance PostgreSQL et Neo4j ; le `README.md` donne les commandes.
- **Décalage** : Neo4j est écrit après PostgreSQL, pas dans la même transaction → l'application pousse chaque match terminé juste après le commit PostgreSQL, avec la même requête `MERGE` que l'import ; elle supprime d'abord la flèche du match, pour qu'une correction de score ou une annulation ne laisse pas l'ancienne. Si Neo4j est arrêté à ce moment-là, la saisie du score réussit quand même, et `importer.py --reset` reste la reconstruction complète, qui rattrape tout écart. Un déclencheur PostgreSQL ou du CDC (Debezium) irait plus loin, hors du périmètre du TP.
- **Neo4j ne vérifie aucune règle métier** (deux équipes par match, inscription au tournoi, pas de nul…) → il ne reçoit que des matchs déjà validés par PostgreSQL.
- **Un forfait compte comme une victoire** dans le graphe (RG12) → la relation porte `forfait: true`, et les requêtes peuvent l'exclure (`WHERE NOT r.forfait`).
- **Les matchs prévus, en cours ou annulés** (RG8) ne sont pas dans le graphe : ils n'ont pas de vainqueur.
- **Les manches** (RG10, RG11) ne vont pas dans Neo4j : aucune question ne les parcourt.
- **Une technologie de plus** → deux étiquettes, deux types de relations ; les requêtes sont fournies et commentées.
