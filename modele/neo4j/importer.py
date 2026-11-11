"""Import du graphe « qui a battu qui » dans Neo4j (MLD : docs/mld-neo4j.md).

PostgreSQL fait foi ; Neo4j en est une copie reconstruite par ce script (ADR 0001).

Sources :
  --source csv   (défaut) les CSV d'un dossier, par défaut modele/neo4j/demo/
  --source pg    PostgreSQL directement (requêtes SQL ci-dessous)

Exemples :
  pip install -r modele/neo4j/requirements.txt
  python modele/neo4j/importer.py --reset              # données de démo
  python modele/neo4j/importer.py --source pg --reset  # depuis PostgreSQL
  python modele/neo4j/importer.py --dry-run            # lit et compte, n'écrit rien

Connexion (variables d'environnement) :
  NEO4J_URI (bolt://localhost:7687), NEO4J_USER (neo4j), NEO4J_PASSWORD (motdepasse)
  PG_DSN (postgresql://postgres:postgres@localhost:5432/esport)
"""

import argparse
import csv
import datetime as dt
import os
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent

# --- Extraction PostgreSQL --------------------------------------------------------
# Noms de tables/colonnes tirés du MCD (CONCEPTION.md section 2).
# À ALIGNER sur le DDL d'Armand. Chaque requête renvoie les colonnes du CSV du même nom.
SQL = {
    "equipes": """
        SELECT e.id_equipe, e.nom, e.tag, e.pays, j.nom AS jeu
        FROM equipe e JOIN jeu j ON j.id_jeu = e.id_jeu            -- Évoluer sur (RG4)
    """,
    "joueurs": "SELECT id_joueur, pseudo, pays FROM joueur",
    "appartenances": """
        SELECT id_joueur, id_equipe, date_entree, date_sortie, role
        FROM appartenir                                             -- RG7
    """,
    # Un match terminé = 2 lignes DISPUTER (RG9). Le vainqueur n'est pas stocké : c'est
    # le plus haut score, il y en a toujours un (RG11). Forfait (RG12) : celui du perdant.
    "victoires": """
        SELECT m.id_match, t.id_tournoi, t.nom AS tournoi,
               ph.type AS phase_type, ph.ordre AS phase_ordre,
               m.date_heure, m.format,
               v.id_equipe AS id_vainqueur, p.id_equipe AS id_perdant,
               v.score AS score_vainqueur, p.score AS score_perdant,
               p.forfait
        FROM match m
        JOIN phase ph   ON ph.id_phase = m.id_phase                 -- Contenir (RG8)
        JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi             -- Composer (RG3)
        JOIN disputer v ON v.id_match = m.id_match
        JOIN disputer p ON p.id_match = m.id_match AND p.id_equipe <> v.id_equipe
        WHERE m.statut = 'termine' AND v.score > p.score
    """,
}

# --- Écriture Neo4j (idempotente : MERGE sur les clés) -----------------------------
CONTRAINTES = [
    "CREATE CONSTRAINT equipe_id IF NOT EXISTS FOR (e:Equipe) REQUIRE e.id_equipe IS UNIQUE",
    "CREATE CONSTRAINT joueur_id IF NOT EXISTS FOR (j:Joueur) REQUIRE j.id_joueur IS UNIQUE",
    "CREATE CONSTRAINT a_battu_match IF NOT EXISTS "
    "FOR ()-[r:A_BATTU]-() REQUIRE r.id_match IS UNIQUE",  # Neo4j >= 5.7
]

CYPHER = {
    "equipes": """
        UNWIND $lignes AS l
        MERGE (e:Equipe {id_equipe: toInteger(l.id_equipe)})
        SET e.nom = l.nom, e.tag = l.tag, e.pays = l.pays, e.jeu = l.jeu
    """,
    "joueurs": """
        UNWIND $lignes AS l
        MERGE (j:Joueur {id_joueur: toInteger(l.id_joueur)})
        SET j.pseudo = l.pseudo, j.pays = l.pays
    """,
    "appartenances": """
        UNWIND $lignes AS l
        MATCH (j:Joueur {id_joueur: toInteger(l.id_joueur)})
        MATCH (e:Equipe {id_equipe: toInteger(l.id_equipe)})
        MERGE (j)-[r:A_JOUE_POUR {date_entree: date(l.date_entree)}]->(e)
        SET r.date_sortie = CASE WHEN coalesce(l.date_sortie, '') = '' THEN null
                                 ELSE date(l.date_sortie) END,
            r.role = l.role
    """,
    "victoires": """
        UNWIND $lignes AS l
        MATCH (v:Equipe {id_equipe: toInteger(l.id_vainqueur)})
        MATCH (p:Equipe {id_equipe: toInteger(l.id_perdant)})
        MERGE (v)-[r:A_BATTU {id_match: toInteger(l.id_match)}]->(p)
        SET r.id_tournoi = toInteger(l.id_tournoi), r.tournoi = l.tournoi,
            r.phase_type = l.phase_type, r.phase_ordre = toInteger(l.phase_ordre),
            r.date_heure = localdatetime(l.date_heure), r.format = toInteger(l.format),
            r.score_vainqueur = toInteger(l.score_vainqueur),
            r.score_perdant = toInteger(l.score_perdant),
            r.forfait = toLower(l.forfait) IN ['true', 't', '1']
    """,
}

# Ordre d'import : les nœuds d'abord, car les relations en ont besoin.
ORDRE = ["equipes", "joueurs", "appartenances", "victoires"]


def _texte(valeur):
    """Convertit une valeur PostgreSQL en texte, comme dans les CSV.

    Ainsi les requêtes CYPHER reçoivent la même chose quelle que soit la source :
    dates au format ISO ('2026-01-17'), booléens en 'true' / 'false'.
    """
    if valeur is None:
        return None
    if isinstance(valeur, dt.datetime):
        return valeur.replace(tzinfo=None).isoformat()
    if isinstance(valeur, dt.date):
        return valeur.isoformat()
    if isinstance(valeur, bool):
        return "true" if valeur else "false"
    return str(valeur)


def lire_csv(dossier: Path) -> dict[str, list[dict]]:
    """Lit les 4 CSV du dossier. Renvoie {"equipes": [lignes], "joueurs": [...], ...}."""
    donnees = {}
    for nom in ORDRE:
        chemin = dossier / f"{nom}.csv"
        if not chemin.exists():
            sys.exit(f"Fichier manquant : {chemin}")
        with chemin.open(encoding="utf-8", newline="") as f:
            donnees[nom] = list(csv.DictReader(f))
    return donnees


def lire_pg(dsn: str) -> dict[str, list[dict]]:
    """Lance les 4 requêtes SQL. Renvoie le même format que lire_csv."""
    try:
        import psycopg
    except ImportError:
        sys.exit("psycopg manquant : pip install -r modele/neo4j/requirements.txt")
    donnees = {}
    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        for nom in ORDRE:
            cur.execute(SQL[nom])
            colonnes = [c.name for c in cur.description]
            donnees[nom] = [{c: _texte(v) for c, v in zip(colonnes, ligne)} for ligne in cur]
    return donnees


def ecrire_neo4j(donnees: dict[str, list[dict]], uri: str, user: str, mdp: str, reset: bool):
    """Crée les contraintes, puis envoie les lignes à Neo4j (une requête CYPHER par fichier)."""
    try:
        from neo4j import GraphDatabase
    except ImportError:
        sys.exit("neo4j manquant : pip install -r modele/neo4j/requirements.txt")
    with GraphDatabase.driver(uri, auth=(user, mdp)) as driver:
        driver.verify_connectivity()
        with driver.session() as s:
            if reset:
                s.run("MATCH (n) WHERE n:Equipe OR n:Joueur DETACH DELETE n")
                print("Graphe vidé.")
            for c in CONTRAINTES:
                s.run(c)
            for nom in ORDRE:
                lignes = donnees[nom]
                s.run(CYPHER[nom], lignes=lignes)  # UNWIND $lignes traite chaque ligne
                print(f"  {nom:<14} {len(lignes):>6} ligne(s) importée(s)")
            # Vérification : ce que contient le graphe après l'import
            equipes = s.run("MATCH (e:Equipe) RETURN count(e) AS n").single()["n"]
            victoires = s.run("MATCH ()-[r:A_BATTU]->() RETURN count(r) AS n").single()["n"]
            print(f"Graphe : {equipes} équipes, {victoires} relations A_BATTU.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--source", choices=["csv", "pg"], default="csv")
    p.add_argument("--dossier", type=Path, default=ICI / "demo", help="dossier des CSV (source csv)")
    p.add_argument("--reset", action="store_true", help="vider le graphe avant l'import")
    p.add_argument("--dry-run", action="store_true", help="lire et compter sans écrire")
    a = p.parse_args()

    if a.source == "csv":
        donnees = lire_csv(a.dossier)
    else:
        donnees = lire_pg(os.environ.get("PG_DSN", "postgresql://postgres:postgres@localhost:5432/esport"))

    print(f"Source : {a.source}")
    for nom in ORDRE:
        print(f"  {nom:<14} {len(donnees[nom]):>6} ligne(s) lue(s)")
    if a.dry_run:
        return

    ecrire_neo4j(
        donnees,
        os.environ.get("NEO4J_URI", "bolt://localhost:7687"),
        os.environ.get("NEO4J_USER", "neo4j"),
        os.environ.get("NEO4J_PASSWORD", "motdepasse"),
        a.reset,
    )


if __name__ == "__main__":
    main()
