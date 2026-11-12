import { notFound } from "next/navigation";
import { actionAttribuerRole } from "@/app/actions";
import { Choix, FormAction } from "@/composants/formulaire";
import { Titre } from "@/composants/page";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { listeEquipes } from "@/requetes/equipes";
import { listeComptes } from "@/services/comptes";

const ROLES = [
  { valeur: "membre", libelle: "Membre" },
  { valeur: "organisateur", libelle: "Organisateur" },
  { valeur: "admin", libelle: "Admin" },
];

export default async function Comptes() {
  const { acteur } = await exigerConnexion();
  if (!peut(acteur, "role.attribuer")) notFound();
  const [comptes, equipes] = await Promise.all([listeComptes(), listeEquipes()]);
  const choixEquipes = equipes.map((e) => ({ valeur: e.idEquipe, libelle: `${e.nom} (${e.jeu})` }));
  return (
    <>
      <Titre sur="EF-15">Comptes et rôles</Titre>
      <p className="mb-6 text-sm text-muted-foreground">
        Un capitaine est un compte rattaché à une équipe. Un changement s&apos;applique dès la prochaine
        action du compte.
      </p>
      <ul className="grid gap-4">
        {comptes.map((c) => (
          <li key={c.idUtilisateur} className="flex flex-wrap items-end gap-x-6 gap-y-2 border-b pb-4">
            <div className="w-64">
              <p className="font-medium">{c.nom}</p>
              <p className="text-sm text-muted-foreground">{c.email}</p>
            </div>
            <FormAction action={actionAttribuerRole} caches={{ idUtilisateur: c.idUtilisateur }}>
              <Choix libelle="Rôle" name="role" options={ROLES} defaultValue={c.role} />
              <Choix
                libelle="Capitaine de"
                name="idEquipe"
                options={choixEquipes}
                defaultValue={c.idEquipe ?? ""}
                vide="— aucune équipe —"
              />
            </FormAction>
          </li>
        ))}
      </ul>
    </>
  );
}
