import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Acteur } from "@/metier/droits";
import { majorite } from "@/metier/score";
import { acteurParId, attribuerRole, creerCompte } from "@/services/comptes";
import { declarerForfait, genererPhase, saisirManche } from "@/services/moteur";
import {
  ajouterPhase,
  creerTournoi,
  inscrireEquipe,
  ordonnerTetesDeSerie,
  ouvrirInscriptions,
} from "@/services/tournois";

// ENF-02 : la démo du premier lancement. Trois tournois, un par état, joués avec les mêmes services
// que l'interface (donc avec les mêmes règles), sur des équipes du générateur : elles ont déjà un
// historique et un graphe. Les dates sont calées sur le jour du lancement.

/** Les comptes de démo : dans le README, et proposés en un clic sur /connexion quand DEMO=1. */
export const COMPTES_DEMO = [
  {
    libelle: "Admin",
    email: process.env.ADMIN_EMAIL ?? "admin@bracket.test",
    motDePasse: process.env.ADMIN_PASSWORD ?? "admin-bracket",
    detail: "tout, y compris les jeux et les rôles",
  },
  {
    libelle: "Organisateur",
    email: "orga@bracket.test",
    motDePasse: "orga-bracket",
    detail: "ses tournois : phases, inscriptions, scores",
  },
  {
    libelle: "Capitaine",
    email: "capitaine@bracket.test",
    motDePasse: "capitaine-bracket",
    detail: "son équipe, ses inscriptions",
  },
] as const;

export const NOMS_DEMO = {
  poules: "Bracket Open",
  finale: "Bracket Masters",
  inscriptions: "Bracket Rookie Cup",
} as const;

const jour = (decalage: number) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toLocaleDateString("sv-SE"); // AAAA-MM-JJ, heure locale
};

type MatchDemo = { idMatch: number; format: number; a: number; b: number };

async function matchsPrevus(idPhase: number) {
  return [
    ...(await db.execute<MatchDemo>(sql`
      SELECT m.id_match AS "idMatch", m.format, min(d.id_equipe) AS a, max(d.id_equipe) AS b
      FROM match m JOIN disputer d ON d.id_match = m.id_match
      WHERE m.id_phase = ${idPhase} AND m.statut = 'prevu'
      GROUP BY m.id_match ORDER BY m.date_heure, m.id_match`)),
  ];
}

export async function installerDemo() {
  const [{ deja }] = await db.execute<{ deja: boolean }>(
    sql`SELECT EXISTS (SELECT 1 FROM app.utilisateur WHERE email = ${COMPTES_DEMO[1].email}) AS deja`,
  );
  if (deja) return;

  // Deux jeux qui ont assez d'équipes ; sinon (base vide ou incomplète) pas de démo.
  const jeux = await db.execute<{ idJeu: number; equipes: number[]; cartes: string[] }>(sql`
    SELECT j.id_jeu AS "idJeu",
           (SELECT array_agg(e.id_equipe ORDER BY e.id_equipe) FROM equipe e WHERE e.id_jeu = j.id_jeu) AS equipes,
           coalesce((SELECT array_agg(DISTINCT ma.carte) FROM manche ma
                     JOIN match m ON m.id_match = ma.id_match JOIN phase ph ON ph.id_phase = m.id_phase
                     JOIN tournoi t ON t.id_tournoi = ph.id_tournoi WHERE t.id_jeu = j.id_jeu), ARRAY['Carte 1', 'Carte 2', 'Carte 3']) AS cartes
    FROM jeu j ORDER BY j.id_jeu`);
  const [jeuA, jeuB] = jeux.filter((j) => (j.equipes?.length ?? 0) >= 10);
  if (!jeuA || !jeuB) {
    console.warn("Démo non installée : il faut deux jeux d'au moins 10 équipes (lancez le service seed).");
    return;
  }

  const [{ idAdmin }] = await db.execute<{ idAdmin: number }>(
    sql`SELECT id_utilisateur AS "idAdmin" FROM app.utilisateur WHERE role = 'admin' ORDER BY id_utilisateur LIMIT 1`,
  );
  const admin = await acteurParId(idAdmin);
  const orga = await acteurParId(
    await creerCompte({ ...COMPTES_DEMO[1], nom: "Organisatrice de démo" }, "organisateur"),
  );
  const idCapitaine = await creerCompte({ ...COMPTES_DEMO[2], nom: "Capitaine de démo" });
  // Le capitaine de démo reçoit une équipe du générateur, pas encore inscrite au tournoi ouvert.
  await attribuerRole(admin, { idUtilisateur: idCapitaine, role: "membre", idEquipe: jeuA.equipes[9] });

  let n = 0;
  /** Joue un match : le vainqueur prend les manches qu'il faut, le perdant en prend une si `accroche`. */
  async function jouer(
    m: MatchDemo,
    cartes: string[],
    vainqueur: number,
    accroche: boolean,
    manches = Infinity,
  ) {
    const gagnantes = [...Array(majorite(m.format)).fill(vainqueur)];
    if (accroche && m.format > 1) gagnantes.splice(1, 0, vainqueur === m.a ? m.b : m.a);
    for (const equipe of gagnantes.slice(0, manches)) {
      const perdant = 4 + ((n * 7) % 9);
      await saisirManche(orga, {
        idMatch: m.idMatch,
        carte: cartes[n++ % cartes.length],
        pointsA: equipe === m.a ? 13 : perdant,
        pointsB: equipe === m.b ? 13 : perdant,
      });
    }
  }
  /** Le favori (la meilleure tête de série = le plus petit rang) gagne, sauf une fois sur trois. */
  const vainqueurDe = (m: MatchDemo, rang: Map<number, number>, i: number) => {
    const [favori, outsider] = rang.get(m.a)! < rang.get(m.b)! ? [m.a, m.b] : [m.b, m.a];
    return i % 3 === 2 ? outsider : favori;
  };

  async function preparer(
    nom: string,
    jeu: (typeof jeux)[number],
    equipes: number[],
    debut: number,
    fin: number,
    formatPoules: number,
    acteur: Acteur = orga,
  ) {
    const idTournoi = await creerTournoi(acteur, {
      idJeu: jeu.idJeu,
      nom,
      lieu: "Ynov Paris",
      dateDebut: jour(debut),
      dateFin: jour(fin),
      dotation: 2000,
    });
    const poules = await ajouterPhase(acteur, {
      idTournoi,
      type: "poules",
      format: formatPoules,
      nbQualifies: 4,
    });
    const elimination = await ajouterPhase(acteur, { idTournoi, type: "elimination", format: 3 });
    await ouvrirInscriptions(acteur, { idTournoi });
    for (const idEquipe of equipes) await inscrireEquipe(acteur, { idTournoi, idEquipe });
    await ordonnerTetesDeSerie(acteur, { idTournoi, idsEquipes: equipes });
    return { idTournoi, poules, elimination, rang: new Map(equipes.map((e, i) => [e, i])) };
  }

  // 1. En poules (BO3) : 8 matchs joués, 1 forfait, 1 en cours, 5 à saisir.
  const open = await preparer(NOMS_DEMO.poules, jeuA, jeuA.equipes.slice(0, 6), 0, 3, 3);
  await genererPhase(orga, { idPhase: open.poules });
  for (const [i, m] of (await matchsPrevus(open.poules)).slice(0, 10).entries()) {
    const v = vainqueurDe(m, open.rang, i);
    if (i === 4) await declarerForfait(orga, { idMatch: m.idMatch, idEquipe: v === m.a ? m.b : m.a });
    else if (i === 9)
      await jouer(m, jeuA.cartes, v, false, 1); // une manche : le match est en cours
    else await jouer(m, jeuA.cartes, v, i % 2 === 0);
  }

  // 2. En phase finale : poules (BO1) finies, une demi-finale jouée, l'autre en cours, finale vide.
  const masters = await preparer(NOMS_DEMO.finale, jeuB, jeuB.equipes.slice(0, 6), -2, 1, 1);
  await genererPhase(orga, { idPhase: masters.poules });
  for (const [i, m] of (await matchsPrevus(masters.poules)).entries())
    await jouer(m, jeuB.cartes, vainqueurDe(m, masters.rang, i), false);
  await genererPhase(orga, { idPhase: masters.elimination });
  const [demi1, demi2] = await matchsPrevus(masters.elimination);
  await jouer(demi1, jeuB.cartes, demi1.a, true);
  await jouer(demi2, jeuB.cartes, demi2.b, false, 1);

  // 3. Inscriptions ouvertes : le capitaine de démo peut y inscrire son équipe.
  await preparer(NOMS_DEMO.inscriptions, jeuA, jeuA.equipes.slice(6, 9), 10, 13, 1);
}
