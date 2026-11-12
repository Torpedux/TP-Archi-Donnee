// EF-11 / O4 : classement d'une poule. Victoires, puis différence de manches, puis
// confrontation directe entre les équipes à égalité, puis tête de série.

export type LigneClassement = {
  idEquipe: number;
  victoires: number;
  difference: number;
  teteDeSerie: number | null;
};
export type Duel = { vainqueur: number; perdant: number };

export function trierClassement<L extends LigneClassement>(lignes: L[], duels: Duel[]): L[] {
  const cle = (l: L) => `${l.victoires}/${l.difference}`;
  const groupes = Map.groupBy(lignes, cle);
  // Duels gagnés contre les seules équipes du même groupe d'égalité.
  const duelsGagnes = (l: L) => {
    const groupe = new Set(groupes.get(cle(l))!.map((x) => x.idEquipe));
    return duels.filter((d) => d.vainqueur === l.idEquipe && groupe.has(d.perdant)).length;
  };
  const tete = (l: L) => l.teteDeSerie ?? Number.MAX_SAFE_INTEGER;
  return [...lignes].sort(
    (a, b) =>
      b.victoires - a.victoires ||
      b.difference - a.difference ||
      duelsGagnes(b) - duelsGagnes(a) ||
      tete(a) - tete(b) ||
      a.idEquipe - b.idEquipe,
  );
}
