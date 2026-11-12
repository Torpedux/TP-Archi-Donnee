import neo4j, { type Driver } from "neo4j-driver";

const g = globalThis as unknown as { __neo4j?: Driver };

export function neo4jDriver(): Driver {
  return (g.__neo4j ??= neo4j.driver(
    process.env.NEO4J_URI ?? "bolt://localhost:7687",
    neo4j.auth.basic(process.env.NEO4J_USER ?? "neo4j", process.env.NEO4J_PASSWORD ?? "motdepasse"),
    // Délais courts : si Neo4j est arrêté, la saisie d'un score n'attend pas (EF-14).
    {
      disableLosslessIntegers: true,
      connectionTimeout: 3000,
      connectionAcquisitionTimeout: 4000,
      maxTransactionRetryTime: 3000,
    },
  ));
}

/** Lance une requête Cypher et rend les lignes en objets simples. */
export async function cypher<T = Record<string, unknown>>(
  requete: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const session = neo4jDriver().session();
  try {
    const res = await session.run(requete, params);
    return res.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}
