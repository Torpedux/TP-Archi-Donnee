import { sql } from "drizzle-orm";
import { z } from "zod";
import { obstacleNouvellePhase, type TypePhase } from "@/metier/tournoi";
import {
  videEnNull,
  chargerTournoi,
  date,
  exiger,
  exigerDroit,
  id,
  texte,
  transaction,
  valider,
  type Acteur,
} from "./socle";

const tournoi = z.object({
  idJeu: id,
  nom: texte("Nom"),
  lieu: texte("Lieu").default("en ligne"),
  dateDebut: date("Date de début"),
  dateFin: date("Date de fin"),
  dotation: z.coerce
    .number("Dotation : nombre attendu.")
    .min(0, "La dotation ne peut pas être négative.")
    .max(99999999),
});

/** EF-02 : créer un tournoi (RG2). Il naît en brouillon et appartient à celui qui le crée. */
export async function creerTournoi(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "tournoi.creer");
  const d = valider(tournoi, donnees);
  return transaction(async (tx) => {
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO tournoi (id_jeu, nom, lieu, date_debut, date_fin, dotation)
      VALUES (${d.idJeu}, ${d.nom}, ${d.lieu}, ${d.dateDebut}, ${d.dateFin}, ${d.dotation})
      RETURNING id_tournoi AS id`);
    await tx.execute(sql`
      INSERT INTO app.reglage_tournoi (id_tournoi, etat, id_organisateur) VALUES (${r.id}, 'brouillon', ${acteur!.id})`);
    return r.id;
  });
}

export async function modifierTournoi(acteur: Acteur, donnees: unknown) {
  const d = valider(tournoi.omit({ idJeu: true }).extend({ idTournoi: id }), donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    await tx.execute(sql`
      UPDATE tournoi SET nom = ${d.nom}, lieu = ${d.lieu}, date_debut = ${d.dateDebut}, date_fin = ${d.dateFin},
                         dotation = ${d.dotation}
      WHERE id_tournoi = ${d.idTournoi}`);
  });
}

/** Seul un brouillon se supprime : rien n'y est encore joué ni inscrit publiquement. */
export async function supprimerTournoi(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idTournoi: id }), donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(t.etat === "brouillon", "Seul un tournoi en brouillon peut être supprimé.");
    await tx.execute(sql`DELETE FROM inscrire WHERE id_tournoi = ${d.idTournoi}`);
    await tx.execute(sql`DELETE FROM phase WHERE id_tournoi = ${d.idTournoi}`);
    await tx.execute(sql`DELETE FROM tournoi WHERE id_tournoi = ${d.idTournoi}`);
  });
}

const phase = z.object({
  idTournoi: id,
  type: z.enum(["poules", "elimination"]),
  format: z.coerce.number().refine((f) => [1, 3, 5].includes(f), "Format : BO1, BO3 ou BO5."),
  nbQualifies: z.preprocess(
    videEnNull,
    z.coerce.number().int().min(2, "Il faut au moins 2 qualifiés.").max(64).nullable(),
  ),
});

/** EF-02 : ajouter une phase (RG3 : ordonnées, poules puis élimination). Le réglage vit dans le schéma app. */
export async function ajouterPhase(acteur: Acteur, donnees: unknown) {
  const d = valider(phase, donnees);
  return transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(
      t.etat === "brouillon" || t.etat === "inscriptions",
      "Le tournoi a commencé : ses phases sont figées.",
    );
    const existantes = await tx.execute<{ type: TypePhase }>(
      sql`SELECT type FROM phase WHERE id_tournoi = ${d.idTournoi} ORDER BY ordre`,
    );
    const obstacle = obstacleNouvellePhase(
      existantes.map((p) => p.type),
      d.type,
    );
    exiger(!obstacle, obstacle ?? "");
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO phase (id_tournoi, type, ordre) VALUES (${d.idTournoi}, ${d.type}, ${existantes.length + 1})
      RETURNING id_phase AS id`);
    await tx.execute(sql`
      INSERT INTO app.reglage_phase (id_phase, format, nb_qualifies)
      VALUES (${r.id}, ${d.format}, ${d.type === "poules" ? (d.nbQualifies ?? 2) : null})`);
    return r.id;
  });
}

export async function supprimerPhase(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idTournoi: id, idPhase: id }), donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(
      t.etat === "brouillon" || t.etat === "inscriptions",
      "Le tournoi a commencé : ses phases sont figées.",
    );
    await tx.execute(sql`DELETE FROM phase WHERE id_phase = ${d.idPhase} AND id_tournoi = ${d.idTournoi}`);
    // Les phases restantes gardent des numéros d'ordre qui se suivent (RG3).
    await tx.execute(sql`
      UPDATE phase p SET ordre = n.rang
      FROM (SELECT id_phase, row_number() OVER (ORDER BY ordre) AS rang FROM phase WHERE id_tournoi = ${d.idTournoi}) n
      WHERE p.id_phase = n.id_phase`);
  });
}

/** EF-02 : brouillon → inscriptions ouvertes. Le tournoi devient public. */
export async function ouvrirInscriptions(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idTournoi: id }), donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(t.etat === "brouillon", "Les inscriptions sont déjà ouvertes ou le tournoi a commencé.");
    await tx.execute(
      sql`UPDATE app.reglage_tournoi SET etat = 'inscriptions' WHERE id_tournoi = ${d.idTournoi}`,
    );
  });
}

const inscription = z.object({ idTournoi: id, idEquipe: id });

/**
 * EF-05 : inscrire une équipe (RG5), date automatique. L'équipe doit évoluer sur le jeu du tournoi
 * (RG2, RG4) : le schéma ne le garantit pas. La double inscription est refusée par la clé primaire.
 */
export async function inscrireEquipe(acteur: Acteur, donnees: unknown) {
  const d = valider(inscription, donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "inscription.gerer", { idEquipe: d.idEquipe, idOrganisateur: t.idOrganisateur });
    exiger(t.etat === "inscriptions", "Les inscriptions ne sont pas ouvertes pour ce tournoi.");
    const [e] = await tx.execute<{ idJeu: number; nom: string }>(
      sql`SELECT id_jeu AS "idJeu", nom FROM equipe WHERE id_equipe = ${d.idEquipe}`,
    );
    exiger(e, "Équipe introuvable.");
    exiger(e.idJeu === t.idJeu, `${e.nom} n'évolue pas sur le jeu de ce tournoi (RG4).`);
    await tx.execute(sql`
      INSERT INTO inscrire (id_tournoi, id_equipe, date_inscription) VALUES (${d.idTournoi}, ${d.idEquipe}, current_date)`);
  });
}

/** Désinscrire une équipe, tant que le tournoi n'a pas commencé. */
export async function desinscrireEquipe(acteur: Acteur, donnees: unknown) {
  const d = valider(inscription, donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "inscription.gerer", { idEquipe: d.idEquipe, idOrganisateur: t.idOrganisateur });
    exiger(t.etat === "inscriptions", "Le tournoi a commencé : les inscriptions sont figées.");
    await tx.execute(
      sql`DELETE FROM inscrire WHERE id_tournoi = ${d.idTournoi} AND id_equipe = ${d.idEquipe}`,
    );
  });
}

const tete = inscription.extend({
  teteDeSerie: z.preprocess(
    videEnNull,
    z.coerce.number().int().min(1, "La tête de série commence à 1.").nullable(),
  ),
});

/** EF-05 : fixer une tête de série. Deux équipes avec le même numéro : refusé par le schéma (RG5). */
export async function fixerTeteDeSerie(acteur: Acteur, donnees: unknown) {
  const d = valider(tete, donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(t.etat === "inscriptions", "Les têtes de série se fixent pendant les inscriptions.");
    await tx.execute(sql`
      UPDATE inscrire SET tete_de_serie = ${d.teteDeSerie}
      WHERE id_tournoi = ${d.idTournoi} AND id_equipe = ${d.idEquipe}`);
  });
}

/** EF-05 : l'organisateur ordonne toutes les têtes de série d'un coup (1 = la première de la liste). */
export async function ordonnerTetesDeSerie(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idTournoi: id, idsEquipes: z.array(id).min(1) }), donnees);
  await transaction(async (tx) => {
    const t = await chargerTournoi(tx, d.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);
    exiger(t.etat === "inscriptions", "Les têtes de série se fixent pendant les inscriptions.");
    // On efface d'abord : la contrainte d'unicité est vérifiée ligne par ligne.
    await tx.execute(sql`UPDATE inscrire SET tete_de_serie = NULL WHERE id_tournoi = ${d.idTournoi}`);
    for (const [i, idEquipe] of d.idsEquipes.entries())
      await tx.execute(sql`
        UPDATE inscrire SET tete_de_serie = ${i + 1} WHERE id_tournoi = ${d.idTournoi} AND id_equipe = ${idEquipe}`);
  });
}
