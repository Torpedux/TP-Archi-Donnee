import type { Metadata } from "next";
import Link from "next/link";
import { Titre, lien } from "@/composants/page";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listeJoueurs } from "@/requetes/joueurs";

export const metadata: Metadata = { title: "Joueurs" };
const LIMITE = 100;

export default async function Joueurs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim();
  const joueurs = await listeJoueurs(q, LIMITE);
  return (
    <>
      <Titre>Joueurs</Titre>
      <form className="mb-4 flex items-center gap-2">
        <label htmlFor="filtre" className="text-sm text-muted-foreground">
          Pseudo
        </label>
        <Input id="filtre" name="q" defaultValue={q} placeholder="Filtrer par pseudo…" className="h-8 w-64" />
      </form>
      {joueurs.length === LIMITE && (
        <p className="mb-2 text-xs text-muted-foreground">
          Les {LIMITE} premiers pseudos. Filtrez pour en voir d&apos;autres.
        </p>
      )}
      {joueurs.length === 0 ? (
        <p className="text-muted-foreground">Aucun joueur ne correspond.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pseudo</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Pays</TableHead>
              <TableHead>Équipe actuelle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {joueurs.map((j) => (
              <TableRow key={j.idJoueur}>
                <TableCell>
                  <Link href={`/joueurs/${j.idJoueur}`} className={`font-medium ${lien}`}>
                    {j.pseudo}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {j.prenom} {j.nom}
                </TableCell>
                <TableCell className="text-muted-foreground">{j.pays}</TableCell>
                <TableCell>
                  {j.equipes ?? <span className="text-muted-foreground">sans équipe</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
