import { afterAll, beforeAll, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db, pg } from "@/db/client";
import { cypher, neo4jDriver } from "@/db/neo4j";
import type { Acteur } from "@/metier/droits";
import { classementPoule } from "@/requetes/classement";
import { palmares } from "@/requetes/equipes";
import { Q6 } from "@/requetes/cypher-copie";
import { acteurParId, creerCompte } from "@/services/comptes";
import { abonner, type Evenement } from "@/services/direct";
import { declarerForfait, genererPhase, saisirManche } from "@/services/moteur";
import {
  ajouterPhase,
  creerTournoi,
  inscrireEquipe,
  ordonnerTetesDeSerie,
  ouvrirInscriptions,
} from "@/services/tournois";
import { creerEquipe, creerJeu, viderLaBase } from "./outils";

// Cahier des charges § 10 : le scénario de démo, étapes 2 à 8, rejoué par les services que les
// Server Actions appellent, sur PostgreSQL et Neo4j. (L'étape 1, la connexion, est un écran.)
// Identifiants à partir de 900 001 dans Neo4j, nettoyés à la fin : la base de démo n'est pas touchée.
const BASE = 900_000;
let orga: Acteur;
const nettoyer = () => cypher(`MATCH (e:Equipe) WHERE e.id_equipe > $base DETACH DELETE e`, { base: BASE });

type M = { idMatch: number; format: number; a: number; b: number; statut: string };
const matchs = async (idPhase: number) => [
  ...(await db.execute<M>(sql`
    SELECT m.id_match AS "idMatch", m.format, m.statut, min(d.id_equipe) AS a, max(d.id_equipe) AS b
    FROM match m JOIN disputer d USING (id_match) WHERE m.id_phase = ${idPhase}
    GROUP BY m.id_match ORDER BY m.id_match`)),
];
async function jouer(m: M, vainqueur: number) {
  for (let i = 0; i < Math.floor(m.format / 2) + 1; i++)
    await saisirManche(orga, {
      idMatch: m.idMatch,
      carte: "Ascent",
      pointsA: vainqueur === m.a ? 13 : 6,
      pointsB: vainqueur === m.b ? 13 : 6,
    });
}

beforeAll(async () => {
  process.env.NEO4J_PUSH = "on";
  await viderLaBase();
  await nettoyer();
  await pg.unsafe(`ALTER SEQUENCE equipe_id_equipe_seq RESTART ${BASE + 1};
                   ALTER SEQUENCE match_id_match_seq RESTART ${BASE + 1}`);
  orga = await acteurParId(
    await creerCompte({ email: "orga@test.fr", nom: "Orga", motDePasse: "motdepasse-test" }, "organisateur"),
  );
});
afterAll(async () => {
  process.env.NEO4J_PUSH = "off";
  await nettoyer();
  await neo4jDriver().close();
});

test("scénario de démo du § 10, étapes 2 à 8", async () => {
  const jeu = await creerJeu("Valorant");
  const equipes: number[] = [];
  for (let i = 1; i <= 6; i++) equipes.push(await creerEquipe(jeu, `Scénario ${i}`));
  const [e1, e2, e3, e4, e5] = equipes;

  // 2. Créer le tournoi « Ynov Cup » sur un jeu existant : poules (BO1, 4 qualifiés) puis élimination (BO3).
  const idTournoi = await creerTournoi(orga, {
    idJeu: jeu,
    nom: "Ynov Cup",
    lieu: "Ynov Paris",
    dateDebut: "2026-11-20",
    dateFin: "2026-11-24",
    dotation: 1000,
  });
  const poules = await ajouterPhase(orga, { idTournoi, type: "poules", format: 1, nbQualifies: 4 });
  const elimination = await ajouterPhase(orga, { idTournoi, type: "elimination", format: 3 });

  // 3. Ouvrir les inscriptions ; inscrire 6 équipes ; ordonner les têtes de série.
  await ouvrirInscriptions(orga, { idTournoi });
  for (const idEquipe of [...equipes].reverse()) await inscrireEquipe(orga, { idTournoi, idEquipe });
  await ordonnerTetesDeSerie(orga, { idTournoi, idsEquipes: equipes });

  // 4. Générer la poule : 15 matchs créés.
  await genererPhase(orga, { idPhase: poules });
  const dePoule = await matchs(poules);
  expect(dePoule).toHaveLength(15);

  // 6. Un visiteur a le classement ouvert dans un second navigateur : il reçoit chaque saisie en direct.
  const recus: Evenement[] = [];
  const fermer = abonner((e) => recus.push(e));

  // 5. Saisir quelques résultats, dont un forfait ; le classement de poule se met à jour.
  const premier = dePoule.find((m) => m.a === e1 && m.b === e2)!;
  await jouer(premier, e1);
  const forfait = dePoule.find((m) => m.a === e1 && m.b === e5)!;
  await declarerForfait(orga, { idMatch: forfait.idMatch, idEquipe: e5 });
  let classement = await classementPoule(poules);
  expect(classement[0]).toMatchObject({ idEquipe: e1, joues: 2, victoires: 2 });
  expect(classement.find((l) => l.idEquipe === e5)).toMatchObject({ joues: 1, defaites: 1 });
  expect(recus).toEqual([
    { idTournoi, idMatch: premier.idMatch },
    { idTournoi, idMatch: forfait.idMatch },
  ]);
  fermer();

  // 7. Terminer les poules, générer l'arbre (4 qualifiés), jouer demi-finales et finale.
  for (const m of (await matchs(poules)).filter((x) => x.statut === "prevu"))
    await jouer(m, Math.min(m.a, m.b));
  classement = await classementPoule(poules);
  expect(classement.map((l) => l.idEquipe)).toEqual(equipes);
  await genererPhase(orga, { idPhase: elimination });
  const demis = await matchs(elimination);
  expect(demis.map((m) => [m.a, m.b])).toEqual([
    [e1, e4],
    [e2, e3],
  ]);
  await jouer(demis[0], e1);
  await jouer(demis[1], e3);
  const finale = (await matchs(elimination))[2];
  expect([finale.a, finale.b]).toEqual([e1, e3]);
  await jouer(finale, e3);

  // 8. Le palmarès du vainqueur affiche « Ynov Cup » ; le graphe montre ses victoires.
  expect((await palmares(e3)).map((t) => t.tournoi)).toEqual(["Ynov Cup"]);
  const battues = await cypher<{ battue: string; tournoi: string; phase: string }>(Q6, {
    equipe: "Scénario 3",
  });
  expect(battues.filter((b) => b.phase === "elimination").map((b) => b.battue)).toEqual([
    "Scénario 2",
    "Scénario 1",
  ]);
  expect(battues.every((b) => b.tournoi === "Ynov Cup")).toBe(true);
  // Le forfait de la poule est une victoire dans le graphe, marquée forfait (RG12).
  const [f] = await cypher<{ forfait: boolean }>(
    `MATCH (:Equipe {nom: 'Scénario 1'})-[r:A_BATTU]->(:Equipe {nom: 'Scénario 5'}) RETURN r.forfait AS forfait`,
  );
  expect(f.forfait).toBe(true);
});
