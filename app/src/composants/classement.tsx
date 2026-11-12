import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LignePoule } from "@/requetes/classement";

/** EF-11 : classement d'une poule. Les `nbQualifies` premières lignes sont marquées « qualifié ». */
export function TableauClassement({
  lignes,
  nbQualifies,
}: {
  lignes: LignePoule[];
  nbQualifies: number | null;
}) {
  if (lignes.length === 0)
    return <p className="text-sm text-muted-foreground">Les matchs ne sont pas encore générés.</p>;
  return (
    <Table>
      <caption className="sr-only">Classement de la poule</caption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Équipe</TableHead>
          <TableHead className="text-right">
            <abbr title="Matchs joués">J</abbr>
          </TableHead>
          <TableHead className="text-right">
            <abbr title="Victoires">V</abbr>
          </TableHead>
          <TableHead className="text-right">
            <abbr title="Défaites">D</abbr>
          </TableHead>
          <TableHead className="text-right">
            <abbr title="Manches gagnées et perdues">Manches</abbr>
          </TableHead>
          <TableHead className="text-right">
            <abbr title="Différence de manches">Diff.</abbr>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lignes.map((l, i) => {
          const qualifie = nbQualifies !== null && i < nbQualifies;
          return (
            <TableRow
              key={l.idEquipe}
              className={qualifie ? "border-l-2 border-l-direct" : "border-l-2 border-l-transparent"}
            >
              <TableCell className="score">{i + 1}</TableCell>
              <TableCell>
                <Link
                  href={`/equipes/${l.idEquipe}`}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {l.equipe}
                </Link>
                {qualifie && <span className="ml-2 text-xs text-direct">qualifié</span>}
              </TableCell>
              <TableCell className="score text-right">{l.joues}</TableCell>
              <TableCell className="score text-right font-semibold">{l.victoires}</TableCell>
              <TableCell className="score text-right">{l.defaites}</TableCell>
              <TableCell className="score text-right">
                {l.manchesGagnees}–{l.manchesPerdues}
              </TableCell>
              <TableCell className="score text-right">
                {l.difference > 0 ? "+" : ""}
                {l.difference}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
