import { readFile } from "node:fs/promises";
import path from "node:path";
import { pg } from "@/db/client";

/** Applique db/app.sql (idempotent). Appelé une fois au démarrage du serveur. */
export async function appliquerSchemaApp(sql = pg) {
  const ddl = await readFile(path.join(process.cwd(), "db", "app.sql"), "utf8");
  await sql.unsafe(ddl);
}

export async function initialiser() {
  await appliquerSchemaApp();
}
