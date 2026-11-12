import { nomDuTour } from "@/metier/arbre";
import type { Emplacement } from "@/requetes/arbre";
import type { MatchResume } from "@/requetes/matchs";
import { CarteMatch } from "./match";

/**
 * EF-07 : l'arbre d'élimination directe. Une colonne par tour ; dans chaque colonne, les emplacements
 * sont répartis sur la hauteur, donc un match se trouve en face des deux qui l'alimentent.
 * Lisible sans la couleur : chaque case dit en toutes lettres « exempt », « à déterminer », « vainqueur ».
 */
export function Arbre({
  emplacements,
  matchs,
  baseLien,
}: {
  emplacements: Emplacement[];
  matchs: MatchResume[];
  baseLien?: string;
}) {
  const parId = new Map(matchs.map((m) => [m.idMatch, m]));
  const tours = Math.max(...emplacements.map((e) => e.tour));
  return (
    <div className="overflow-x-auto pb-2">
      <ol className="flex min-w-max gap-6" aria-label="Arbre d'élimination directe">
        {Array.from({ length: tours }, (_, i) => i + 1).map((tour) => (
          <li key={tour} className="flex w-72 flex-col">
            <h3 className="mb-3 text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {nomDuTour(tour, tours)}
            </h3>
            <ol className="flex flex-1 flex-col justify-around gap-3">
              {emplacements
                .filter((e) => e.tour === tour)
                .map((e) => {
                  const m = e.idMatch ? parId.get(e.idMatch) : undefined;
                  return (
                    <li key={e.position}>
                      {m ? (
                        <>
                          <CarteMatch m={m} contexte={false} href={baseLien && `${baseLien}/${m.idMatch}`} />
                          {m.statut === "annule" && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {e.designee ? `Qualifié désigné : ${e.designee}` : "Qualifié à désigner"}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          {e.designee ? (
                            <>
                              <span className="font-medium text-foreground">{e.designee}</span> · exempt,
                              passe sans jouer
                            </>
                          ) : (
                            "À déterminer"
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
