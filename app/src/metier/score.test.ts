import { describe, expect, test } from "vitest";
import { erreurManche, etatDuMatch, majorite, scoreForfait, sequenceValide } from "./score";

const m = (pointsA: number, pointsB: number) => ({ pointsA, pointsB });

describe("majorite (RG8)", () => {
  test("1 en BO1, 2 en BO3, 3 en BO5", () => {
    expect([1, 3, 5].map(majorite)).toEqual([1, 2, 3]);
  });
});

describe("erreurManche (EF-08, RG11)", () => {
  test("manche à égalité de points : refusée, pas de nul", () => {
    expect(erreurManche(m(13, 13))).toMatch(/égalité/);
  });
  test("points négatifs ou non entiers : refusés", () => {
    expect(erreurManche(m(-1, 5))).not.toBeNull();
    expect(erreurManche(m(1.5, 5))).not.toBeNull();
  });
  test("une manche avec un vainqueur est acceptée", () => {
    expect(erreurManche(m(13, 11))).toBeNull();
    expect(erreurManche(m(0, 1))).toBeNull();
  });
});

describe("etatDuMatch (EF-08 : le score est calculé, jamais saisi)", () => {
  test("le score de match est le nombre de manches gagnées (RG9)", () => {
    expect(etatDuMatch(5, [m(13, 5), m(8, 13), m(13, 11)])).toEqual({
      scoreA: 2,
      scoreB: 1,
      termine: false,
      vainqueur: null,
    });
  });
  test("BO3 : après 2 manches gagnées par la même équipe, le match est terminé", () => {
    expect(etatDuMatch(3, [m(13, 5), m(13, 9)])).toEqual({
      scoreA: 2,
      scoreB: 0,
      termine: true,
      vainqueur: "A",
    });
    expect(etatDuMatch(3, [m(13, 5), m(2, 13), m(4, 13)])).toMatchObject({ termine: true, vainqueur: "B" });
  });
  test("BO3 à une manche partout : pas terminé", () => {
    expect(etatDuMatch(3, [m(13, 5), m(2, 13)])).toMatchObject({ scoreA: 1, scoreB: 1, termine: false });
  });
  test("BO1 : une manche suffit ; aucune manche : 0-0", () => {
    expect(etatDuMatch(1, [m(1, 0)])).toMatchObject({ termine: true, vainqueur: "A" });
    expect(etatDuMatch(3, [])).toEqual({ scoreA: 0, scoreB: 0, termine: false, vainqueur: null });
  });
});

describe("sequenceValide (EF-08 : plus de manche après la majorité)", () => {
  test("aucune manche n'est jouée après qu'une équipe a atteint la majorité", () => {
    expect(sequenceValide(3, [m(13, 5), m(13, 9)])).toBe(true);
    expect(sequenceValide(3, [m(13, 5), m(13, 9), m(13, 2)])).toBe(false);
    expect(sequenceValide(3, [m(13, 5), m(5, 13), m(13, 2)])).toBe(true);
    expect(sequenceValide(1, [m(13, 5), m(5, 13)])).toBe(false);
  });
});

describe("scoreForfait (EF-09, RG12)", () => {
  test("l'adversaire gagne avec le score maximal du format : 1-0, 2-0, 3-0", () => {
    expect([1, 3, 5].map(scoreForfait)).toEqual([
      { vainqueur: 1, perdant: 0 },
      { vainqueur: 2, perdant: 0 },
      { vainqueur: 3, perdant: 0 },
    ]);
  });
});
