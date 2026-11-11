# Neo4j : « qui a battu qui » (bonus, Aurel)

Le modèle est décrit dans `docs/mld-neo4j.md` et le choix de la base dans `docs/adr/0001-postgresql-et-neo4j.md`.

| Fichier | Rôle |
|---|---|
| `importer.py` | construit le graphe à partir des CSV de démo, ou de PostgreSQL avec `--source pg` |
| `demo/*.csv` | petit jeu cohérent avec RG1 à RG12 : 12 équipes sur 2 jeux, 19 joueurs, 17 matchs terminés, 1 forfait, 2 transferts, 1 joueur dans deux équipes de jeux différents |
| `requetes.cypher` | Q6 à Q8 de `CONCEPTION.md`, plus face-à-face, cycles, anciens coéquipiers devenus adversaires, tombeurs de champions |

## Lancer

```bash
# 1. Neo4j : le service du docker-compose.yml, ou à défaut :
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/motdepasse neo4j:5

# 2. Import
pip install -r modele/neo4j/requirements.txt
python modele/neo4j/importer.py --reset                 # données de démo
python modele/neo4j/importer.py --source pg --reset     # depuis PostgreSQL (variable PG_DSN)

# 3. Requêtes : http://localhost:7474 (neo4j / motdepasse), coller requetes.cypher
```

## Résultats attendus sur la démo

- **Q6** : Nova a battu Kraken et Phoenix.
- **Q7** : depuis Nova, Kraken et Phoenix (1 niveau), Orbit et Titans (2), Lynx et Vortex (3).
- **Q8** : Nova et Orbit ont un adversaire commun, **Kraken**. Nova l'a battu, Orbit a perdu contre lui.
- **Q7 bis** : Titans → Nova → Kraken → Orbit. Titans n'a jamais joué Orbit.
- **Cycles** : quatre, dont Nova → Kraken → Orbit → Nova.
- **Anciens coéquipiers devenus adversaires** : Shade (Kraken → Zenith) bat Kraken en finale du Spring Masters ; Blitz (Nova → Titans) bat Nova en poules.
- **Tombeurs de champions** : Kraken a battu Orbit, champion de la Winter Cup ; Lynx a battu Zenith, champion du Spring Masters, mais par forfait.
