import { expect, test } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { viderLaBase } from "./outils";

test("la base de test a le schéma du groupe et le schéma app", async () => {
  await viderLaBase();
  await db.execute(sql`INSERT INTO jeu (nom, editeur) VALUES ('Jeu test', 'Éditeur')`);
  await db.execute(
    sql`INSERT INTO equipe (id_jeu, nom, tag, pays, cree_le) VALUES (1, 'Nova', 'NOVA', 'FR', '2024-01-01')`,
  );
  const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM equipe`);
  expect(n).toBe(1);
  const [{ m }] = await db.execute<{ m: number }>(sql`SELECT count(*)::int AS m FROM app.utilisateur`);
  expect(m).toBe(0);
});
