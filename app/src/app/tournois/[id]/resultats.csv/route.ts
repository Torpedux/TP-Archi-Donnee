import { lireId, LIBELLE_PHASE, LIBELLE_STATUT } from "@/lib/format";
import { matchsDuTournoi } from "@/requetes/matchs";
import { tournoiParId } from "@/requetes/tournois";

/** Une cellule CSV : entre guillemets, guillemets doublés ; pas de formule pour un tableur (=, +, -, @). */
const cellule = (v: string | number | null) => {
  const texte = String(v ?? "");
  return `"${(/^[=+\-@]/.test(texte) ? "'" + texte : texte).replace(/"/g, '""')}"`;
};

/** EF-17 : export CSV des résultats d'un tournoi public. Séparateur « ; » et BOM : s'ouvre tel quel dans Excel. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = lireId((await params).id);
  const t = id && (await tournoiParId(id));
  if (!t || t.etat === "brouillon") return new Response("Tournoi introuvable", { status: 404 });
  const lignes = [
    ["date_heure", "phase", "format", "statut", "equipe_a", "score_a", "score_b", "equipe_b", "forfait"],
    ...(await matchsDuTournoi(t.idTournoi)).map((m) => [
      m.dateHeure,
      LIBELLE_PHASE[m.phaseType],
      `BO${m.format}`,
      LIBELLE_STATUT[m.statut],
      m.nomA,
      m.scoreA,
      m.scoreB,
      m.nomB,
      m.forfaitA ? m.nomA : m.forfaitB ? m.nomB : "",
    ]),
  ];
  return new Response("﻿" + lignes.map((l) => l.map(cellule).join(";")).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resultats-tournoi-${t.idTournoi}.csv"`,
    },
  });
}
