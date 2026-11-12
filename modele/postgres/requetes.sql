-- Requêtes SQL Q1 à Q5 (CONCEPTION.md section 5).
--   psql -U postgres -d esport -f modele/postgres/requetes.sql
--
-- Les lignes \gset ci-dessous sont de la syntaxe psql : elles choisissent des paramètres
-- d'exemple qui donnent des résultats. Une application les remplace par ses propres
-- paramètres (:id_tournoi, :id_equipe, :id_joueur).

SELECT
  (SELECT min(id_tournoi) FROM tournoi) AS id_tournoi,
  -- l'équipe qui a joué le plus de matchs et a encore des joueurs (Q2, Q4)
  (SELECT d.id_equipe FROM disputer d
    WHERE d.id_equipe IN (SELECT id_equipe FROM appartenir WHERE date_sortie IS NULL)
    GROUP BY d.id_equipe ORDER BY count(*) DESC, d.id_equipe LIMIT 1) AS id_equipe,
  -- un joueur dont l'équipe a joué pendant sa période (Q3)
  (SELECT a.id_joueur FROM appartenir a
    JOIN disputer d ON d.id_equipe = a.id_equipe
    JOIN match m ON m.id_match = d.id_match
    WHERE m.date_heure::date >= a.date_entree
      AND m.date_heure::date <= coalesce(a.date_sortie, 'infinity')
    GROUP BY a.id_joueur ORDER BY count(*) DESC, a.id_joueur LIMIT 1) AS id_joueur
\gset

-- Q1. Classement d'une poule : par équipe, victoires, défaites, manches gagnées et perdues.
--     RG3 (phase de type poules), RG8 (matchs terminés), RG9 (score = manches gagnées).
--     Un forfait compte comme une victoire au score maximal (RG12). Départage : victoires,
--     puis différence de manches (la confrontation directe n'est pas faite ici).
SELECT e.nom AS equipe,
       count(*)                                   AS joues,
       count(*) FILTER (WHERE d.score > o.score)  AS victoires,
       count(*) FILTER (WHERE d.score < o.score)  AS defaites,
       sum(d.score)                               AS manches_gagnees,
       sum(o.score)                               AS manches_perdues,
       sum(d.score - o.score)                     AS difference
FROM phase ph
JOIN match m    ON m.id_phase = ph.id_phase AND m.statut = 'termine'
JOIN disputer d ON d.id_match = m.id_match
JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
JOIN equipe e   ON e.id_equipe = d.id_equipe
WHERE ph.id_tournoi = :id_tournoi AND ph.type = 'poules'
GROUP BY e.id_equipe, e.nom
ORDER BY victoires DESC, difference DESC, e.nom;

-- Q2. Historique d'une équipe : ses matchs triés par date, avec l'adversaire, le score et le tournoi.
--     RG8, RG9.
SELECT m.date_heure, t.nom AS tournoi, ph.type AS phase, adv.nom AS adversaire,
       d.score || '-' || o.score AS score,
       CASE WHEN d.score > o.score THEN 'victoire' ELSE 'défaite' END AS resultat,
       d.forfait AS forfait_equipe, o.forfait AS forfait_adverse
FROM disputer d
JOIN match m    ON m.id_match = d.id_match
JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
JOIN equipe adv ON adv.id_equipe = o.id_equipe
JOIN phase ph   ON ph.id_phase = m.id_phase
JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi
WHERE d.id_equipe = :id_equipe AND m.statut = 'termine'
ORDER BY m.date_heure;

-- Q3. Matchs d'un joueur : les matchs joués par son équipe pendant sa période d'appartenance.
--     RG7, RG9. Un joueur qui revient dans une équipe a plusieurs périodes : chacune compte.
SELECT m.date_heure, e.nom AS equipe, a.role, adv.nom AS adversaire,
       d.score || '-' || o.score AS score, t.nom AS tournoi
FROM appartenir a
JOIN equipe e   ON e.id_equipe = a.id_equipe
JOIN disputer d ON d.id_equipe = a.id_equipe
JOIN match m    ON m.id_match = d.id_match
JOIN disputer o ON o.id_match = m.id_match AND o.id_equipe <> d.id_equipe
JOIN equipe adv ON adv.id_equipe = o.id_equipe
JOIN phase ph   ON ph.id_phase = m.id_phase
JOIN tournoi t  ON t.id_tournoi = ph.id_tournoi
WHERE a.id_joueur = :id_joueur
  AND m.statut = 'termine'
  AND m.date_heure::date >= a.date_entree
  AND m.date_heure::date <= coalesce(a.date_sortie, 'infinity')
ORDER BY m.date_heure;

-- Q4. Composition actuelle d'une équipe : les joueurs sans date de sortie.
--     RG7.
SELECT j.pseudo, j.prenom, j.nom, a.role, a.date_entree
FROM appartenir a
JOIN joueur j ON j.id_joueur = a.id_joueur
WHERE a.id_equipe = :id_equipe AND a.date_sortie IS NULL
ORDER BY a.date_entree, j.pseudo;

-- Q5. Palmarès : le vainqueur de chaque tournoi = le vainqueur du dernier match de la phase
--     d'ordre maximal (la finale). RG3 (phases ordonnées), RG11 (un vainqueur, pas de nul).
--     Pour une équipe : ajouter WHERE v.id_equipe = :id_equipe.
SELECT t.nom AS tournoi, t.date_fin, v.id_equipe, e.nom AS vainqueur
FROM tournoi t
JOIN LATERAL (
    SELECT m.id_match
    FROM phase ph
    JOIN match m ON m.id_phase = ph.id_phase AND m.statut = 'termine'
    WHERE ph.id_tournoi = t.id_tournoi
      AND ph.ordre = (SELECT max(ordre) FROM phase WHERE id_tournoi = t.id_tournoi)
    ORDER BY m.date_heure DESC, m.id_match DESC
    LIMIT 1
) finale ON true
JOIN LATERAL (
    SELECT d.id_equipe FROM disputer d WHERE d.id_match = finale.id_match
    ORDER BY d.score DESC LIMIT 1
) v ON true
JOIN equipe e ON e.id_equipe = v.id_equipe
ORDER BY t.date_fin, t.nom;
