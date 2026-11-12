// Cahier des charges § 3 : la matrice des droits, en une fonction pure.
// Elle est appelée par chaque service, côté serveur : masquer un bouton ne suffit pas.

export type Role = "membre" | "organisateur" | "admin";
/** Le compte connecté ; null pour un visiteur. Capitaine = compte rattaché à une équipe. */
export type Acteur = { id: number; role: Role; idEquipe: number | null } | null;

type Ressources = {
  "jeu.gerer": undefined;
  "equipe.creer": undefined;
  "equipe.gerer": { idEquipe: number };
  "inscription.gerer": { idEquipe: number; idOrganisateur: number | null };
  "tournoi.creer": undefined;
  "tournoi.gerer": { idOrganisateur: number | null };
  "role.attribuer": undefined;
};
export type Action = keyof Ressources;
/** L'argument « ressource » d'une action : absent quand l'action n'en a pas. */
export type Reste<A extends Action> = Ressources[A] extends undefined ? [] : [Ressources[A]];

export function peut<A extends Action>(acteur: Acteur, action: A, ...[ressource]: Reste<A>): boolean {
  if (!acteur) return false; // un visiteur ne fait que consulter
  if (acteur.role === "admin") return true;
  const r = ressource as Partial<{ idEquipe: number; idOrganisateur: number | null }> | undefined;
  const organise = acteur.role === "organisateur" && r?.idOrganisateur === acteur.id;
  const capitaine = acteur.idEquipe !== null && r?.idEquipe === acteur.idEquipe;
  switch (action) {
    case "equipe.creer":
      return acteur.idEquipe === null; // libre-service : une équipe par compte
    case "equipe.gerer":
      return capitaine;
    case "inscription.gerer":
      return capitaine || organise;
    case "tournoi.creer":
      return acteur.role === "organisateur";
    case "tournoi.gerer":
      return organise;
    default: // jeu.gerer, role.attribuer : admin seulement
      return false;
  }
}
