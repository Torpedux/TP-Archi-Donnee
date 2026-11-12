// RG7 : à un instant donné, un joueur est dans au plus une équipe par jeu.
// Le schéma ne le garantit pas (le jeu est sur EQUIPE, pas sur APPARTENIR, cahier O13).

/** Une période d'appartenance, avec le jeu de l'équipe. Dates ISO « AAAA-MM-JJ ». */
export type Periode = { idJeu: number; dateEntree: string; dateSortie: string | null };

const FIN = "9999-12-31";

/** Rend la période existante qui chevauche la nouvelle sur le même jeu, ou null. Bornes incluses. */
export function conflitAppartenance<P extends Periode>(nouvelle: Periode, existantes: P[]): P | null {
  return (
    existantes.find(
      (p) =>
        p.idJeu === nouvelle.idJeu &&
        p.dateEntree <= (nouvelle.dateSortie ?? FIN) &&
        nouvelle.dateEntree <= (p.dateSortie ?? FIN),
    ) ?? null
  );
}
