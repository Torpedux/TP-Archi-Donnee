import { describe, expect, test } from "vitest";
import { trierClassement, type LigneClassement } from "./classement";

const ligne = (idEquipe: number, victoires: number, difference: number, teteDeSerie: number | null = null) =>
  ({ idEquipe, victoires, difference, teteDeSerie }) satisfies LigneClassement;
const ordre = (lignes: LigneClassement[]) => lignes.map((l) => l.idEquipe);

// EF-11 / O4 : victoires, puis différence de manches, puis confrontation directe, puis tête de série.
describe("trierClassement", () => {
  test("le plus de victoires passe devant", () => {
    expect(ordre(trierClassement([ligne(1, 1, 5), ligne(2, 3, -2)], []))).toEqual([2, 1]);
  });

  test("à victoires égales, la meilleure différence de manches passe devant", () => {
    expect(ordre(trierClassement([ligne(1, 2, 0), ligne(2, 2, 3)], []))).toEqual([2, 1]);
  });

  test("à égalité parfaite, le vainqueur de la confrontation directe passe devant", () => {
    const duels = [{ vainqueur: 2, perdant: 1 }];
    expect(ordre(trierClassement([ligne(1, 2, 1, 1), ligne(2, 2, 1, 2)], duels))).toEqual([2, 1]);
  });

  test("si la confrontation directe ne départage pas, la tête de série décide", () => {
    // 1 bat 2, 2 bat 3, 3 bat 1 : un duel gagné chacun
    const duels = [
      { vainqueur: 1, perdant: 2 },
      { vainqueur: 2, perdant: 3 },
      { vainqueur: 3, perdant: 1 },
    ];
    const lignes = [ligne(1, 1, 0, 3), ligne(2, 1, 0, 1), ligne(3, 1, 0, 2)];
    expect(ordre(trierClassement(lignes, duels))).toEqual([2, 3, 1]);
  });

  test("un duel hors du groupe à égalité ne compte pas", () => {
    // 3 a battu 1, mais 3 n'est pas à égalité avec 1 et 2
    const duels = [{ vainqueur: 3, perdant: 1 }];
    const lignes = [ligne(1, 2, 0, 1), ligne(2, 2, 0, 2), ligne(3, 0, -4, 3)];
    expect(ordre(trierClassement(lignes, duels))).toEqual([1, 2, 3]);
  });
});
