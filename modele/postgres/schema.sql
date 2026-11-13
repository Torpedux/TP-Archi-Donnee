-- DDL PostgreSQL du MCD (CONCEPTION.md section 2), conforme au MLD de la section 4.1.
-- Relu contre le MLD le 13/11/2026 : mêmes tables, clés, contraintes et choix (NULL permis sur
-- inscrire.tete_de_serie et disputer.score, vainqueur non stocké).
--
-- Les noms de tables et de colonnes sont ceux du dict SQL de modele/neo4j/importer.py.
-- Rejouable : on efface d'abord ce qui existe.
--
--   docker compose exec postgres psql -U postgres -d esport -f /docker-entrypoint-initdb.d/schema.sql
--
-- Pas de contrainte EXCLUDE pour RG7 : le jeu est sur EQUIPE, pas sur APPARTENIR (cahier des charges O13).
-- L'application vérifie le chevauchement. Voir CONCEPTION.md section 4.3, « ce que le schéma ne garantit pas ».

DROP TABLE IF EXISTS marquer, manche, disputer, match, inscrire, appartenir,
                     joueur, equipe, phase, tournoi, jeu CASCADE;

-- RG1 : un jeu a un nom unique et un éditeur.
CREATE TABLE jeu (
    id_jeu   serial PRIMARY KEY,
    nom      text NOT NULL UNIQUE,                       -- RG1
    editeur  text NOT NULL
);

-- RG2 : un tournoi porte sur un seul jeu (Porter, 1,1 côté tournoi).
CREATE TABLE tournoi (
    id_tournoi  serial PRIMARY KEY,
    id_jeu      integer NOT NULL REFERENCES jeu (id_jeu),            -- RG2
    nom         text NOT NULL,
    lieu        text NOT NULL DEFAULT 'en ligne',                    -- RG2 : un lieu ou « en ligne »
    date_debut  date NOT NULL,
    date_fin    date NOT NULL,
    dotation    numeric(10, 2) NOT NULL DEFAULT 0 CHECK (dotation >= 0),   -- RG2 : en euros
    CHECK (date_fin >= date_debut)                                   -- RG2 : la fin ne précède pas le début
);

-- RG3 : une phase appartient à un seul tournoi, avec un type et un numéro d'ordre.
CREATE TABLE phase (
    id_phase    serial PRIMARY KEY,
    id_tournoi  integer NOT NULL REFERENCES tournoi (id_tournoi),    -- RG3 (Composer, 1,1 côté phase)
    type        text NOT NULL CHECK (type IN ('poules', 'elimination')),   -- RG3 : poules puis élimination
    ordre       integer NOT NULL CHECK (ordre >= 1),
    UNIQUE (id_tournoi, ordre)                                       -- RG3 : phases ordonnées
);

-- RG4 : une équipe a un nom unique et évolue sur un seul jeu (Évoluer sur, 1,1).
CREATE TABLE equipe (
    id_equipe  serial PRIMARY KEY,
    id_jeu     integer NOT NULL REFERENCES jeu (id_jeu),             -- RG4
    nom        text NOT NULL UNIQUE,                                 -- RG4
    tag        text NOT NULL,
    pays       text NOT NULL,
    cree_le    date NOT NULL
);

-- RG6 : un joueur a un pseudo unique.
CREATE TABLE joueur (
    id_joueur  serial PRIMARY KEY,
    pseudo     text NOT NULL UNIQUE,                                 -- RG6
    nom        text NOT NULL,
    prenom     text NOT NULL,
    pays       text NOT NULL,
    ne_le      date NOT NULL
);

-- RG7 : Appartenir (n,n) porte une période et un rôle. Un joueur peut revenir dans une équipe :
-- la date d'entrée fait partie de la clé.
CREATE TABLE appartenir (
    id_joueur    integer NOT NULL REFERENCES joueur (id_joueur),     -- RG7
    id_equipe    integer NOT NULL REFERENCES equipe (id_equipe),     -- RG7
    date_entree  date NOT NULL,
    date_sortie  date,                                               -- RG7 : vide tant que le joueur y est
    role         text NOT NULL,
    PRIMARY KEY (id_joueur, id_equipe, date_entree),
    CHECK (date_sortie IS NULL OR date_sortie >= date_entree)        -- RG7
);

-- RG5 : Inscrire (n,n) porte une date et une tête de série.
CREATE TABLE inscrire (
    id_tournoi        integer NOT NULL REFERENCES tournoi (id_tournoi),    -- RG5
    id_equipe         integer NOT NULL REFERENCES equipe (id_equipe),      -- RG5
    date_inscription  date NOT NULL,
    tete_de_serie     integer CHECK (tete_de_serie >= 1),                  -- RG5 : fixée après l'inscription (nullable)
    PRIMARY KEY (id_tournoi, id_equipe),                                   -- RG5 : une seule inscription par équipe et tournoi
    UNIQUE (id_tournoi, tete_de_serie)                                     -- RG5 : une tête de série par tournoi (NULL répétable)
);

-- RG8 : un match appartient à une seule phase (Contenir, 1,1 côté match).
CREATE TABLE match (
    id_match    serial PRIMARY KEY,
    id_phase    integer NOT NULL REFERENCES phase (id_phase),        -- RG8
    date_heure  timestamp NOT NULL,
    format      integer NOT NULL CHECK (format IN (1, 3, 5)),        -- RG8 : 1, 3 ou 5 manches
    statut      text NOT NULL DEFAULT 'prevu'
                CHECK (statut IN ('prevu', 'en_cours', 'termine', 'annule'))   -- RG8
);

-- RG9 : un match oppose deux équipes (2 lignes) ; le score est le nombre de manches gagnées.
-- RG12 : forfait = la ligne de l'équipe qui déclare forfait.
CREATE TABLE disputer (
    id_match   integer NOT NULL REFERENCES match (id_match),         -- RG9
    id_equipe  integer NOT NULL REFERENCES equipe (id_equipe),       -- RG9
    score      integer CHECK (score >= 0),                           -- RG9 : connu une fois le match joué
    forfait    boolean NOT NULL DEFAULT false,                       -- RG12
    PRIMARY KEY (id_match, id_equipe)                                -- RG9 : une équipe n'apparaît qu'une fois dans un match
);

-- RG10 : une manche appartient à un seul match (Découper, 1,1 côté manche).
CREATE TABLE manche (
    id_manche  serial PRIMARY KEY,
    id_match   integer NOT NULL REFERENCES match (id_match),         -- RG10
    numero     integer NOT NULL CHECK (numero >= 1),
    carte      text NOT NULL,
    UNIQUE (id_match, numero)                                        -- RG10 : manches numérotées
);

-- RG11 : une manche donne des points à chacune des deux équipes.
CREATE TABLE marquer (
    id_manche  integer NOT NULL REFERENCES manche (id_manche),       -- RG11
    id_equipe  integer NOT NULL REFERENCES equipe (id_equipe),       -- RG11
    points     integer NOT NULL CHECK (points >= 0),                 -- RG11
    PRIMARY KEY (id_manche, id_equipe)
);

-- PostgreSQL n'indexe pas les clés étrangères tout seul. Sont déjà couvertes par une clé primaire
-- ou unique : appartenir (id_joueur), inscrire (id_tournoi), disputer (id_match), manche (id_match),
-- marquer (id_manche), phase (id_tournoi).
CREATE INDEX ON tournoi (id_jeu);
CREATE INDEX ON equipe (id_jeu);
CREATE INDEX ON appartenir (id_equipe);
CREATE INDEX ON inscrire (id_equipe);
CREATE INDEX ON match (id_phase);
CREATE INDEX ON disputer (id_equipe);
CREATE INDEX ON marquer (id_equipe);
