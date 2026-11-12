import { expect, test } from "vitest";
import { GET } from "@/app/api/live/route";
import { abonner, publier } from "./direct";
import { apresCommit } from "./diffusion";

/** Lit le flux jusqu'à trouver `attendu`, ou échoue après `delai` ms. */
async function lireJusqua(lecteur: ReadableStreamDefaultReader<Uint8Array>, attendu: string, delai: number) {
  const decodeur = new TextDecoder();
  let recu = "";
  const limite = new Promise<never>((_, rejeter) =>
    setTimeout(() => rejeter(new Error(`rien reçu en ${delai} ms : ${recu}`)), delai),
  );
  while (!recu.includes(attendu)) {
    const { value, done } = await Promise.race([lecteur.read(), limite]);
    if (done) throw new Error("flux fermé");
    recu += decodeur.decode(value);
  }
  return recu;
}

test("EF-13 : un événement publié arrive sur le flux SSE en moins de 2 s", async () => {
  const arret = new AbortController();
  const reponse = await GET(new Request("http://localhost/api/live", { signal: arret.signal }));
  expect(reponse.headers.get("content-type")).toContain("text/event-stream");
  const lecteur = reponse.body!.getReader();
  await lireJusqua(lecteur, "retry:", 2000); // le flux est ouvert

  const debut = Date.now();
  publier({ idTournoi: 42, idMatch: 7 });
  const recu = await lireJusqua(lecteur, '"idTournoi":42', 2000);
  expect(Date.now() - debut).toBeLessThan(2000);
  expect(recu).toContain('data: {"idTournoi":42,"idMatch":7}\n\n');
  arret.abort();
});

test("EF-13 : deux navigateurs abonnés reçoivent tous les deux la saisie ; se désabonner arrête la réception", () => {
  const recusA: number[] = [];
  const recusB: number[] = [];
  const stopA = abonner((e) => recusA.push(e.idTournoi));
  const stopB = abonner((e) => recusB.push(e.idTournoi));
  publier({ idTournoi: 1 });
  stopA();
  publier({ idTournoi: 2 });
  stopB();
  expect(recusA).toEqual([1]);
  expect(recusB).toEqual([1, 2]);
});

test("EF-13 : chaque opération du moteur publie son tournoi et son match après le commit", async () => {
  const recus: unknown[] = [];
  const stop = abonner((e) => recus.push(e));
  await apresCommit({ idTournoi: 5, idMatch: 9 }); // NEO4J_PUSH=off dans les tests : seul le direct part
  stop();
  expect(recus).toEqual([{ idTournoi: 5, idMatch: 9 }]);
});
