// Règles sur le cycle de vie d'un tournoi que le schéma ne garantit pas (cardinalités 1,n).

export type TypePhase = "poules" | "elimination";

/** EF-02 : ce qui empêche un tournoi de passer « en cours ». Liste vide = il peut démarrer. */
export function obstaclesAuDemarrage({ nbPhases, nbEquipes }: { nbPhases: number; nbEquipes: number }) {
  const obstacles: string[] = [];
  if (nbPhases < 1) obstacles.push("Le tournoi doit avoir au moins une phase (RG3).");
  if (nbEquipes < 2) obstacles.push("Il faut au moins deux équipes inscrites pour jouer (RG5).");
  return obstacles;
}

/** RG3, O3 : poules puis élimination directe, une seule phase de chaque type. */
export function obstacleNouvellePhase(existantes: TypePhase[], nouvelle: TypePhase): string | null {
  if (existantes.includes(nouvelle)) return "Le tournoi a déjà une phase de ce type.";
  if (nouvelle === "poules" && existantes.includes("elimination"))
    return "Les poules se jouent avant l'élimination directe (RG3).";
  return null;
}
