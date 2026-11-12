import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./introspection/schema";

export const PG_DSN = process.env.PG_DSN ?? "postgresql://postgres:postgres@localhost:5432/esport";

// Une seule connexion par processus, y compris quand Next recharge les modules en dev.
const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
export const pg = (g.__pg ??= postgres(PG_DSN, { max: 10, onnotice: () => {} }));

export const db = drizzle(pg, { schema });
export type Db = typeof db;
/** Une transaction Drizzle, ou la base elle-même : les services acceptent les deux. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0] | Db;
export { schema };
