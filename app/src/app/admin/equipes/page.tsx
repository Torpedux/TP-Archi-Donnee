import Link from "next/link";
import { redirect } from "next/navigation";
import { actionCreerEquipe } from "@/app/actions";
import { Champ, Choix, FormAction } from "@/composants/formulaire";
import { Section, Titre, lien } from "@/composants/page";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { listeEquipes } from "@/requetes/equipes";
import { listeJeux } from "@/requetes/tournois";

export default async function Equipes() {
  const { compte, acteur } = await exigerConnexion();
  if (acteur.role !== "admin" && compte.idEquipe) redirect(`/admin/equipes/${compte.idEquipe}`);
  const admin = acteur.role === "admin";
  const [jeux, equipes] = await Promise.all([listeJeux(), admin ? listeEquipes() : []]);
  return (
    <>
      <Titre sur="EF-03 · RG4">{admin ? "Équipes" : "Créer mon équipe"}</Titre>
      {peut(acteur, "equipe.creer") && (
        <Section titre="Nouvelle équipe">
          {!admin && (
            <p className="mb-3 text-sm text-muted-foreground">
              Vous en deviendrez le capitaine. Une équipe évolue sur un seul jeu.
            </p>
          )}
          <FormAction action={actionCreerEquipe} libelle="Créer l'équipe">
            <Champ libelle="Nom (unique)" name="nom" required />
            <Champ libelle="Tag" name="tag" maxLength={6} required className="w-24" />
            <Champ libelle="Pays" name="pays" maxLength={3} defaultValue="FR" required className="w-20" />
            <Choix
              libelle="Jeu"
              name="idJeu"
              options={jeux.map((j) => ({ valeur: j.idJeu, libelle: j.nom }))}
            />
          </FormAction>
        </Section>
      )}
      {admin && (
        <Section titre={`Toutes les équipes (${equipes.length})`}>
          <ul className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
            {equipes.map((e) => (
              <li key={e.idEquipe} className="border-b py-1.5">
                <Link href={`/admin/equipes/${e.idEquipe}`} className={lien}>
                  {e.nom}
                </Link>{" "}
                <span className="text-xs text-muted-foreground">{e.jeu}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
