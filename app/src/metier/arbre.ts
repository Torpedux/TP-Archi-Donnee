// EF-07 : l'arbre d'élimination directe. Le MCD ne dit pas où un match se place dans l'arbre (O2) :
// tour 1 = premier tour, position 1 = en haut. Les positions 2k−1 et 2k alimentent la position k
// du tour suivant.

/** La puissance de 2 immédiatement supérieure ou égale au nombre d'équipes. */
export function tailleArbre(nbEquipes: number) {
  let taille = 2;
  while (taille < nbEquipes) taille *= 2;
  return taille;
}

export const nbTours = (taille: number) => Math.log2(taille);

/** Placement standard des têtes de série : pour 8, [1, 8, 4, 5, 2, 7, 3, 6]. */
export function ordreDePlacement(taille: number): number[] {
  let ordre = [1, 2];
  while (ordre.length < taille) {
    const n = ordre.length * 2;
    ordre = ordre.flatMap((s) => [s, n + 1 - s]);
  }
  return ordre;
}

export type PremierTour =
  { position: number; equipes: [number, number] } | { position: number; exempt: number };

/**
 * Le premier tour, pour des équipes classées de la meilleure à la moins bonne. Quand l'adversaire
 * prévu n'existe pas, la tête de série est exemptée : elle passe sans match (RG9 : jamais de match
 * à une seule équipe).
 */
export function premierTour(classees: number[]): PremierTour[] {
  const ordre = ordreDePlacement(tailleArbre(classees.length));
  return Array.from({ length: ordre.length / 2 }, (_, i) => {
    const [a, b] = [classees[ordre[2 * i] - 1], classees[ordre[2 * i + 1] - 1]];
    return b === undefined ? { position: i + 1, exempt: a } : { position: i + 1, equipes: [a, b] };
  });
}

export type Place = { tour: number; position: number };

/** L'emplacement que celui-ci alimente au tour suivant. */
export const suivant = ({ tour, position }: Place): Place => ({
  tour: tour + 1,
  position: Math.ceil(position / 2),
});

/** Les deux emplacements qui alimentent celui-ci. */
export const precedents = ({ tour, position }: Place): [Place, Place] => [
  { tour: tour - 1, position: 2 * position - 1 },
  { tour: tour - 1, position: 2 * position },
];

const NOMS = ["Finale", "Demi-finales", "Quarts de finale", "Huitièmes de finale"];

/** « Finale », « Demi-finales »… d'après le nombre de tours qu'il reste. */
export function nomDuTour(tour: number, toursEnTout: number) {
  return NOMS[toursEnTout - tour] ?? `Tour ${tour}`;
}

export type MatchJoue = { idMatch: number; dateHeure: string; equipes: [number, number] };
export type EmplacementDeduit = Place & { idMatch: number | null; exempt: number | null };

/**
 * Retrouve l'arbre d'une phase déjà jouée dont les emplacements n'ont pas été enregistrés (les tournois
 * du générateur). La finale est le dernier match ; chaque équipe d'un match vient de son match
 * précédent dans la phase, ou était exemptée si elle n'en a pas.
 */
export function deduireArbre(matchs: MatchJoue[]): EmplacementDeduit[] {
  if (matchs.length === 0) return [];
  const tries = [...matchs].sort((a, b) => a.dateHeure.localeCompare(b.dateHeure) || a.idMatch - b.idMatch);
  const finale = tries[tries.length - 1];
  const precedent = (m: MatchJoue, equipe: number) =>
    tries.findLast((x) => x !== m && x.dateHeure < m.dateHeure && x.equipes.includes(equipe));
  const profondeur = (m: MatchJoue): number =>
    1 + Math.max(0, ...m.equipes.map((e) => precedent(m, e)).map((p) => (p ? profondeur(p) : 0)));

  const emplacements: EmplacementDeduit[] = [];
  const placer = (m: MatchJoue, place: Place) => {
    emplacements.push({ ...place, idMatch: m.idMatch, exempt: null });
    if (place.tour === 1) return;
    m.equipes.forEach((equipe, i) => {
      const avant = precedent(m, equipe);
      const p = precedents(place)[i];
      if (avant) placer(avant, p);
      else emplacements.push({ ...p, idMatch: null, exempt: equipe });
    });
  };
  placer(finale, { tour: profondeur(finale), position: 1 });
  return emplacements.sort((a, b) => a.tour - b.tour || a.position - b.position);
}
