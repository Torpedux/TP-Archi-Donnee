import Link from "next/link";
import { notFound } from "next/navigation";
import {
  actionAjouterPhase,
  actionDeplacerTete,
  actionDesinscrire,
  actionFixerTete,
  actionGenererPhase,
  actionInscrire,
  actionModifierTournoi,
  actionOuvrirInscriptions,
  actionSupprimerPhase,
  actionSupprimerTournoi,
} from "@/app/actions";
import { Arbre } from "@/composants/arbre";
import { Champ, Choix, FormAction } from "@/composants/formulaire";
import { GrilleMatchs } from "@/composants/match";
import { Section, Titre } from "@/composants/page";
import { EtatTournoi } from "@/composants/tournoi";
import { formatBo, LIBELLE_PHASE, lireId } from "@/lib/format";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { obstaclesAuDemarrage } from "@/metier/tournoi";
import { arbreDeLaPhase } from "@/requetes/arbre";
import { matchsDeLaPhase } from "@/requetes/matchs";
import { equipesInscriptibles, inscrits, phasesDuTournoi, tournoiParId } from "@/requetes/tournois";

const FORMATS = [1, 3, 5].map((f) => ({ valeur: f, libelle: formatBo(f) }));

export default async function GestionTournoi({ params }: { params: Promise<{ id: string }> }) {
  const { acteur } = await exigerConnexion();
  const id = lireId((await params).id);
  const t = id && (await tournoiParId(id));
  if (!t || !peut(acteur, "tournoi.gerer", t)) notFound();

  const [phases, equipes, candidates] = await Promise.all([
    phasesDuTournoi(t.idTournoi),
    inscrits(t.idTournoi),
    equipesInscriptibles(t.idTournoi),
  ]);
  const detail = await Promise.all(
    phases.map(async (phase) => ({
      phase,
      matchs: await matchsDeLaPhase(phase.idPhase),
      arbre: phase.type === "elimination" ? await arbreDeLaPhase(phase.idPhase) : [],
    })),
  );
  const avantDebut = t.etat === "brouillon" || t.etat === "inscriptions";
  const obstacles = obstaclesAuDemarrage({ nbPhases: phases.length, nbEquipes: equipes.length });
  const cle = { idTournoi: t.idTournoi };

  return (
    <>
      <Titre
        sur={t.jeu}
        droite={
          <div className="flex items-center gap-3">
            <EtatTournoi etat={t.etat} />
            {t.etat !== "brouillon" && (
              <Link href={`/tournois/${t.idTournoi}`} className="text-sm underline underline-offset-4">
                Page publique
              </Link>
            )}
          </div>
        }
      >
        {t.nom}
      </Titre>

      <Section titre="Informations (EF-02)">
        <FormAction action={actionModifierTournoi} caches={cle}>
          <Champ libelle="Nom" name="nom" defaultValue={t.nom} required className="w-56" />
          <Champ libelle="Lieu" name="lieu" defaultValue={t.lieu} required />
          <Champ libelle="Début" name="dateDebut" type="date" defaultValue={t.dateDebut} required />
          <Champ libelle="Fin" name="dateFin" type="date" defaultValue={t.dateFin} required />
          <Champ
            libelle="Dotation (€)"
            name="dotation"
            type="number"
            min={0}
            defaultValue={Number(t.dotation)}
            className="w-28"
          />
        </FormAction>
      </Section>

      <Section titre={`Phases (${phases.length}) · RG3`}>
        {phases.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">Aucune phase pour le moment.</p>
        )}
        <ol className="mb-4">
          {phases.map((p) => (
            <li key={p.idPhase} className="flex flex-wrap items-center gap-3 border-b py-2">
              <span className="score text-muted-foreground">{p.ordre}</span>
              <span className="font-medium">{LIBELLE_PHASE[p.type]}</span>
              <span className="text-sm text-muted-foreground">
                {p.format ? formatBo(p.format) : "format non réglé"}
                {p.nbQualifies ? ` · ${p.nbQualifies} qualifiés` : ""} · {p.nbMatchs} matchs
              </span>
              {avantDebut && (
                <FormAction
                  action={actionSupprimerPhase}
                  caches={{ ...cle, idPhase: p.idPhase }}
                  libelle="Retirer"
                  variante="outline"
                />
              )}
            </li>
          ))}
        </ol>
        {avantDebut && (
          <FormAction action={actionAjouterPhase} caches={cle} libelle="Ajouter la phase">
            <Choix
              libelle="Type"
              name="type"
              options={[
                { valeur: "poules", libelle: "Poules (un groupe, round-robin)" },
                { valeur: "elimination", libelle: "Élimination directe" },
              ]}
            />
            <Choix libelle="Format des matchs" name="format" options={FORMATS} defaultValue={3} />
            <Champ
              libelle="Qualifiés (poules)"
              name="nbQualifies"
              type="number"
              min={2}
              placeholder="ex. 4"
              className="w-28"
            />
          </FormAction>
        )}
      </Section>

      {detail.map(({ phase, matchs, arbre }) => {
        const joues = matchs.filter((x) => x.statut !== "prevu").length;
        const generable = t.etat !== "termine" && t.etat !== "brouillon" && joues === 0;
        return (
          <Section
            key={phase.idPhase}
            titre={`Matchs · phase ${phase.ordre} · ${LIBELLE_PHASE[phase.type]} (${matchs.length})`}
          >
            {generable && (
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <FormAction
                  action={actionGenererPhase}
                  caches={{ idPhase: phase.idPhase }}
                  libelle={matchs.length === 0 ? "Générer les matchs" : "Regénérer les matchs"}
                  confirmer={
                    matchs.length === 0 ? undefined : "Regénérer efface les matchs prévus de cette phase."
                  }
                />
                <p className="text-sm text-muted-foreground">
                  {phase.ordre === 1
                    ? "Générer la première phase ferme les inscriptions et démarre le tournoi."
                    : "Les qualifiés viennent du classement de la poule : 1er contre 4e, 2e contre 3e."}
                </p>
              </div>
            )}
            {arbre.length > 0 ? (
              <Arbre emplacements={arbre} matchs={matchs} baseLien="/admin/matchs" />
            ) : (
              <GrilleMatchs
                matchs={matchs}
                contexte={false}
                baseLien="/admin/matchs"
                vide="Aucun match généré pour cette phase."
              />
            )}
          </Section>
        );
      })}

      <Section titre={`Inscriptions et têtes de série (${equipes.length}) · EF-05`}>
        {t.etat === "brouillon" && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Le tournoi est un brouillon, invisible du public. Ouvrez les inscriptions pour inscrire des
              équipes.
            </p>
            <FormAction action={actionOuvrirInscriptions} caches={cle} libelle="Ouvrir les inscriptions" />
          </div>
        )}
        {t.etat === "inscriptions" && (
          <div className="mb-4">
            <FormAction action={actionInscrire} caches={cle} libelle="Inscrire">
              <Choix
                libelle={`Équipe de ${t.jeu}`}
                name="idEquipe"
                options={candidates.map((e) => ({ valeur: e.idEquipe, libelle: e.nom }))}
              />
            </FormAction>
          </div>
        )}
        <ol>
          {equipes.map((e, i) => (
            <li key={e.idEquipe} className="flex flex-wrap items-center gap-3 border-b py-2">
              <span className="score w-6 text-right text-muted-foreground">{e.teteDeSerie ?? "–"}</span>
              <span className="w-48 font-medium">{e.nom}</span>
              {t.etat === "inscriptions" && (
                <>
                  <FormAction
                    action={actionDeplacerTete}
                    caches={{ ...cle, idEquipe: e.idEquipe, sens: "monter" }}
                    libelle="↑"
                    titre={`Monter ${e.nom}`}
                    variante="ghost"
                    className={i === 0 ? "invisible" : "flex"}
                  />
                  <FormAction
                    action={actionDeplacerTete}
                    caches={{ ...cle, idEquipe: e.idEquipe, sens: "descendre" }}
                    libelle="↓"
                    titre={`Descendre ${e.nom}`}
                    variante="ghost"
                    className={i === equipes.length - 1 ? "invisible" : "flex"}
                  />
                  <FormAction
                    action={actionFixerTete}
                    caches={{ ...cle, idEquipe: e.idEquipe }}
                    libelle="Fixer"
                  >
                    <Champ
                      libelle="Tête de série"
                      name="teteDeSerie"
                      id={String(e.idEquipe)}
                      type="number"
                      min={1}
                      defaultValue={e.teteDeSerie ?? ""}
                      className="w-20"
                    />
                  </FormAction>
                  <FormAction
                    action={actionDesinscrire}
                    caches={{ ...cle, idEquipe: e.idEquipe }}
                    libelle="Désinscrire"
                    variante="outline"
                  />
                </>
              )}
            </li>
          ))}
        </ol>
      </Section>

      {avantDebut && (
        <Section titre="Démarrage">
          {obstacles.length > 0 ? (
            <ul className="text-sm text-muted-foreground">
              {obstacles.map((o) => (
                <li key={o}>• {o}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Le tournoi peut démarrer : générer la première phase ferme les inscriptions.
            </p>
          )}
        </Section>
      )}

      {t.etat === "brouillon" && (
        <FormAction
          action={actionSupprimerTournoi}
          caches={cle}
          libelle="Supprimer ce brouillon"
          variante="destructive"
          confirmer={`Supprimer le tournoi ${t.nom} ?`}
        />
      )}
    </>
  );
}
