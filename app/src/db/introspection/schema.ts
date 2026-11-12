import { pgTable, foreignKey, unique, check, serial, integer, text, index, date, numeric, timestamp, pgSchema, primaryKey, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const app = pgSchema("app");


export const phase = pgTable("phase", {
	idPhase: serial("id_phase").primaryKey().notNull(),
	idTournoi: integer("id_tournoi").notNull(),
	type: text().notNull(),
	ordre: integer().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idTournoi],
			foreignColumns: [tournoi.idTournoi],
			name: "phase_id_tournoi_fkey"
		}),
	unique("phase_id_tournoi_ordre_key").on(table.idTournoi, table.ordre),
	check("phase_type_check", sql`type = ANY (ARRAY['poules'::text, 'elimination'::text])`),
	check("phase_ordre_check", sql`ordre >= 1`),
]);

export const jeu = pgTable("jeu", {
	idJeu: serial("id_jeu").primaryKey().notNull(),
	nom: text().notNull(),
	editeur: text().notNull(),
}, (table) => [
	unique("jeu_nom_key").on(table.nom),
]);

export const tournoi = pgTable("tournoi", {
	idTournoi: serial("id_tournoi").primaryKey().notNull(),
	idJeu: integer("id_jeu").notNull(),
	nom: text().notNull(),
	lieu: text().default('en ligne').notNull(),
	dateDebut: date("date_debut").notNull(),
	dateFin: date("date_fin").notNull(),
	dotation: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
}, (table) => [
	index("tournoi_id_jeu_idx").using("btree", table.idJeu.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idJeu],
			foreignColumns: [jeu.idJeu],
			name: "tournoi_id_jeu_fkey"
		}),
	check("tournoi_dotation_check", sql`dotation >= (0)::numeric`),
	check("tournoi_check", sql`date_fin >= date_debut`),
]);

export const equipe = pgTable("equipe", {
	idEquipe: serial("id_equipe").primaryKey().notNull(),
	idJeu: integer("id_jeu").notNull(),
	nom: text().notNull(),
	tag: text().notNull(),
	pays: text().notNull(),
	creeLe: date("cree_le").notNull(),
}, (table) => [
	index("equipe_id_jeu_idx").using("btree", table.idJeu.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idJeu],
			foreignColumns: [jeu.idJeu],
			name: "equipe_id_jeu_fkey"
		}),
	unique("equipe_nom_key").on(table.nom),
]);

export const joueur = pgTable("joueur", {
	idJoueur: serial("id_joueur").primaryKey().notNull(),
	pseudo: text().notNull(),
	nom: text().notNull(),
	prenom: text().notNull(),
	pays: text().notNull(),
	neLe: date("ne_le").notNull(),
}, (table) => [
	unique("joueur_pseudo_key").on(table.pseudo),
]);

export const match = pgTable("match", {
	idMatch: serial("id_match").primaryKey().notNull(),
	idPhase: integer("id_phase").notNull(),
	dateHeure: timestamp("date_heure", { mode: 'string' }).notNull(),
	format: integer().notNull(),
	statut: text().default('prevu').notNull(),
}, (table) => [
	index("match_id_phase_idx").using("btree", table.idPhase.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idPhase],
			foreignColumns: [phase.idPhase],
			name: "match_id_phase_fkey"
		}),
	check("match_format_check", sql`format = ANY (ARRAY[1, 3, 5])`),
	check("match_statut_check", sql`statut = ANY (ARRAY['prevu'::text, 'en_cours'::text, 'termine'::text, 'annule'::text])`),
]);

export const manche = pgTable("manche", {
	idManche: serial("id_manche").primaryKey().notNull(),
	idMatch: integer("id_match").notNull(),
	numero: integer().notNull(),
	carte: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idMatch],
			foreignColumns: [match.idMatch],
			name: "manche_id_match_fkey"
		}),
	unique("manche_id_match_numero_key").on(table.idMatch, table.numero),
	check("manche_numero_check", sql`numero >= 1`),
]);

export const utilisateurInApp = app.table("utilisateur", {
	idUtilisateur: serial("id_utilisateur").primaryKey().notNull(),
	email: text().notNull(),
	nom: text().notNull(),
	hash: text().notNull(),
	role: text().default('membre').notNull(),
	idEquipe: integer("id_equipe"),
	creeLe: timestamp("cree_le", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.idEquipe],
			foreignColumns: [equipe.idEquipe],
			name: "utilisateur_id_equipe_fkey"
		}),
	unique("utilisateur_email_key").on(table.email),
	unique("utilisateur_id_equipe_key").on(table.idEquipe),
	check("utilisateur_role_check", sql`role = ANY (ARRAY['membre'::text, 'organisateur'::text, 'admin'::text])`),
]);

export const reglagePhaseInApp = app.table("reglage_phase", {
	idPhase: integer("id_phase").primaryKey().notNull(),
	format: integer().notNull(),
	nbQualifies: integer("nb_qualifies"),
}, (table) => [
	foreignKey({
			columns: [table.idPhase],
			foreignColumns: [phase.idPhase],
			name: "reglage_phase_id_phase_fkey"
		}).onDelete("cascade"),
	check("reglage_phase_format_check", sql`format = ANY (ARRAY[1, 3, 5])`),
	check("reglage_phase_nb_qualifies_check", sql`nb_qualifies >= 2`),
]);

export const reglageTournoiInApp = app.table("reglage_tournoi", {
	idTournoi: integer("id_tournoi").primaryKey().notNull(),
	etat: text().default('brouillon').notNull(),
	idOrganisateur: integer("id_organisateur"),
}, (table) => [
	foreignKey({
			columns: [table.idTournoi],
			foreignColumns: [tournoi.idTournoi],
			name: "reglage_tournoi_id_tournoi_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.idOrganisateur],
			foreignColumns: [utilisateurInApp.idUtilisateur],
			name: "reglage_tournoi_id_organisateur_fkey"
		}),
	check("reglage_tournoi_etat_check", sql`etat = ANY (ARRAY['brouillon'::text, 'inscriptions'::text, 'en_cours'::text, 'termine'::text])`),
]);

export const marquer = pgTable("marquer", {
	idManche: integer("id_manche").notNull(),
	idEquipe: integer("id_equipe").notNull(),
	points: integer().notNull(),
}, (table) => [
	index("marquer_id_equipe_idx").using("btree", table.idEquipe.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idManche],
			foreignColumns: [manche.idManche],
			name: "marquer_id_manche_fkey"
		}),
	foreignKey({
			columns: [table.idEquipe],
			foreignColumns: [equipe.idEquipe],
			name: "marquer_id_equipe_fkey"
		}),
	primaryKey({ columns: [table.idManche, table.idEquipe], name: "marquer_pkey"}),
	check("marquer_points_check", sql`points >= 0`),
]);

export const inscrire = pgTable("inscrire", {
	idTournoi: integer("id_tournoi").notNull(),
	idEquipe: integer("id_equipe").notNull(),
	dateInscription: date("date_inscription").notNull(),
	teteDeSerie: integer("tete_de_serie"),
}, (table) => [
	index("inscrire_id_equipe_idx").using("btree", table.idEquipe.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idTournoi],
			foreignColumns: [tournoi.idTournoi],
			name: "inscrire_id_tournoi_fkey"
		}),
	foreignKey({
			columns: [table.idEquipe],
			foreignColumns: [equipe.idEquipe],
			name: "inscrire_id_equipe_fkey"
		}),
	primaryKey({ columns: [table.idTournoi, table.idEquipe], name: "inscrire_pkey"}),
	unique("inscrire_id_tournoi_tete_de_serie_key").on(table.idTournoi, table.teteDeSerie),
	check("inscrire_tete_de_serie_check", sql`tete_de_serie >= 1`),
]);

export const disputer = pgTable("disputer", {
	idMatch: integer("id_match").notNull(),
	idEquipe: integer("id_equipe").notNull(),
	score: integer(),
	forfait: boolean().default(false).notNull(),
}, (table) => [
	index("disputer_id_equipe_idx").using("btree", table.idEquipe.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idMatch],
			foreignColumns: [match.idMatch],
			name: "disputer_id_match_fkey"
		}),
	foreignKey({
			columns: [table.idEquipe],
			foreignColumns: [equipe.idEquipe],
			name: "disputer_id_equipe_fkey"
		}),
	primaryKey({ columns: [table.idMatch, table.idEquipe], name: "disputer_pkey"}),
	check("disputer_score_check", sql`score >= 0`),
]);

export const appartenir = pgTable("appartenir", {
	idJoueur: integer("id_joueur").notNull(),
	idEquipe: integer("id_equipe").notNull(),
	dateEntree: date("date_entree").notNull(),
	dateSortie: date("date_sortie"),
	role: text().notNull(),
}, (table) => [
	index("appartenir_id_equipe_idx").using("btree", table.idEquipe.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.idJoueur],
			foreignColumns: [joueur.idJoueur],
			name: "appartenir_id_joueur_fkey"
		}),
	foreignKey({
			columns: [table.idEquipe],
			foreignColumns: [equipe.idEquipe],
			name: "appartenir_id_equipe_fkey"
		}),
	primaryKey({ columns: [table.idJoueur, table.idEquipe, table.dateEntree], name: "appartenir_pkey"}),
	check("appartenir_check", sql`(date_sortie IS NULL) OR (date_sortie >= date_entree)`),
]);

export const emplacementArbreInApp = app.table("emplacement_arbre", {
	idPhase: integer("id_phase").notNull(),
	tour: integer().notNull(),
	position: integer().notNull(),
	idMatch: integer("id_match"),
	idEquipeQualifiee: integer("id_equipe_qualifiee"),
}, (table) => [
	foreignKey({
			columns: [table.idPhase],
			foreignColumns: [phase.idPhase],
			name: "emplacement_arbre_id_phase_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.idMatch],
			foreignColumns: [match.idMatch],
			name: "emplacement_arbre_id_match_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.idEquipeQualifiee],
			foreignColumns: [equipe.idEquipe],
			name: "emplacement_arbre_id_equipe_qualifiee_fkey"
		}),
	primaryKey({ columns: [table.idPhase, table.tour, table.position], name: "emplacement_arbre_pkey"}),
	unique("emplacement_arbre_id_match_key").on(table.idMatch),
	check("emplacement_arbre_tour_check", sql`tour >= 1`),
	check("emplacement_arbre_position_check", sql`"position" >= 1`),
]);
