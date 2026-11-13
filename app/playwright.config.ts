import { defineConfig } from "@playwright/test";

// Le test de bout en bout joue le scénario de démo (cahier des charges § 10) dans un vrai navigateur,
// contre l'application lancée par `docker compose up -d --build` sur une base fraîche.
export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    viewport: { width: 1280, height: 900 },
    screenshot: "only-on-failure",
  },
});
