import Link from "next/link";
import { Section, Titre, lien } from "@/composants/page";
import { EtatTournoi } from "@/composants/tournoi";
import { formatDate } from "@/lib/format";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { GrilleMatchs } from "@/composants/match";
import { matchsASaisir } from "@/requetes/matchs";
import { inscriptionsEnAttente, tournoisGeres } from "@/requetes/tournois";

export default async function TableauDeBord() {
  const { compte, acteur } = await exigerConnexion();
  const organise = peut(acteur, "tournoi.creer");
  const tournois = organise ? await tournoisGeres(acteur.role === "admin" ? null : acteur.id) : [];
  const aGerer = tournois.filter((t) => t.etat !== "termine");
  const idOrga = acteur.role === "admin" ? null : acteur.id;
  const [duJour, aSaisir, enAttente] = organise
    ? await Promise.all([matchsASaisir(idOrga, true), matchsASaisir(idOrga), inscriptionsEnAttente(idOrga)])
    : [[], [], []];

  return (
    <>
      <Titre sur={compte.email}>Bonjour {compte.nom}</Titre>

      <Section titre="Mon équipe">
        {compte.idEquipe ? (
          <p>
            Vous êtes capitaine de{" "}
            <Link href={`/admin/equipes/${compte.idEquipe}`} className={`font-semibold ${lien}`}>
              {compte.equipe}
            </Link>
            .
          </p>
        ) : (
          <p className="text-muted-foreground">
            {acteur.role === "admin"
              ? "L'admin gère toutes les équipes. "
              : "Vous n'avez pas encore d'équipe. "}
            <Link href="/admin/equipes" className={`text-foreground ${lien} underline`}>
              {acteur.role === "admin" ? "Voir les équipes" : "Créer mon équipe"}
            </Link>
          </p>
        )}
      </Section>

      {organise && (
        <>
          <Section titre={`Matchs du jour (${duJour.length})`}>
            <GrilleMatchs matchs={duJour} baseLien="/admin/matchs" vide="Aucun match à jouer aujourd'hui." />
          </Section>
          <Section titre={`Matchs à saisir (${aSaisir.length})`}>
            <GrilleMatchs matchs={aSaisir} baseLien="/admin/matchs" vide="Aucun match en attente de score." />
          </Section>
          <Section titre="Inscriptions en attente">
            {enAttente.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun tournoi n&apos;a ses inscriptions ouvertes.
              </p>
            ) : (
              <ul>
                {enAttente.map((t) => (
                  <li key={t.idTournoi} className="flex flex-wrap items-baseline gap-3 border-b py-2">
                    <Link href={`/admin/tournois/${t.idTournoi}`} className={`font-medium ${lien}`}>
                      {t.nom}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {t.inscrites} équipes inscrites, dont {t.enAttente} sans tête de série
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      {organise && (
        <Section titre={`Tournois à gérer (${aGerer.length})`}>
          {aGerer.length === 0 ? (
            <p className="text-muted-foreground">Aucun tournoi en préparation ou en cours.</p>
          ) : (
            <ul>
              {aGerer.map((t) => (
                <li key={t.idTournoi} className="flex flex-wrap items-center gap-3 border-b py-2">
                  <Link href={`/admin/tournois/${t.idTournoi}`} className={`font-medium ${lien}`}>
                    {t.nom}
                  </Link>
                  <EtatTournoi etat={t.etat} />
                  <span className="text-sm text-muted-foreground">
                    {t.jeu} · {formatDate(t.dateDebut)} · {t.nbEquipes} équipes
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-sm">
            <Link href="/admin/tournois" className="underline underline-offset-4">
              Tous mes tournois, créer un tournoi
            </Link>
          </p>
        </Section>
      )}

      {!organise && (
        <p className="text-sm text-muted-foreground">
          Pour organiser un tournoi, demandez le rôle d&apos;organisateur à l&apos;administrateur.
        </p>
      )}
    </>
  );
}
