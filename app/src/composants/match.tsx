import Link from "next/link";
import { formatBo, formatDateHeure, LIBELLE_STATUT } from "@/lib/format";
import type { MatchResume } from "@/requetes/matchs";

/** Pastille de statut. « En direct » ne repose pas que sur la couleur : point animé et libellé. */
export function Statut({ statut }: { statut: MatchResume["statut"] }) {
  if (statut === "en_cours")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-direct px-2 py-0.5 text-xs font-semibold text-direct-foreground">
        <span className="pouls size-1.5 rounded-full bg-direct-foreground" aria-hidden />
        En direct
      </span>
    );
  return (
    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      {LIBELLE_STATUT[statut]}
    </span>
  );
}

function Cote({
  nom,
  tag,
  score,
  gagne,
  forfait,
}: {
  nom: string;
  tag: string;
  score: number | null;
  gagne: boolean;
  forfait: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={gagne ? "font-semibold" : "text-muted-foreground"}>
        <span className="mr-2 inline-block w-12 text-xs tracking-wider text-muted-foreground uppercase">
          {tag}
        </span>
        {nom}
        {forfait && <span className="ml-2 text-xs text-destructive">forfait</span>}
      </span>
      <span className={`score text-lg ${gagne ? "font-bold text-direct" : "text-muted-foreground"}`}>
        {score ?? "–"}
        {gagne && <span className="sr-only"> (vainqueur)</span>}
      </span>
    </div>
  );
}

/** Une carte de match : les deux équipes, le score, le contexte. Toute la carte mène à la page du match. */
export function CarteMatch({
  m,
  contexte = true,
  href,
}: {
  m: MatchResume;
  contexte?: boolean;
  /** Par défaut la page publique du match ; l'espace de gestion y met la page de saisie. */
  href?: string;
}) {
  const fini = m.statut === "termine";
  const a = fini && (m.scoreA ?? 0) > (m.scoreB ?? 0);
  const b = fini && (m.scoreB ?? 0) > (m.scoreA ?? 0);
  return (
    <Link
      href={href ?? `/matchs/${m.idMatch}`}
      className="block rounded-lg border bg-card p-3 transition-colors hover:border-foreground/30 focus-visible:outline-2"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {contexte && <>{m.tournoi} · </>}
          {formatDateHeure(m.dateHeure)} · {formatBo(m.format)}
        </span>
        <Statut statut={m.statut} />
      </div>
      <Cote nom={m.nomA} tag={m.tagA} score={m.scoreA} gagne={a} forfait={m.forfaitA} />
      <Cote nom={m.nomB} tag={m.tagB} score={m.scoreB} gagne={b} forfait={m.forfaitB} />
    </Link>
  );
}

export function GrilleMatchs({
  matchs,
  contexte,
  vide,
  baseLien,
}: {
  matchs: MatchResume[];
  contexte?: boolean;
  vide: string;
  baseLien?: string;
}) {
  if (matchs.length === 0) return <p className="text-sm text-muted-foreground">{vide}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {matchs.map((m) => (
        <CarteMatch key={m.idMatch} m={m} contexte={contexte} href={baseLien && `${baseLien}/${m.idMatch}`} />
      ))}
    </div>
  );
}
