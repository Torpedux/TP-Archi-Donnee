import Link from "next/link";
import { formatDate, formatEuros, LIBELLE_ETAT } from "@/lib/format";
import type { Etat, TournoiResume } from "@/requetes/tournois";

export function EtatTournoi({ etat }: { etat: Etat }) {
  const vif = etat === "en_cours";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${vif ? "bg-direct font-semibold text-direct-foreground" : "border text-muted-foreground"}`}
    >
      {LIBELLE_ETAT[etat]}
    </span>
  );
}

export function CarteTournoi({ t }: { t: TournoiResume }) {
  return (
    <Link
      href={`/tournois/${t.idTournoi}`}
      className="block rounded-lg border bg-card p-4 transition-colors hover:border-foreground/30"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">{t.jeu}</span>
        <EtatTournoi etat={t.etat} />
      </div>
      <p className="text-lg font-semibold">{t.nom}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDate(t.dateDebut)} → {formatDate(t.dateFin)} · {t.lieu}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.nbEquipes} équipes · {formatEuros(t.dotation)}
      </p>
    </Link>
  );
}
