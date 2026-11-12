// EF-06 : une phase de poules = un groupe en round-robin (O3), chaque équipe rencontre chaque autre une fois.

/**
 * Les n(n−1)/2 paires, rangées par journées (méthode du cercle) : dans une journée, chaque équipe
 * joue au plus une fois. Avec un nombre impair d'équipes, une équipe se repose à chaque journée.
 */
export function pairesRoundRobin(ids: number[]): [number, number][] {
  const cercle: (number | null)[] = ids.length % 2 === 0 ? [...ids] : [...ids, null];
  const n = cercle.length;
  const paires: [number, number][] = [];
  for (let journee = 0; journee < n - 1; journee++) {
    for (let i = 0; i < n / 2; i++) {
      const [a, b] = [cercle[i], cercle[n - 1 - i]];
      if (a !== null && b !== null) paires.push([a, b]);
    }
    cercle.splice(1, 0, cercle.pop()!); // la première reste, les autres tournent
  }
  return paires;
}

const HEURE_DEBUT = 10;
const PAR_JOUR = 10; // 10h, 11h, … 19h

/** EF-06 : n créneaux réguliers à partir de la date de début, un match par heure de 10h à 19h. */
export function creneaux(dateDebut: string, n: number): string[] {
  const [a, m, j] = dateDebut.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const jour = new Date(Date.UTC(a, m - 1, j + Math.floor(i / PAR_JOUR))).toISOString().slice(0, 10);
    return `${jour} ${String(HEURE_DEBUT + (i % PAR_JOUR)).padStart(2, "0")}:00:00`;
  });
}
