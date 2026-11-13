# Tournoi e-sport · groupe Matteo, Aurel, Armand, Thomas

Matteo, Aurel, Armand, Thomas · Bachelor 3 · Conception et architecture des données · Ynov Paris, novembre 2026

Une plateforme qui gère des tournois e-sport : des équipes de joueurs s'inscrivent à un tournoi d'un jeu, jouent des matchs en poules puis en élimination directe, et chaque match est découpé en manches.
Elle sert aux organisateurs (saisie des résultats) et au public (classements, historiques, « qui a battu qui »).

**Bases de données** : PostgreSQL pour toutes les données et leurs règles, Neo4j pour le graphe « qui a battu qui ». PostgreSQL garantit l'intégrité des résultats (deux équipes inscrites par match, pas de nul, forfait) ; Neo4j en est une copie, reconstruite à la demande, pour les questions qui suivent des liens de profondeur variable (chaînes de victoires, adversaires communs). Voir l'[ADR 0001](docs/adr/0001-postgresql-et-neo4j.md).

| Fichier | Contenu |
|---|---|
| [`CONCEPTION.md`](CONCEPTION.md) | les règles de gestion (RG1 à RG12), le MCD, le MLD, ce que le schéma ne garantit pas |
| [`docs/adr/`](docs/adr/) | le choix des bases (ADR 0001) |
| [`docs/mld-neo4j.md`](docs/mld-neo4j.md) | le modèle du graphe et la répartition des données entre les deux bases |
| `modele/postgres/schema.sql` | le DDL PostgreSQL (provisoire, à valider par Armand) |
| `modele/postgres/charger.sql` | le chargement des CSV et la remise à jour des séquences |
| `modele/postgres/requetes.sql` | les requêtes Q1 à Q5 |
| `modele/donnees/generer.py` | le générateur de données (Python, sans dépendance, graine fixe) |
| `modele/neo4j/` | l'import dans Neo4j (`importer.py`) et les requêtes Cypher Q6 à Q8 |
| `modele/seed/Dockerfile` | l'image du service `seed` (Python et client `psql`) |
| `docker-compose.yml`, `.env.example` | PostgreSQL 16, Neo4j 5.26, `seed` et l'application ; les réglages |
| [`app/`](app/) | « Bracket », l'application : vitrine publique, gestion des tournois, scores en direct, graphe |

## En bonus : tout lancer, depuis zéro

Il faut Docker. Rien d'autre à installer.

```bash
git clone <ce dépôt> && cd TP-Archi-Donnee
docker compose up -d --build     # PostgreSQL, Neo4j, les données, puis l'application (2 à 4 minutes la première fois)
# puis ouvrir http://localhost:3000
docker compose down -v           # tout arrêter et repartir de zéro
```

Au premier lancement, le service `seed` génère et charge les données (4 jeux, 120 équipes, 700 joueurs, 30 tournois terminés), puis l'application ajoute trois tournois de démo : un en poules, un en phase finale avec un match en cours, un aux inscriptions ouvertes. Les saisies survivent aux redémarrages.

| Compte de démo | E-mail | Mot de passe | Ce qu'il fait |
|---|---|---|---|
| Admin | `admin@bracket.test` | `admin-bracket` | tout, y compris les jeux et les rôles |
| Organisateur | `orga@bracket.test` | `orga-bracket` | ses tournois : phases, inscriptions, génération, scores |
| Capitaine | `capitaine@bracket.test` | `capitaine-bracket` | son équipe, ses inscriptions |

La page de connexion propose ces trois comptes en un clic. Ce sont des identifiants de démonstration : pour un autre usage, copier `.env.example` en `.env`, changer `ADMIN_PASSWORD` et `AUTH_SECRET`, et mettre `DEMO=0`.

Si un port est déjà pris sur la machine (par exemple un PostgreSQL local sur 5432), copier `.env.example` en `.env` et changer `PORT_POSTGRES`, `PORT_APP`, `PORT_NEO4J` ou `PORT_NEO4J_WEB`.

### Les requêtes seules

```bash
docker compose exec postgres psql -U postgres -d esport -f /modele/postgres/requetes.sql     # Q1 à Q5
docker compose exec neo4j cypher-shell -u neo4j -p motdepasse                                 # Cypher
docker compose run --rm seed                                                                  # reconstruit Neo4j depuis PostgreSQL
```

Neo4j Browser : <http://localhost:7474> (utilisateur `neo4j`, mot de passe `motdepasse`) ; coller les requêtes de `modele/neo4j/requetes.cypher`.

## L'application « Bracket »

Next.js, Drizzle (schéma introspecté depuis le DDL, qui fait foi), Auth.js, Tailwind, Cytoscape. Détail dans [`app/`](app/).

| Page | Ce qu'elle montre | Requêtes |
|---|---|---|
| `/tournois/…` | classement de poule, arbre d'élimination, matchs, équipes inscrites | Q1, Q5 |
| `/equipes/…` | effectif actuel, anciens joueurs, historique des matchs, palmarès | Q2, Q4, Q5 |
| `/joueurs/…` | parcours d'un joueur et ses matchs pendant ses périodes en équipe | Q3 |
| `/graphe` | qui a battu qui, chaînes de victoires, adversaires communs, lus dans Neo4j | Q6, Q7, Q8 |
| `/admin` | tableau de bord (matchs du jour, matchs à saisir), jeux, comptes, tournois, phases, inscriptions, génération des poules et de l'arbre, saisie des scores | |
| `/tournois/…/resultats.csv` | export CSV des résultats d'un tournoi | |

Ce que le schéma ne garantit pas (section 4 de `CONCEPTION.md`) est appliqué dans `app/src/metier/`, en fonctions pures testées : chevauchement des appartenances par jeu (RG7), deux équipes inscrites par match (RG9), score calculé depuis les manches et pas de nul (RG9, RG11), forfait au score maximal sans manche (RG12). Les tables propres à l'application vivent dans un schéma PostgreSQL séparé, `app` : le MLD noté n'est pas touché.

À la fin d'un match, l'application met à jour sa flèche dans Neo4j avec les requêtes d'`importer.py`, et les pages ouvertes se rafraîchissent toutes seules (Server-Sent Events).

### Les tests

```bash
docker compose up -d postgres neo4j      # les tests d'intégration utilisent une base à part, esport_test
cd app && npm ci && npm test             # règles métier, services, requêtes Q1 à Q8, scénario de démo
npm run check                            # TypeScript strict, ESLint, Prettier
```

Le scénario de démonstration est vérifié deux fois : `app/tests/scenario.test.ts` le rejoue par les services (créer « Ynov Cup », inscrire 6 équipes, générer la poule de 15 matchs, saisir des résultats dont un forfait, générer l'arbre, jouer jusqu'à la finale, vérifier le palmarès et le graphe), et `app/e2e/scenario.spec.ts` le joue dans un vrai navigateur, avec un second navigateur qui regarde le classement se mettre à jour en direct.

```bash
docker compose down -v && docker compose up -d --build     # le test de bout en bout part d'une base fraîche
cd app && npx playwright install chromium && npm run test:e2e
```

## En bonus : nos requêtes et leur résultat

Sur les données générées (4 jeux, 120 équipes, 700 joueurs, 30 tournois, 709 matchs).

| Requête | Question | Base |
|---|---|---|
| Q1 | classement d'une poule (victoires, défaites, manches gagnées et perdues) | PostgreSQL |
| Q2 | historique d'une équipe : matchs, adversaire, score, tournoi | PostgreSQL |
| Q3 | matchs d'un joueur pendant sa période dans l'équipe | PostgreSQL |
| Q4 | composition actuelle d'une équipe | PostgreSQL |
| Q5 | palmarès : vainqueur de la finale de chaque tournoi | PostgreSQL |
| Q6 à Q8 | qui a battu qui, chaînes de victoires, adversaires communs | Neo4j |

Chaque requête de `modele/postgres/requetes.sql` porte sa question et ses règles en commentaire. Exemple, Q1 sur le premier tournoi :

```
     equipe      | joues | victoires | defaites | manches_gagnees | manches_perdues | difference
-----------------+-------+-----------+----------+-----------------+-----------------+------------
 Vortex Esport   |     5 |         4 |        1 |               8 |               4 |          4
 Lynx Crew       |     5 |         3 |        2 |               7 |               4 |          3
 ...
```
