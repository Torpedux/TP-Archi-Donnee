-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "phase" (
	"id_phase" serial PRIMARY KEY NOT NULL,
	"id_tournoi" integer NOT NULL,
	"type" text NOT NULL,
	"ordre" integer NOT NULL,
	CONSTRAINT "phase_id_tournoi_ordre_key" UNIQUE("id_tournoi","ordre"),
	CONSTRAINT "phase_type_check" CHECK (type = ANY (ARRAY['poules'::text, 'elimination'::text])),
	CONSTRAINT "phase_ordre_check" CHECK (ordre >= 1)
);
--> statement-breakpoint
CREATE TABLE "jeu" (
	"id_jeu" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"editeur" text NOT NULL,
	CONSTRAINT "jeu_nom_key" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "tournoi" (
	"id_tournoi" serial PRIMARY KEY NOT NULL,
	"id_jeu" integer NOT NULL,
	"nom" text NOT NULL,
	"lieu" text DEFAULT 'en ligne' NOT NULL,
	"date_debut" date NOT NULL,
	"date_fin" date NOT NULL,
	"dotation" numeric(10, 2) DEFAULT '0' NOT NULL,
	CONSTRAINT "tournoi_dotation_check" CHECK (dotation >= (0)::numeric),
	CONSTRAINT "tournoi_check" CHECK (date_fin >= date_debut)
);
--> statement-breakpoint
CREATE TABLE "equipe" (
	"id_equipe" serial PRIMARY KEY NOT NULL,
	"id_jeu" integer NOT NULL,
	"nom" text NOT NULL,
	"tag" text NOT NULL,
	"pays" text NOT NULL,
	"cree_le" date NOT NULL,
	CONSTRAINT "equipe_nom_key" UNIQUE("nom")
);
--> statement-breakpoint
CREATE TABLE "joueur" (
	"id_joueur" serial PRIMARY KEY NOT NULL,
	"pseudo" text NOT NULL,
	"nom" text NOT NULL,
	"prenom" text NOT NULL,
	"pays" text NOT NULL,
	"ne_le" date NOT NULL,
	CONSTRAINT "joueur_pseudo_key" UNIQUE("pseudo")
);
--> statement-breakpoint
CREATE TABLE "match" (
	"id_match" serial PRIMARY KEY NOT NULL,
	"id_phase" integer NOT NULL,
	"date_heure" timestamp NOT NULL,
	"format" integer NOT NULL,
	"statut" text DEFAULT 'prevu' NOT NULL,
	CONSTRAINT "match_format_check" CHECK (format = ANY (ARRAY[1, 3, 5])),
	CONSTRAINT "match_statut_check" CHECK (statut = ANY (ARRAY['prevu'::text, 'en_cours'::text, 'termine'::text, 'annule'::text]))
);
--> statement-breakpoint
CREATE TABLE "manche" (
	"id_manche" serial PRIMARY KEY NOT NULL,
	"id_match" integer NOT NULL,
	"numero" integer NOT NULL,
	"carte" text NOT NULL,
	CONSTRAINT "manche_id_match_numero_key" UNIQUE("id_match","numero"),
	CONSTRAINT "manche_numero_check" CHECK (numero >= 1)
);
--> statement-breakpoint
CREATE TABLE "app"."utilisateur" (
	"id_utilisateur" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nom" text NOT NULL,
	"hash" text NOT NULL,
	"role" text DEFAULT 'membre' NOT NULL,
	"id_equipe" integer,
	"cree_le" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateur_email_key" UNIQUE("email"),
	CONSTRAINT "utilisateur_id_equipe_key" UNIQUE("id_equipe"),
	CONSTRAINT "utilisateur_role_check" CHECK (role = ANY (ARRAY['membre'::text, 'organisateur'::text, 'admin'::text]))
);
--> statement-breakpoint
CREATE TABLE "app"."reglage_phase" (
	"id_phase" integer PRIMARY KEY NOT NULL,
	"format" integer NOT NULL,
	"nb_qualifies" integer,
	CONSTRAINT "reglage_phase_format_check" CHECK (format = ANY (ARRAY[1, 3, 5])),
	CONSTRAINT "reglage_phase_nb_qualifies_check" CHECK (nb_qualifies >= 2)
);
--> statement-breakpoint
CREATE TABLE "app"."reglage_tournoi" (
	"id_tournoi" integer PRIMARY KEY NOT NULL,
	"etat" text DEFAULT 'brouillon' NOT NULL,
	"id_organisateur" integer,
	CONSTRAINT "reglage_tournoi_etat_check" CHECK (etat = ANY (ARRAY['brouillon'::text, 'inscriptions'::text, 'en_cours'::text, 'termine'::text]))
);
--> statement-breakpoint
CREATE TABLE "marquer" (
	"id_manche" integer NOT NULL,
	"id_equipe" integer NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "marquer_pkey" PRIMARY KEY("id_manche","id_equipe"),
	CONSTRAINT "marquer_points_check" CHECK (points >= 0)
);
--> statement-breakpoint
CREATE TABLE "inscrire" (
	"id_tournoi" integer NOT NULL,
	"id_equipe" integer NOT NULL,
	"date_inscription" date NOT NULL,
	"tete_de_serie" integer,
	CONSTRAINT "inscrire_pkey" PRIMARY KEY("id_tournoi","id_equipe"),
	CONSTRAINT "inscrire_id_tournoi_tete_de_serie_key" UNIQUE("id_tournoi","tete_de_serie"),
	CONSTRAINT "inscrire_tete_de_serie_check" CHECK (tete_de_serie >= 1)
);
--> statement-breakpoint
CREATE TABLE "disputer" (
	"id_match" integer NOT NULL,
	"id_equipe" integer NOT NULL,
	"score" integer,
	"forfait" boolean DEFAULT false NOT NULL,
	CONSTRAINT "disputer_pkey" PRIMARY KEY("id_match","id_equipe"),
	CONSTRAINT "disputer_score_check" CHECK (score >= 0)
);
--> statement-breakpoint
CREATE TABLE "appartenir" (
	"id_joueur" integer NOT NULL,
	"id_equipe" integer NOT NULL,
	"date_entree" date NOT NULL,
	"date_sortie" date,
	"role" text NOT NULL,
	CONSTRAINT "appartenir_pkey" PRIMARY KEY("id_joueur","id_equipe","date_entree"),
	CONSTRAINT "appartenir_check" CHECK ((date_sortie IS NULL) OR (date_sortie >= date_entree))
);
--> statement-breakpoint
CREATE TABLE "app"."emplacement_arbre" (
	"id_phase" integer NOT NULL,
	"tour" integer NOT NULL,
	"position" integer NOT NULL,
	"id_match" integer,
	"id_equipe_qualifiee" integer,
	CONSTRAINT "emplacement_arbre_pkey" PRIMARY KEY("id_phase","tour","position"),
	CONSTRAINT "emplacement_arbre_id_match_key" UNIQUE("id_match"),
	CONSTRAINT "emplacement_arbre_tour_check" CHECK (tour >= 1),
	CONSTRAINT "emplacement_arbre_position_check" CHECK ("position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "phase" ADD CONSTRAINT "phase_id_tournoi_fkey" FOREIGN KEY ("id_tournoi") REFERENCES "public"."tournoi"("id_tournoi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournoi" ADD CONSTRAINT "tournoi_id_jeu_fkey" FOREIGN KEY ("id_jeu") REFERENCES "public"."jeu"("id_jeu") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_id_jeu_fkey" FOREIGN KEY ("id_jeu") REFERENCES "public"."jeu"("id_jeu") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match" ADD CONSTRAINT "match_id_phase_fkey" FOREIGN KEY ("id_phase") REFERENCES "public"."phase"("id_phase") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manche" ADD CONSTRAINT "manche_id_match_fkey" FOREIGN KEY ("id_match") REFERENCES "public"."match"("id_match") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."utilisateur" ADD CONSTRAINT "utilisateur_id_equipe_fkey" FOREIGN KEY ("id_equipe") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reglage_phase" ADD CONSTRAINT "reglage_phase_id_phase_fkey" FOREIGN KEY ("id_phase") REFERENCES "public"."phase"("id_phase") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reglage_tournoi" ADD CONSTRAINT "reglage_tournoi_id_tournoi_fkey" FOREIGN KEY ("id_tournoi") REFERENCES "public"."tournoi"("id_tournoi") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."reglage_tournoi" ADD CONSTRAINT "reglage_tournoi_id_organisateur_fkey" FOREIGN KEY ("id_organisateur") REFERENCES "app"."utilisateur"("id_utilisateur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marquer" ADD CONSTRAINT "marquer_id_manche_fkey" FOREIGN KEY ("id_manche") REFERENCES "public"."manche"("id_manche") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marquer" ADD CONSTRAINT "marquer_id_equipe_fkey" FOREIGN KEY ("id_equipe") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscrire" ADD CONSTRAINT "inscrire_id_tournoi_fkey" FOREIGN KEY ("id_tournoi") REFERENCES "public"."tournoi"("id_tournoi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscrire" ADD CONSTRAINT "inscrire_id_equipe_fkey" FOREIGN KEY ("id_equipe") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputer" ADD CONSTRAINT "disputer_id_match_fkey" FOREIGN KEY ("id_match") REFERENCES "public"."match"("id_match") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputer" ADD CONSTRAINT "disputer_id_equipe_fkey" FOREIGN KEY ("id_equipe") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appartenir" ADD CONSTRAINT "appartenir_id_joueur_fkey" FOREIGN KEY ("id_joueur") REFERENCES "public"."joueur"("id_joueur") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appartenir" ADD CONSTRAINT "appartenir_id_equipe_fkey" FOREIGN KEY ("id_equipe") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."emplacement_arbre" ADD CONSTRAINT "emplacement_arbre_id_phase_fkey" FOREIGN KEY ("id_phase") REFERENCES "public"."phase"("id_phase") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."emplacement_arbre" ADD CONSTRAINT "emplacement_arbre_id_match_fkey" FOREIGN KEY ("id_match") REFERENCES "public"."match"("id_match") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."emplacement_arbre" ADD CONSTRAINT "emplacement_arbre_id_equipe_qualifiee_fkey" FOREIGN KEY ("id_equipe_qualifiee") REFERENCES "public"."equipe"("id_equipe") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tournoi_id_jeu_idx" ON "tournoi" USING btree ("id_jeu" int4_ops);--> statement-breakpoint
CREATE INDEX "equipe_id_jeu_idx" ON "equipe" USING btree ("id_jeu" int4_ops);--> statement-breakpoint
CREATE INDEX "match_id_phase_idx" ON "match" USING btree ("id_phase" int4_ops);--> statement-breakpoint
CREATE INDEX "marquer_id_equipe_idx" ON "marquer" USING btree ("id_equipe" int4_ops);--> statement-breakpoint
CREATE INDEX "inscrire_id_equipe_idx" ON "inscrire" USING btree ("id_equipe" int4_ops);--> statement-breakpoint
CREATE INDEX "disputer_id_equipe_idx" ON "disputer" USING btree ("id_equipe" int4_ops);--> statement-breakpoint
CREATE INDEX "appartenir_id_equipe_idx" ON "appartenir" USING btree ("id_equipe" int4_ops);
*/