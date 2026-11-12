import { sql } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "@/db/client";
import { deduireArbre, nbTours, premierTour, suivant, tailleArbre, type Place } from "@/metier/arbre";
import { creneaux, pairesRoundRobin } from "@/metier/poules";
import { erreurManche, etatDuMatch, scoreForfait, sequenceValide } from "@/metier/score";
import { obstaclesAuDemarrage } from "@/metier/tournoi";
import { classementPoule } from "@/requetes/classement";
import { apresCommit } from "./diffusion";
import { chargerTournoi, exiger, exigerDroit, id, texte, transaction, valider, type Acteur } from "./socle";

// Le moteur de tournoi (EF-06 à EF-10). Chaque opération est une transaction (ENF-04) qui verrouille
// la ligne du tournoi : deux saisies sur un même tournoi passent l'une après l'autre.
// Les règles sont dans src/metier (fonctions pures) ; ici, on lit, on applique, on écrit.

type MatchCharge = {
  idMatch: number;
  idPhase: number;
  idTournoi: number;
  typePhase: "poules" | "elimination";
  ordre: number;
  format: number;
  statut: "prevu" | "en_cours" | "termine" | "annule";
  idA: number; // le plus petit id_equipe du match
  idB: number;
};

/** Charge un match, verrouille son tournoi et vérifie le droit de le gérer. */
async function chargerMatch(tx: Tx, acteur: Acteur, idMatch: number) {
  const [m] = await tx.execute<MatchCharge>(sql`
    SELECT m.id_match AS "idMatch", m.id_phase AS "idPhase", ph.id_tournoi AS "idTournoi", ph.type AS "typePhase",
           ph.ordre, m.format, m.statut, min(d.id_equipe) AS "idA", max(d.id_equipe) AS "idB"
    FROM match m
    JOIN phase ph   ON ph.id_phase = m.id_phase
    JOIN disputer d ON d.id_match = m.id_match
    WHERE m.id_match = ${idMatch}
    GROUP BY m.id_match, ph.id_phase`);
  exiger(m, "Match introuvable.");
  const t = await chargerTournoi(tx, m.idTournoi);
  exigerDroit(acteur, "tournoi.gerer", t);
  // Relu après le verrou : un autre organisateur a pu le modifier entre-temps.
  const [{ statut }] = await tx.execute<{ statut: MatchCharge["statut"] }>(
    sql`SELECT statut FROM match WHERE id_match = ${idMatch}`,
  );
  return { m: { ...m, statut }, t };
}

async function creerMatch(tx: Tx, idPhase: number, quand: string, format: number, a: number, b: number) {
  const [r] = await tx.execute<{ id: number }>(sql`
    INSERT INTO match (id_phase, date_heure, format, statut) VALUES (${idPhase}, ${quand}, ${format}, 'prevu')
    RETURNING id_match AS id`);
  // RG9 : exactement deux équipes, créées avec le match dans la même transaction.
  await tx.execute(sql`INSERT INTO disputer (id_match, id_equipe) VALUES (${r.id}, ${a}), (${r.id}, ${b})`);
  return r.id;
}

// Le qualifié d'un emplacement : l'équipe désignée (exempt, ou choisie après une annulation),
// sinon le vainqueur de son match terminé.
const QUALIFIES = (idPhase: number) => sql`
  SELECT e.tour, e.position,
         coalesce(e.id_equipe_qualifiee,
                  (SELECT d.id_equipe FROM match m JOIN disputer d ON d.id_match = m.id_match
                   WHERE m.id_match = e.id_match AND m.statut = 'termine'
                   ORDER BY d.score DESC LIMIT 1)) AS equipe,
         (SELECT m.date_heure FROM match m WHERE m.id_match = e.id_match) AS quand
  FROM app.emplacement_arbre e WHERE e.id_phase = ${idPhase}`;

/** EF-07 : crée chaque match de l'arbre dont les deux équipes sont maintenant connues. */
async function avancer(tx: Tx, idPhase: number, dateParDefaut: string) {
  const [{ format }] = await tx.execute<{ format: number }>(sql`
    SELECT coalesce((SELECT format FROM app.reglage_phase WHERE id_phase = ${idPhase}), 3) AS format`);
  const prets = await tx.execute<{ tour: number; position: number; a: number; b: number; quand: string }>(sql`
    WITH q AS (${QUALIFIES(idPhase)})
    SELECT p.tour, p.position, g.equipe AS a, d.equipe AS b,
           coalesce(greatest(g.quand, d.quand) + interval '3 hours', ${dateParDefaut}::timestamp)::text AS quand
    FROM app.emplacement_arbre p
    JOIN q g ON g.tour = p.tour - 1 AND g.position = 2 * p.position - 1
    JOIN q d ON d.tour = p.tour - 1 AND d.position = 2 * p.position
    WHERE p.id_phase = ${idPhase} AND p.id_match IS NULL AND p.id_equipe_qualifiee IS NULL
      AND g.equipe IS NOT NULL AND d.equipe IS NOT NULL`);
  for (const p of prets) {
    const idMatch = await creerMatch(tx, idPhase, p.quand, format, p.a, p.b);
    await tx.execute(sql`
      UPDATE app.emplacement_arbre SET id_match = ${idMatch}
      WHERE id_phase = ${idPhase} AND tour = ${p.tour} AND position = ${p.position}`);
  }
}

async function placeDuMatch(tx: Tx, idMatch: number) {
  const [p] = await tx.execute<Place & { idPhase: number }>(sql`
    SELECT id_phase AS "idPhase", tour, position FROM app.emplacement_arbre WHERE id_match = ${idMatch}`);
  return p as (Place & { idPhase: number }) | undefined;
}

async function matchSuivant(tx: Tx, idMatch: number) {
  const place = await placeDuMatch(tx, idMatch);
  if (!place) return undefined;
  const s = suivant(place);
  const [r] = await tx.execute<{ idMatch: number; statut: string }>(sql`
    SELECT m.id_match AS "idMatch", m.statut
    FROM app.emplacement_arbre e JOIN match m ON m.id_match = e.id_match
    WHERE e.id_phase = ${place.idPhase} AND e.tour = ${s.tour} AND e.position = ${s.position}`);
  return r as { idMatch: number; statut: string } | undefined;
}

/** EF-08 : une correction n'est possible que tant que le tour suivant n'a pas commencé. */
async function exigerTourSuivantPasCommence(tx: Tx, m: MatchCharge) {
  if (m.typePhase === "elimination") {
    const s = await matchSuivant(tx, m.idMatch);
    exiger(!s || s.statut === "prevu", "Correction impossible : le tour suivant a commencé.");
  } else {
    const [{ n }] = await tx.execute<{ n: number }>(sql`
      SELECT count(*)::int AS n FROM match x JOIN phase ph ON ph.id_phase = x.id_phase
      WHERE ph.id_tournoi = ${m.idTournoi} AND ph.ordre > ${m.ordre}`);
    exiger(n === 0, "Correction impossible : le tour suivant a commencé (la phase suivante est générée).");
  }
}

/**
 * À appeler après tout changement du résultat d'un match : dans l'arbre, le match suivant (pas encore
 * commencé) est défait puis recréé avec le bon qualifié ; l'état du tournoi suit la fin de la dernière phase.
 */
async function propager(tx: Tx, m: MatchCharge) {
  if (m.typePhase === "elimination") {
    const s = await matchSuivant(tx, m.idMatch);
    if (s) {
      await tx.execute(sql`DELETE FROM disputer WHERE id_match = ${s.idMatch}`);
      await tx.execute(sql`DELETE FROM match WHERE id_match = ${s.idMatch}`); // l'emplacement repasse à NULL
    }
    const [{ quand }] = await tx.execute<{ quand: string }>(
      sql`SELECT (date_heure + interval '3 hours')::text AS quand FROM match WHERE id_match = ${m.idMatch}`,
    );
    await avancer(tx, m.idPhase, quand);
  }
  await majEtatTournoi(tx, m.idTournoi);
}

/** Le tournoi est terminé quand sa dernière phase l'est : finale jouée, ou tous les matchs de poule joués. */
async function majEtatTournoi(tx: Tx, idTournoi: number) {
  const [d] = await tx.execute<{ idPhase: number; type: string }>(sql`
    SELECT id_phase AS "idPhase", type FROM phase WHERE id_tournoi = ${idTournoi} ORDER BY ordre DESC LIMIT 1`);
  if (!d) return;
  const [{ fini }] =
    d.type === "elimination"
      ? await tx.execute<{ fini: boolean }>(sql`
          WITH q AS (${QUALIFIES(d.idPhase)})
          SELECT coalesce((SELECT equipe IS NOT NULL FROM q ORDER BY tour DESC LIMIT 1), false) AS fini`)
      : await tx.execute<{ fini: boolean }>(sql`
          SELECT count(*) > 0 AND count(*) FILTER (WHERE statut IN ('prevu', 'en_cours')) = 0 AS fini
          FROM match WHERE id_phase = ${d.idPhase}`);
  await tx.execute(sql`
    UPDATE app.reglage_tournoi SET etat = ${fini ? "termine" : "en_cours"}
    WHERE id_tournoi = ${idTournoi} AND etat IN ('en_cours', 'termine')`);
}

// --- Génération (EF-06, EF-07) -----------------------------------------------------------

/**
 * Génère les matchs d'une phase. La première phase démarre le tournoi (RG3, RG5) ; une phase
 * suivante prend les qualifiés de la poule, dans l'ordre du classement. Regénérer est permis tant
 * qu'aucun match de la phase n'est joué.
 */
export async function genererPhase(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idPhase: id }), donnees);
  const idTournoi = await transaction(async (tx) => {
    const [ph] = await tx.execute<{
      idTournoi: number;
      type: "poules" | "elimination";
      ordre: number;
      format: number;
    }>(sql`
      SELECT ph.id_tournoi AS "idTournoi", ph.type, ph.ordre, coalesce(rp.format, 3) AS format
      FROM phase ph LEFT JOIN app.reglage_phase rp ON rp.id_phase = ph.id_phase
      WHERE ph.id_phase = ${d.idPhase}`);
    exiger(ph, "Phase introuvable.");
    const t = await chargerTournoi(tx, ph.idTournoi);
    exigerDroit(acteur, "tournoi.gerer", t);

    const [{ joues }] = await tx.execute<{ joues: number }>(
      sql`SELECT count(*)::int AS joues FROM match WHERE id_phase = ${d.idPhase} AND statut <> 'prevu'`,
    );
    exiger(joues === 0, "Cette phase a déjà un match joué : elle ne peut plus être regénérée.");
    await tx.execute(
      sql`DELETE FROM disputer WHERE id_match IN (SELECT id_match FROM match WHERE id_phase = ${d.idPhase})`,
    );
    await tx.execute(sql`DELETE FROM app.emplacement_arbre WHERE id_phase = ${d.idPhase}`);
    await tx.execute(sql`DELETE FROM match WHERE id_phase = ${d.idPhase}`);

    let participants: number[];
    let debut: string;
    if (ph.ordre === 1) {
      exiger(t.etat === "inscriptions" || t.etat === "en_cours", "Ouvrez d'abord les inscriptions.");
      const [n] = await tx.execute<{ nbPhases: number; nbEquipes: number }>(sql`
        SELECT (SELECT count(*)::int FROM phase WHERE id_tournoi = ${t.idTournoi}) AS "nbPhases",
               (SELECT count(*)::int FROM inscrire WHERE id_tournoi = ${t.idTournoi}) AS "nbEquipes"`);
      const obstacles = obstaclesAuDemarrage(n);
      exiger(obstacles.length === 0, obstacles.join(" "));
      // Les têtes de série qui manquent suivent l'ordre d'inscription, après celles déjà fixées.
      await tx.execute(sql`
        UPDATE inscrire i SET tete_de_serie = x.rang
        FROM (SELECT id_equipe,
                     (SELECT coalesce(max(tete_de_serie), 0) FROM inscrire WHERE id_tournoi = ${t.idTournoi})
                       + row_number() OVER (ORDER BY date_inscription, id_equipe) AS rang
              FROM inscrire WHERE id_tournoi = ${t.idTournoi} AND tete_de_serie IS NULL) x
        WHERE i.id_tournoi = ${t.idTournoi} AND i.id_equipe = x.id_equipe`);
      const inscrites = await tx.execute<{ idEquipe: number }>(sql`
        SELECT id_equipe AS "idEquipe" FROM inscrire WHERE id_tournoi = ${t.idTournoi} ORDER BY tete_de_serie`);
      participants = inscrites.map((i) => i.idEquipe);
      debut = t.dateDebut;
      await tx.execute(
        sql`UPDATE app.reglage_tournoi SET etat = 'en_cours' WHERE id_tournoi = ${t.idTournoi}`,
      );
    } else {
      const [prec] = await tx.execute<{
        idPhase: number;
        nbQualifies: number;
        matchs: number;
        restants: number;
        lendemain: string;
      }>(sql`
        SELECT p.id_phase AS "idPhase", coalesce(rp.nb_qualifies, 2) AS "nbQualifies",
               count(m.id_match)::int AS matchs,
               count(m.id_match) FILTER (WHERE m.statut IN ('prevu', 'en_cours'))::int AS restants,
               (max(m.date_heure)::date + 1)::text AS lendemain
        FROM phase p
        LEFT JOIN app.reglage_phase rp ON rp.id_phase = p.id_phase
        LEFT JOIN match m ON m.id_phase = p.id_phase
        WHERE p.id_tournoi = ${t.idTournoi} AND p.ordre = ${ph.ordre - 1}
        GROUP BY p.id_phase, rp.nb_qualifies`);
      exiger(
        prec && prec.matchs > 0 && prec.restants === 0,
        "La phase précédente n'est pas terminée : il reste des matchs à jouer.",
      );
      // Décision du cadrage : placement d'après le classement de poule (1er contre 4e, 2e contre 3e).
      participants = (await classementPoule(prec.idPhase, tx))
        .slice(0, prec.nbQualifies)
        .map((l) => l.idEquipe);
      debut = prec.lendemain;
    }
    exiger(participants.length >= 2, "Il faut au moins deux équipes pour générer cette phase (RG9).");

    if (ph.type === "poules") {
      const paires = pairesRoundRobin(participants);
      const dates = creneaux(debut, paires.length);
      for (const [i, [a, b]] of paires.entries()) await creerMatch(tx, d.idPhase, dates[i], ph.format, a, b);
    } else {
      const tour1 = premierTour(participants);
      const tours = nbTours(tailleArbre(participants.length));
      const dates = creneaux(debut, tour1.length);
      for (let tour = 1; tour <= tours; tour++)
        for (let position = 1; position <= tour1.length / 2 ** (tour - 1); position++)
          await tx.execute(sql`
            INSERT INTO app.emplacement_arbre (id_phase, tour, position) VALUES (${d.idPhase}, ${tour}, ${position})`);
      for (const [i, e] of tour1.entries()) {
        // Un exempt avance sans match : RG9 interdit un match à une seule équipe.
        const maj =
          "exempt" in e
            ? sql`id_equipe_qualifiee = ${e.exempt}`
            : sql`id_match = ${await creerMatch(tx, d.idPhase, dates[i], ph.format, e.equipes[0], e.equipes[1])}`;
        await tx.execute(sql`
          UPDATE app.emplacement_arbre SET ${maj}
          WHERE id_phase = ${d.idPhase} AND tour = 1 AND position = ${e.position}`);
      }
      await avancer(tx, d.idPhase, creneaux(debut, tour1.length + 1)[tour1.length]);
    }
    return t.idTournoi;
  });
  await apresCommit({ idTournoi });
}

// --- Saisie des scores (EF-08) -----------------------------------------------------------

/** Recalcule le score et le statut d'un match depuis ses manches : le score n'est jamais saisi. */
async function recalculer(tx: Tx, m: MatchCharge) {
  const manches = await tx.execute<{ pointsA: number; pointsB: number }>(sql`
    SELECT a.points AS "pointsA", b.points AS "pointsB"
    FROM manche ma
    JOIN marquer a ON a.id_manche = ma.id_manche AND a.id_equipe = ${m.idA}
    JOIN marquer b ON b.id_manche = ma.id_manche AND b.id_equipe = ${m.idB}
    WHERE ma.id_match = ${m.idMatch} ORDER BY ma.numero`);
  exiger(
    sequenceValide(m.format, [...manches]),
    "Avec ce résultat, le match aurait fini plus tôt : supprimez d'abord la dernière manche.",
  );
  const e = etatDuMatch(m.format, [...manches]);
  const vide = manches.length === 0;
  await tx.execute(sql`
    UPDATE disputer SET forfait = false,
      score = CASE WHEN ${vide} THEN NULL WHEN id_equipe = ${m.idA} THEN ${e.scoreA}::int ELSE ${e.scoreB}::int END
    WHERE id_match = ${m.idMatch}`);
  await tx.execute(sql`
    UPDATE match SET statut = ${e.termine ? "termine" : vide ? "prevu" : "en_cours"} WHERE id_match = ${m.idMatch}`);
  await propager(tx, m);
}

const points = z.coerce.number("Points : nombre attendu.");
const manche = z.object({ idMatch: id, carte: texte("Carte", 60), pointsA: points, pointsB: points });

/**
 * EF-08 : saisir une manche (RG10, RG11). Le match passe « en cours » à la première manche, et
 * « terminé » dès qu'une équipe atteint la majorité du format ; son vainqueur avance dans l'arbre.
 */
export async function saisirManche(acteur: Acteur, donnees: unknown) {
  const d = valider(manche, donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m, t } = await chargerMatch(tx, acteur, d.idMatch);
    exiger(t.etat === "en_cours", "Le tournoi n'est pas en cours.");
    exiger(m.statut !== "termine", "Le match est terminé : plus de manche à saisir.");
    exiger(m.statut !== "annule", "Ce match est annulé.");
    const erreur = erreurManche(d);
    exiger(!erreur, erreur ?? "");
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO manche (id_match, numero, carte)
      VALUES (${m.idMatch}, (SELECT count(*) + 1 FROM manche WHERE id_match = ${m.idMatch}), ${d.carte})
      RETURNING id_manche AS id`);
    await tx.execute(sql`
      INSERT INTO marquer (id_manche, id_equipe, points) VALUES (${r.id}, ${m.idA}, ${d.pointsA}), (${r.id}, ${m.idB}, ${d.pointsB})`);
    await recalculer(tx, m);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi, idMatch: d.idMatch });
}

/** EF-08 : corriger une manche, tant que le tour suivant n'a pas commencé. */
export async function corrigerManche(acteur: Acteur, donnees: unknown) {
  const d = valider(manche.omit({ idMatch: true }).extend({ idManche: id }), donnees);
  const cible = await transaction(async (tx) => {
    const [ma] = await tx.execute<{ idMatch: number }>(
      sql`SELECT id_match AS "idMatch" FROM manche WHERE id_manche = ${d.idManche}`,
    );
    exiger(ma, "Manche introuvable.");
    const { m } = await chargerMatch(tx, acteur, ma.idMatch);
    await exigerTourSuivantPasCommence(tx, m);
    const erreur = erreurManche(d);
    exiger(!erreur, erreur ?? "");
    await tx.execute(sql`UPDATE manche SET carte = ${d.carte} WHERE id_manche = ${d.idManche}`);
    await tx.execute(sql`
      UPDATE marquer SET points = CASE WHEN id_equipe = ${m.idA} THEN ${d.pointsA}::int ELSE ${d.pointsB}::int END
      WHERE id_manche = ${d.idManche}`);
    await recalculer(tx, m);
    return { idTournoi: m.idTournoi, idMatch: m.idMatch };
  });
  await apresCommit(cible);
}

/** EF-08 : retirer la dernière manche saisie (erreur de saisie), tant que le tour suivant n'a pas commencé. */
export async function supprimerDerniereManche(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idMatch: id }), donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m } = await chargerMatch(tx, acteur, d.idMatch);
    await exigerTourSuivantPasCommence(tx, m);
    const [derniere] = await tx.execute<{ id: number }>(
      sql`SELECT id_manche AS id FROM manche WHERE id_match = ${m.idMatch} ORDER BY numero DESC LIMIT 1`,
    );
    exiger(derniere, "Ce match n'a aucune manche.");
    await tx.execute(sql`DELETE FROM marquer WHERE id_manche = ${derniere.id}`);
    await tx.execute(sql`DELETE FROM manche WHERE id_manche = ${derniere.id}`);
    await recalculer(tx, m);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi, idMatch: d.idMatch });
}

// --- Forfait, annulation (EF-09, EF-10) --------------------------------------------------

const equipeDuMatch = z.object({ idMatch: id, idEquipe: id });

/**
 * EF-09 : forfait d'une équipe (RG12). L'adversaire gagne avec le score maximal du format, aucune
 * manche n'est enregistrée, le match passe à « terminé », le forfait est marqué sur l'équipe.
 */
export async function declarerForfait(acteur: Acteur, donnees: unknown) {
  const d = valider(equipeDuMatch, donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m, t } = await chargerMatch(tx, acteur, d.idMatch);
    exiger(t.etat === "en_cours", "Le tournoi n'est pas en cours.");
    exiger(m.statut !== "termine", "Le match est terminé : plus de forfait possible.");
    exiger(d.idEquipe === m.idA || d.idEquipe === m.idB, "Cette équipe ne dispute pas ce match.");
    const s = scoreForfait(m.format);
    await tx.execute(
      sql`DELETE FROM marquer WHERE id_manche IN (SELECT id_manche FROM manche WHERE id_match = ${m.idMatch})`,
    );
    await tx.execute(sql`DELETE FROM manche WHERE id_match = ${m.idMatch}`);
    await tx.execute(sql`
      UPDATE disputer SET forfait = (id_equipe = ${d.idEquipe}),
        score = CASE WHEN id_equipe = ${d.idEquipe} THEN ${s.perdant}::int ELSE ${s.vainqueur}::int END
      WHERE id_match = ${m.idMatch}`);
    await tx.execute(sql`UPDATE match SET statut = 'termine' WHERE id_match = ${m.idMatch}`);
    // Un forfait déclaré à la place d'une annulation remplace la désignation éventuelle (EF-10).
    await tx.execute(
      sql`UPDATE app.emplacement_arbre SET id_equipe_qualifiee = NULL WHERE id_match = ${m.idMatch}`,
    );
    await propager(tx, m);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi, idMatch: d.idMatch });
}

/** EF-10 : annuler un match prévu (RG8). Il n'a pas de vainqueur et n'alimente aucun tour. */
export async function annulerMatch(acteur: Acteur, donnees: unknown) {
  const d = valider(z.object({ idMatch: id }), donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m } = await chargerMatch(tx, acteur, d.idMatch);
    exiger(m.statut === "prevu", "Seul un match prévu peut être annulé.");
    await tx.execute(sql`UPDATE match SET statut = 'annule' WHERE id_match = ${m.idMatch}`);
    await propager(tx, m);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi, idMatch: d.idMatch });
}

/** EF-10 : après l'annulation d'un match de l'arbre, l'organisateur désigne l'équipe qui avance. */
export async function designerQualifie(acteur: Acteur, donnees: unknown) {
  const d = valider(equipeDuMatch, donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m } = await chargerMatch(tx, acteur, d.idMatch);
    exiger(
      m.statut === "annule" && m.typePhase === "elimination",
      "On ne désigne un qualifié que pour un match annulé de l'arbre.",
    );
    exiger(d.idEquipe === m.idA || d.idEquipe === m.idB, "Cette équipe ne dispute pas ce match.");
    await exigerTourSuivantPasCommence(tx, m);
    await tx.execute(
      sql`UPDATE app.emplacement_arbre SET id_equipe_qualifiee = ${d.idEquipe} WHERE id_match = ${m.idMatch}`,
    );
    await propager(tx, m);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi, idMatch: d.idMatch });
}

const horaire = z.object({
  idMatch: id,
  dateHeure: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, "Date et heure invalides.")
    .transform((v) => v.replace("T", " ").slice(0, 16) + ":00"),
});

/** EF-06 : l'organisateur peut déplacer un match qui n'a pas commencé. */
export async function modifierDateMatch(acteur: Acteur, donnees: unknown) {
  const d = valider(horaire, donnees);
  const idTournoi = await transaction(async (tx) => {
    const { m } = await chargerMatch(tx, acteur, d.idMatch);
    exiger(m.statut === "prevu", "Seul un match prévu peut être déplacé.");
    await tx.execute(sql`UPDATE match SET date_heure = ${d.dateHeure} WHERE id_match = ${m.idMatch}`);
    return m.idTournoi;
  });
  await apresCommit({ idTournoi });
}

// --- Rattrapage des tournois du générateur -----------------------------------------------

/**
 * Les tournois chargés par le générateur n'ont ni réglage de phase ni emplacement d'arbre (schéma app).
 * On les déduit des matchs, une fois : format = celui des matchs, qualifiés = équipes de la phase
 * suivante, arbre = metier/arbre.deduireArbre. Idempotent.
 */
export async function rattraperTournoisImportes() {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      INSERT INTO app.reglage_phase (id_phase, format, nb_qualifies)
      SELECT ph.id_phase, (SELECT min(m.format) FROM match m WHERE m.id_phase = ph.id_phase),
             CASE WHEN ph.type = 'poules' THEN
               (SELECT CASE WHEN count(DISTINCT d.id_equipe) >= 2 THEN count(DISTINCT d.id_equipe) END
                FROM phase s JOIN match m ON m.id_phase = s.id_phase JOIN disputer d ON d.id_match = m.id_match
                WHERE s.id_tournoi = ph.id_tournoi AND s.ordre = ph.ordre + 1) END
      FROM phase ph
      WHERE EXISTS (SELECT 1 FROM match m WHERE m.id_phase = ph.id_phase)
        AND NOT EXISTS (SELECT 1 FROM app.reglage_phase rp WHERE rp.id_phase = ph.id_phase)`);
    const lignes = await tx.execute<{
      idPhase: number;
      idMatch: number;
      dateHeure: string;
      a: number;
      b: number;
    }>(sql`
      SELECT m.id_phase AS "idPhase", m.id_match AS "idMatch", m.date_heure AS "dateHeure",
             min(d.id_equipe) AS a, max(d.id_equipe) AS b
      FROM phase ph
      JOIN match m    ON m.id_phase = ph.id_phase AND m.statut = 'termine'
      JOIN disputer d ON d.id_match = m.id_match
      WHERE ph.type = 'elimination'
        AND NOT EXISTS (SELECT 1 FROM app.emplacement_arbre e WHERE e.id_phase = ph.id_phase)
        AND NOT EXISTS (SELECT 1 FROM app.reglage_tournoi rt WHERE rt.id_tournoi = ph.id_tournoi)
      GROUP BY m.id_match`);
    for (const [idPhase, matchs] of Map.groupBy([...lignes], (l) => l.idPhase))
      for (const e of deduireArbre(matchs.map((l) => ({ ...l, equipes: [l.a, l.b] }))))
        await tx.execute(sql`
          INSERT INTO app.emplacement_arbre (id_phase, tour, position, id_match, id_equipe_qualifiee)
          VALUES (${idPhase}, ${e.tour}, ${e.position}, ${e.idMatch}, ${e.exempt})`);
  });
}
