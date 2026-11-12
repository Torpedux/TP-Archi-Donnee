import { notFound } from "next/navigation";
import { actionCreerJeu, actionModifierJeu, actionSupprimerJeu } from "@/app/actions";
import { Champ, FormAction } from "@/composants/formulaire";
import { Section, Titre } from "@/composants/page";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { listeJeux } from "@/requetes/tournois";

export default async function Jeux() {
  const { acteur } = await exigerConnexion();
  if (!peut(acteur, "jeu.gerer")) notFound();
  const jeux = await listeJeux();
  return (
    <>
      <Titre sur="EF-01 · RG1">Jeux</Titre>
      <Section titre="Nouveau jeu">
        <FormAction action={actionCreerJeu} libelle="Créer">
          <Champ libelle="Nom (unique)" name="nom" required />
          <Champ libelle="Éditeur" name="editeur" required />
        </FormAction>
      </Section>
      <Section titre={`Jeux (${jeux.length})`}>
        <ul className="grid gap-4">
          {jeux.map((j) => (
            <li key={j.idJeu} className="flex flex-wrap items-end gap-3 border-b pb-4">
              <FormAction action={actionModifierJeu} caches={{ idJeu: j.idJeu }}>
                <Champ libelle="Nom" name="nom" id={String(j.idJeu)} defaultValue={j.nom} required />
                <Champ
                  libelle="Éditeur"
                  name="editeur"
                  id={String(j.idJeu)}
                  defaultValue={j.editeur}
                  required
                />
              </FormAction>
              <FormAction
                action={actionSupprimerJeu}
                caches={{ idJeu: j.idJeu }}
                libelle="Supprimer"
                variante="outline"
                confirmer={`Supprimer le jeu ${j.nom} ?`}
              />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
