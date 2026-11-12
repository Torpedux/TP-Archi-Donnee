import Link from "next/link";
import { notFound } from "next/navigation";
import { actionCreerTournoi } from "@/app/actions";
import { Champ, Choix, FormAction } from "@/composants/formulaire";
import { Section, Titre, lien } from "@/composants/page";
import { EtatTournoi } from "@/composants/tournoi";
import { formatDate } from "@/lib/format";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { listeJeux, tournoisGeres } from "@/requetes/tournois";

export default async function Tournois() {
  const { acteur } = await exigerConnexion();
  if (!peut(acteur, "tournoi.creer")) notFound();
  const [jeux, tournois] = await Promise.all([
    listeJeux(),
    tournoisGeres(acteur.role === "admin" ? null : acteur.id),
  ]);
  return (
    <>
      <Titre sur="EF-02 · RG2">Tournois</Titre>
      <Section titre="Nouveau tournoi">
        <FormAction action={actionCreerTournoi} libelle="Créer le tournoi">
          <Champ libelle="Nom" name="nom" required className="w-56" />
          <Choix
            libelle="Jeu"
            name="idJeu"
            options={jeux.map((j) => ({ valeur: j.idJeu, libelle: j.nom }))}
          />
          <Champ libelle="Lieu" name="lieu" defaultValue="en ligne" required />
          <Champ libelle="Début" name="dateDebut" type="date" required />
          <Champ libelle="Fin" name="dateFin" type="date" required />
          <Champ
            libelle="Dotation (€)"
            name="dotation"
            type="number"
            min={0}
            defaultValue={0}
            className="w-28"
          />
        </FormAction>
      </Section>
      <Section
        titre={`${acteur.role === "admin" ? "Tous les tournois" : "Mes tournois"} (${tournois.length})`}
      >
        {tournois.length === 0 ? (
          <p className="text-muted-foreground">Aucun tournoi pour le moment.</p>
        ) : (
          <ul>
            {tournois.map((t) => (
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
      </Section>
    </>
  );
}
