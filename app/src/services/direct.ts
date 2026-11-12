// EF-13 : les scores en direct. Les services publient ici après chaque commit ; /api/live relaie
// aux navigateurs en Server-Sent Events.
// shortcut: un seul processus Next.js ; passer à PostgreSQL LISTEN/NOTIFY si l'app tourne sur plusieurs instances.

export type Evenement = { idTournoi: number; idMatch?: number };
type Abonne = (e: Evenement) => void;

// Sur globalThis : Next peut charger ce module dans plusieurs bundles (actions, routes) du même processus.
const g = globalThis as unknown as { __abonnesDirect?: Set<Abonne> };
const abonnes = (g.__abonnesDirect ??= new Set<Abonne>());

export function publier(e: Evenement) {
  for (const abonne of abonnes) abonne(e);
}

/** Rend la fonction de désabonnement. */
export function abonner(abonne: Abonne) {
  abonnes.add(abonne);
  return () => void abonnes.delete(abonne);
}
