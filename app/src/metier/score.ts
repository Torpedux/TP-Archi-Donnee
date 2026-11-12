// EF-08, EF-09 : le score d'un match est calculé à partir de ses manches, jamais saisi.
// A et B sont les deux équipes du match (A = le plus petit id_equipe, par convention de l'app).

export type PointsManche = { pointsA: number; pointsB: number };

/** Nombre de manches à gagner pour remporter le match : 1 en BO1, 2 en BO3, 3 en BO5 (RG8). */
export const majorite = (format: number) => Math.floor(format / 2) + 1;

/** RG11 : une manche a un vainqueur. Rend le motif du refus, ou null si la manche est valable. */
export function erreurManche({ pointsA, pointsB }: PointsManche): string | null {
  if (![pointsA, pointsB].every((p) => Number.isInteger(p) && p >= 0))
    return "Les points sont des nombres entiers positifs ou nuls.";
  if (pointsA === pointsB)
    return "Une manche ne peut pas finir à égalité : il n'y a pas de match nul (RG11).";
  return null;
}

/** RG9 : le score de match est le nombre de manches gagnées ; le match finit à la majorité du format. */
export function etatDuMatch(format: number, manches: PointsManche[]) {
  const scoreA = manches.filter((m) => m.pointsA > m.pointsB).length;
  const scoreB = manches.filter((m) => m.pointsB > m.pointsA).length;
  const vainqueur = scoreA >= majorite(format) ? "A" : scoreB >= majorite(format) ? "B" : null;
  return { scoreA, scoreB, termine: vainqueur !== null, vainqueur: vainqueur as "A" | "B" | null };
}

/** EF-08 : aucune manche n'est jouée après qu'une équipe a atteint la majorité. */
export function sequenceValide(format: number, manches: PointsManche[]) {
  return manches.every((_, i) => !etatDuMatch(format, manches.slice(0, i)).termine);
}

/** RG12 : en cas de forfait, l'adversaire gagne avec le score maximal du format, sans manche. */
export const scoreForfait = (format: number) => ({ vainqueur: majorite(format), perdant: 0 });
