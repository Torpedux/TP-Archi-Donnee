import { readFile } from "node:fs/promises";
import postgres from "postgres";

/** Recrée la base esport_test depuis le DDL du groupe et le schéma app. */
export default async function setup() {
  const admin = postgres(process.env.PG_DSN_ADMIN!, { max: 1, onnotice: () => {} });
  await admin.unsafe("DROP DATABASE IF EXISTS esport_test WITH (FORCE)");
  await admin.unsafe("CREATE DATABASE esport_test");
  await admin.end();
  const test = postgres(process.env.PG_DSN!, { max: 1, onnotice: () => {} });
  await test.unsafe(await readFile("../modele/postgres/schema.sql", "utf8"));
  await test.unsafe(await readFile("db/app.sql", "utf8"));
  await test.end();
}
