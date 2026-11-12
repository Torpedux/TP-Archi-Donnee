import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Titre, lien } from "@/composants/page";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatDateHeure, LIBELLE_PHASE, lireId } from "@/lib/format";
import {
  anciensJoueurs,
  effectifActuel,
  equipeParId,
  historiqueEquipe,
  palmares,
  type Membre,
} from "@/requetes/equipes";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const e = await equipeParId(lireId((await params).id) ?? 0);
  return { title: e?.nom ?? "Équipe introuvable" };
}

function Joueurs({ membres, vide }: { membres: Membre[]; vide: string }) {
  if (membres.length === 0) return <p className="text-sm text-muted-foreground">{vide}</p>;
  return (
    <ul className="grid gap-x-6 sm:grid-cols-2">
      {membres.map((j) => (
        <li
          key={`${j.idJoueur}-${j.dateEntree}`}
          className="flex items-baseline justify-between gap-3 border-b py-1.5"
        >
          <span>
            <Link href={`/joueurs/${j.idJoueur}`} className={`font-medium ${lien}`}>
              {j.pseudo}
            </Link>{" "}
            <span className="text-sm text-muted-foreground">
              {j.prenom} {j.nom} · {j.role}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDate(j.dateEntree)}
            {j.dateSortie && <> → {formatDate(j.dateSortie)}</>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function Equipe({ params }: Props) {
  const id = lireId((await params).id);
  const e = id && (await equipeParId(id));
  if (!e) notFound();
  const [effectif, anciens, historique, titres] = await Promise.all([
    effectifActuel(e.idEquipe),
    anciensJoueurs(e.idEquipe),
    historiqueEquipe(e.idEquipe),
    palmares(e.idEquipe),
  ]);
  const victoires = historique.filter((h) => h.score > h.scoreAdverse).length;

  return (
    <>
      <Titre
        sur={`${e.tag} · ${e.jeu} · ${e.pays}`}
        droite={
          <p className="score text-sm text-muted-foreground">
            {victoires} V · {historique.length - victoires} D
          </p>
        }
      >
        {e.nom}
      </Titre>
      <p className="mb-8 text-sm text-muted-foreground">Créée le {formatDate(e.creeLe)}</p>

      <Section titre={`Palmarès (${titres.length})`}>
        {titres.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun tournoi remporté.</p>
        ) : (
          <ul>
            {titres.map((t) => (
              <li key={t.idTournoi} className="border-b py-1.5">
                <span className="mr-2 text-direct" aria-hidden>
                  ★
                </span>
                <Link href={`/tournois/${t.idTournoi}`} className={lien}>
                  {t.tournoi}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">{formatDate(t.dateFin)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section titre={`Effectif actuel (${effectif.length})`}>
        <Joueurs membres={effectif} vide="Aucun joueur dans l'effectif." />
      </Section>

      <Section titre={`Anciens joueurs (${anciens.length})`}>
        <Joueurs membres={anciens} vide="Aucun ancien joueur." />
      </Section>

      <Section titre={`Historique des matchs (${historique.length})`}>
        {historique.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun match joué.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Tournoi</TableHead>
                <TableHead>Adversaire</TableHead>
                <TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...historique].reverse().map((h) => {
                const gagne = h.score > h.scoreAdverse;
                return (
                  <TableRow key={h.idMatch}>
                    <TableCell className="text-muted-foreground">{formatDateHeure(h.dateHeure)}</TableCell>
                    <TableCell>
                      <Link href={`/tournois/${h.idTournoi}`} className={lien}>
                        {h.tournoi}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">{LIBELLE_PHASE[h.phase]}</span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/equipes/${h.idAdversaire}`} className={lien}>
                        {h.adversaire}
                      </Link>
                      {(h.forfaitEquipe || h.forfaitAdverse) && (
                        <span className="ml-2 text-xs text-destructive">forfait</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/matchs/${h.idMatch}`}
                        className={`score ${gagne ? "font-bold text-direct" : ""} ${lien}`}
                      >
                        {h.score}–{h.scoreAdverse}
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
