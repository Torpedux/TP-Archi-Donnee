import type { Metadata } from "next";
import Link from "next/link";
import { Filtres, Titre } from "@/composants/page";
import { lireId } from "@/lib/format";
import { listeEquipes } from "@/requetes/equipes";
import { listeJeux } from "@/requetes/tournois";

export const metadata: Metadata = { title: "Équipes" };

export default async function Equipes({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const idJeu = lireId((await searchParams).jeu);
  const [jeux, equipes] = await Promise.all([listeJeux(), listeEquipes(idJeu)]);
  return (
    <>
      <Titre sur={`${equipes.length} équipes`}>Équipes</Titre>
      <Filtres
        base="/equipes"
        param="jeu"
        actif={String(idJeu ?? "")}
        options={jeux.map((j) => ({ valeur: String(j.idJeu), libelle: j.nom }))}
      />
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {equipes.map((e) => (
          <li key={e.idEquipe}>
            <Link
              href={`/equipes/${e.idEquipe}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-foreground/30"
            >
              <span className="w-12 text-xs tracking-wider text-muted-foreground uppercase">{e.tag}</span>
              <span className="flex-1 font-medium">{e.nom}</span>
              <span className="text-xs text-muted-foreground">
                {e.jeu} · {e.pays}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
