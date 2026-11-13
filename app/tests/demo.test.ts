import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { creerAdminInitial } from "@/init";
import { COMPTES_DEMO, installerDemo, NOMS_DEMO } from "@/init/demo";
import { arbreDeLaPhase } from "@/requetes/arbre";
import { classementPoule } from "@/requetes/classement";
import { verifierIdentifiants } from "@/services/comptes";
import { creerEquipe, creerJeu, viderLaBase } from "./outils";

// ENF-02 : au premier lancement, un tournoi de démo à moitié joué (un match en cours, des matchs à saisir).
test("la démo installe trois tournois, un par état, et trois comptes ; une seule fois", async () => {
  await viderLaBase();
  for (const jeu of ["Valorant", "Rocket League"]) {
    const idJeu = await creerJeu(jeu);
    for (let i = 1; i <= 10; i++) await creerEquipe(idJeu, `${jeu} ${i}`);
  }
  await creerAdminInitial();
  await installerDemo();
  await installerDemo(); // idempotent

  const tournois = await db.execute<{ nom: string; etat: string; idTournoi: number }>(sql`
    SELECT t.nom, rt.etat, t.id_tournoi AS "idTournoi" FROM tournoi t JOIN app.reglage_tournoi rt USING (id_tournoi)
    ORDER BY t.id_tournoi`);
  expect(tournois.map((t) => [t.nom, t.etat])).toEqual([
    [NOMS_DEMO.poules, "en_cours"],
    [NOMS_DEMO.finale, "en_cours"],
    [NOMS_DEMO.inscriptions, "inscriptions"],
  ]);
  expect(tournois.map((t) => t.nom)).not.toContain("Ynov Cup"); // réservé au scénario rejoué à la main

  const statuts = async (idTournoi: number, type: string) =>
    Object.fromEntries(
      (
        await db.execute<{ statut: string; n: number }>(sql`
          SELECT m.statut, count(*)::int AS n FROM match m JOIN phase ph USING (id_phase)
          WHERE ph.id_tournoi = ${idTournoi} AND ph.type = ${type} GROUP BY m.statut`)
      ).map((r) => [r.statut, r.n]),
    );

  // 1. En poules : 9 matchs terminés (dont 1 forfait), 1 en cours, 5 à saisir.
  expect(await statuts(tournois[0].idTournoi, "poules")).toEqual({ termine: 9, en_cours: 1, prevu: 5 });
  const [{ forfaits }] = await db.execute<{ forfaits: number }>(sql`
    SELECT count(*)::int AS forfaits FROM disputer d JOIN match m USING (id_match) JOIN phase ph USING (id_phase)
    WHERE ph.id_tournoi = ${tournois[0].idTournoi} AND d.forfait`);
  expect(forfaits).toBe(1);
  const [{ idPhase }] = await db.execute<{ idPhase: number }>(
    sql`SELECT id_phase AS "idPhase" FROM phase WHERE id_tournoi = ${tournois[0].idTournoi} AND type = 'poules'`,
  );
  expect((await classementPoule(idPhase)).reduce((s, l) => s + l.joues, 0)).toBe(18);

  // 2. En phase finale : 15 matchs de poule joués, une demi-finale jouée, l'autre en cours, finale vide.
  expect(await statuts(tournois[1].idTournoi, "poules")).toEqual({ termine: 15 });
  expect(await statuts(tournois[1].idTournoi, "elimination")).toEqual({ termine: 1, en_cours: 1 });
  const [{ elim }] = await db.execute<{ elim: number }>(
    sql`SELECT id_phase AS elim FROM phase WHERE id_tournoi = ${tournois[1].idTournoi} AND type = 'elimination'`,
  );
  const arbre = await arbreDeLaPhase(elim);
  expect(arbre.map((e) => [e.tour, e.position, e.idMatch !== null, e.idQualifie !== null])).toEqual([
    [1, 1, true, true],
    [1, 2, true, false],
    [2, 1, false, false], // la finale n'existe pas encore : ses deux équipes ne sont pas connues
  ]);

  // 3. Inscriptions ouvertes : 3 équipes ; le capitaine de démo a une équipe du même jeu, pas encore inscrite.
  const [c] = await db.execute<{ inscrites: number; inscriptible: boolean }>(sql`
    SELECT (SELECT count(*)::int FROM inscrire WHERE id_tournoi = ${tournois[2].idTournoi}) AS inscrites,
           EXISTS (SELECT 1 FROM app.utilisateur u JOIN equipe e ON e.id_equipe = u.id_equipe
                   JOIN tournoi t ON t.id_jeu = e.id_jeu AND t.id_tournoi = ${tournois[2].idTournoi}
                   WHERE u.email = 'capitaine@bracket.test'
                     AND NOT EXISTS (SELECT 1 FROM inscrire i WHERE i.id_tournoi = t.id_tournoi AND i.id_equipe = e.id_equipe)) AS inscriptible`);
  expect(c).toEqual({ inscrites: 3, inscriptible: true });

  // Les trois comptes de démo se connectent avec les identifiants annoncés.
  for (const compte of COMPTES_DEMO)
    expect(await verifierIdentifiants(compte.email, compte.motDePasse), compte.email).not.toBeNull();
});
