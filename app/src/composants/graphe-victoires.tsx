"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Arete, Noeud } from "@/requetes/graphe";

// Couleurs du thème (globals.css), en clair pour le canvas de Cytoscape.
const LIME = "#b6f03c";
const TEXTE = "#f1f2f4";
const SOURD = "#8b90a0";
const FOND_NOEUD = "#2a2d38";

/**
 * EF-14 : le graphe orienté « qui a battu qui ». Nœuds = équipes, flèches = victoires (du vainqueur
 * vers le perdant), épaisseur = nombre de victoires. Cliquer sur une équipe la prend comme point de départ.
 * Le tableau sous le graphe donne la même information en texte (ENF-06).
 */
export function GrapheVictoires({
  noeuds,
  aretes,
  enCercle,
  lienEquipe,
}: {
  noeuds: Noeud[];
  aretes: Arete[];
  enCercle: boolean;
  /** Début de l'URL à ouvrir au clic sur un nœud : l'id de l'équipe y est ajouté. */
  lienEquipe: string;
}) {
  const conteneur = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let detruit = false;
    let cy: import("cytoscape").Core | undefined;
    // Cytoscape est lourd et n'a de sens que dans le navigateur : chargé à la demande.
    import("cytoscape").then(({ default: cytoscape }) => {
      if (detruit || !conteneur.current) return;
      const depart = noeuds.find((n) => n.role === "depart");
      cy = cytoscape({
        container: conteneur.current,
        elements: [
          ...noeuds.map((n) => ({ data: { id: String(n.id), nom: n.nom, role: n.role } })),
          ...aretes.map((a) => ({
            data: {
              id: `${a.source}-${a.cible}`,
              source: String(a.source),
              target: String(a.cible),
              victoires: a.victoires,
              libelle: a.victoires > 1 ? `×${a.victoires}` : "",
            },
          })),
        ],
        layout: enCercle
          ? { name: "circle", padding: 30 }
          : {
              name: "breadthfirst",
              directed: true,
              // En cercles : l'équipe de départ au centre, un cercle par niveau, les noms ne se chevauchent pas.
              circle: true,
              roots: depart ? [String(depart.id)] : undefined,
              padding: 40,
              spacingFactor: 1.2,
            },
        minZoom: 0.3,
        maxZoom: 2.5,
        style: [
          {
            selector: "node",
            style: {
              label: "data(nom)",
              color: TEXTE,
              "font-size": 11,
              "text-valign": "bottom",
              "text-margin-y": 6,
              "background-color": FOND_NOEUD,
              "border-width": 2,
              "border-color": SOURD,
              width: 22,
              height: 22,
            },
          },
          {
            selector: 'node[role = "depart"]',
            style: {
              "background-color": LIME,
              "border-color": LIME,
              width: 32,
              height: 32,
              "font-weight": "bold",
            },
          },
          {
            selector: 'node[role = "autre"]',
            style: { "border-color": LIME, "border-width": 4, width: 32, height: 32, "font-weight": "bold" },
          },
          {
            selector: "edge",
            style: {
              width: "mapData(victoires, 1, 5, 1.5, 7)",
              "line-color": SOURD,
              "target-arrow-color": SOURD,
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(libelle)",
              color: TEXTE,
              "font-size": 10,
              "text-background-color": "#1c1e26",
              "text-background-opacity": 1,
              "text-background-padding": "2px",
            },
          },
        ],
      });
      cy.on("tap", "node", (e) => router.push(`${lienEquipe}${e.target.id()}`));
    });
    return () => {
      detruit = true;
      cy?.destroy();
    };
  }, [noeuds, aretes, enCercle, lienEquipe, router]);

  return (
    <div
      ref={conteneur}
      role="img"
      aria-label={`Graphe de ${noeuds.length} équipes et ${aretes.length} flèches de victoire. Le détail est dans le tableau qui suit.`}
      className="h-[36rem] w-full rounded-lg border bg-card"
    />
  );
}
