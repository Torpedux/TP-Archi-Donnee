import { beforeAll, expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { GET } from "@/app/tournois/[id]/resultats.csv/route";
import { db } from "@/db/client";
import type { Acteur } from "@/metier/droits";
import { matchsASaisir } from "@/requetes/matchs";
import { inscriptionsEnAttente } from "@/requetes/tournois";
import { acteurParId, creerCompte } from "@/services/comptes";
import { declarerForfait, genererPhase, saisirManche } from "@/services/moteur";
import { ajouterPhase, creerTournoi, inscrireEquipe, ouvrirInscriptions } from "@/services/tournois";
import { creerEquipe, creerJeu, viderLaBase } from "./outils";

let orga: Acteur, autre: Acteur, idTournoi: number, brouillon: number, ouvert: number;
const exporter = (id: number) =>
  GET(new Request("http://localhost/"), { params: Promise.resolve({ id: String(id) }) });

beforeAll(async () => {
  await viderLaBase();
  const compte = async (email: string) =>
    acteurParId(await creerCompte({ email, nom: "Orga", motDePasse: "motdepasse-test" }, "organisateur"));
  orga = await compte("orga@test.fr");
  autre = await compte("autre@test.fr");
  const jeu = await creerJeu();
  const base = { idJeu: jeu, lieu: "en ligne", dateDebut: "2026-11-20", dateFin: "2026-11-22", dotation: 0 };
  idTournoi = await creerTournoi(orga, { ...base, nom: 'Coupe; "du" test' });
  const idPhase = await ajouterPhase(orga, { idTournoi, type: "poules", format: 1, nbQualifies: 2 });
  await ouvrirInscriptions(orga, { idTournoi });
  for (const nom of ["Nova", "Orbit", "=Titans"])
    await inscrireEquipe(orga, { idTournoi, idEquipe: await creerEquipe(jeu, nom) });
  await genererPhase(orga, { idPhase });
  const ms = await db.execute<{ id: number; a: number }>(sql`
    SELECT m.id_match AS id, min(d.id_equipe) AS a FROM match m JOIN disputer d USING (id_match)
    GROUP BY m.id_match ORDER BY m.id_match`);
  await saisirManche(orga, { idMatch: ms[0].id, carte: "Ascent", pointsA: 13, pointsB: 4 });
  await declarerForfait(orga, { idMatch: ms[1].id, idEquipe: ms[1].a });
  brouillon = await creerTournoi(orga, { ...base, nom: "Brouillon" });
  ouvert = await creerTournoi(orga, { ...base, nom: "Ouvert" });
  await ouvrirInscriptions(orga, { idTournoi: ouvert });
  await inscrireEquipe(orga, { idTournoi: ouvert, idEquipe: 1 });
});

test("EF-17 : export CSV des résultats d'un tournoi", async () => {
  const reponse = await exporter(idTournoi);
  expect(reponse.headers.get("content-type")).toContain("text/csv");
  expect(reponse.headers.get("content-disposition")).toContain("attachment");
  const lignes = (await reponse.text()).replace("﻿", "").trim().split("\r\n");
  expect(lignes[0]).toBe(
    '"date_heure";"phase";"format";"statut";"equipe_a";"score_a";"score_b";"equipe_b";"forfait"',
  );
  expect(lignes).toHaveLength(4); // l'en-tête et les 3 matchs de la poule
  expect(lignes.filter((l) => l.includes('"Terminé"'))).toHaveLength(2);
  expect(lignes.filter((l) => l.includes('"Prévu"'))).toHaveLength(1);
  expect(lignes.some((l) => /"1";"0";"[^"]+";""$/.test(l))).toBe(true); // match joué, sans forfait
  expect(lignes.some((l) => l.endsWith(';""') === false && l.includes('"0";"1"'))).toBe(true); // forfait nommé
  // Un nom qui commence par « = » ne devient pas une formule dans un tableur.
  expect(lignes.join("\n")).toContain('"\'=Titans"');
  expect(lignes.join("\n")).not.toContain('"=Titans"');
});

test("EF-17 : un brouillon ou un tournoi inconnu ne s'exporte pas", async () => {
  expect((await exporter(brouillon)).status).toBe(404);
  expect((await exporter(99999)).status).toBe(404);
});

test("EF-16 : matchs à saisir de l'organisateur, en cours d'abord ; rien pour un autre organisateur", async () => {
  const aSaisir = await matchsASaisir(orga!.id);
  expect(aSaisir).toHaveLength(1); // le match encore prévu ; les deux autres sont terminés
  expect(aSaisir[0].statut).toBe("prevu");
  expect(await matchsASaisir(autre!.id)).toEqual([]);
  expect(await matchsASaisir(null)).toHaveLength(1); // l'admin voit tout
  expect(await matchsASaisir(orga!.id, true)).toEqual([]); // aucun n'est daté d'aujourd'hui
});

test("EF-16 : inscriptions en attente = inscrites sans tête de série, dans les tournois ouverts", async () => {
  expect(await inscriptionsEnAttente(orga!.id)).toEqual([
    { idTournoi: ouvert, nom: "Ouvert", enAttente: 1, inscrites: 1 },
  ]);
  expect(await inscriptionsEnAttente(autre!.id)).toEqual([]);
});
