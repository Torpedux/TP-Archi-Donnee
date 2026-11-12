import { describe, expect, test } from "vitest";
import {
  deduireArbre,
  nbTours,
  nomDuTour,
  ordreDePlacement,
  premierTour,
  suivant,
  tailleArbre,
} from "./arbre";

describe("tailleArbre (EF-07)", () => {
  test("la puissance de 2 immédiatement supérieure ou égale", () => {
    expect([2, 3, 4, 5, 6, 8, 9, 16].map(tailleArbre)).toEqual([2, 4, 4, 8, 8, 8, 16, 16]);
  });
  test("nombre de tours", () => {
    expect([2, 4, 8, 16].map(nbTours)).toEqual([1, 2, 3, 4]);
  });
});

describe("ordreDePlacement (EF-07)", () => {
  test("placement standard pour 8 : 1 contre 8, 4 contre 5, 2 contre 7, 3 contre 6", () => {
    expect(ordreDePlacement(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  test("pour 4 : 1 contre 4, 2 contre 3 ; pour 2 : la finale", () => {
    expect(ordreDePlacement(4)).toEqual([1, 4, 2, 3]);
    expect(ordreDePlacement(2)).toEqual([1, 2]);
  });
  test("les têtes de série 1 et 2 ne peuvent se rencontrer qu'en finale", () => {
    const o = ordreDePlacement(16);
    expect(o.indexOf(1) < 8).not.toBe(o.indexOf(2) < 8);
  });
});

describe("premierTour (EF-07, RG9)", () => {
  test("8 équipes : 4 matchs, aucun exempt", () => {
    const t = premierTour([11, 12, 13, 14, 15, 16, 17, 18]);
    expect(t).toEqual([
      { position: 1, equipes: [11, 18] },
      { position: 2, equipes: [14, 15] },
      { position: 3, equipes: [12, 17] },
      { position: 4, equipes: [13, 16] },
    ]);
  });

  test("6 équipes : arbre de 8, têtes de série 1 et 2 exemptées, 2 matchs au premier tour", () => {
    const t = premierTour([11, 12, 13, 14, 15, 16]);
    expect(t).toEqual([
      { position: 1, exempt: 11 },
      { position: 2, equipes: [14, 15] },
      { position: 3, exempt: 12 },
      { position: 4, equipes: [13, 16] },
    ]);
    expect(t.filter((e) => "equipes" in e)).toHaveLength(2);
  });

  test("un exempt n'est jamais un match à une équipe (RG9)", () => {
    for (const n of [2, 3, 5, 6, 7, 9]) {
      const ids = Array.from({ length: n }, (_, i) => i + 1);
      for (const e of premierTour(ids)) if ("equipes" in e) expect(new Set(e.equipes).size).toBe(2);
    }
  });

  test("4 qualifiés classés : 1er contre 4e, 2e contre 3e", () => {
    expect(premierTour([1, 2, 3, 4])).toEqual([
      { position: 1, equipes: [1, 4] },
      { position: 2, equipes: [2, 3] },
    ]);
  });
});

describe("suivant", () => {
  test("les positions 1 et 2 d'un tour alimentent la position 1 du tour suivant", () => {
    expect(suivant({ tour: 1, position: 1 })).toEqual({ tour: 2, position: 1 });
    expect(suivant({ tour: 1, position: 2 })).toEqual({ tour: 2, position: 1 });
    expect(suivant({ tour: 1, position: 3 })).toEqual({ tour: 2, position: 2 });
    expect(suivant({ tour: 2, position: 2 })).toEqual({ tour: 3, position: 1 });
  });
});

describe("nomDuTour", () => {
  test("nommé d'après ce qu'il reste à jouer", () => {
    expect([1, 2, 3].map((t) => nomDuTour(t, 3))).toEqual(["Quarts de finale", "Demi-finales", "Finale"]);
    expect(nomDuTour(1, 4)).toBe("Huitièmes de finale");
    expect(nomDuTour(1, 5)).toBe("Tour 1");
  });
});

describe("deduireArbre (tournois du générateur, sans emplacement)", () => {
  test("deux demi-finales puis une finale", () => {
    const arbre = deduireArbre([
      { idMatch: 3, dateHeure: "2026-01-12 18:00:00", equipes: [1, 2] },
      { idMatch: 1, dateHeure: "2026-01-11 14:00:00", equipes: [1, 4] },
      { idMatch: 2, dateHeure: "2026-01-11 17:00:00", equipes: [2, 3] },
    ]);
    expect(arbre).toEqual([
      { tour: 1, position: 1, idMatch: 1, exempt: null },
      { tour: 1, position: 2, idMatch: 2, exempt: null },
      { tour: 2, position: 1, idMatch: 3, exempt: null },
    ]);
  });

  test("une équipe sans match avant sa demi-finale était exemptée", () => {
    const arbre = deduireArbre([
      { idMatch: 1, dateHeure: "2026-01-11 14:00:00", equipes: [2, 3] },
      { idMatch: 2, dateHeure: "2026-01-12 18:00:00", equipes: [1, 2] },
    ]);
    expect(arbre).toEqual([
      { tour: 1, position: 1, idMatch: null, exempt: 1 },
      { tour: 1, position: 2, idMatch: 1, exempt: null },
      { tour: 2, position: 1, idMatch: 2, exempt: null },
    ]);
  });

  test("une finale seule", () => {
    expect(deduireArbre([{ idMatch: 9, dateHeure: "2026-01-12 18:00:00", equipes: [1, 2] }])).toEqual([
      { tour: 1, position: 1, idMatch: 9, exempt: null },
    ]);
  });

  test("aucun match : aucun emplacement", () => {
    expect(deduireArbre([])).toEqual([]);
  });
});
