"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * EF-13 : garde la page à jour sans la recharger. À chaque changement de score du tournoi suivi
 * (ou de n'importe quel tournoi si `idTournoi` est absent), les composants serveur de la page sont
 * relus : classement, arbre et score se mettent à jour d'un coup.
 */
export function Direct({ idTournoi }: { idTournoi?: number }) {
  const router = useRouter();
  useEffect(() => {
    const source = new EventSource("/api/live");
    source.onmessage = (message) => {
      const e = JSON.parse(message.data) as { idTournoi: number };
      if (idTournoi === undefined || e.idTournoi === idTournoi) router.refresh();
    };
    return () => source.close();
  }, [idTournoi, router]);
  return null;
}
