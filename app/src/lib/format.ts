// Les dates viennent de PostgreSQL en texte (« 2026-01-10 » ou « 2026-01-10 13:00:00 »), sans fuseau :
// on les affiche telles quelles, sans passer par Date.

export function formatDate(d: string | null) {
  if (!d) return "—";
  const [a, m, j] = d.slice(0, 10).split("-");
  return `${j}/${m}/${a}`;
}

export function formatDateHeure(d: string) {
  return `${formatDate(d)} · ${d.slice(11, 16)}`;
}

export function formatEuros(montant: string | number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(montant));
}

export const LIBELLE_ETAT = {
  brouillon: "Brouillon",
  inscriptions: "Inscriptions ouvertes",
  en_cours: "En cours",
  termine: "Terminé",
} as const;

export const LIBELLE_STATUT = {
  prevu: "Prévu",
  en_cours: "En direct",
  termine: "Terminé",
  annule: "Annulé",
} as const;

export const LIBELLE_PHASE = { poules: "Poules", elimination: "Élimination directe" } as const;

export const formatBo = (format: number) => `BO${format}`;

/** Lit un identifiant entier dans un paramètre d'URL ; undefined s'il n'en est pas un. */
export function lireId(valeur: string | string[] | undefined) {
  const n = Number(Array.isArray(valeur) ? valeur[0] : valeur);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}
