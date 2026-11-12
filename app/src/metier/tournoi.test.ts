import { describe, expect, test } from "vitest";
import { obstaclesAuDemarrage, obstacleNouvellePhase } from "./tournoi";

describe("obstaclesAuDemarrage (EF-02, RG3, RG5)", () => {
  test("sans phase : le tournoi ne démarre pas (RG3)", () => {
    expect(obstaclesAuDemarrage({ nbPhases: 0, nbEquipes: 4 })).toEqual([
      "Le tournoi doit avoir au moins une phase (RG3).",
    ]);
  });

  test("avec une seule équipe : le tournoi ne démarre pas (RG5)", () => {
    expect(obstaclesAuDemarrage({ nbPhases: 1, nbEquipes: 1 })).toEqual([
      "Il faut au moins deux équipes inscrites pour jouer (RG5).",
    ]);
  });

  test("une phase et deux équipes : rien ne s'y oppose", () => {
    expect(obstaclesAuDemarrage({ nbPhases: 1, nbEquipes: 2 })).toEqual([]);
  });
});

describe("obstacleNouvellePhase (RG3, O3 : poules puis élimination, une phase de chaque type)", () => {
  test("on peut commencer par des poules ou par l'élimination", () => {
    expect(obstacleNouvellePhase([], "poules")).toBeNull();
    expect(obstacleNouvellePhase([], "elimination")).toBeNull();
  });

  test("l'élimination vient après les poules", () => {
    expect(obstacleNouvellePhase(["poules"], "elimination")).toBeNull();
  });

  test("pas de poules après l'élimination, ni deux phases du même type", () => {
    expect(obstacleNouvellePhase(["elimination"], "poules")).not.toBeNull();
    expect(obstacleNouvellePhase(["poules"], "poules")).not.toBeNull();
    expect(obstacleNouvellePhase(["poules", "elimination"], "elimination")).not.toBeNull();
  });
});
