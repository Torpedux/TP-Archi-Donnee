import { beforeAll, expect, test } from "vitest";
import {
  appartenir,
  creerEquipe,
  creerJeu,
  creerJoueur,
  creerPhase,
  creerTournoi,
  inscrire,
  matchTermine,
  viderLaBase,
} from "../../tests/outils";
import { classementPoule } from "./classement";
import { anciensJoueurs, effectifActuel, historiqueEquipe, palmares } from "./equipes";
import { matchsJoueur } from "./joueurs";
import { rechercher } from "./recherche";

// Un tournoi : poule de 3 équipes (Nova, Orbit, Titans), puis finale Nova–Orbit.
let nova: number, orbit: number, titans: number, poules: number, blitz: number;

beforeAll(async () => {
  await viderLaBase();
  const jeu = await creerJeu();
  nova = await creerEquipe(jeu, "Nova");
  orbit = await creerEquipe(jeu, "Orbit");
  titans = await creerEquipe(jeu, "Titans");
  const tournoi = await creerTournoi(jeu, "Winter Cup");
  for (const [i, e] of [nova, orbit, titans].entries()) await inscrire(tournoi, e, i + 1);
  poules = await creerPhase(tournoi, "poules", 1);
  const finale = await creerPhase(tournoi, "elimination", 2);
  await matchTermine(poules, nova, orbit, 2, 1, "2026-01-10 10:00:00");
  await matchTermine(poules, nova, titans, 2, 0, "2026-01-10 11:00:00", titans); // forfait de Titans
  await matchTermine(poules, orbit, titans, 2, 0, "2026-01-10 12:00:00");
  await matchTermine(finale, nova, orbit, 1, 2, "2026-01-12 18:00:00");
  // Blitz : chez Nova jusqu'au 10/01 inclus, puis chez Orbit.
  blitz = await creerJoueur("Blitz");
  await appartenir(blitz, nova, "2025-01-01", "2026-01-10");
  await appartenir(blitz, orbit, "2026-01-11");
});

test("Q1 : classement de la poule, forfait compté comme une victoire au score maximal", async () => {
  const c = await classementPoule(poules);
  expect(c.map((l) => l.equipe)).toEqual(["Nova", "Orbit", "Titans"]);
  expect(c[0]).toMatchObject({
    joues: 2,
    victoires: 2,
    defaites: 0,
    manchesGagnees: 4,
    manchesPerdues: 1,
    difference: 3,
  });
  expect(c[2]).toMatchObject({ joues: 2, victoires: 0, defaites: 2, difference: -4 });
});

test("Q2 : historique d'une équipe, trié par date, avec adversaire, score et tournoi", async () => {
  const h = await historiqueEquipe(orbit);
  expect(h.map((l) => [l.adversaire, l.score, l.scoreAdverse, l.phase])).toEqual([
    ["Nova", 1, 2, "poules"],
    ["Titans", 2, 0, "poules"],
    ["Nova", 2, 1, "elimination"],
  ]);
  expect(h[0].tournoi).toBe("Winter Cup");
});

test("Q3 : matchs d'un joueur, seulement pendant ses périodes d'appartenance", async () => {
  const m = await matchsJoueur(blitz);
  // Chez Nova le 10/01 (2 matchs de poule), chez Orbit pour la finale du 12/01 ; pas Orbit–Titans du 10/01.
  expect(m.map((l) => [l.equipe, l.adversaire])).toEqual([
    ["Orbit", "Nova"],
    ["Nova", "Titans"],
    ["Nova", "Orbit"],
  ]);
});

test("Q4 : effectif actuel = joueurs sans date de sortie ; les autres sont d'anciens joueurs", async () => {
  expect((await effectifActuel(orbit)).map((j) => j.pseudo)).toEqual(["Blitz"]);
  expect(await effectifActuel(nova)).toEqual([]);
  expect((await anciensJoueurs(nova)).map((j) => j.pseudo)).toEqual(["Blitz"]);
});

test("Q5 : palmarès = vainqueur du dernier match de la phase d'ordre maximal", async () => {
  expect((await palmares()).map((t) => [t.tournoi, t.vainqueur])).toEqual([["Winter Cup", "Orbit"]]);
  expect(await palmares(nova)).toEqual([]);
  expect((await palmares(orbit)).length).toBe(1);
});

test("EF-12 : recherche par nom d'équipe, pseudo de joueur et nom de tournoi", async () => {
  expect((await rechercher("nov")).map((r) => [r.type, r.libelle])).toEqual([["equipe", "Nova"]]);
  expect((await rechercher("blit")).map((r) => [r.type, r.libelle])).toEqual([["joueur", "Blitz"]]);
  expect((await rechercher("winter")).map((r) => [r.type, r.libelle])).toEqual([["tournoi", "Winter Cup"]]);
  expect(await rechercher("x")).toEqual([]);
});
