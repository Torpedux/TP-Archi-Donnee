import Link from "next/link";
import type { ReactNode } from "react";

/** Titre de page avec un sur-titre et, à droite, des actions ou des infos. */
export function Titre({
  sur,
  children,
  droite,
}: {
  sur?: ReactNode;
  children: ReactNode;
  droite?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        {sur && <p className="text-xs tracking-widest text-muted-foreground uppercase">{sur}</p>}
        <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
      </div>
      {droite}
    </div>
  );
}

export function Section({ titre, children, id }: { titre: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mb-10 scroll-mt-20">
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-muted-foreground uppercase">{titre}</h2>
      {children}
    </section>
  );
}

/** Filtres en liens (pas de JavaScript) : le filtre actif est marqué par aria-current. */
export function Filtres({
  options,
  actif,
  base,
  param,
}: {
  options: { valeur: string; libelle: string }[];
  actif: string;
  base: string;
  param: string;
}) {
  return (
    <nav aria-label="Filtres" className="mb-4 flex flex-wrap gap-2">
      {[{ valeur: "", libelle: "Tous" }, ...options].map((o) => (
        <Link
          key={o.valeur}
          href={o.valeur ? `${base}?${param}=${o.valeur}` : base}
          aria-current={o.valeur === actif ? "true" : undefined}
          className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground aria-[current]:border-foreground aria-[current]:text-foreground"
        >
          {o.libelle}
        </Link>
      ))}
    </nav>
  );
}

export const lien = "underline-offset-4 hover:underline focus-visible:underline";
