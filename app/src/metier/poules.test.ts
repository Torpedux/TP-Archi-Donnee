import { describe, expect, test } from "vitest";
import { creneaux, pairesRoundRobin } from "./poules";

const cle = ([a, b]: [number, number]) => [a, b].sort((x, y) => x - y).join("-");

describe("pairesRoundRobin (EF-06, RG9)", () => {
  test("pour 4 équipes, 6 matchs, chaque paire une seule fois", () => {
    const paires = pairesRoundRobin([10, 20, 30, 40]);
    expect(paires).toHaveLength(6);
    expect(new Set(paires.map(cle))).toEqual(new Set(["10-20", "10-30", "10-40", "20-30", "20-40", "30-40"]));
  });

  test("n(n−1)/2 matchs, y compris pour un nombre impair d'équipes", () => {
    for (const n of [2, 3, 5, 6, 8]) {
      const ids = Array.from({ length: n }, (_, i) => i + 1);
      const paires = pairesRoundRobin(ids);
      expect(paires).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(paires.map(cle)).size).toBe(paires.length);
      expect(paires.every(([a, b]) => a !== b)).toBe(true); // RG9 : deux équipes différentes
    }
  });

  test("6 équipes : 15 matchs (scénario de démo)", () => {
    expect(pairesRoundRobin([1, 2, 3, 4, 5, 6])).toHaveLength(15);
  });

  test("une équipe ne joue pas deux matchs de suite dans une même journée de poule", () => {
    const paires = pairesRoundRobin([1, 2, 3, 4]);
    // 3 journées de 2 matchs : dans chaque journée, 4 équipes différentes
    for (let j = 0; j < 3; j++) expect(new Set(paires.slice(j * 2, j * 2 + 2).flat()).size).toBe(4);
  });
});

describe("creneaux (EF-06)", () => {
  test("un match par heure de 10h à 19h, puis le lendemain", () => {
    const c = creneaux("2026-11-20", 12);
    expect(c[0]).toBe("2026-11-20 10:00:00");
    expect(c[9]).toBe("2026-11-20 19:00:00");
    expect(c[10]).toBe("2026-11-21 10:00:00");
    expect(c[11]).toBe("2026-11-21 11:00:00");
  });

  test("passe correctement une fin de mois", () => {
    expect(creneaux("2026-11-30", 11)[10]).toBe("2026-12-01 10:00:00");
  });
});
