-- Charge les CSV de modele/donnees/sortie/ dans l'ordre des clés étrangères.
-- À lancer depuis la racine du dépôt (les chemins sont relatifs) :
--   psql -U postgres -d esport -f modele/postgres/charger.sql
-- Les tables doivent être vides (schema.sql vient d'être joué).

\copy jeu        FROM 'modele/donnees/sortie/jeu.csv'        WITH (FORMAT csv, HEADER true)
\copy tournoi    FROM 'modele/donnees/sortie/tournoi.csv'    WITH (FORMAT csv, HEADER true)
\copy phase      FROM 'modele/donnees/sortie/phase.csv'      WITH (FORMAT csv, HEADER true)
\copy equipe     FROM 'modele/donnees/sortie/equipe.csv'     WITH (FORMAT csv, HEADER true)
\copy joueur     FROM 'modele/donnees/sortie/joueur.csv'     WITH (FORMAT csv, HEADER true)
\copy appartenir FROM 'modele/donnees/sortie/appartenir.csv' WITH (FORMAT csv, HEADER true)
\copy inscrire   FROM 'modele/donnees/sortie/inscrire.csv'   WITH (FORMAT csv, HEADER true)
\copy match      FROM 'modele/donnees/sortie/match.csv'      WITH (FORMAT csv, HEADER true)
\copy disputer   FROM 'modele/donnees/sortie/disputer.csv'   WITH (FORMAT csv, HEADER true)
\copy manche     FROM 'modele/donnees/sortie/manche.csv'     WITH (FORMAT csv, HEADER true)
\copy marquer    FROM 'modele/donnees/sortie/marquer.csv'    WITH (FORMAT csv, HEADER true)

-- Les id viennent des CSV : les séquences repartent après le plus grand.
SELECT setval(pg_get_serial_sequence('jeu', 'id_jeu'),         (SELECT max(id_jeu) FROM jeu));
SELECT setval(pg_get_serial_sequence('tournoi', 'id_tournoi'), (SELECT max(id_tournoi) FROM tournoi));
SELECT setval(pg_get_serial_sequence('phase', 'id_phase'),     (SELECT max(id_phase) FROM phase));
SELECT setval(pg_get_serial_sequence('equipe', 'id_equipe'),   (SELECT max(id_equipe) FROM equipe));
SELECT setval(pg_get_serial_sequence('joueur', 'id_joueur'),   (SELECT max(id_joueur) FROM joueur));
SELECT setval(pg_get_serial_sequence('match', 'id_match'),     (SELECT max(id_match) FROM match));
SELECT setval(pg_get_serial_sequence('manche', 'id_manche'),   (SELECT max(id_manche) FROM manche));
