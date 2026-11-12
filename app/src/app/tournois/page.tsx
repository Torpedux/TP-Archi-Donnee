import type { Metadata } from "next";
import { Filtres, Titre } from "@/composants/page";
import { CarteTournoi } from "@/composants/tournoi";
import { lireId } from "@/lib/format";
import { listeJeux, listeTournois } from "@/requetes/tournois";

export const metadata: Metadata = { title: "Tournois" };

export default async function Tournois({ searchParams }: { searchParams: Promise<{ jeu?: string }> }) {
  const idJeu = lireId((await searchParams).jeu);
  const [jeux, tournois] = await Promise.all([listeJeux(), listeTournois({ idJeu })]);
  return (
    <>
      <Titre sur={`${tournois.length} tournois`}>Tournois</Titre>
      <Filtres
        base="/tournois"
        param="jeu"
        actif={String(idJeu ?? "")}
        options={jeux.map((j) => ({ valeur: String(j.idJeu), libelle: j.nom }))}
      />
      {tournois.length === 0 ? (
        <p className="text-muted-foreground">Aucun tournoi pour ce jeu.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tournois.map((t) => (
            <CarteTournoi key={t.idTournoi} t={t} />
          ))}
        </div>
      )}
    </>
  );
}
