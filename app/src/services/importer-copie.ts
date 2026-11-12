// Copié depuis modele/neo4j/importer.py (Aurel) : copies exactes des dicts CYPHER et SQL.
// Ne pas modifier ici. Si importer.py change, recopier ; src/services/graphe.test.ts échoue tant que
// les deux textes diffèrent (cahier des charges § 6.3 : « recopiée telle quelle »).

export const CYPHER_EQUIPES = `
        UNWIND $lignes AS l
        MERGE (e:Equipe {id_equipe: toInteger(l.id_equipe)})
        SET e.nom = l.nom, e.tag = l.tag, e.pays = l.pays, e.jeu = l.jeu
    `;

export const CYPHER_VICTOIRES = `
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
    `;

export const SQL_EQUIPES = `
        SELECT e.id_equipe, e.nom, e.tag, e.pays, j.nom AS jeu
        FROM equipe e JOIN jeu j ON j.id_jeu = e.id_jeu            -- Évoluer sur (RG4)
    `;

export const SQL_VICTOIRES = `
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
    `;
