import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Le .env de la racine peut déplacer le port de PostgreSQL (PORT_POSTGRES).
if (existsSync("../.env")) process.loadEnvFile("../.env");
const port = process.env.PORT_POSTGRES ?? "5432";
const base = `postgresql://postgres:postgres@localhost:${port}`;

// Posées aussi sur ce processus : tests/base-de-test.ts (globalSetup) tourne ici, pas dans un worker.
const env = {
  PG_DSN: process.env.PG_DSN_TEST ?? `${base}/esport_test`,
  PG_DSN_ADMIN: `${base}/postgres`,
};
Object.assign(process.env, env);

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globalSetup: "./tests/base-de-test.ts",
    // Les tests d'intégration partagent la base esport_test : un fichier à la fois.
    fileParallelism: false,
    env,
  },
});
