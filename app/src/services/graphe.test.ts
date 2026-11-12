import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";
import { db, pg } from "@/db/client";
import { cypher, neo4jDriver } from "@/db/neo4j";
import type { Acteur } from "@/metier/droits";
import { Q6, Q7, Q8 } from "@/requetes/cypher-copie";
import { creerEquipe, creerJeu, viderLaBase } from "../../tests/outils";
import { acteurParId, creerCompte } from "./comptes";
import { pousserMatch } from "./graphe";
import { CYPHER_EQUIPES, CYPHER_VICTOIRES, SQL_EQUIPES, SQL_VICTOIRES } from "./importer-copie";
import { corrigerManche, declarerForfait, genererPhase, saisirManche } from "./moteur";
import { ajouterPhase, creerTournoi, inscrireEquipe, ouvrirInscriptions } from "./tournois";

// EF-14 : un match terminé apparaît dans le graphe sans action manuelle.
// Neo4j n'a qu'une base : les tests y écrivent avec des identifiants à partir de 900 001, loin des
// données de démo, et nettoient derrière eux.
const BASE = 900_000;
let orga: Acteur, nova: number, orbit: number, idMatch: number, idPhase: number;

const fleches = () =>
  cypher<{
    vainqueur: number;
    perdant: number;
    score: string;
    forfait: boolean;
    tournoi: string;
    phase: string;
  }>(
    `MATCH (v:Equipe)-[r:A_BATTU]->(p:Equipe) WHERE r.id_match > $base
     RETURN v.id_equipe AS vainqueur, p.id_equipe AS perdant, r.forfait AS forfait, r.tournoi AS tournoi,
            r.phase_type AS phase, toString(r.score_vainqueur) + '-' + toString(r.score_perdant) AS score`,
    { base: BASE },
  );
const nettoyer = () => cypher(`MATCH (e:Equipe) WHERE e.id_equipe > $base DETACH DELETE e`, { base: BASE });

beforeAll(async () => {
  process.env.NEO4J_PUSH = "on";
  await viderLaBase();
  await nettoyer();
  await pg.unsafe(`ALTER SEQUENCE equipe_id_equipe_seq RESTART ${BASE + 1};
                   ALTER SEQUENCE match_id_match_seq RESTART ${BASE + 1}`);
  const id = await creerCompte(
    { email: "orga@test.fr", nom: "Orga", motDePasse: "motdepasse-test" },
    "organisateur",
  );
  orga = await acteurParId(id);
  const jeu = await creerJeu();
  const idTournoi = await creerTournoi(orga, {
    idJeu: jeu,
    nom: "Coupe du graphe",
    lieu: "en ligne",
    dateDebut: "2026-11-20",
    dateFin: "2026-11-21",
    dotation: 0,
  });
  idPhase = await ajouterPhase(orga, { idTournoi, type: "elimination", format: 3 });
  await ouvrirInscriptions(orga, { idTournoi });
  nova = await creerEquipe(jeu, "Nova Test");
  orbit = await creerEquipe(jeu, "Orbit Test");
  for (const idEquipe of [nova, orbit]) await inscrireEquipe(orga, { idTournoi, idEquipe });
  await genererPhase(orga, { idPhase });
  [{ idMatch }] = await db.execute<{ idMatch: number }>(sql`SELECT id_match AS "idMatch" FROM match`);
});

afterAll(async () => {
  process.env.NEO4J_PUSH = "off";
  await nettoyer();
  await neo4jDriver().close();
});

describe("copie des requêtes d'Aurel (§ 6.3 : recopiées telles quelles)", () => {
  test("CYPHER et SQL de l'app sont identiques à ceux de modele/neo4j/importer.py", () => {
    const importer = readFileSync("../modele/neo4j/importer.py", "utf8").replace(/\r\n/g, "\n");
    for (const texte of [CYPHER_EQUIPES, CYPHER_VICTOIRES, SQL_EQUIPES, SQL_VICTOIRES])
      expect(importer).toContain(`"""${texte.replace(/\r\n/g, "\n")}"""`);
  });
});

describe("copie des requêtes Cypher Q6 à Q8 (O14)", () => {
  test("Q6, Q7 et Q8 de l'app sont le texte de modele/neo4j/requetes.cypher", () => {
    const fichier = readFileSync("../modele/neo4j/requetes.cypher", "utf8").replace(/\r\n/g, "\n");
    for (const q of [Q6, Q7, Q8]) expect(fichier).toContain(q.replace(/\r\n/g, "\n") + ";");
  });
});

describe("EF-14 · push Neo4j à la fin d'un match", () => {
  const manche = (pointsA: number, pointsB: number) =>
    saisirManche(orga, { idMatch, carte: "Ascent", pointsA, pointsB });

  test("tant que le match n'est pas terminé, aucune flèche", async () => {
    await manche(13, 5); // Nova (A) mène 1-0
    expect(await fleches()).toEqual([]);
  });

  test("un match terminé apparaît dans le graphe sans action manuelle, même pour des équipes créées dans l'app", async () => {
    await manche(13, 9); // 2-0 : terminé
    expect(await fleches()).toEqual([
      {
        vainqueur: nova,
        perdant: orbit,
        score: "2-0",
        forfait: false,
        tournoi: "Coupe du graphe",
        phase: "elimination",
      },
    ]);
    const [e] = await cypher<{ nom: string; jeu: string }>(
      `MATCH (e:Equipe {id_equipe: $id}) RETURN e.nom AS nom, e.jeu AS jeu`,
      { id: nova },
    );
    expect(e).toEqual({ nom: "Nova Test", jeu: "Valorant" });
  });

  test("si une correction change le vainqueur, l'ancienne flèche ne reste pas", async () => {
    const ids = await db.execute<{ id: number }>(sql`SELECT id_manche AS id FROM manche ORDER BY numero`);
    await corrigerManche(orga, { idManche: ids[0].id, carte: "Ascent", pointsA: 5, pointsB: 13 });
    expect(await fleches()).toEqual([]); // 1-1 : plus de vainqueur, plus de flèche
    await corrigerManche(orga, { idManche: ids[1].id, carte: "Ascent", pointsA: 5, pointsB: 13 });
    expect((await fleches()).map((f) => [f.vainqueur, f.perdant, f.score])).toEqual([[orbit, nova, "2-0"]]);
  });

  test("rejouer le push ne crée pas de doublon (MERGE sur id_match)", async () => {
    await pousserMatch(idMatch);
    await pousserMatch(idMatch);
    expect(await fleches()).toHaveLength(1);
  });

  test("Neo4j indisponible : l'erreur est journalisée et la saisie du score n'échoue pas", async () => {
    const journal = vi.spyOn(console, "error").mockImplementation(() => {});
    const enPanne = () => Promise.reject(new Error("Neo4j injoignable"));
    await expect(pousserMatch(idMatch, enPanne)).resolves.toBeUndefined();
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("Neo4j"), expect.anything());
    journal.mockRestore();
  });

  test("un forfait est une victoire dans le graphe, marquée forfait (RG12)", async () => {
    // Nouveau match dans une nouvelle phase n'est pas possible ici : on repart du même match non terminé.
    const ids = await db.execute<{ id: number }>(sql`SELECT id_manche AS id FROM manche ORDER BY numero`);
    await corrigerManche(orga, { idManche: ids[1].id, carte: "Ascent", pointsA: 13, pointsB: 5 }); // 1-1
    await declarerForfait(orga, { idMatch, idEquipe: orbit });
    expect((await fleches()).map((f) => [f.vainqueur, f.perdant, f.score, f.forfait])).toEqual([
      [nova, orbit, "2-0", true],
    ]);
  });
});
