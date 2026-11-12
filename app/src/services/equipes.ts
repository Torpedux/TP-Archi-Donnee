import { sql } from "drizzle-orm";
import { z } from "zod";
import { conflitAppartenance, type Periode } from "@/metier/appartenance";
import { formatDate } from "@/lib/format";
import { date, exiger, exigerDroit, id, texte, transaction, valider, type Acteur } from "./socle";

const equipe = z.object({
  idJeu: id,
  nom: texte("Nom"),
  tag: texte("Tag", 6).transform((t) => t.toUpperCase()),
  pays: texte("Pays", 3).transform((p) => p.toUpperCase()),
});

/**
 * EF-03 : créer une équipe (RG4). Libre-service : un compte sans équipe crée la sienne et en devient
 * capitaine ; l'admin crée une équipe sans capitaine.
 */
export async function creerEquipe(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "equipe.creer");
  const d = valider(equipe, donnees);
  return transaction(async (tx) => {
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO equipe (id_jeu, nom, tag, pays, cree_le)
      VALUES (${d.idJeu}, ${d.nom}, ${d.tag}, ${d.pays}, current_date) RETURNING id_equipe AS id`);
    if (acteur!.role !== "admin")
      await tx.execute(
        sql`UPDATE app.utilisateur SET id_equipe = ${r.id} WHERE id_utilisateur = ${acteur!.id}`,
      );
    return r.id;
  });
}

/** EF-03 : une équipe ne change pas de jeu une fois qu'elle a disputé un match. */
export async function modifierEquipe(acteur: Acteur, donnees: unknown) {
  const d = valider(equipe.extend({ idEquipe: id }), donnees);
  exigerDroit(acteur, "equipe.gerer", { idEquipe: d.idEquipe });
  await transaction(async (tx) => {
    const [e] = await tx.execute<{ idJeu: number; aJoue: boolean }>(sql`
      SELECT id_jeu AS "idJeu", EXISTS (SELECT 1 FROM disputer d WHERE d.id_equipe = e.id_equipe) AS "aJoue"
      FROM equipe e WHERE id_equipe = ${d.idEquipe} FOR UPDATE`);
    exiger(e, "Équipe introuvable.");
    exiger(
      e.idJeu === d.idJeu || !e.aJoue,
      "Cette équipe a déjà disputé un match : elle ne peut plus changer de jeu.",
    );
    await tx.execute(sql`
      UPDATE equipe SET id_jeu = ${d.idJeu}, nom = ${d.nom}, tag = ${d.tag}, pays = ${d.pays}
      WHERE id_equipe = ${d.idEquipe}`);
  });
}

const joueur = z.object({
  pseudo: texte("Pseudo", 30),
  nom: texte("Nom"),
  prenom: texte("Prénom"),
  pays: texte("Pays", 3).transform((p) => p.toUpperCase()),
  neLe: date("Date de naissance"),
});

/** EF-04 : créer un joueur (RG6 : pseudo unique). Réservé aux capitaines et à l'admin. */
export async function creerJoueur(acteur: Acteur, donnees: unknown) {
  exiger(acteur && (acteur.role === "admin" || acteur.idEquipe !== null), "Accès refusé.");
  const d = valider(joueur, donnees);
  return transaction(async (tx) => {
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO joueur (pseudo, nom, prenom, pays, ne_le)
      VALUES (${d.pseudo}, ${d.nom}, ${d.prenom}, ${d.pays}, ${d.neLe}) RETURNING id_joueur AS id`);
    return r.id;
  });
}

const entree = z.object({
  idEquipe: id,
  pseudo: texte("Pseudo", 30),
  dateEntree: date("Date d'entrée"),
  role: texte("Rôle", 30),
});

/**
 * EF-04 : ajouter un joueur à une équipe. RG7 : pas d'autre équipe du même jeu sur une période qui
 * chevauche. La ligne du joueur est verrouillée, pour que deux ajouts simultanés ne passent pas tous les deux.
 */
export async function ajouterJoueur(acteur: Acteur, donnees: unknown) {
  const d = valider(entree, donnees);
  exigerDroit(acteur, "equipe.gerer", { idEquipe: d.idEquipe });
  await transaction(async (tx) => {
    const [j] = await tx.execute<{ idJoueur: number }>(
      sql`SELECT id_joueur AS "idJoueur" FROM joueur WHERE pseudo = ${d.pseudo} FOR UPDATE`,
    );
    exiger(j, `Aucun joueur ne porte le pseudo « ${d.pseudo} ».`);
    const [e] = await tx.execute<{ idJeu: number }>(
      sql`SELECT id_jeu AS "idJeu" FROM equipe WHERE id_equipe = ${d.idEquipe}`,
    );
    exiger(e, "Équipe introuvable.");
    const existantes = await tx.execute<Periode & { equipe: string }>(sql`
      SELECT e.id_jeu AS "idJeu", a.date_entree AS "dateEntree", a.date_sortie AS "dateSortie", e.nom AS equipe
      FROM appartenir a JOIN equipe e ON e.id_equipe = a.id_equipe
      WHERE a.id_joueur = ${j.idJoueur}`);
    const conflit = conflitAppartenance({ idJeu: e.idJeu, dateEntree: d.dateEntree, dateSortie: null }, [
      ...existantes,
    ]);
    exiger(
      !conflit,
      `${d.pseudo} est déjà dans l'équipe ${conflit?.equipe} sur ce jeu ` +
        `(depuis le ${formatDate(conflit?.dateEntree ?? null)}${conflit?.dateSortie ? `, jusqu'au ${formatDate(conflit.dateSortie)}` : ""}) : ` +
        "un joueur n'a qu'une équipe par jeu à la fois (RG7).",
    );
    await tx.execute(sql`
      INSERT INTO appartenir (id_joueur, id_equipe, date_entree, role)
      VALUES (${j.idJoueur}, ${d.idEquipe}, ${d.dateEntree}, ${d.role})`);
  });
}

const sortie = z.object({
  idEquipe: id,
  idJoueur: id,
  dateEntree: date("Date d'entrée"),
  dateSortie: date("Date de sortie"),
});

/** EF-04 : faire sortir un joueur de l'équipe (date de sortie, RG7). */
export async function sortirJoueur(acteur: Acteur, donnees: unknown) {
  const d = valider(sortie, donnees);
  exigerDroit(acteur, "equipe.gerer", { idEquipe: d.idEquipe });
  await transaction(async (tx) => {
    const r = await tx.execute(sql`
      UPDATE appartenir SET date_sortie = ${d.dateSortie}
      WHERE id_joueur = ${d.idJoueur} AND id_equipe = ${d.idEquipe} AND date_entree = ${d.dateEntree}
        AND date_sortie IS NULL
      RETURNING id_joueur`);
    exiger(r.length === 1, "Ce joueur n'est pas dans l'effectif actuel.");
  });
}
