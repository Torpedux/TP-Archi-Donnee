import Link from "next/link";
import { notFound } from "next/navigation";
import { Statut } from "@/composants/match";
import { Section } from "@/composants/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBo, formatDateHeure, LIBELLE_PHASE, lireId } from "@/lib/format";
import { manchesDuMatch, matchParId } from "@/requetes/matchs";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const m = await matchParId(lireId((await params).id) ?? 0);
  return { title: m ? `${m.nomA} – ${m.nomB}` : "Match introuvable" };
}

function Equipe({
  idEquipe,
  nom,
  tag,
  gagne,
}: {
  idEquipe: number;
  nom: string;
  tag: string;
  gagne: boolean;
}) {
  return (
    <div className="flex-1 text-center">
      <p className="text-xs tracking-widest text-muted-foreground uppercase">{tag}</p>
      <Link
        href={`/equipes/${idEquipe}`}
        className="text-xl font-bold underline-offset-4 hover:underline sm:text-2xl"
      >
        {nom}
      </Link>
      {gagne && <p className="text-xs font-semibold text-direct">Vainqueur</p>}
    </div>
  );
}

export default async function Match({ params }: Props) {
  const id = lireId((await params).id);
  const m = id && (await matchParId(id));
  if (!m) notFound();
  const manches = await manchesDuMatch(m.idMatch, m.idA, m.idB);
  const fini = m.statut === "termine";
  const gagneA = fini && (m.scoreA ?? 0) > (m.scoreB ?? 0);
  const gagneB = fini && (m.scoreB ?? 0) > (m.scoreA ?? 0);
  const forfait = m.forfaitA ? m.nomA : m.forfaitB ? m.nomB : null;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href={`/tournois/${m.idTournoi}`} className="underline underline-offset-4">
          {m.tournoi}
        </Link>{" "}
        · {LIBELLE_PHASE[m.phaseType]} · {formatBo(m.format)} · {formatDateHeure(m.dateHeure)}
      </p>
      <div className="mb-10 rounded-lg border bg-card p-6">
        <div className="mb-4 flex justify-center">
          <Statut statut={m.statut} />
        </div>
        <h1 className="flex items-center gap-4">
          <Equipe idEquipe={m.idA} nom={m.nomA} tag={m.tagA} gagne={gagneA} />
          <span className="score text-5xl font-black sm:text-6xl">
            <span className={gagneA ? "text-direct" : ""}>{m.scoreA ?? "–"}</span>
            <span className="mx-2 text-muted-foreground">:</span>
            <span className={gagneB ? "text-direct" : ""}>{m.scoreB ?? "–"}</span>
          </span>
          <Equipe idEquipe={m.idB} nom={m.nomB} tag={m.tagB} gagne={gagneB} />
        </h1>
        {forfait && (
          <p className="mt-4 text-center text-sm text-destructive">
            Forfait de {forfait} : aucune manche jouée.
          </p>
        )}
      </div>

      <Section titre="Manches">
        {manches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {forfait ? "Match gagné par forfait." : "Aucune manche jouée pour le moment."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Carte</TableHead>
                <TableHead className="text-right">{m.nomA}</TableHead>
                <TableHead className="text-right">{m.nomB}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {manches.map((ma) => (
                <TableRow key={ma.idManche}>
                  <TableCell className="score">{ma.numero}</TableCell>
                  <TableCell>{ma.carte}</TableCell>
                  <TableCell
                    className={`score text-right ${ma.pointsA > ma.pointsB ? "font-bold text-direct" : ""}`}
                  >
                    {ma.pointsA}
                  </TableCell>
                  <TableCell
                    className={`score text-right ${ma.pointsB > ma.pointsA ? "font-bold text-direct" : ""}`}
                  >
                    {ma.pointsB}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
