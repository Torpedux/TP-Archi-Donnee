import { beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Acteur } from "@/metier/droits";
import { creerEquipe as equipeBrute, creerPhase, matchTermine, viderLaBase } from "../../tests/outils";
import { attribuerRole, creerCompte, verifierIdentifiants, acteurParId } from "./comptes";
import { ajouterJoueur, creerEquipe, creerJoueur, modifierEquipe, sortirJoueur } from "./equipes";
import { creerJeu, supprimerJeu } from "./jeux";
import {
  ajouterPhase,
  creerTournoi,
  fixerTeteDeSerie,
  inscrireEquipe,
  ordonnerTetesDeSerie,
  ouvrirInscriptions,
} from "./tournois";

// Les ✔ des EF-01 à EF-05 et EF-15, par les services (ceux que les Server Actions appellent).
let admin: Acteur, orga: Acteur, membre: Acteur;
let valorant: number, rocket: number;

async function compte(email: string, role: "membre" | "organisateur" | "admin"): Promise<Acteur> {
  const id = await creerCompte({ email, nom: email.split("@")[0], motDePasse: "motdepasse-test" });
  await db.execute(sql`UPDATE app.utilisateur SET role = ${role} WHERE id_utilisateur = ${id}`);
  return acteurParId(id);
}

const tournoi = (idJeu: number, nom = "Ynov Cup") =>
  ({ idJeu, nom, lieu: "en ligne", dateDebut: "2026-11-20", dateFin: "2026-11-22", dotation: 1000 }) as const;
const equipe = (idJeu: number, nom: string) => ({ idJeu, nom, tag: nom.slice(0, 4), pays: "FR" });

beforeEach(async () => {
  await viderLaBase();
  admin = await compte("admin@test.fr", "admin");
  orga = await compte("orga@test.fr", "organisateur");
  membre = await compte("membre@test.fr", "membre");
  valorant = await creerJeu(admin, { nom: "Valorant", editeur: "Riot Games" });
  rocket = await creerJeu(admin, { nom: "Rocket League", editeur: "Psyonix" });
});

describe("EF-01 · Jeux (RG1)", () => {
  test("créer un jeu avec un nom déjà pris est refusé avec un message clair", async () => {
    await expect(creerJeu(admin, { nom: "Valorant", editeur: "Autre" })).rejects.toThrow(
      "Un jeu porte déjà ce nom.",
    );
  });

  test("un jeu qui a des équipes ou des tournois ne peut pas être supprimé", async () => {
    await creerEquipe(admin, equipe(valorant, "Nova"));
    await expect(supprimerJeu(admin, { idJeu: valorant })).rejects.toThrow(/ne peut pas être supprimé/);
    await supprimerJeu(admin, { idJeu: rocket }); // sans dépendance : accepté
  });

  test("seul l'admin gère les jeux", async () => {
    await expect(creerJeu(orga, { nom: "Dota 2", editeur: "Valve" })).rejects.toThrow("Accès refusé.");
  });
});

describe("EF-02 · Tournois et phases (RG2, RG3)", () => {
  test("date de fin avant la date de début : refusé", async () => {
    await expect(creerTournoi(orga, { ...tournoi(valorant), dateFin: "2026-11-19" })).rejects.toThrow(
      "La date de fin ne peut pas précéder la date de début.",
    );
  });

  test("un tournoi créé est un brouillon qui appartient à son organisateur", async () => {
    const id = await creerTournoi(orga, tournoi(valorant));
    const [r] = await db.execute(
      sql`SELECT etat, id_organisateur FROM app.reglage_tournoi WHERE id_tournoi = ${id}`,
    );
    expect(r).toEqual({ etat: "brouillon", id_organisateur: orga!.id });
  });

  test("phases ordonnées : poules puis élimination, avec format et nombre de qualifiés", async () => {
    const id = await creerTournoi(orga, tournoi(valorant));
    await ajouterPhase(orga, { idTournoi: id, type: "poules", format: 1, nbQualifies: 4 });
    await ajouterPhase(orga, { idTournoi: id, type: "elimination", format: 3 });
    const phases = await db.execute(sql`
      SELECT ph.type, ph.ordre, rp.format, rp.nb_qualifies FROM phase ph JOIN app.reglage_phase rp USING (id_phase)
      WHERE ph.id_tournoi = ${id} ORDER BY ph.ordre`);
    expect([...phases]).toEqual([
      { type: "poules", ordre: 1, format: 1, nb_qualifies: 4 },
      { type: "elimination", ordre: 2, format: 3, nb_qualifies: null },
    ]);
    await expect(
      ajouterPhase(orga, { idTournoi: id, type: "poules", format: 1, nbQualifies: 2 }),
    ).rejects.toThrow();
  });

  test("un organisateur ne gère pas le tournoi d'un autre", async () => {
    const id = await creerTournoi(admin, tournoi(valorant));
    await expect(ajouterPhase(orga, { idTournoi: id, type: "elimination", format: 3 })).rejects.toThrow(
      "Accès refusé.",
    );
  });
});

describe("EF-03 · Équipes (RG4)", () => {
  test("nom d'équipe unique", async () => {
    await creerEquipe(admin, equipe(valorant, "Nova"));
    await expect(creerEquipe(admin, equipe(rocket, "Nova"))).rejects.toThrow("Une équipe porte déjà ce nom.");
  });

  test("libre-service : un compte sans équipe crée la sienne et en devient capitaine", async () => {
    const id = await creerEquipe(membre, equipe(valorant, "Orbit"));
    expect((await acteurParId(membre!.id))!.idEquipe).toBe(id);
    await expect(creerEquipe(await acteurParId(membre!.id), equipe(valorant, "Autre"))).rejects.toThrow(
      "Accès refusé.",
    );
  });

  test("une équipe ne change pas de jeu une fois qu'elle a disputé un match", async () => {
    const nova = await creerEquipe(admin, equipe(valorant, "Nova"));
    const orbit = await creerEquipe(admin, equipe(valorant, "Orbit"));
    await modifierEquipe(admin, { ...equipe(rocket, "Nova"), idEquipe: nova }); // aucun match : accepté
    await modifierEquipe(admin, { ...equipe(valorant, "Nova"), idEquipe: nova });
    const t = await creerTournoi(admin, tournoi(valorant));
    await matchTermine(await creerPhase(t, "poules", 1), nova, orbit, 2, 0);
    await expect(modifierEquipe(admin, { ...equipe(rocket, "Nova"), idEquipe: nova })).rejects.toThrow(
      /ne peut plus changer de jeu/,
    );
  });
});

describe("EF-04 · Joueurs et appartenances (RG6, RG7)", () => {
  const blitz = { pseudo: "Blitz", nom: "Martin", prenom: "Léa", pays: "FR", neLe: "2002-05-01" };

  test("pseudo unique", async () => {
    await creerJoueur(admin, blitz);
    await expect(creerJoueur(admin, blitz)).rejects.toThrow("Ce pseudo est déjà pris.");
  });

  test("déjà dans une autre équipe du même jeu sur une période qui chevauche : refusé", async () => {
    const idJoueur = await creerJoueur(admin, blitz);
    const nova = await creerEquipe(admin, equipe(valorant, "Nova"));
    const orbit = await creerEquipe(admin, equipe(valorant, "Orbit"));
    await ajouterJoueur(admin, {
      idEquipe: nova,
      pseudo: "Blitz",
      dateEntree: "2026-01-01",
      role: "titulaire",
    });
    await expect(
      ajouterJoueur(admin, { idEquipe: orbit, pseudo: "Blitz", dateEntree: "2026-06-01", role: "titulaire" }),
    ).rejects.toThrow(/déjà dans l'équipe Nova/);
    // Après sa sortie de Nova, l'entrée chez Orbit passe.
    await sortirJoueur(admin, {
      idEquipe: nova,
      idJoueur,
      dateEntree: "2026-01-01",
      dateSortie: "2026-05-31",
    });
    await ajouterJoueur(admin, {
      idEquipe: orbit,
      pseudo: "Blitz",
      dateEntree: "2026-06-01",
      role: "titulaire",
    });
  });

  test("le même joueur dans deux équipes de jeux différents en même temps : accepté", async () => {
    await creerJoueur(admin, blitz);
    const nova = await creerEquipe(admin, equipe(valorant, "Nova"));
    const fusee = await creerEquipe(admin, equipe(rocket, "Fusée"));
    await ajouterJoueur(admin, {
      idEquipe: nova,
      pseudo: "Blitz",
      dateEntree: "2026-01-01",
      role: "titulaire",
    });
    await ajouterJoueur(admin, {
      idEquipe: fusee,
      pseudo: "Blitz",
      dateEntree: "2026-02-01",
      role: "remplaçant",
    });
    const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM appartenir`);
    expect(n).toBe(2);
  });

  test("un capitaine ne touche pas à l'effectif d'une autre équipe", async () => {
    await creerJoueur(admin, blitz);
    const nova = await creerEquipe(admin, equipe(valorant, "Nova"));
    await creerEquipe(membre, equipe(valorant, "Orbit"));
    const capitaine = await acteurParId(membre!.id);
    await expect(
      ajouterJoueur(capitaine, {
        idEquipe: nova,
        pseudo: "Blitz",
        dateEntree: "2026-01-01",
        role: "titulaire",
      }),
    ).rejects.toThrow("Accès refusé.");
  });
});

describe("EF-05 · Inscriptions et têtes de série (RG2, RG4, RG5)", () => {
  let idTournoi: number, nova: number, orbit: number;

  beforeEach(async () => {
    idTournoi = await creerTournoi(orga, tournoi(valorant));
    nova = await equipeBrute(valorant, "Nova");
    orbit = await equipeBrute(valorant, "Orbit");
  });

  test("pas d'inscription tant que les inscriptions ne sont pas ouvertes", async () => {
    await expect(inscrireEquipe(orga, { idTournoi, idEquipe: nova })).rejects.toThrow(
      /inscriptions ne sont pas ouvertes/,
    );
  });

  test("inscription : la date est automatique", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    await inscrireEquipe(orga, { idTournoi, idEquipe: nova });
    const [r] = await db.execute<{ ok: boolean }>(
      sql`SELECT date_inscription = current_date AS ok FROM inscrire WHERE id_equipe = ${nova}`,
    );
    expect(r.ok).toBe(true);
  });

  test("inscrire une équipe d'un autre jeu que celui du tournoi : refusé", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    const fusee = await equipeBrute(rocket, "Fusée");
    await expect(inscrireEquipe(orga, { idTournoi, idEquipe: fusee })).rejects.toThrow(
      /n'évolue pas sur le jeu/,
    );
  });

  test("inscrire deux fois la même équipe : refusé", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    await inscrireEquipe(orga, { idTournoi, idEquipe: nova });
    await expect(inscrireEquipe(orga, { idTournoi, idEquipe: nova })).rejects.toThrow(
      "Cette équipe est déjà inscrite à ce tournoi.",
    );
  });

  test("deux équipes avec la même tête de série dans un tournoi : refusé", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    await inscrireEquipe(orga, { idTournoi, idEquipe: nova });
    await inscrireEquipe(orga, { idTournoi, idEquipe: orbit });
    await fixerTeteDeSerie(orga, { idTournoi, idEquipe: nova, teteDeSerie: 1 });
    await expect(fixerTeteDeSerie(orga, { idTournoi, idEquipe: orbit, teteDeSerie: 1 })).rejects.toThrow(
      "Cette tête de série est déjà attribuée dans ce tournoi.",
    );
  });

  test("l'organisateur ordonne les têtes de série d'un coup", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    await inscrireEquipe(orga, { idTournoi, idEquipe: nova });
    await inscrireEquipe(orga, { idTournoi, idEquipe: orbit });
    await ordonnerTetesDeSerie(orga, { idTournoi, idsEquipes: [nova, orbit] });
    await ordonnerTetesDeSerie(orga, { idTournoi, idsEquipes: [orbit, nova] });
    const r = await db.execute(sql`SELECT id_equipe, tete_de_serie FROM inscrire ORDER BY tete_de_serie`);
    expect([...r]).toEqual([
      { id_equipe: orbit, tete_de_serie: 1 },
      { id_equipe: nova, tete_de_serie: 2 },
    ]);
  });

  test("un capitaine inscrit sa propre équipe, pas celle d'un autre", async () => {
    await ouvrirInscriptions(orga, { idTournoi });
    const sienne = await creerEquipe(membre, equipe(valorant, "Titans"));
    const capitaine = await acteurParId(membre!.id);
    await inscrireEquipe(capitaine, { idTournoi, idEquipe: sienne });
    await expect(inscrireEquipe(capitaine, { idTournoi, idEquipe: nova })).rejects.toThrow("Accès refusé.");
  });
});

describe("EF-15 · Comptes et rôles", () => {
  test("le mot de passe est haché (bcrypt), jamais stocké en clair", async () => {
    const [r] = await db.execute<{ hash: string }>(
      sql`SELECT hash FROM app.utilisateur WHERE email = 'membre@test.fr'`,
    );
    expect(r.hash).toMatch(/^\$2[aby]\$/);
    expect(r.hash).not.toContain("motdepasse-test");
  });

  test("connexion : bon mot de passe accepté, mauvais refusé, e-mail inconnu refusé", async () => {
    expect(await verifierIdentifiants("membre@test.fr", "motdepasse-test")).toMatchObject({ id: membre!.id });
    expect(await verifierIdentifiants("MEMBRE@test.fr ", "motdepasse-test")).not.toBeNull(); // e-mail normalisé
    expect(await verifierIdentifiants("membre@test.fr", "faux")).toBeNull();
    expect(await verifierIdentifiants("inconnu@test.fr", "motdepasse-test")).toBeNull();
  });

  test("un e-mail ne sert qu'à un compte ; mot de passe trop court refusé", async () => {
    await expect(
      creerCompte({ email: "membre@test.fr", nom: "X", motDePasse: "motdepasse-test" }),
    ).rejects.toThrow("Un compte existe déjà avec cet e-mail.");
    await expect(creerCompte({ email: "a@test.fr", nom: "X", motDePasse: "court" })).rejects.toThrow(
      /8 caractères/,
    );
  });

  test("seul l'admin attribue un rôle ; le changement s'applique tout de suite", async () => {
    await expect(
      attribuerRole(orga, { idUtilisateur: membre!.id, role: "organisateur", idEquipe: null }),
    ).rejects.toThrow("Accès refusé.");
    const nova = await equipeBrute(valorant, "Nova");
    await attribuerRole(admin, { idUtilisateur: membre!.id, role: "organisateur", idEquipe: nova });
    expect(await acteurParId(membre!.id)).toEqual({ id: membre!.id, role: "organisateur", idEquipe: nova });
  });
});
