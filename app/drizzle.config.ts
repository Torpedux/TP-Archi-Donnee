import { defineConfig } from "drizzle-kit";

// Le DDL fait foi (modele/postgres/schema.sql et db/app.sql) : on introspecte, on ne migre pas.
export default defineConfig({
  dialect: "postgresql",
  out: "./src/db/introspection",
  schemaFilter: ["public", "app"],
  dbCredentials: {
    url: process.env.PG_DSN ?? "postgresql://postgres:postgres@localhost:5432/esport",
  },
});
