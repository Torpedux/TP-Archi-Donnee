import Link from "next/link";
import { actionDeconnexion } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compteCourant } from "@/lib/session";

const LIENS = [
  { href: "/tournois", libelle: "Tournois" },
  { href: "/equipes", libelle: "Équipes" },
  { href: "/joueurs", libelle: "Joueurs" },
];

export async function EnTete() {
  const compte = await compteCourant();
  return (
    <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded focus:bg-card focus:p-2"
      >
        Aller au contenu
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-black tracking-tight uppercase">
          Bracket<span className="text-direct">.</span>
        </Link>
        <nav aria-label="Principale" className="flex gap-4 text-sm">
          {LIENS.map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.libelle}
            </Link>
          ))}
        </nav>
        <form action="/recherche" role="search" className="ml-auto flex items-center gap-2">
          <label htmlFor="q" className="sr-only">
            Rechercher une équipe, un joueur ou un tournoi
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            placeholder="Équipe, joueur, tournoi…"
            className="h-8 w-48 sm:w-64"
          />
        </form>
        {compte ? (
          <div className="flex items-center gap-3 text-sm">
            <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
              Gestion
            </Link>
            <span className="hidden text-muted-foreground sm:inline">{compte.nom}</span>
            <form action={actionDeconnexion}>
              <Button type="submit" variant="outline" size="sm">
                Déconnexion
              </Button>
            </form>
          </div>
        ) : (
          <Link href="/connexion" className="text-sm font-medium underline-offset-4 hover:underline">
            Connexion
          </Link>
        )}
      </div>
    </header>
  );
}
