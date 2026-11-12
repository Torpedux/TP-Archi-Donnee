import { cypher } from "@/db/neo4j";
import { Q6, Q7, Q8 } from "./cypher-copie";

// EF-14 : les trois vues du graphe « qui a battu qui ». Les données viennent de Neo4j, pas de
// PostgreSQL : c'est la démonstration du choix de l'ADR 0001.

export type Vue = "battues" | "chaines" | "communs";
export type Noeud = { id: number; nom: string; role: "depart" | "autre" | "normal" };
export type Arete = { source: number; cible: number; victoires: number };

export type LigneQ6 = {
  battue: string;
  tournoi: string;
  phase: string;
  score: string;
  par_forfait: boolean;
  le: string;
};
export type LigneQ7 = { domine_indirectement: string; niveaux: number; chaine: string[] };
export type LigneQ8 = { adversaire_commun: string; bilan_a: string[]; bilan_b: string[] };

export type Graphe =
  | { vue: "battues"; lignes: LigneQ6[]; noeuds: Noeud[]; aretes: Arete[] }
  | { vue: "chaines"; lignes: LigneQ7[]; noeuds: Noeud[]; aretes: Arete[] }
  | { vue: "communs"; lignes: LigneQ8[]; noeuds: Noeud[]; aretes: Arete[] };

/** L'équipe qui a le plus de victoires (sur un jeu, ou partout) : le point de départ par défaut. */
export async function equipesLesPlusVictorieuses(jeu: string | null, n = 2) {
  return cypher<{ nom: string }>(
    `MATCH (e:Equipe)-[r:A_BATTU]->() WHERE $jeu IS NULL OR e.jeu = $jeu
     RETURN e.nom AS nom, count(r) AS victoires ORDER BY victoires DESC, nom LIMIT toInteger($n)`,
    { jeu, n },
  );
}

/** Les nœuds et les flèches à dessiner pour des paires d'équipes ; l'épaisseur vient du nombre de victoires. */
async function dessin(
  paires: [string, string][],
  depart: string,
  autre: string | null,
  idTournoi: number | null,
) {
  const noms = [...new Set([depart, ...(autre ? [autre] : []), ...paires.flat()])];
  const [equipes, fleches] = await Promise.all([
    cypher<{ nom: string; id: number }>(
      `MATCH (e:Equipe) WHERE e.nom IN $noms RETURN e.nom AS nom, e.id_equipe AS id`,
      { noms },
    ),
    cypher<{ source: string; cible: string; victoires: number }>(
      `MATCH (a:Equipe)-[r:A_BATTU]->(b:Equipe)
       WHERE a.nom IN $noms AND b.nom IN $noms AND ($tournoi IS NULL OR r.id_tournoi = $tournoi)
       RETURN a.nom AS source, b.nom AS cible, count(r) AS victoires`,
      { noms, tournoi: idTournoi },
    ),
  ]);
  const idDe = new Map(equipes.map((e) => [e.nom, e.id]));
  const voulues = new Set(paires.flatMap(([a, b]) => [`${a}→${b}`, `${b}→${a}`]));
  return {
    noeuds: equipes.map((e): Noeud => ({
      ...e,
      role: e.nom === depart ? "depart" : e.nom === autre ? "autre" : "normal",
    })),
    aretes: fleches
      .filter((f) => voulues.has(`${f.source}→${f.cible}`))
      .map((f): Arete => ({
        source: idDe.get(f.source)!,
        cible: idDe.get(f.cible)!,
        victoires: f.victoires,
      })),
  };
}

/** Q6 : les équipes battues par `equipe`, filtrables par tournoi. */
export async function vueBattues(
  equipe: string,
  idTournoi: number | null,
  tournoi: string | null,
): Promise<Graphe> {
  const brut = await cypher<LigneQ6>(Q6, { equipe });
  const lignes = brut
    .filter((l) => !tournoi || l.tournoi === tournoi)
    .map((l) => ({ ...l, le: String(l.le) }));
  const paires = lignes.map((l): [string, string] => [equipe, l.battue]);
  return { vue: "battues", lignes, ...(await dessin(paires, equipe, null, idTournoi)) };
}

/** Q7 : les chaînes de victoires depuis `equipe`, jusqu'à trois niveaux. */
export async function vueChaines(equipe: string): Promise<Graphe> {
  const lignes = await cypher<LigneQ7>(Q7, { equipe });
  const paires = lignes.flatMap((l) =>
    l.chaine.slice(1).map((nom, i): [string, string] => [l.chaine[i], nom]),
  );
  return { vue: "chaines", lignes, ...(await dessin(paires, equipe, null, null)) };
}

/** Q8 : les adversaires communs de `equipe` et `autre`. */
export async function vueCommuns(equipe: string, autre: string): Promise<Graphe> {
  const lignes = await cypher<LigneQ8>(Q8, { equipe, autre });
  const paires = lignes.flatMap((l): [string, string][] => [
    [equipe, l.adversaire_commun],
    [autre, l.adversaire_commun],
  ]);
  return { vue: "communs", lignes, ...(await dessin(paires, equipe, autre, null)) };
}
