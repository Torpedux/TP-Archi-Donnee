import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Titre, lien } from "@/composants/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateHeure, lireId } from "@/lib/format";
import { joueurParId, matchsJoueur, parcoursJoueur } from "@/requetes/joueurs";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const j = await joueurParId(lireId((await params).id) ?? 0);
  return { title: j?.pseudo ?? "Joueur introuvable" };
}

export default async function Joueur({ params }: Props) {
  const id = lireId((await params).id);
  const j = id && (await joueurParId(id));
  if (!j) notFound();
  const [parcours, matchs] = await Promise.all([parcoursJoueur(j.idJoueur), matchsJoueur(j.idJoueur)]);

  return (
    <>
      <Titre sur={`${j.prenom} ${j.nom} · ${j.pays}`}>{j.pseudo}</Titre>
      <p className="mb-8 text-sm text-muted-foreground">Né le {formatDate(j.neLe)}</p>

      <Section titre="Parcours">
        {parcours.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ce joueur n&apos;a encore appartenu à aucune équipe.
          </p>
        ) : (
          <ul>
            {parcours.map((p) => (
              <li
                key={`${p.idEquipe}-${p.dateEntree}`}
                className="flex flex-wrap items-baseline justify-between gap-3 border-b py-1.5"
              >
                <span>
                  <Link href={`/equipes/${p.idEquipe}`} className={`font-medium ${lien}`}>
                    {p.equipe}
                  </Link>{" "}
                  <span className="text-sm text-muted-foreground">
                    {p.jeu} · {p.role}
                  </span>
                  {!p.dateSortie && <span className="ml-2 text-xs text-direct">actuel</span>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(p.dateEntree)} → {p.dateSortie ? formatDate(p.dateSortie) : "aujourd'hui"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre={`Matchs joués (${matchs.length})`}>
        {matchs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun match pendant ses périodes en équipe.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Équipe</TableHead>
                <TableHead>Adversaire</TableHead>
                <TableHead>Tournoi</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matchs.map((m) => {
                const gagne = m.score > m.scoreAdverse;
                return (
                  <TableRow key={`${m.idMatch}-${m.idEquipe}`}>
                    <TableCell className="text-muted-foreground">{formatDateHeure(m.dateHeure)}</TableCell>
                    <TableCell>
                      <Link href={`/equipes/${m.idEquipe}`} className={lien}>
                        {m.equipe}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/equipes/${m.idAdversaire}`} className={lien}>
                        {m.adversaire}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/tournois/${m.idTournoi}`} className={lien}>
                        {m.tournoi}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/matchs/${m.idMatch}`}
                        className={`score ${gagne ? "font-bold text-direct" : ""} ${lien}`}
                      >
                        {m.score}–{m.scoreAdverse}
                        <span className="sr-only">{gagne ? " victoire" : " défaite"}</span>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Section>
    </>
  );
}
