/**
 * Ce qui se passe après le commit PostgreSQL d'une opération du moteur. PostgreSQL fait foi : rien
 * ici ne peut faire échouer la saisie. Le lot 4 y branche le push Neo4j (EF-14) et le direct (EF-13).
 */
export async function apresCommit(_cible: { idTournoi: number; idMatch?: number }) {}
