import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { exigerDroit, id, texte, transaction, valider, videEnNull, type Acteur } from "./socle";

const email = z.string().trim().toLowerCase().pipe(z.email("E-mail invalide."));

const nouveauCompte = z.object({
  email,
  nom: texte("Nom", 60),
  motDePasse: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères.").max(72),
});

/** EF-15 : inscription. Le mot de passe est haché (bcrypt), le compte naît « membre ». */
export async function creerCompte(donnees: unknown, role: "membre" | "organisateur" | "admin" = "membre") {
  const d = valider(nouveauCompte, donnees);
  const hash = await bcrypt.hash(d.motDePasse, 10);
  return transaction(async (tx) => {
    const [r] = await tx.execute<{ id: number }>(sql`
      INSERT INTO app.utilisateur (email, nom, hash, role) VALUES (${d.email}, ${d.nom}, ${hash}, ${role})
      RETURNING id_utilisateur AS id`);
    return r.id;
  });
}

/** EF-15 : connexion. Rend le compte si le mot de passe est le bon, sinon null. */
export async function verifierIdentifiants(emailSaisi: string, motDePasse: string) {
  const [u] = await db.execute<{ id: number; email: string; nom: string; hash: string }>(sql`
    SELECT id_utilisateur AS id, email, nom, hash FROM app.utilisateur
    WHERE email = ${emailSaisi.trim().toLowerCase()}`);
  if (!u || !(await bcrypt.compare(motDePasse, u.hash))) return null;
  return { id: u.id, email: u.email, nom: u.nom };
}

/** Le rôle et l'équipe sont relus en base à chaque action : un changement s'applique tout de suite. */
export async function acteurParId(idUtilisateur: number): Promise<Acteur> {
  const [u] = await db.execute<NonNullable<Acteur>>(sql`
    SELECT id_utilisateur AS id, role, id_equipe AS "idEquipe" FROM app.utilisateur
    WHERE id_utilisateur = ${idUtilisateur}`);
  return u ?? null;
}

const role = z.object({
  idUtilisateur: id,
  role: z.enum(["membre", "organisateur", "admin"]),
  idEquipe: z.preprocess(videEnNull, id.nullable()),
});

/** EF-15 : l'admin attribue un rôle et rattache (ou détache) un capitaine à une équipe. */
export async function attribuerRole(acteur: Acteur, donnees: unknown) {
  exigerDroit(acteur, "role.attribuer");
  const d = valider(role, donnees);
  await transaction((tx) =>
    tx.execute(sql`
      UPDATE app.utilisateur SET role = ${d.role}, id_equipe = ${d.idEquipe}
      WHERE id_utilisateur = ${d.idUtilisateur}`),
  );
}

export type Compte = {
  idUtilisateur: number;
  email: string;
  nom: string;
  role: "membre" | "organisateur" | "admin";
  idEquipe: number | null;
  equipe: string | null;
};

export async function listeComptes() {
  return [
    ...(await db.execute<Compte>(sql`
      SELECT u.id_utilisateur AS "idUtilisateur", u.email, u.nom, u.role, u.id_equipe AS "idEquipe", e.nom AS equipe
      FROM app.utilisateur u LEFT JOIN equipe e ON e.id_equipe = u.id_equipe
      ORDER BY u.email`)),
  ];
}

export async function compteParId(idUtilisateur: number) {
  return (await listeComptes()).find((c) => c.idUtilisateur === idUtilisateur);
}
