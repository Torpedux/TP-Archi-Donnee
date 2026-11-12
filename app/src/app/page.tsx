import { Direct } from "@/composants/direct";
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { GrilleMatchs } from "@/composants/match";
import { Section } from "@/composants/page";
import { CarteTournoi } from "@/composants/tournoi";
import { derniersResultats, matchsEnDirect } from "@/requetes/matchs";
import { listeTournois } from "@/requetes/tournois";

export default async function Accueil() {
  const [direct, enCours, ouverts, resultats, [chiffres]] = await Promise.all([
    matchsEnDirect(),
    listeTournois({ etat: "en_cours" }),
    listeTournois({ etat: "inscriptions" }),
    derniersResultats(9),
    db.execute<{ equipes: number; joueurs: number; tournois: number; matchs: number }>(sql`
      SELECT (SELECT count(*)::int FROM equipe) AS equipes, (SELECT count(*)::int FROM joueur) AS joueurs,
             (SELECT count(*)::int FROM tournoi) AS tournois,
             (SELECT count(*)::int FROM match WHERE statut = 'termine') AS matchs`),
  ]);
  return (
    <>
      <Direct />
      <div className="mb-10">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
          Les tournois, les scores, <span className="text-direct">qui a battu qui.</span>
        </h1>
        <p className="mt-3 text-muted-foreground">
          <span className="score text-foreground">{chiffres.equipes}</span> équipes ·{" "}
          <span className="score text-foreground">{chiffres.joueurs}</span> joueurs ·{" "}
          <span className="score text-foreground">{chiffres.tournois}</span> tournois ·{" "}
          <span className="score text-foreground">{chiffres.matchs}</span> matchs joués
        </p>
      </div>

      <Section titre="En direct">
        <GrilleMatchs matchs={direct} vide="Aucun match en cours pour le moment." />
      </Section>

      {enCours.length + ouverts.length > 0 && (
        <Section titre="Tournois du moment">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...enCours, ...ouverts].map((t) => (
              <CarteTournoi key={t.idTournoi} t={t} />
            ))}
          </div>
        </Section>
      )}

      <Section titre="Derniers résultats">
        <GrilleMatchs matchs={resultats} vide="Aucun match joué." />
        <p className="mt-4 text-sm">
          <Link href="/tournois" className="underline underline-offset-4">
            Tous les tournois
          </Link>
        </p>
      </Section>
    </>
  );
}
