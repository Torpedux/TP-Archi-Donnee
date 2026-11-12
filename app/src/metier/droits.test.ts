import { describe, expect, test } from "vitest";
import { peut, type Acteur } from "./droits";

// Cahier des charges § 3, matrice des droits. Une ligne de test par ligne de la matrice.
const visiteur: Acteur = null;
const membre: Acteur = { id: 1, role: "membre", idEquipe: null };
const capitaine: Acteur = { id: 2, role: "membre", idEquipe: 10 };
const organisateur: Acteur = { id: 3, role: "organisateur", idEquipe: null };
const admin: Acteur = { id: 4, role: "admin", idEquipe: null };

const sonTournoi = { idOrganisateur: 3 };
const autreTournoi = { idOrganisateur: 99 };
const tournoiImporte = { idOrganisateur: null };

describe("matrice des droits (EF-15)", () => {
  test("créer / modifier un jeu : admin seulement", () => {
    expect([visiteur, membre, capitaine, organisateur, admin].map((a) => peut(a, "jeu.gerer"))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  test("créer une équipe : un compte sans équipe (libre-service) ou l'admin, jamais un visiteur", () => {
    expect(peut(visiteur, "equipe.creer")).toBe(false);
    expect(peut(membre, "equipe.creer")).toBe(true);
    expect(peut(capitaine, "equipe.creer")).toBe(false); // il a déjà la sienne
    expect(peut(admin, "equipe.creer")).toBe(true);
  });

  test("gérer une équipe et ses joueurs : son capitaine ou l'admin", () => {
    expect(peut(capitaine, "equipe.gerer", { idEquipe: 10 })).toBe(true);
    expect(peut(capitaine, "equipe.gerer", { idEquipe: 11 })).toBe(false);
    expect(peut(organisateur, "equipe.gerer", { idEquipe: 10 })).toBe(false);
    expect(peut(visiteur, "equipe.gerer", { idEquipe: 10 })).toBe(false);
    expect(peut(admin, "equipe.gerer", { idEquipe: 11 })).toBe(true);
  });

  test("inscrire une équipe : son capitaine, l'organisateur du tournoi ou l'admin", () => {
    expect(peut(capitaine, "inscription.gerer", { idEquipe: 10, ...autreTournoi })).toBe(true);
    expect(peut(capitaine, "inscription.gerer", { idEquipe: 11, ...autreTournoi })).toBe(false);
    expect(peut(organisateur, "inscription.gerer", { idEquipe: 11, ...sonTournoi })).toBe(true);
    expect(peut(organisateur, "inscription.gerer", { idEquipe: 11, ...autreTournoi })).toBe(false);
    expect(peut(membre, "inscription.gerer", { idEquipe: 11, ...sonTournoi })).toBe(false);
    expect(peut(admin, "inscription.gerer", { idEquipe: 11, ...autreTournoi })).toBe(true);
  });

  test("créer un tournoi : organisateur ou admin", () => {
    expect([visiteur, membre, capitaine, organisateur, admin].map((a) => peut(a, "tournoi.creer"))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  test("gérer un tournoi (phases, têtes de série, génération, scores, forfaits) : son organisateur ou l'admin", () => {
    expect(peut(organisateur, "tournoi.gerer", sonTournoi)).toBe(true);
    expect(peut(organisateur, "tournoi.gerer", autreTournoi)).toBe(false);
    expect(peut(organisateur, "tournoi.gerer", tournoiImporte)).toBe(false);
    expect(peut(capitaine, "tournoi.gerer", sonTournoi)).toBe(false);
    expect(peut(visiteur, "tournoi.gerer", sonTournoi)).toBe(false);
    expect(peut(admin, "tournoi.gerer", tournoiImporte)).toBe(true);
  });

  test("attribuer un rôle : admin seulement", () => {
    expect([visiteur, membre, capitaine, organisateur, admin].map((a) => peut(a, "role.attribuer"))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });
});
