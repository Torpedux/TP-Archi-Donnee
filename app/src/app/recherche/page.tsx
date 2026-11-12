import type { Metadata } from "next";
import Link from "next/link";
import { Section, Titre } from "@/composants/page";
import { rechercher, type Resultat } from "@/requetes/recherche";

export const metadata: Metadata = { title: "Recherche" };

const GROUPES: { type: Resultat["type"]; titre: string; base: string }[] = [
  { type: "equipe", titre: "Équipes", base: "/equipes" },
  { type: "joueur", titre: "Joueurs", base: "/joueurs" },
  { type: "tournoi", titre: "Tournois", base: "/tournois" },
];

export default async function Recherche({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const resultats = await rechercher(q);
  return (
    <>
      <Titre sur={`${resultats.length} résultats`}>Recherche : « {q} »</Titre>
      {q.length < 2 && <p className="text-muted-foreground">Tapez au moins deux caractères.</p>}
      {q.length >= 2 && resultats.length === 0 && (
        <p className="text-muted-foreground">Aucune équipe, aucun joueur ni tournoi ne correspond.</p>
      )}
      {GROUPES.map((g) => {
        const lignes = resultats.filter((r) => r.type === g.type);
        if (lignes.length === 0) return null;
        return (
          <Section key={g.type} titre={`${g.titre} (${lignes.length})`}>
            <ul>
              {lignes.map((r) => (
                <li key={r.id} className="border-b py-1.5">
                  <Link href={`${g.base}/${r.id}`} className="font-medium underline-offset-4 hover:underline">
                    {r.libelle}
                  </Link>{" "}
                  <span className="text-sm text-muted-foreground">{r.detail}</span>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </>
  );
}
