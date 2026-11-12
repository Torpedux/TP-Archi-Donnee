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
| `docker-compose.yml`, `.env.example` | PostgreSQL 16, Neo4j 5.26 et le service `seed` ; les réglages |
| `app/` | l'application : **à venir** |

## En bonus : tout lancer, depuis zéro

Il faut Docker. Rien d'autre à installer.

```bash
# 1. Les bases (le schéma est créé au premier démarrage de PostgreSQL)
docker compose up -d postgres neo4j

# 2. Les données : génère les CSV, les charge dans PostgreSQL, importe le graphe dans Neo4j
docker compose run --rm seed

# 3. Les requêtes
docker compose exec postgres psql -U postgres -d esport -f /modele/postgres/requetes.sql     # Q1 à Q5
docker compose exec neo4j cypher-shell -u neo4j -p motdepasse                                 # Cypher
```

Neo4j Browser : <http://localhost:7474> (utilisateur `neo4j`, mot de passe `motdepasse`) ; coller les requêtes de `modele/neo4j/requetes.cypher`.
Pour changer un identifiant ou un port : copier `.env.example` en `.env`.
Le service `seed` est rejouable : il efface et recrée le schéma, puis recharge.

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
