-- Schéma « app » : tout ce qui est propre à l'application (cahier des charges § 6.3).
-- Le MLD noté (schéma public, modele/postgres/schema.sql) n'est pas touché.
-- Idempotent : rejoué à chaque démarrage du serveur (src/instrumentation.ts).

CREATE SCHEMA IF NOT EXISTS app;

-- EF-15 : comptes. Capitaine = compte rattaché à une équipe (id_equipe non nul).
CREATE TABLE IF NOT EXISTS app.utilisateur (
    id_utilisateur  serial PRIMARY KEY,
    email           text NOT NULL UNIQUE,
    nom             text NOT NULL,
    hash            text NOT NULL,                                  -- bcrypt (ENF-03)
    role            text NOT NULL DEFAULT 'membre'
                    CHECK (role IN ('membre', 'organisateur', 'admin')),
    id_equipe       integer UNIQUE REFERENCES public.equipe (id_equipe),   -- un capitaine par équipe
    cree_le         timestamp NOT NULL DEFAULT now()
);

-- EF-02 : état applicatif d'un tournoi et son organisateur.
-- Un tournoi sans ligne ici vient du générateur : il est terminé et géré par l'admin.
CREATE TABLE IF NOT EXISTS app.reglage_tournoi (
    id_tournoi       integer PRIMARY KEY REFERENCES public.tournoi (id_tournoi) ON DELETE CASCADE,
    etat             text NOT NULL DEFAULT 'brouillon'
                     CHECK (etat IN ('brouillon', 'inscriptions', 'en_cours', 'termine')),
    id_organisateur  integer REFERENCES app.utilisateur (id_utilisateur)
);

-- EF-02 : format des matchs d'une phase et, pour les poules, nombre de qualifiés.
CREATE TABLE IF NOT EXISTS app.reglage_phase (
    id_phase      integer PRIMARY KEY REFERENCES public.phase (id_phase) ON DELETE CASCADE,
    format        integer NOT NULL CHECK (format IN (1, 3, 5)),
    nb_qualifies  integer CHECK (nb_qualifies >= 2)
);

-- O2 : la place d'un match dans l'arbre. Tour 1 = premier tour ; position 1 en haut.
-- Le qualifié d'un emplacement est id_equipe_qualifiee (exempt, ou désigné après une
-- annulation, EF-10), sinon le vainqueur de id_match.
CREATE TABLE IF NOT EXISTS app.emplacement_arbre (
    id_phase             integer NOT NULL REFERENCES public.phase (id_phase) ON DELETE CASCADE,
    tour                 integer NOT NULL CHECK (tour >= 1),
    position             integer NOT NULL CHECK (position >= 1),
    id_match             integer UNIQUE REFERENCES public.match (id_match) ON DELETE SET NULL,
    id_equipe_qualifiee  integer REFERENCES public.equipe (id_equipe),
    PRIMARY KEY (id_phase, tour, position)
);
