import { Direct } from "@/composants/direct";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Arbre } from "@/composants/arbre";
import { TableauClassement } from "@/composants/classement";
import { GrilleMatchs } from "@/composants/match";
import { Section, Titre } from "@/composants/page";
import { EtatTournoi } from "@/composants/tournoi";
import { formatBo, formatDate, formatEuros, LIBELLE_PHASE, lireId } from "@/lib/format";
import { arbreDeLaPhase } from "@/requetes/arbre";
import { classementPoule } from "@/requetes/classement";
import { palmares } from "@/requetes/equipes";
import { matchsDeLaPhase } from "@/requetes/matchs";
import { inscrits, phasesDuTournoi, tournoiParId } from "@/requetes/tournois";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await tournoiParId(lireId((await params).id) ?? 0);
  return { title: t?.nom ?? "Tournoi introuvable" };
}

export default async function Tournoi({ params }: Props) {
  const id = lireId((await params).id);
  const t = id && (await tournoiParId(id));
  if (!t || t.etat === "brouillon") notFound();

  const [phases, equipes, titres] = await Promise.all([
    phasesDuTournoi(t.idTournoi),
    inscrits(t.idTournoi),
    palmares(),
  ]);
  const vainqueur = titres.find((x) => x.idTournoi === t.idTournoi);
  const detail = await Promise.all(
    phases.map(async (p) => ({
      phase: p,
      matchs: await matchsDeLaPhase(p.idPhase),
      classement: p.type === "poules" ? await classementPoule(p.idPhase) : [],
      arbre: p.type === "elimination" ? await arbreDeLaPhase(p.idPhase) : [],
    })),
  );

  return (
    <>
      <Direct idTournoi={t.idTournoi} />
      <Titre sur={t.jeu} droite={<EtatTournoi etat={t.etat} />}>
        {t.nom}
      </Titre>
      <p className="mb-8 text-muted-foreground">
        {formatDate(t.dateDebut)} → {formatDate(t.dateFin)} · {t.lieu} · {formatEuros(t.dotation)} de dotation
        {vainqueur && (
          <>
            {" · "}Vainqueur :{" "}
            <Link
              href={`/equipes/${vainqueur.idEquipe}`}
              className="font-semibold text-direct underline-offset-4 hover:underline"
            >
              {vainqueur.vainqueur}
            </Link>
          </>
        )}
      </p>

      {detail.map(({ phase, matchs, classement, arbre }) => (
        <Section
          key={phase.idPhase}
          id={`phase-${phase.ordre}`}
          titre={
            <>
              Phase {phase.ordre} · {LIBELLE_PHASE[phase.type]}
              {phase.format && <> · {formatBo(phase.format)}</>}
            </>
          }
        >
          {phase.type === "poules" && (
            <div className="mb-6">
              <TableauClassement lignes={classement} nbQualifies={phase.nbQualifies} />
            </div>
          )}
          {arbre.length > 0 ? (
            <Arbre emplacements={arbre} matchs={matchs} />
          ) : (
            <GrilleMatchs matchs={matchs} contexte={false} vide="Aucun match pour le moment." />
          )}
        </Section>
      ))}

      <Section titre={`Équipes inscrites (${equipes.length})`} id="equipes">
        {equipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune équipe inscrite.</p>
        ) : (
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
            {equipes.map((e) => (
              <li key={e.idEquipe} className="flex items-baseline gap-3 border-b py-1.5">
                <span className="score w-6 text-right text-muted-foreground">{e.teteDeSerie ?? "–"}</span>
                <Link href={`/equipes/${e.idEquipe}`} className="underline-offset-4 hover:underline">
                  {e.nom}
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </>
  );
}
