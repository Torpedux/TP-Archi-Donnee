# Bracket — consignes pour l'agent

Application du TP « Tournoi e-sport ». Avant toute tâche, lire `../../tp/CAHIER_DES_CHARGES.md`
(ou la copie fournie) et `../CONCEPTION.md` (RG1 à RG12, MCD, Q1 à Q8).

- Ne **jamais** modifier `../modele/`, `../CONCEPTION.md` ni `../docs/` : livrables notés ou d'autres membres.
  Si un livrable change de forme, c'est l'app qui s'adapte.
- Toute table nouvelle va dans le schéma PostgreSQL `app` : `db/app.sql` (idempotent), puis `npm run db:pull`.
- Toute règle métier va dans `src/metier/`, en fonction pure, avec son test écrit d'abord.
  Les transactions vont dans `src/services/` (acteur explicite, testées sur la base `esport_test`).
- Avant chaque commit de lot : `npm run check` et `npm test` passent (`postgres` et `neo4j` démarrés).
- Ne jamais supprimer, sauter ou affaiblir un test. Ne jamais s'arrêter entre deux lots.
- Message de commit : citer la règle (RGx) ou l'exigence (EF-xx) appliquée.
- Le score d'un match est calculé, jamais saisi (EF-08). Un exempt n'a pas de match (RG9).
- PostgreSQL fait foi. Neo4j se reconstruit par `npm run sync:neo4j`.

@AGENTS.md
