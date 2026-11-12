import { describe, expect, test } from "vitest";
import { conflitAppartenance, type Periode } from "./appartenance";

const periode = (idJeu: number, dateEntree: string, dateSortie: string | null = null): Periode => ({
  idJeu,
  dateEntree,
  dateSortie,
});

// RG7 : à un instant donné, un joueur est dans au plus une équipe par jeu.
describe("conflitAppartenance (EF-04, RG7)", () => {
  test("même jeu, périodes qui se chevauchent : conflit", () => {
    const existantes = [periode(1, "2025-01-01", "2025-06-30")];
    expect(conflitAppartenance(periode(1, "2025-06-01", "2025-12-31"), existantes)).toEqual(existantes[0]);
  });

  test("même jeu, période existante encore ouverte : conflit", () => {
    const existantes = [periode(1, "2025-01-01")];
    expect(conflitAppartenance(periode(1, "2026-01-01"), existantes)).toEqual(existantes[0]);
  });

  test("même jeu, nouvelle période ouverte qui englobe une période future : conflit", () => {
    const existantes = [periode(1, "2026-03-01", "2026-04-01")];
    expect(conflitAppartenance(periode(1, "2026-01-01"), existantes)).toEqual(existantes[0]);
  });

  test("même jeu, le jour de sortie est encore dans l'équipe : conflit le même jour", () => {
    expect(
      conflitAppartenance(periode(1, "2025-06-30"), [periode(1, "2025-01-01", "2025-06-30")]),
    ).not.toBeNull();
  });

  test("même jeu, périodes qui se suivent : pas de conflit", () => {
    expect(
      conflitAppartenance(periode(1, "2025-07-01"), [periode(1, "2025-01-01", "2025-06-30")]),
    ).toBeNull();
  });

  test("jeux différents en même temps : accepté", () => {
    expect(conflitAppartenance(periode(2, "2025-03-01"), [periode(1, "2025-01-01")])).toBeNull();
  });
});
