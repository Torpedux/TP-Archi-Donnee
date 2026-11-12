import { relations } from "drizzle-orm/relations";
import { tournoi, phase, jeu, equipe, match, manche, utilisateurInApp, reglagePhaseInApp, reglageTournoiInApp, marquer, inscrire, disputer, joueur, appartenir, emplacementArbreInApp } from "./schema";

export const phaseRelations = relations(phase, ({one, many}) => ({
	tournoi: one(tournoi, {
		fields: [phase.idTournoi],
		references: [tournoi.idTournoi]
	}),
	matches: many(match),
	reglagePhaseInApps: many(reglagePhaseInApp),
	emplacementArbreInApps: many(emplacementArbreInApp),
}));

export const tournoiRelations = relations(tournoi, ({one, many}) => ({
	phases: many(phase),
	jeu: one(jeu, {
		fields: [tournoi.idJeu],
		references: [jeu.idJeu]
	}),
	reglageTournoiInApps: many(reglageTournoiInApp),
	inscrires: many(inscrire),
}));

export const jeuRelations = relations(jeu, ({many}) => ({
	tournois: many(tournoi),
	equipes: many(equipe),
}));

export const equipeRelations = relations(equipe, ({one, many}) => ({
	jeu: one(jeu, {
		fields: [equipe.idJeu],
		references: [jeu.idJeu]
	}),
	utilisateurInApps: many(utilisateurInApp),
	marquers: many(marquer),
	inscrires: many(inscrire),
	disputers: many(disputer),
	appartenirs: many(appartenir),
	emplacementArbreInApps: many(emplacementArbreInApp),
}));

export const matchRelations = relations(match, ({one, many}) => ({
	phase: one(phase, {
		fields: [match.idPhase],
		references: [phase.idPhase]
	}),
	manches: many(manche),
	disputers: many(disputer),
	emplacementArbreInApps: many(emplacementArbreInApp),
}));

export const mancheRelations = relations(manche, ({one, many}) => ({
	match: one(match, {
		fields: [manche.idMatch],
		references: [match.idMatch]
	}),
	marquers: many(marquer),
}));

export const utilisateurInAppRelations = relations(utilisateurInApp, ({one, many}) => ({
	equipe: one(equipe, {
		fields: [utilisateurInApp.idEquipe],
		references: [equipe.idEquipe]
	}),
	reglageTournoiInApps: many(reglageTournoiInApp),
}));

export const reglagePhaseInAppRelations = relations(reglagePhaseInApp, ({one}) => ({
	phase: one(phase, {
		fields: [reglagePhaseInApp.idPhase],
		references: [phase.idPhase]
	}),
}));

export const reglageTournoiInAppRelations = relations(reglageTournoiInApp, ({one}) => ({
	tournoi: one(tournoi, {
		fields: [reglageTournoiInApp.idTournoi],
		references: [tournoi.idTournoi]
	}),
	utilisateurInApp: one(utilisateurInApp, {
		fields: [reglageTournoiInApp.idOrganisateur],
		references: [utilisateurInApp.idUtilisateur]
	}),
}));

export const marquerRelations = relations(marquer, ({one}) => ({
	manche: one(manche, {
		fields: [marquer.idManche],
		references: [manche.idManche]
	}),
	equipe: one(equipe, {
		fields: [marquer.idEquipe],
		references: [equipe.idEquipe]
	}),
}));

export const inscrireRelations = relations(inscrire, ({one}) => ({
	tournoi: one(tournoi, {
		fields: [inscrire.idTournoi],
		references: [tournoi.idTournoi]
	}),
	equipe: one(equipe, {
		fields: [inscrire.idEquipe],
		references: [equipe.idEquipe]
	}),
}));

export const disputerRelations = relations(disputer, ({one}) => ({
	match: one(match, {
		fields: [disputer.idMatch],
		references: [match.idMatch]
	}),
	equipe: one(equipe, {
		fields: [disputer.idEquipe],
		references: [equipe.idEquipe]
	}),
}));

export const appartenirRelations = relations(appartenir, ({one}) => ({
	joueur: one(joueur, {
		fields: [appartenir.idJoueur],
		references: [joueur.idJoueur]
	}),
	equipe: one(equipe, {
		fields: [appartenir.idEquipe],
		references: [equipe.idEquipe]
	}),
}));

export const joueurRelations = relations(joueur, ({many}) => ({
	appartenirs: many(appartenir),
}));

export const emplacementArbreInAppRelations = relations(emplacementArbreInApp, ({one}) => ({
	phase: one(phase, {
		fields: [emplacementArbreInApp.idPhase],
		references: [phase.idPhase]
	}),
	match: one(match, {
		fields: [emplacementArbreInApp.idMatch],
		references: [match.idMatch]
	}),
	equipe: one(equipe, {
		fields: [emplacementArbreInApp.idEquipeQualifiee],
		references: [equipe.idEquipe]
	}),
}));