import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Choix } from "@/composants/formulaire";
import { GrapheVictoires } from "@/composants/graphe-victoires";
import { Section, Titre } from "@/composants/page";
import { formatDateHeure, LIBELLE_PHASE, lireId } from "@/lib/format";
import { listeEquipes } from "@/requetes/equipes";
import {
  equipesLesPlusVictorieuses,
  vueBattues,
  vueChaines,
  vueCommuns,
  type Graphe,
  type Vue,
} from "@/requetes/graphe";
import { listeJeux, listeTournois } from "@/requetes/tournois";

export const metadata: Metadata = { title: "Graphe « qui a battu qui »" };

const VUES: { vue: Vue; libelle: string; question: string }[] = [
  { vue: "battues", libelle: "Équipes battues", question: "Q6 · Qui cette équipe a-t-elle battu ?" },
  {
    vue: "chaines",
    libelle: "Chaînes de victoires",
    question: "Q7 · A a battu B qui a battu C, jusqu'à 3 niveaux",
  },
  {
    vue: "communs",
    libelle: "Adversaires communs",
    question: "Q8 · Les adversaires communs de deux équipes",
  },
];

type Params = { vue?: string; jeu?: string; equipe?: string; autre?: string; tournoi?: string };

function Tableau({ g, depart, autre }: { g: Graphe; depart: string; autre: string }) {
  if (g.lignes.length === 0)
    return <p className="text-sm text-muted-foreground">Aucun résultat pour cette équipe.</p>;
  if (g.vue === "battues")
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Équipe battue</TableHead>
            <TableHead>Tournoi</TableHead>
            <TableHead>Phase</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {g.lignes.map((l, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{l.battue}</TableCell>
              <TableCell>{l.tournoi}</TableCell>
              <TableCell>{LIBELLE_PHASE[l.phase as keyof typeof LIBELLE_PHASE] ?? l.phase}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDateHeure(l.le.replace("T", " "))}
              </TableCell>
              <TableCell className="score text-right">
                {l.score}
                {l.par_forfait && <span className="ml-2 text-xs text-destructive">forfait</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  if (g.vue === "chaines")
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Équipe dominée</TableHead>
            <TableHead>Niveaux</TableHead>
            <TableHead>Chaîne la plus courte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {g.lignes.map((l) => (
            <TableRow key={l.domine_indirectement}>
              <TableCell className="font-medium">{l.domine_indirectement}</TableCell>
              <TableCell className="score">{l.niveaux}</TableCell>
              <TableCell className="text-muted-foreground">{l.chaine.join(" → ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Adversaire commun</TableHead>
          <TableHead>{depart} contre lui</TableHead>
          <TableHead>{autre} contre lui</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {g.lignes.map((l) => (
          <TableRow key={l.adversaire_commun}>
            <TableCell className="font-medium">{l.adversaire_commun}</TableCell>
            <TableCell>{l.bilan_a.join(" et ")}</TableCell>
            <TableCell>{l.bilan_b.join(" et ")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function PageGraphe({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams;
  const vue = VUES.find((v) => v.vue === p.vue) ?? VUES[0];
  const jeux = await listeJeux();
  const jeu = jeux.find((j) => j.idJeu === lireId(p.jeu));
  const [equipes, tournois] = await Promise.all([
    listeEquipes(jeu?.idJeu),
    listeTournois({ idJeu: jeu?.idJeu }),
  ]);
  const tournoi = tournois.find((t) => t.idTournoi === lireId(p.tournoi));
  const url = (q: Record<string, string | number | undefined>) =>
    "/graphe?" +
    new URLSearchParams(
      Object.entries({ vue: vue.vue, jeu: jeu?.idJeu, ...q })
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)]),
    );

  let graphe: Graphe | undefined;
  let depart = equipes.find((e) => e.idEquipe === lireId(p.equipe));
  let autre = equipes.find((e) => e.idEquipe === lireId(p.autre));
  let panne = false;
  try {
    // Sans choix, on part des équipes qui ont le plus gagné : la page montre tout de suite quelque chose.
    if (!depart) {
      const [meilleure] = await equipesLesPlusVictorieuses(jeu?.nom ?? null, 1);
      depart = equipes.find((e) => e.nom === meilleure?.nom);
    }
    if (depart && vue.vue === "communs" && !autre) {
      // Deux équipes n'ont d'adversaires communs que sur le même jeu (RG4).
      const rivales = await equipesLesPlusVictorieuses(depart.jeu, 2);
      autre = equipes.find((e) => e.nom === rivales.find((r) => r.nom !== depart!.nom)?.nom);
    }
    if (depart)
      graphe =
        vue.vue === "battues"
          ? await vueBattues(depart.nom, tournoi?.idTournoi ?? null, tournoi?.nom ?? null)
          : vue.vue === "chaines"
            ? await vueChaines(depart.nom)
            : autre
              ? await vueCommuns(depart.nom, autre.nom)
              : undefined;
  } catch (e) {
    console.error("Neo4j : graphe indisponible.", e);
    panne = true;
  }
  const choixEquipes = equipes.map((e) => ({ valeur: e.idEquipe, libelle: e.nom }));

  return (
    <>
      <Titre sur="Neo4j · ADR 0001">Qui a battu qui</Titre>
      <nav aria-label="Vues du graphe" className="mb-4 flex flex-wrap gap-2">
        {VUES.map((v) => (
          <Link
            key={v.vue}
            href={url({ vue: v.vue, equipe: depart?.idEquipe, autre: autre?.idEquipe })}
            aria-current={v.vue === vue.vue ? "true" : undefined}
            className="rounded-full border px-3 py-1 text-sm text-muted-foreground hover:text-foreground aria-[current]:border-foreground aria-[current]:text-foreground"
          >
            {v.libelle}
          </Link>
        ))}
      </nav>
      <p className="mb-4 text-sm text-muted-foreground">{vue.question}</p>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <input type="hidden" name="vue" value={vue.vue} />
        <Choix
          libelle="Jeu"
          name="jeu"
          options={jeux.map((j) => ({ valeur: j.idJeu, libelle: j.nom }))}
          defaultValue={jeu?.idJeu}
          vide="Tous les jeux"
        />
        <Choix
          libelle="Équipe"
          name="equipe"
          options={choixEquipes}
          defaultValue={depart?.idEquipe}
          vide="La plus victorieuse"
        />
        {vue.vue === "communs" && (
          <Choix
            libelle="Autre équipe"
            name="autre"
            options={choixEquipes}
            defaultValue={autre?.idEquipe}
            vide="Choisie pour vous"
          />
        )}
        {vue.vue === "battues" && (
          <Choix
            libelle="Tournoi"
            name="tournoi"
            options={tournois.map((t) => ({ valeur: t.idTournoi, libelle: t.nom }))}
            defaultValue={tournoi?.idTournoi}
            vide="Tous les tournois"
          />
        )}
        <Button type="submit" size="sm">
          Afficher
        </Button>
      </form>

      {panne && (
        <p role="alert" className="rounded-lg border border-destructive p-4 text-sm">
          Le graphe est indisponible : Neo4j ne répond pas. Les résultats restent consultables sur les pages
          des tournois et des équipes (PostgreSQL).
        </p>
      )}
      {!panne && !graphe && (
        <p className="text-muted-foreground">Aucune victoire enregistrée pour ce choix.</p>
      )}
      {graphe && depart && (
        <>
          <GrapheVictoires
            noeuds={graphe.noeuds}
            aretes={graphe.aretes}
            enCercle={graphe.vue === "communs"}
            lienEquipe={url({ equipe: "" })}
          />
          <p className="mt-2 mb-8 text-xs text-muted-foreground">
            Une flèche va du vainqueur vers le perdant ; plus elle est épaisse, plus il y a de victoires. En
            vert :{" "}
            <Link
              href={`/equipes/${depart.idEquipe}`}
              className="text-foreground underline underline-offset-4"
            >
              {depart.nom}
            </Link>
            . Cliquez sur une équipe pour repartir d&apos;elle.
          </p>
          <Section titre={`${vue.libelle} (${graphe.lignes.length})`}>
            <Tableau g={graphe} depart={depart.nom} autre={autre?.nom ?? ""} />
          </Section>
        </>
      )}
    </>
  );
}
