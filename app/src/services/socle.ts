import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import { peut, type Acteur, type Action, type Reste } from "@/metier/droits";

/** Une erreur à montrer telle quelle à l'utilisateur (règle métier, saisie invalide, droit refusé). */
export class ErreurMetier extends Error {}

export function exiger(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ErreurMetier(message);
}

/** Vérifie un droit de la matrice (§ 3), côté serveur, avant toute écriture. */
export function exigerDroit<A extends Action>(acteur: Acteur, action: A, ...reste: Reste<A>) {
  exiger(peut(acteur, action, ...reste), "Accès refusé.");
}
export type { Acteur, Action };

/** Valide une entrée avec Zod (ENF-03) ; la première erreur devient le message. */
export function valider<S extends z.ZodType>(schema: S, donnees: unknown): z.infer<S> {
  const r = schema.safeParse(donnees);
  if (!r.success) throw new ErreurMetier(r.error.issues[0].message);
  return r.data;
}

// Les contraintes du MLD restent actives (ENF-04) : quand l'une d'elles refuse, on dit pourquoi.
const CONTRAINTES: Record<string, string> = {
  jeu_nom_key: "Un jeu porte déjà ce nom.",
  equipe_nom_key: "Une équipe porte déjà ce nom.",
  joueur_pseudo_key: "Ce pseudo est déjà pris.",
  inscrire_pkey: "Cette équipe est déjà inscrite à ce tournoi.",
  inscrire_id_tournoi_tete_de_serie_key: "Cette tête de série est déjà attribuée dans ce tournoi.",
  appartenir_pkey: "Ce joueur est déjà entré dans cette équipe à cette date.",
  appartenir_check: "La date de sortie ne peut pas précéder la date d'entrée.",
  tournoi_check: "La date de fin ne peut pas précéder la date de début.",
  utilisateur_email_key: "Un compte existe déjà avec cet e-mail.",
  utilisateur_id_equipe_key: "Cette équipe a déjà un capitaine.",
  manche_id_match_numero_key: "Cette manche existe déjà.",
};

function traduire(e: unknown): unknown {
  for (let c: unknown = e; c; c = (c as { cause?: unknown }).cause) {
    const nom = (c as { constraint_name?: string }).constraint_name;
    if (nom && CONTRAINTES[nom]) return new ErreurMetier(CONTRAINTES[nom]);
  }
  return e;
}

/** Tout service qui écrit passe par ici : une transaction (ENF-04), et des erreurs lisibles. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  try {
    return await db.transaction(fn);
  } catch (e) {
    throw traduire(e);
  }
}

export const id = z.coerce.number().int().positive();
/** Un champ de formulaire laissé vide vaut null. */
export const videEnNull = (v: unknown) => (v === "" || v === undefined ? null : v);
export const texte = (libelle: string, max = 80) =>
  z
    .string()
    .trim()
    .min(1, `${libelle} : champ obligatoire.`)
    .max(max, `${libelle} : ${max} caractères au plus.`);
export const date = (libelle: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${libelle} : date invalide.`);

export type ReglageTournoi = {
  idTournoi: number;
  idJeu: number;
  nom: string;
  dateDebut: string;
  etat: "brouillon" | "inscriptions" | "en_cours" | "termine";
  idOrganisateur: number | null;
};

/** Charge et verrouille un tournoi pour la durée de la transaction. Sans réglage = importé, terminé. */
export async function chargerTournoi(tx: Tx, idTournoi: number): Promise<ReglageTournoi> {
  const [t] = await tx.execute<ReglageTournoi>(sql`
    SELECT t.id_tournoi AS "idTournoi", t.id_jeu AS "idJeu", t.nom, t.date_debut AS "dateDebut",
           coalesce(rt.etat, 'termine') AS etat, rt.id_organisateur AS "idOrganisateur"
    FROM tournoi t LEFT JOIN app.reglage_tournoi rt ON rt.id_tournoi = t.id_tournoi
    WHERE t.id_tournoi = ${idTournoi}
    FOR UPDATE OF t`);
  exiger(t, "Tournoi introuvable.");
  return t;
}
