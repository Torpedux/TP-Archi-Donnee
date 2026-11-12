import { sql } from "drizzle-orm";
import { z } from "zod";
import { exiger, exigerDroit, id, texte, transaction, valider, type Acteur } from "./socle";

const jeu = z.object({ nom: texte("Nom"), editeur: texte("Éditeur") });

/** EF-01 : créer un jeu (RG1 : nom unique, garanti par le schéma). */
export async function creerJeu(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "jeu.gerer");
  const d = valider(jeu, donnees);
  return transaction(async (tx) => {
    const [r] = await tx.execute<{ id: number }>(
      sql`INSERT INTO jeu (nom, editeur) VALUES (${d.nom}, ${d.editeur}) RETURNING id_jeu AS id`,
    );
    return r.id;
  });
}

export async function modifierJeu(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "jeu.gerer");
  const d = valider(jeu.extend({ idJeu: id }), donnees);
  await transaction((tx) =>
    tx.execute(sql`UPDATE jeu SET nom = ${d.nom}, editeur = ${d.editeur} WHERE id_jeu = ${d.idJeu}`),
  );
}

/** EF-01 : un jeu qui a des tournois ou des équipes ne peut pas être supprimé. */
export async function supprimerJeu(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "jeu.gerer");
  const d = valider(z.object({ idJeu: id }), donnees);
  await transaction(async (tx) => {
    const [r] = await tx.execute<{ utilise: boolean }>(sql`
      SELECT EXISTS (SELECT 1 FROM tournoi WHERE id_jeu = ${d.idJeu})
          OR EXISTS (SELECT 1 FROM equipe WHERE id_jeu = ${d.idJeu}) AS utilise`);
    exiger(!r.utilise, "Ce jeu a des tournois ou des équipes : il ne peut pas être supprimé.");
    await tx.execute(sql`DELETE FROM jeu WHERE id_jeu = ${d.idJeu}`);
  });
}
