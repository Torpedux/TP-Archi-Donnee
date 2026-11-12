import { beforeEach, describe, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Acteur } from "@/metier/droits";
import { classementPoule } from "@/requetes/classement";
import { palmares } from "@/requetes/equipes";
import { creerEquipe, creerJeu, viderLaBase } from "../../tests/outils";
import { acteurParId, creerCompte } from "./comptes";
import {
  annulerMatch,
  corrigerManche,
  declarerForfait,
  designerQualifie,
  genererPhase,
  saisirManche,
  supprimerDerniereManche,
} from "./moteur";
import {
  ajouterPhase,
  creerTournoi,
  inscrireEquipe,
  ordonnerTetesDeSerie,
  ouvrirInscriptions,
} from "./tournois";

// Les ✔ des EF-06 à EF-10, par les services, sur la base de test.
let orga: Acteur, jeu: number;

type Ligne = {
  idMatch: number;
  statut: string;
  format: number;
  a: number;
  b: number;
  sa: number | null;
  sb: number | null;
};

/** Les matchs d'une phase, à plat : a = plus petit id d'équipe. */
async function matchs(idPhase: number) {
  return [
    ...(await db.execute<Ligne>(sql`
      SELECT m.id_match AS "idMatch", m.statut, m.format, a.id_equipe AS a, b.id_equipe AS b, a.score AS sa, b.score AS sb
      FROM match m
      JOIN disputer a ON a.id_match = m.id_match
      JOIN disputer b ON b.id_match = m.id_match AND b.id_equipe > a.id_equipe
      WHERE m.id_phase = ${idPhase} ORDER BY m.id_match`)),
  ];
}
const match = async (idMatch: number) => {
  const [m] = await db.execute<Ligne>(sql`
    SELECT m.id_match AS "idMatch", m.statut, m.format, a.id_equipe AS a, b.id_equipe AS b, a.score AS sa, b.score AS sb
    FROM match m
    JOIN disputer a ON a.id_match = m.id_match
    JOIN disputer b ON b.id_match = m.id_match AND b.id_equipe > a.id_equipe
    WHERE m.id_match = ${idMatch}`);
  return m;
};
const emplacements = async (idPhase: number) => [
  ...(await db.execute<{
    tour: number;
    position: number;
    idMatch: number | null;
    qualifiee: number | null;
  }>(sql`
    SELECT tour, position, id_match AS "idMatch", id_equipe_qualifiee AS qualifiee
    FROM app.emplacement_arbre WHERE id_phase = ${idPhase} ORDER BY tour, position`)),
];
const etat = async (idTournoi: number) =>
  (
    await db.execute<{ etat: string }>(
      sql`SELECT etat FROM app.reglage_tournoi WHERE id_tournoi = ${idTournoi}`,
    )
  )[0].etat;

/** Fait gagner une manche à l'équipe donnée. */
const manche = (idMatch: number, m: Ligne, vainqueur: number) =>
  saisirManche(orga, {
    idMatch,
    carte: "Ascent",
    pointsA: vainqueur === m.a ? 13 : 7,
    pointsB: vainqueur === m.b ? 13 : 7,
  });

/** Joue un match jusqu'au bout : le vainqueur gagne toutes les manches. */
async function jouer(idMatch: number, vainqueur: number) {
  const m = await match(idMatch);
  for (let i = 0; i < Math.floor(m.format / 2) + 1; i++) await manche(idMatch, m, vainqueur);
}

/** Un tournoi prêt à démarrer : n équipes inscrites, têtes de série dans l'ordre de création. */
async function tournoi(
  n: number,
  phases: { type: "poules" | "elimination"; format: number; nbQualifies?: number }[],
) {
  const idTournoi = await creerTournoi(orga, {
    idJeu: jeu,
    nom: "Ynov Cup",
    lieu: "en ligne",
    dateDebut: "2026-11-20",
    dateFin: "2026-11-25",
    dotation: 0,
  });
  const idsPhases: number[] = [];
  for (const p of phases) idsPhases.push(await ajouterPhase(orga, { idTournoi, ...p }));
  await ouvrirInscriptions(orga, { idTournoi });
  const equipes: number[] = [];
  for (let i = 1; i <= n; i++) {
    const idEquipe = await creerEquipe(jeu, `Équipe ${i}`);
    await inscrireEquipe(orga, { idTournoi, idEquipe });
    equipes.push(idEquipe);
  }
  if (n > 0) await ordonnerTetesDeSerie(orga, { idTournoi, idsEquipes: equipes });
  return { idTournoi, phases: idsPhases, equipes };
}

beforeEach(async () => {
  await viderLaBase();
  const id = await creerCompte(
    { email: "orga@test.fr", nom: "Orga", motDePasse: "motdepasse-test" },
    "organisateur",
  );
  orga = await acteurParId(id);
  jeu = await creerJeu();
});

describe("EF-06 · Génération des poules (RG3, RG8, RG9)", () => {
  test("pour 4 équipes, 6 matchs prévus sont créés, chaque paire une seule fois", async () => {
    const t = await tournoi(4, [{ type: "poules", format: 3, nbQualifies: 2 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const ms = await matchs(t.phases[0]);
    expect(ms).toHaveLength(6);
    expect(new Set(ms.map((m) => `${m.a}-${m.b}`)).size).toBe(6);
    expect(ms.every((m) => m.statut === "prevu" && m.format === 3 && m.sa === null)).toBe(true);
    expect(await etat(t.idTournoi)).toBe("en_cours"); // générer la première phase démarre le tournoi
  });

  test("les dates sont proposées par créneaux réguliers à partir de la date de début", async () => {
    const t = await tournoi(4, [{ type: "poules", format: 1, nbQualifies: 2 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const dates = await db.execute<{ d: string }>(sql`SELECT date_heure AS d FROM match ORDER BY date_heure`);
    expect(dates.map((r) => r.d).slice(0, 2)).toEqual(["2026-11-20 10:00:00", "2026-11-20 11:00:00"]);
  });

  test("le classement liste toutes les équipes dès la génération, à zéro match joué", async () => {
    const t = await tournoi(4, [{ type: "poules", format: 1, nbQualifies: 2 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const c = await classementPoule(t.phases[0]);
    expect(c.map((l) => [l.idEquipe, l.joues])).toEqual(t.equipes.map((e) => [e, 0])); // ordre des têtes de série
  });

  test("regénérer une phase qui a déjà un match joué : refusé", async () => {
    const t = await tournoi(4, [{ type: "poules", format: 3, nbQualifies: 2 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    await genererPhase(orga, { idPhase: t.phases[0] }); // rien de joué : on peut regénérer
    expect(await matchs(t.phases[0])).toHaveLength(6);
    const [m] = await matchs(t.phases[0]);
    await manche(m.idMatch, m, m.a);
    await expect(genererPhase(orga, { idPhase: t.phases[0] })).rejects.toThrow(/déjà un match joué/);
  });

  test("EF-02 : un tournoi ne démarre pas sans deux équipes inscrites (RG5)", async () => {
    const t = await tournoi(1, [{ type: "poules", format: 1, nbQualifies: 2 }]);
    await expect(genererPhase(orga, { idPhase: t.phases[0] })).rejects.toThrow(/au moins deux équipes/);
    expect(await etat(t.idTournoi)).toBe("inscriptions");
  });
});

describe("EF-07 · Génération de l'arbre (RG3, RG8, RG9)", () => {
  test("6 équipes : arbre de 8, têtes de série 1 et 2 exemptées, 2 matchs au premier tour", async () => {
    const t = await tournoi(6, [{ type: "elimination", format: 3 }]);
    const [e1, e2, e3, e4, e5, e6] = t.equipes;
    await genererPhase(orga, { idPhase: t.phases[0] });
    const ms = await matchs(t.phases[0]);
    expect(ms.map((m) => [m.a, m.b])).toEqual([
      [e4, e5],
      [e3, e6],
    ]);
    const tour1 = (await emplacements(t.phases[0])).filter((e) => e.tour === 1);
    expect(tour1.map((e) => [e.position, e.idMatch !== null, e.qualifiee])).toEqual([
      [1, false, e1], // exempt : avance sans match (RG9)
      [2, true, null],
      [3, false, e2],
      [4, true, null],
    ]);
    // 7 emplacements en tout (4 + 2 + 1), et aucun match à une seule équipe
    expect(await emplacements(t.phases[0])).toHaveLength(7);
    const [{ n }] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM (SELECT id_match FROM disputer GROUP BY id_match HAVING count(*) <> 2) x`,
    );
    expect(n).toBe(0);
  });

  test("quand les deux matchs qui alimentent une demi-finale sont terminés, elle est créée avec les deux vainqueurs", async () => {
    const t = await tournoi(8, [{ type: "elimination", format: 1 }]);
    const [e1, , , e4] = t.equipes;
    await genererPhase(orga, { idPhase: t.phases[0] });
    const quarts = await matchs(t.phases[0]);
    expect(quarts).toHaveLength(4);
    await jouer(quarts[0].idMatch, e1); // 1 contre 8
    expect(await matchs(t.phases[0])).toHaveLength(4); // un seul quart joué : pas encore de demi-finale
    await jouer(quarts[1].idMatch, e4); // 4 contre 5
    const apres = await matchs(t.phases[0]);
    expect(apres).toHaveLength(5);
    expect([apres[4].a, apres[4].b, apres[4].statut]).toEqual([e1, e4, "prevu"]);
    const demi = (await emplacements(t.phases[0])).find((e) => e.tour === 2 && e.position === 1);
    expect(demi?.idMatch).toBe(apres[4].idMatch);
  });

  test("un exempt rencontre le vainqueur du match voisin dès que celui-ci est terminé", async () => {
    const t = await tournoi(3, [{ type: "elimination", format: 1 }]);
    const [e1, e2] = t.equipes;
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m] = await matchs(t.phases[0]); // 2 contre 3 ; la tête de série 1 est exemptée
    await jouer(m.idMatch, e2);
    const finale = (await matchs(t.phases[0]))[1];
    expect([finale.a, finale.b]).toEqual([e1, e2]);
  });
});

describe("EF-08 · Saisie des scores (RG8, RG10, RG11)", () => {
  let idPhase: number, m: Ligne, equipes: number[];
  beforeEach(async () => {
    const t = await tournoi(4, [{ type: "elimination", format: 3 }]);
    idPhase = t.phases[0];
    equipes = t.equipes;
    await genererPhase(orga, { idPhase });
    [m] = await matchs(idPhase); // 1 contre 4
  });

  test("manche à égalité de points : refusée (pas de nul, RG11)", async () => {
    await expect(
      saisirManche(orga, { idMatch: m.idMatch, carte: "Bind", pointsA: 12, pointsB: 12 }),
    ).rejects.toThrow(/égalité/);
  });

  test("la première manche passe le match « en cours » ; le score est calculé, jamais saisi", async () => {
    await manche(m.idMatch, m, m.a);
    expect(await match(m.idMatch)).toMatchObject({ statut: "en_cours", sa: 1, sb: 0 });
    const manches = await db.execute(sql`
      SELECT ma.numero, ma.carte, array_agg(k.points ORDER BY k.id_equipe) AS points
      FROM manche ma JOIN marquer k USING (id_manche) WHERE ma.id_match = ${m.idMatch} GROUP BY ma.id_manche`);
    expect([...manches]).toEqual([{ numero: 1, carte: "Ascent", points: [13, 7] }]);
  });

  test("BO3 : après 2 manches gagnées par la même équipe, le match est terminé et son vainqueur avance", async () => {
    await manche(m.idMatch, m, m.a);
    await manche(m.idMatch, m, m.a);
    expect(await match(m.idMatch)).toMatchObject({ statut: "termine", sa: 2, sb: 0 });
    // les manches suivantes ne sont plus saisissables
    await expect(manche(m.idMatch, m, m.b)).rejects.toThrow(/terminé/);
    // le vainqueur avance : il est dans la finale dès que l'autre demi-finale est jouée
    const autre = (await matchs(idPhase))[1];
    await jouer(autre.idMatch, autre.a);
    const finale = (await matchs(idPhase))[2];
    expect([finale.a, finale.b].sort()).toEqual([m.a, autre.a].sort());
  });

  test("correction d'une manche tant que le tour suivant n'a pas commencé : le nouveau vainqueur avance", async () => {
    await jouer(m.idMatch, m.a);
    const autre = (await matchs(idPhase))[1];
    await jouer(autre.idMatch, autre.a);
    const finale = (await matchs(idPhase))[2];
    expect([finale.a, finale.b]).toContain(m.a);
    // on corrige les deux manches : c'est l'autre équipe qui les a gagnées
    const ids = await db.execute<{ id: number }>(
      sql`SELECT id_manche AS id FROM manche WHERE id_match = ${m.idMatch} ORDER BY numero`,
    );
    await corrigerManche(orga, { idManche: ids[0].id, carte: "Ascent", pointsA: 5, pointsB: 13 });
    expect(await match(m.idMatch)).toMatchObject({ statut: "en_cours", sa: 1, sb: 1 }); // plus de vainqueur
    expect(await matchs(idPhase)).toHaveLength(2); // la finale, pas commencée, est retirée
    await corrigerManche(orga, { idManche: ids[1].id, carte: "Ascent", pointsA: 5, pointsB: 13 });
    expect(await match(m.idMatch)).toMatchObject({ statut: "termine", sa: 0, sb: 2 });
    const nouvelle = (await matchs(idPhase))[2];
    expect([nouvelle.a, nouvelle.b]).toContain(m.b);
    expect([nouvelle.a, nouvelle.b]).not.toContain(m.a);
  });

  test("correction refusée quand le tour suivant a commencé", async () => {
    await jouer(m.idMatch, m.a);
    const autre = (await matchs(idPhase))[1];
    await jouer(autre.idMatch, autre.a);
    const finale = (await matchs(idPhase))[2];
    await manche(finale.idMatch, finale, finale.a);
    const [{ id }] = await db.execute<{ id: number }>(
      sql`SELECT id_manche AS id FROM manche WHERE id_match = ${m.idMatch} ORDER BY numero LIMIT 1`,
    );
    await expect(
      corrigerManche(orga, { idManche: id, carte: "Ascent", pointsA: 5, pointsB: 13 }),
    ).rejects.toThrow(/tour suivant a commencé/);
  });

  test("une correction ne peut pas laisser une manche jouée après la fin du match", async () => {
    await manche(m.idMatch, m, m.a);
    await manche(m.idMatch, m, m.b);
    await manche(m.idMatch, m, m.a); // 2-1
    const ids = await db.execute<{ id: number }>(
      sql`SELECT id_manche AS id FROM manche WHERE id_match = ${m.idMatch} ORDER BY numero`,
    );
    // si la manche 2 revenait à A, le match aurait fini 2-0 et la manche 3 n'aurait pas existé
    await expect(
      corrigerManche(orga, { idManche: ids[1].id, carte: "Ascent", pointsA: 13, pointsB: 5 }),
    ).rejects.toThrow(/dernière manche/);
    await supprimerDerniereManche(orga, { idMatch: m.idMatch });
    expect(await match(m.idMatch)).toMatchObject({ statut: "en_cours", sa: 1, sb: 1 });
    expect(equipes).toHaveLength(4);
  });

  test("seul l'organisateur du tournoi (ou l'admin) saisit les scores", async () => {
    const id = await creerCompte(
      { email: "autre@test.fr", nom: "Autre", motDePasse: "motdepasse-test" },
      "organisateur",
    );
    await expect(
      saisirManche(await acteurParId(id), { idMatch: m.idMatch, carte: "Bind", pointsA: 13, pointsB: 1 }),
    ).rejects.toThrow("Accès refusé.");
    await expect(
      saisirManche(null, { idMatch: m.idMatch, carte: "Bind", pointsA: 13, pointsB: 1 }),
    ).rejects.toThrow("Accès refusé.");
  });
});

describe("EF-09 · Forfait (RG12)", () => {
  test("forfait en BO5 : score 3-0, zéro manche, match terminé, vainqueur qualifié pour le tour suivant", async () => {
    const t = await tournoi(4, [{ type: "elimination", format: 5 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m, autre] = await matchs(t.phases[0]);
    await manche(m.idMatch, m, m.b); // une manche était jouée : elle n'est pas gardée
    await declarerForfait(orga, { idMatch: m.idMatch, idEquipe: m.b });
    expect(await match(m.idMatch)).toMatchObject({ statut: "termine", sa: 3, sb: 0 });
    const [{ n }] = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM manche WHERE id_match = ${m.idMatch}`,
    );
    expect(n).toBe(0);
    const forfaits = await db.execute(
      sql`SELECT id_equipe, forfait FROM disputer WHERE id_match = ${m.idMatch} ORDER BY id_equipe`,
    );
    expect([...forfaits]).toEqual([
      { id_equipe: m.a, forfait: false },
      { id_equipe: m.b, forfait: true }, // le forfait est marqué sur l'équipe concernée
    ]);
    await jouer(autre.idMatch, autre.a);
    const finale = (await matchs(t.phases[0]))[2];
    expect([finale.a, finale.b]).toContain(m.a);
  });

  test("pas de forfait sur un match terminé, ni pour une équipe qui ne joue pas ce match", async () => {
    const t = await tournoi(4, [{ type: "elimination", format: 1 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m, autre] = await matchs(t.phases[0]);
    await expect(declarerForfait(orga, { idMatch: m.idMatch, idEquipe: autre.a })).rejects.toThrow(
      /ne dispute pas/,
    );
    await jouer(m.idMatch, m.a);
    await expect(declarerForfait(orga, { idMatch: m.idMatch, idEquipe: m.b })).rejects.toThrow(/terminé/);
  });
});

describe("EF-10 · Annulation (RG8)", () => {
  test("un match annulé n'a pas de vainqueur et n'alimente aucun tour ; l'organisateur désigne qui avance", async () => {
    const t = await tournoi(4, [{ type: "elimination", format: 1 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m, autre] = await matchs(t.phases[0]);
    await annulerMatch(orga, { idMatch: m.idMatch });
    expect(await match(m.idMatch)).toMatchObject({ statut: "annule", sa: null, sb: null });
    await jouer(autre.idMatch, autre.a);
    expect(await matchs(t.phases[0])).toHaveLength(2); // pas de finale : personne n'est qualifié en haut
    await designerQualifie(orga, { idMatch: m.idMatch, idEquipe: m.b });
    const finale = (await matchs(t.phases[0]))[2];
    expect([finale.a, finale.b].sort()).toEqual([m.b, autre.a].sort());
  });

  test("seul un match prévu s'annule ; on ne désigne qu'une équipe du match", async () => {
    const t = await tournoi(4, [{ type: "elimination", format: 3 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m, autre] = await matchs(t.phases[0]);
    await manche(m.idMatch, m, m.a);
    await expect(annulerMatch(orga, { idMatch: m.idMatch })).rejects.toThrow(/prévu/);
    await annulerMatch(orga, { idMatch: autre.idMatch });
    await expect(designerQualifie(orga, { idMatch: autre.idMatch, idEquipe: m.a })).rejects.toThrow(
      /ne dispute pas/,
    );
  });

  test("en poule, un match annulé ne compte pas au classement", async () => {
    const t = await tournoi(3, [{ type: "poules", format: 1, nbQualifies: 2 }]);
    await genererPhase(orga, { idPhase: t.phases[0] });
    const [m] = await matchs(t.phases[0]);
    await annulerMatch(orga, { idMatch: m.idMatch });
    const c = await classementPoule(t.phases[0]);
    expect(c.reduce((s, l) => s + l.joues, 0)).toBe(0);
  });
});

describe("Un tournoi de 6 équipes se joue jusqu'à la finale", () => {
  test("poules (BO1, 4 qualifiés) puis élimination (BO3) : classement, arbre, vainqueur, tournoi terminé", async () => {
    const t = await tournoi(6, [
      { type: "poules", format: 1, nbQualifies: 4 },
      { type: "elimination", format: 3 },
    ]);
    const [poules, elim] = t.phases;
    const [e1, e2, e3, e4, e5] = t.equipes;
    await genererPhase(orga, { idPhase: poules });
    expect(await matchs(poules)).toHaveLength(15);

    // l'arbre ne se génère pas tant que les poules ne sont pas finies
    await expect(genererPhase(orga, { idPhase: elim })).rejects.toThrow(/phase précédente/);

    // En poule, la meilleure tête de série gagne toujours, sauf e5 qui déclare forfait une fois.
    for (const m of await matchs(poules)) {
      if (m.a === e5 || m.b === e5) {
        const adversaire = m.a === e5 ? m.b : m.a;
        if (adversaire === e1) {
          await declarerForfait(orga, { idMatch: m.idMatch, idEquipe: e5 });
          continue;
        }
      }
      await jouer(m.idMatch, Math.min(m.a, m.b));
    }
    const classement = await classementPoule(poules);
    expect(classement.map((l) => l.idEquipe)).toEqual(t.equipes);
    expect(classement.map((l) => l.victoires)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(await etat(t.idTournoi)).toBe("en_cours");

    // Arbre : les 4 premiers du classement de poule, 1er contre 4e et 2e contre 3e.
    await genererPhase(orga, { idPhase: elim });
    const demis = await matchs(elim);
    expect(demis.map((m) => [m.a, m.b, m.format])).toEqual([
      [e1, e4, 3],
      [e2, e3, 3],
    ]);
    await jouer(demis[0].idMatch, e4);
    await jouer(demis[1].idMatch, e2);
    const finale = (await matchs(elim))[2];
    expect([finale.a, finale.b]).toEqual([e2, e4]);
    expect(await etat(t.idTournoi)).toBe("en_cours");
    await jouer(finale.idMatch, e4);

    expect(await etat(t.idTournoi)).toBe("termine");
    expect((await palmares(e4)).map((x) => x.tournoi)).toEqual(["Ynov Cup"]);
    expect(await palmares(e1)).toEqual([]);
    // RG9, sur tout le tournoi : chaque match oppose exactement deux équipes inscrites
    const [{ n }] = await db.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM disputer d
      JOIN match m USING (id_match) JOIN phase ph USING (id_phase)
      WHERE NOT EXISTS (SELECT 1 FROM inscrire i WHERE i.id_tournoi = ph.id_tournoi AND i.id_equipe = d.id_equipe)`);
    expect(n).toBe(0);
  });
});
