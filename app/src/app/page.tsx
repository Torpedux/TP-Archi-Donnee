import { sql } from "drizzle-orm";
import { db } from "@/db/client";

export default async function Accueil() {
  const [{ n }] = await db.execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM equipe`);
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-bold">Bracket</h1>
      <p className="mt-2 text-muted-foreground">{n} équipes en base.</p>
    </main>
  );
}
