import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { arbreDeLaPhase } from "@/requetes/arbre";
import {
  creerEquipe,
  creerJeu,
  creerPhase,
  creerTournoi,
  inscrire,
  matchTermine,
  viderLaBase,
} from "../../tests/outils";
import { rattraperTournoisImportes } from "./moteur";

test("un tournoi du générateur reçoit ses réglages de phase et son arbre, une seule fois", async () => {
  await viderLaBase();
  const jeu = await creerJeu();
  const [e1, e2, e3, e4, e5] = await Promise.all(["A", "B", "C", "D", "E"].map((n) => creerEquipe(jeu, n)));
  const t = await creerTournoi(jeu, "Importé");
  for (const e of [e1, e2, e3, e4, e5]) await inscrire(t, e);
  const poules = await creerPhase(t, "poules", 1);
  const elim = await creerPhase(t, "elimination", 2);
  await matchTermine(poules, e1, e5, 2, 0, "2026-01-10 10:00:00");
  const d1 = await matchTermine(elim, e1, e4, 2, 0, "2026-01-12 14:00:00");
  const d2 = await matchTermine(elim, e2, e3, 1, 2, "2026-01-12 17:00:00");
  const finale = await matchTermine(elim, e1, e3, 3, 1, "2026-01-13 18:00:00");

  await rattraperTournoisImportes();
  await rattraperTournoisImportes(); // idempotent

  const reglages = await db.execute(
    sql`SELECT id_phase, format, nb_qualifies FROM app.reglage_phase ORDER BY id_phase`,
  );
  expect([...reglages]).toEqual([
    { id_phase: poules, format: 3, nb_qualifies: 4 }, // 4 équipes dans la phase suivante
    { id_phase: elim, format: 3, nb_qualifies: null },
  ]);
  const arbre = await arbreDeLaPhase(elim);
  expect(arbre.map((e) => [e.tour, e.position, e.idMatch])).toEqual([
    [1, 1, d1],
    [1, 2, d2],
    [2, 1, finale],
  ]);
  expect(arbre[2].qualifie).toBe("A"); // le vainqueur de la finale
});
