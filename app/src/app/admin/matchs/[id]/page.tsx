import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import {
  actionAnnulerMatch,
  actionCorrigerManche,
  actionDateMatch,
  actionDesignerQualifie,
  actionForfait,
  actionSaisirManche,
  actionSupprimerDerniereManche,
} from "@/app/actions";
import { Champ, FormAction } from "@/composants/formulaire";
import { Statut } from "@/composants/match";
import { Section } from "@/composants/page";
import { db } from "@/db/client";
import { formatBo, formatDateHeure, LIBELLE_PHASE, lireId } from "@/lib/format";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { majorite } from "@/metier/score";
import { manchesDuMatch, matchParId } from "@/requetes/matchs";
import { tournoiParId } from "@/requetes/tournois";

/** EF-08 à EF-10 : la saisie d'un match. Champs larges et gros boutons : confortable sur tablette (ENF-07). */
export default async function SaisieMatch({ params }: { params: Promise<{ id: string }> }) {
  const { acteur } = await exigerConnexion();
  const id = lireId((await params).id);
  const m = id && (await matchParId(id));
  const t = m && (await tournoiParId(m.idTournoi));
  if (!m || !t || !peut(acteur, "tournoi.gerer", t)) notFound();

  const [manches, cartes] = await Promise.all([
    manchesDuMatch(m.idMatch, m.idA, m.idB),
    db.execute<{ carte: string }>(sql`
      SELECT DISTINCT ma.carte FROM manche ma
      JOIN match x ON x.id_match = ma.id_match JOIN phase ph ON ph.id_phase = x.id_phase
      JOIN tournoi tt ON tt.id_tournoi = ph.id_tournoi
      WHERE tt.id_jeu = ${t.idJeu} ORDER BY ma.carte`),
  ]);
  const cle = { idMatch: m.idMatch };
  const jouable = t.etat === "en_cours" && (m.statut === "prevu" || m.statut === "en_cours");
  const forfait = m.forfaitA || m.forfaitB;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        <Link href={`/admin/tournois/${m.idTournoi}`} className="underline underline-offset-4">
          {m.tournoi}
        </Link>{" "}
        · {LIBELLE_PHASE[m.phaseType]} · {formatBo(m.format)} (premier à {majorite(m.format)}) ·{" "}
        {formatDateHeure(m.dateHeure)} ·{" "}
        <Link href={`/matchs/${m.idMatch}`} className="underline underline-offset-4">
          Page publique
        </Link>
      </p>

      <div className="mb-8 rounded-lg border bg-card p-6 text-center">
        <div className="mb-3 flex justify-center">
          <Statut statut={m.statut} />
        </div>
        <h1 className="flex items-center justify-center gap-6 text-xl font-bold sm:text-2xl">
          <span className="flex-1 text-right">{m.nomA}</span>
          <span className="score text-5xl font-black">
            {m.scoreA ?? "–"}
            <span className="mx-2 text-muted-foreground">:</span>
            {m.scoreB ?? "–"}
          </span>
          <span className="flex-1 text-left">{m.nomB}</span>
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Le score est calculé à partir des manches : il ne se saisit pas (EF-08).
          {forfait && ` Forfait de ${m.forfaitA ? m.nomA : m.nomB} (RG12).`}
        </p>
      </div>

      <Section titre={`Manches (${manches.length})`}>
        <ol className="grid gap-3">
          {manches.map((ma) => (
            <li key={ma.idManche} className="rounded-lg border p-3">
              <FormAction
                action={actionCorrigerManche}
                caches={{ idManche: ma.idManche }}
                libelle="Corriger"
                variante="outline"
              >
                <span className="score w-8 self-center text-lg text-muted-foreground">{ma.numero}</span>
                <Champ
                  libelle="Carte"
                  name="carte"
                  id={`c${ma.idManche}`}
                  defaultValue={ma.carte}
                  list="cartes"
                  required
                />
                <Champ
                  libelle={m.nomA}
                  name="pointsA"
                  id={`c${ma.idManche}`}
                  type="number"
                  min={0}
                  defaultValue={ma.pointsA}
                  required
                  className="w-24"
                />
                <Champ
                  libelle={m.nomB}
                  name="pointsB"
                  id={`c${ma.idManche}`}
                  type="number"
                  min={0}
                  defaultValue={ma.pointsB}
                  required
                  className="w-24"
                />
              </FormAction>
            </li>
          ))}
        </ol>
        {manches.length === 0 && <p className="text-sm text-muted-foreground">Aucune manche saisie.</p>}
        {manches.length > 0 && (
          <div className="mt-3">
            <FormAction
              action={actionSupprimerDerniereManche}
              caches={cle}
              libelle="Retirer la dernière manche"
              variante="ghost"
              confirmer="Retirer la dernière manche saisie ?"
            />
          </div>
        )}
      </Section>

      <datalist id="cartes">
        {cartes.map((c) => (
          <option key={c.carte} value={c.carte} />
        ))}
      </datalist>

      {jouable && (
        <Section titre={`Saisir la manche ${manches.length + 1}`}>
          <FormAction
            action={actionSaisirManche}
            caches={cle}
            libelle="Enregistrer la manche"
            className="flex flex-wrap items-end gap-4 [&_button]:h-11 [&_button]:px-6 [&_input]:h-11 [&_input]:text-lg"
          >
            <Champ libelle="Carte" name="carte" list="cartes" required autoComplete="off" className="w-56" />
            <Champ
              libelle={`Points ${m.nomA}`}
              name="pointsA"
              type="number"
              min={0}
              inputMode="numeric"
              required
              className="w-28"
            />
            <Champ
              libelle={`Points ${m.nomB}`}
              name="pointsB"
              type="number"
              min={0}
              inputMode="numeric"
              required
              className="w-28"
            />
          </FormAction>
          <p className="mt-2 text-xs text-muted-foreground">
            Pas d&apos;égalité (RG11). Le match se termine tout seul à {majorite(m.format)} manche
            {majorite(m.format) > 1 ? "s" : ""} gagnée{majorite(m.format) > 1 ? "s" : ""}, et le vainqueur
            avance.
          </p>
        </Section>
      )}

      {t.etat === "en_cours" && m.statut !== "termine" && (
        <Section titre="Forfait (EF-09, RG12)">
          <p className="mb-3 text-sm text-muted-foreground">
            L&apos;adversaire gagne {majorite(m.format)}-0, sans manche ; les manches déjà saisies sont
            retirées.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { idEquipe: m.idA, nom: m.nomA },
              { idEquipe: m.idB, nom: m.nomB },
            ].map((e) => (
              <FormAction
                key={e.idEquipe}
                action={actionForfait}
                caches={{ ...cle, idEquipe: e.idEquipe }}
                libelle={`Forfait de ${e.nom}`}
                variante="outline"
                confirmer={`Déclarer le forfait de ${e.nom} ?`}
              />
            ))}
          </div>
        </Section>
      )}

      {m.statut === "prevu" && (
        <Section titre="Déplacer ou annuler (EF-06, EF-10)">
          <div className="flex flex-wrap items-end gap-6">
            <FormAction action={actionDateMatch} caches={cle} libelle="Déplacer">
              <Champ
                libelle="Date et heure"
                name="dateHeure"
                type="datetime-local"
                defaultValue={m.dateHeure.slice(0, 16).replace(" ", "T")}
                required
                className="w-56"
              />
            </FormAction>
            <FormAction
              action={actionAnnulerMatch}
              caches={cle}
              libelle="Annuler le match"
              variante="destructive"
              confirmer="Annuler ce match ? Il n'aura pas de vainqueur."
            />
          </div>
        </Section>
      )}

      {m.statut === "annule" && m.phaseType === "elimination" && (
        <Section titre="Qui avance ? (EF-10)">
          <p className="mb-3 text-sm text-muted-foreground">
            Un match annulé n&apos;a pas de vainqueur. Désignez l&apos;équipe qui passe au tour suivant, ou
            déclarez un forfait ci-dessus.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { idEquipe: m.idA, nom: m.nomA },
              { idEquipe: m.idB, nom: m.nomB },
            ].map((e) => (
              <FormAction
                key={e.idEquipe}
                action={actionDesignerQualifie}
                caches={{ ...cle, idEquipe: e.idEquipe }}
                libelle={`${e.nom} avance`}
                variante="outline"
              />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
