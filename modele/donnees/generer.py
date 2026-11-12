#!/usr/bin/env python3
"""Génère les données du tournoi e-sport : un CSV par table dans sortie/.

4 jeux, 120 équipes, environ 700 joueurs, 30 tournois terminés (poules puis
élimination directe). Respecte RG1 à RG12 ; un bloc d'assert le vérifie
avant d'écrire.

Aucune dépendance : Python 3.10 ou plus suffit.

    python generer.py

La graine est fixe : deux lancements donnent des fichiers identiques. Le script
affiche une empreinte à la fin. Les en-têtes des CSV sont les colonnes de
modele/postgres/schema.sql.
"""

import csv
import hashlib
import os
import random
from collections import defaultdict
from datetime import date, datetime, timedelta

GRAINE = 2026
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sortie")
rng = random.Random(GRAINE)

FIN_DONNEES = date(2026, 10, 31)
N_EQUIPES_PAR_JEU = 30
N_JOUEURS = 700
N_DOUBLE_JEU = 45          # joueurs qui évoluent sur deux jeux en même temps (RG7)
N_TOURNOIS = [8, 8, 7, 7]  # par jeu, 30 au total
P_FORFAIT = 0.04

JEUX = [
    ("Counter-Strike 2", "Valve", ["Mirage", "Inferno", "Nuke", "Ancient", "Anubis"]),
    ("League of Legends", "Riot Games", ["Faille de l'invocateur", "Howling Abyss"]),
    ("Valorant", "Riot Games", ["Ascent", "Bind", "Haven", "Lotus", "Sunset"]),
    ("Rocket League", "Psyonix", ["DFH Stadium", "Mannfield", "Champions Field", "Utopia Coliseum"]),
]
LIEUX = ["en ligne", "Paris", "Lyon", "Lille", "Bordeaux", "Marseille", "Toulouse", "Nantes"]
PAYS = ["FR", "FR", "FR", "BE", "CH", "ES", "DE", "PT", "IT", "CA"]
ROLES = ["titulaire", "titulaire", "titulaire", "remplaçant", "capitaine", "coach"]

DEBUTS = ("Nova Orbit Titans Kraken Phoenix Lynx Vortex Zenith Shade Blitz Apex Comet Eclipse Falcon "
          "Hydra Inferno Jaguar Kodiak Legion Mirage Nebula Onyx Pulsar Quasar Raptor Sirius Tempest "
          "Umbra Viper Wraith Yeti Zephyr Aegis Bolt Cobra Drake Echo Fusion Ghost").split()
SUFFIXES = ["Esport", "Gaming", "Club", "Squad", "Five", "Legacy", "Academy", "Crew"]
PRENOMS = ("Léa Emma Chloé Manon Inès Jade Louise Alice Lina Rose Lucas Hugo Louis Gabriel Arthur "
           "Jules Adam Raphaël Nathan Léo Ethan Paul Noah Sacha Tom Malo Yanis Nolan Amir Rayan "
           "Karim Mehdi Sofiane Aya Yasmine Kenza Wassim Théo Maxime Clara Lola Enzo").split()
NOMS = ("Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre "
        "Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard Andre Mercier Dupont "
        "Lambert Bonnet Francois Martinez Legrand Garnier Faure Rousseau Blanc Guerin Muller").split()
SYLLABES = ["ka", "zo", "ri", "mu", "ta", "vex", "nyx", "lo", "dar", "fi", "ze", "ko", "ba", "xi", "ru", "sha"]


def jour(d0, n):
    return d0 + timedelta(days=n)


def noms_equipes(n):
    tous = [f"{a} {s}" for a in DEBUTS for s in SUFFIXES]
    rng.shuffle(tous)
    return tous[:n]


def pseudos(n):
    vus = set()
    while len(vus) < n:
        vus.add("".join(rng.choice(SYLLABES) for _ in range(rng.randint(2, 3))).capitalize()
                + (str(rng.randint(1, 99)) if rng.random() < 0.5 else ""))
    liste = sorted(vus)  # un set n'a pas d'ordre stable d'un lancement à l'autre
    rng.shuffle(liste)
    return liste


# ---------------------------------------------------------------------------
# Les tables, en listes de lignes (dict ordonnés = colonnes du DDL)
# ---------------------------------------------------------------------------
T = {nom: [] for nom in ["jeu", "tournoi", "phase", "equipe", "joueur", "appartenir",
                         "inscrire", "match", "disputer", "manche", "marquer"]}

# JEU, EQUIPE ---------------------------------------------------------------
equipes_du_jeu = defaultdict(list)
cartes = {}
noms = noms_equipes(len(JEUX) * N_EQUIPES_PAR_JEU)
for i, (nom, editeur, maps) in enumerate(JEUX, 1):
    T["jeu"].append(dict(id_jeu=i, nom=nom, editeur=editeur))
    cartes[i] = maps
for k, nom in enumerate(noms, 1):
    id_jeu = (k - 1) % len(JEUX) + 1
    T["equipe"].append(dict(id_equipe=k, id_jeu=id_jeu, nom=nom, tag=nom.split()[0][:4].upper(),
                            pays=rng.choice(PAYS), cree_le=date(2021, 1, 1) + timedelta(days=rng.randint(0, 700))))
    equipes_du_jeu[id_jeu].append(k)
force = {e["id_equipe"]: rng.uniform(0.5, 3.0) for e in T["equipe"]}

# JOUEUR, APPARTENIR (RG7 : périodes successives dans un même jeu, jeux différents en parallèle) --
pseudo_liste = pseudos(N_JOUEURS)
for k in range(1, N_JOUEURS + 1):
    T["joueur"].append(dict(id_joueur=k, pseudo=pseudo_liste[k - 1], nom=rng.choice(NOMS), prenom=rng.choice(PRENOMS),
                            pays=rng.choice(PAYS), ne_le=date(1995, 1, 1) + timedelta(days=rng.randint(0, 3650))))


def parcours(id_joueur, id_jeu):
    """Une suite de séjours sans chevauchement dans les équipes d'un jeu."""
    debut = date(2023, 1, 1) + timedelta(days=rng.randint(0, 500))
    precedente = None
    for rang in range(rng.choice([1, 1, 1, 2, 2, 3])):
        if debut > FIN_DONNEES:
            return
        equipe = rng.choice([e for e in equipes_du_jeu[id_jeu] if e != precedente])
        fin = None if rng.random() < 0.3 else debut + timedelta(days=rng.randint(120, 400))
        if fin is not None and fin > FIN_DONNEES:
            fin = None
        T["appartenir"].append(dict(id_joueur=id_joueur, id_equipe=equipe, date_entree=debut,
                                    date_sortie=fin, role=rng.choice(ROLES)))
        if fin is None:
            return
        precedente, debut = equipe, fin + timedelta(days=rng.randint(1, 30))


for j in range(1, N_JOUEURS + 1):
    jeu_principal = (j - 1) % len(JEUX) + 1
    parcours(j, jeu_principal)
    if j <= N_DOUBLE_JEU:  # RG7 : deux équipes en même temps si les jeux diffèrent
        parcours(j, jeu_principal % len(JEUX) + 1)

# TOURNOI, PHASE, INSCRIRE, MATCH, DISPUTER, MANCHE, MARQUER ---------------------------
ids = defaultdict(lambda: 0)


def nouvel_id(table):
    ids[table] += 1
    return ids[table]


def jouer(id_phase, a, b, quand, fmt, id_jeu, forfait=False):
    """Crée un match terminé entre a et b ; renvoie (vainqueur, perdant, score_v, score_p)."""
    maj = fmt // 2 + 1
    v, p = (a, b) if rng.random() < force[a] / (force[a] + force[b]) else (b, a)
    id_match = nouvel_id("match")
    T["match"].append(dict(id_match=id_match, id_phase=id_phase, date_heure=quand, format=fmt, statut="termine"))
    if forfait:  # RG12 : score maximal du format, aucune manche
        sv, sp = maj, 0
    else:
        sv, sp = maj, rng.randint(0, maj - 1)
        issues = [v] * (sv - 1) + [p] * sp
        rng.shuffle(issues)
        for numero, gagnante in enumerate(issues + [v], 1):  # le vainqueur gagne la dernière manche (RG11)
            id_manche = nouvel_id("manche")
            T["manche"].append(dict(id_manche=id_manche, id_match=id_match, numero=numero,
                                    carte=rng.choice(cartes[id_jeu])))
            pts_g, pts_p = 16, rng.randint(4, 14)
            T["marquer"].append(dict(id_manche=id_manche, id_equipe=gagnante, points=pts_g))
            T["marquer"].append(dict(id_manche=id_manche, id_equipe=a if gagnante == b else b, points=pts_p))
    T["disputer"].append(dict(id_match=id_match, id_equipe=v, score=sv, forfait=False))
    T["disputer"].append(dict(id_match=id_match, id_equipe=p, score=sp, forfait=forfait))
    return v, p, sv, sp


for id_jeu, n_tournois in enumerate(N_TOURNOIS, 1):
    debut = date(2024, 2, 1) + timedelta(days=rng.randint(0, 20))
    for k in range(n_tournois):
        id_tournoi = nouvel_id("tournoi")
        d0 = debut + timedelta(days=k * 100 + rng.randint(0, 20))  # un jeu : tournois successifs
        n = rng.choice([6, 8])
        participantes = sorted(rng.sample(equipes_du_jeu[id_jeu], n), key=lambda e: -force[e])
        T["tournoi"].append(dict(id_tournoi=id_tournoi, id_jeu=id_jeu, nom=f"{JEUX[id_jeu - 1][0].split()[0]} Cup {d0.year} #{k + 1}",
                                 lieu=rng.choice(LIEUX), date_debut=d0, date_fin=jour(d0, 4),
                                 dotation=rng.choice([1000, 2500, 5000, 10000, 20000])))
        for rang, e in enumerate(participantes, 1):
            T["inscrire"].append(dict(id_tournoi=id_tournoi, id_equipe=e, date_inscription=jour(d0, -rng.randint(7, 40)),
                                      tete_de_serie=rang))
        id_poules, id_elim = nouvel_id("phase"), nouvel_id("phase")
        T["phase"] += [dict(id_phase=id_poules, id_tournoi=id_tournoi, type="poules", ordre=1),
                       dict(id_phase=id_elim, id_tournoi=id_tournoi, type="elimination", ordre=2)]
        # Poules : un groupe en round-robin (chaque paire une fois)
        fmt = rng.choice([1, 3])
        bilan = {e: [0, 0] for e in participantes}  # victoires, manches
        paires = [(a, b) for i, a in enumerate(participantes) for b in participantes[i + 1:]]
        rng.shuffle(paires)
        for slot, (a, b) in enumerate(paires):
            quand = datetime.combine(jour(d0, slot // 10), datetime.min.time()) + timedelta(hours=10 + slot % 10)
            v, p, sv, sp = jouer(id_poules, a, b, quand, fmt, id_jeu, forfait=rng.random() < P_FORFAIT)
            bilan[v][0] += 1
            bilan[v][1] += sv - sp
            bilan[p][1] += sp - sv
        # Élimination : les 4 premiers des poules, demi-finales 1-4 et 2-3, finale en BO5
        q = sorted(participantes, key=lambda e: (-bilan[e][0], -bilan[e][1], e))[:4]
        h = lambda j, heure: datetime.combine(jour(d0, j), datetime.min.time()) + timedelta(hours=heure)
        v1 = jouer(id_elim, q[0], q[3], h(3, 14), 3, id_jeu)[0]
        v2 = jouer(id_elim, q[1], q[2], h(3, 17), 3, id_jeu)[0]
        jouer(id_elim, v1, v2, h(4, 18), 5, id_jeu)

# ---------------------------------------------------------------------------
# Vérification de RG7, RG9, RG11, RG12 avant d'écrire
# ---------------------------------------------------------------------------
equipe_jeu = {e["id_equipe"]: e["id_jeu"] for e in T["equipe"]}
# RG7 : pour un joueur et un jeu, les périodes ne se chevauchent pas
periodes = defaultdict(list)
for a in T["appartenir"]:
    periodes[(a["id_joueur"], equipe_jeu[a["id_equipe"]])].append((a["date_entree"], a["date_sortie"]))
for cle, liste in periodes.items():
    liste.sort()
    for (_, sortie), (entree_suiv, _) in zip(liste, liste[1:]):
        assert sortie is not None and sortie < entree_suiv, f"RG7 : chevauchement {cle}"
assert any(sum(1 for (j, _) in periodes if j == x) == 2 for x in range(1, N_DOUBLE_JEU + 1)), "RG7 : aucun joueur sur deux jeux"

phase_tournoi = {p["id_phase"]: p["id_tournoi"] for p in T["phase"]}
tournoi_jeu = {t["id_tournoi"]: t["id_jeu"] for t in T["tournoi"]}
inscrites = {(i["id_tournoi"], i["id_equipe"]) for i in T["inscrire"]}
par_match = defaultdict(list)
for d in T["disputer"]:
    par_match[d["id_match"]].append(d)
manches_du_match = defaultdict(list)
for m in T["manche"]:
    manches_du_match[m["id_match"]].append(m)
points = defaultdict(dict)
for k in T["marquer"]:
    points[k["id_manche"]][k["id_equipe"]] = k["points"]
n_forfaits = 0
for m in T["match"]:
    lignes = par_match[m["id_match"]]
    t = phase_tournoi[m["id_phase"]]
    equipes = {d["id_equipe"] for d in lignes}
    assert len(lignes) == 2 and len(equipes) == 2, f"RG9 : match {m['id_match']} sans deux équipes"
    for e in equipes:
        assert (t, e) in inscrites and equipe_jeu[e] == tournoi_jeu[t], f"RG9 : équipe {e} non inscrite"
    maj = m["format"] // 2 + 1
    gagnees = dict.fromkeys(equipes, 0)
    for ma in manches_du_match[m["id_match"]]:
        pts = points[ma["id_manche"]]
        assert set(pts) == equipes, "RG11 : une manche donne des points aux deux équipes du match"
        a, b = pts.values()
        assert a != b, "RG11 : pas d'égalité dans une manche"
        gagnees[max(pts, key=pts.get)] += 1
    v = max(lignes, key=lambda d: d["score"])
    p = min(lignes, key=lambda d: d["score"])
    assert v["score"] == maj and p["score"] < maj, "RG11 : un vainqueur, pas de nul"
    if p["forfait"]:  # RG12
        n_forfaits += 1
        assert not manches_du_match[m["id_match"]] and p["score"] == 0 and not v["forfait"], "RG12"
    else:
        assert all(gagnees[d["id_equipe"]] == d["score"] for d in lignes), "RG9 : score = manches gagnées"
assert n_forfaits > 0, "RG12 : aucun forfait généré"

# ---------------------------------------------------------------------------
# Écriture
# ---------------------------------------------------------------------------
os.makedirs(SORTIE, exist_ok=True)
empreinte = hashlib.sha256()
for nom, lignes in T.items():
    chemin = os.path.join(SORTIE, f"{nom}.csv")
    with open(chemin, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(lignes[0]), lineterminator="\n")
        w.writeheader()
        for ligne in lignes:
            w.writerow({c: ("true" if v is True else "false" if v is False else "" if v is None else v)
                        for c, v in ligne.items()})
    with open(chemin, "rb") as f:
        empreinte.update(f.read())
    print(f"{nom + '.csv':<16} {len(lignes):>6} lignes")
print(f"{n_forfaits} forfaits. Empreinte : {empreinte.hexdigest()[:16]}")
