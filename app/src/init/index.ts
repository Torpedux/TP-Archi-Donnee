import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, pg } from "@/db/client";
import { creerCompte } from "@/services/comptes";
import { installerDemo } from "./demo";
import { rattraperTournoisImportes } from "@/services/moteur";

/** Applique db/app.sql (idempotent). Appelé une fois au démarrage du serveur. */
export async function appliquerSchemaApp(sql = pg) {
  const ddl = await readFile(path.join(process.cwd(), "db", "app.sql"), "utf8");
  await sql.unsafe(ddl);
}

/** EF-15 : un admin est créé au premier lancement (identifiants dans le README, à changer). */
export async function creerAdminInitial() {
  const [{ n }] = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM app.utilisateur WHERE role = 'admin'`,
  );
  if (n > 0) return;
  await creerCompte(
    {
      email: process.env.ADMIN_EMAIL ?? "admin@bracket.test",
      nom: "Admin",
      motDePasse: process.env.ADMIN_PASSWORD ?? "admin-bracket",
    },
    "admin",
  );
}

export async function initialiser() {
  await appliquerSchemaApp();
  await creerAdminInitial();
  await rattraperTournoisImportes();
  // ENF-02 : la démo, au premier lancement seulement, si DEMO=1 (défaut du docker-compose).
  if (process.env.DEMO === "1") await installerDemo();
}
