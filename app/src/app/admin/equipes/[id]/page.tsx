import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import {
  actionAjouterJoueur,
  actionCreerJoueur,
  actionDesinscrire,
  actionInscrire,
  actionModifierEquipe,
  actionSortirJoueur,
} from "@/app/actions";
import { Champ, Choix, FormAction } from "@/composants/formulaire";
import { Section, Titre, lien } from "@/composants/page";
import { db } from "@/db/client";
import { formatDate, lireId } from "@/lib/format";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";
import { effectifActuel, equipeParId } from "@/requetes/equipes";
import { listeJeux, tournoisOuvertsPour } from "@/requetes/tournois";

const aujourdhui = () => new Date().toLocaleDateString("sv-SE"); // AAAA-MM-JJ, heure locale

export default async function GestionEquipe({ params }: { params: Promise<{ id: string }> }) {
  const { acteur } = await exigerConnexion();
  const id = lireId((await params).id);
  const e = id && (await equipeParId(id));
  if (!e || !peut(acteur, "equipe.gerer", { idEquipe: e.idEquipe })) notFound();

  const [jeux, effectif, ouverts, pseudos] = await Promise.all([
    listeJeux(),
    effectifActuel(e.idEquipe),
    tournoisOuvertsPour(e.idEquipe),
    db.execute<{ pseudo: string }>(sql`SELECT pseudo FROM joueur ORDER BY pseudo`),
  ]);
  const cle = { idEquipe: e.idEquipe };

  return (
    <>
      <Titre
        sur={`${e.tag} · ${e.jeu}`}
        droite={
          <Link href={`/equipes/${e.idEquipe}`} className="text-sm underline underline-offset-4">
            Page publique
          </Link>
        }
      >
        {e.nom}
      </Titre>

      <Section titre="Profil (EF-03)">
        <FormAction action={actionModifierEquipe} caches={cle}>
          <Champ libelle="Nom" name="nom" defaultValue={e.nom} required />
          <Champ libelle="Tag" name="tag" maxLength={6} defaultValue={e.tag} required className="w-24" />
          <Champ libelle="Pays" name="pays" maxLength={3} defaultValue={e.pays} required className="w-20" />
          <Choix
            libelle="Jeu"
            name="idJeu"
            options={jeux.map((j) => ({ valeur: j.idJeu, libelle: j.nom }))}
            defaultValue={e.idJeu}
          />
        </FormAction>
      </Section>

      <Section titre={`Effectif actuel (${effectif.length}) · EF-04, RG7`}>
        <ul className="mb-4">
          {effectif.map((j) => (
            <li key={j.idJoueur} className="flex flex-wrap items-end gap-3 border-b py-2">
              <span className="w-56">
                <Link href={`/joueurs/${j.idJoueur}`} className={`font-medium ${lien}`}>
                  {j.pseudo}
                </Link>{" "}
                <span className="text-sm text-muted-foreground">
                  {j.role} · depuis le {formatDate(j.dateEntree)}
                </span>
              </span>
              <FormAction
                action={actionSortirJoueur}
                caches={{ ...cle, idJoueur: j.idJoueur, dateEntree: j.dateEntree }}
                libelle="Faire sortir"
                variante="outline"
              >
                <Champ
                  libelle="Date de sortie"
                  name="dateSortie"
                  id={String(j.idJoueur)}
                  type="date"
                  defaultValue={aujourdhui()}
                  required
                />
              </FormAction>
            </li>
          ))}
        </ul>
        <h3 className="mb-2 text-sm font-medium">Ajouter un joueur existant</h3>
        <FormAction action={actionAjouterJoueur} caches={cle} libelle="Ajouter à l'effectif">
          <Champ libelle="Pseudo" name="pseudo" list="pseudos" required autoComplete="off" />
          <datalist id="pseudos">
            {pseudos.map((p) => (
              <option key={p.pseudo} value={p.pseudo} />
            ))}
          </datalist>
          <Champ libelle="Date d'entrée" name="dateEntree" type="date" defaultValue={aujourdhui()} required />
          <Champ libelle="Rôle" name="role" defaultValue="titulaire" required className="w-32" />
        </FormAction>
        <h3 className="mt-6 mb-2 text-sm font-medium">Créer un joueur (RG6)</h3>
        <FormAction action={actionCreerJoueur} libelle="Créer le joueur">
          <Champ libelle="Pseudo (unique)" name="pseudo" id="nouveau" required />
          <Champ libelle="Prénom" name="prenom" required className="w-32" />
          <Champ libelle="Nom" name="nom" id="nouveau" required className="w-32" />
          <Champ
            libelle="Pays"
            name="pays"
            id="nouveau"
            maxLength={3}
            defaultValue="FR"
            required
            className="w-20"
          />
          <Champ libelle="Né le" name="neLe" type="date" required />
        </FormAction>
      </Section>

      <Section titre={`Tournois ouverts sur ${e.jeu} (${ouverts.length}) · EF-05`}>
        {ouverts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun tournoi n&apos;a ses inscriptions ouvertes sur ce jeu.
          </p>
        ) : (
          <ul>
            {ouverts.map((t) => (
              <li key={t.idTournoi} className="flex flex-wrap items-center gap-3 border-b py-2">
                <Link href={`/tournois/${t.idTournoi}`} className={`w-56 font-medium ${lien}`}>
                  {t.nom}
                </Link>
                <span className="text-sm text-muted-foreground">début le {formatDate(t.dateDebut)}</span>
                {t.inscrite ? (
                  <FormAction
                    action={actionDesinscrire}
                    caches={{ ...cle, idTournoi: t.idTournoi }}
                    libelle="Se désinscrire"
                    variante="outline"
                  >
                    <span className="text-sm text-direct">Inscrite</span>
                  </FormAction>
                ) : (
                  <FormAction
                    action={actionInscrire}
                    caches={{ ...cle, idTournoi: t.idTournoi }}
                    libelle="Inscrire mon équipe"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
