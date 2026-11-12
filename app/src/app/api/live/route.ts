import { abonner } from "@/services/direct";

export const dynamic = "force-dynamic";

/**
 * EF-13 : flux Server-Sent Events. Chaque changement de score envoie `{idTournoi, idMatch}` ;
 * le navigateur rafraîchit alors la page affichée (src/composants/direct.tsx). Rien de privé ne
 * passe ici : seulement des identifiants de pages publiques.
 */
export async function GET(requete: Request) {
  const encodeur = new TextEncoder();
  let fermer = () => {};
  const flux = new ReadableStream<Uint8Array>({
    start(controle) {
      const envoyer = (texte: string) => controle.enqueue(encodeur.encode(texte));
      envoyer("retry: 3000\n\n"); // le navigateur se reconnecte tout seul après 3 s
      const desabonner = abonner((e) => envoyer(`data: ${JSON.stringify(e)}\n\n`));
      // Un commentaire toutes les 25 s garde la connexion ouverte derrière un proxy.
      const battement = setInterval(() => envoyer(": battement\n\n"), 25_000);
      fermer = () => {
        clearInterval(battement);
        desabonner();
      };
      requete.signal.addEventListener("abort", () => {
        fermer();
        controle.close();
      });
    },
    cancel() {
      fermer();
    },
  });
  return new Response(flux, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
