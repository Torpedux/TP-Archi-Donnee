import type { Metadata } from "next";
import Link from "next/link";
import { exigerConnexion } from "@/lib/session";
import { peut } from "@/metier/droits";

export const metadata: Metadata = { title: "Gestion" };

/** L'espace de gestion : réservé aux comptes connectés. Chaque service revérifie les droits. */
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  const { compte, acteur } = await exigerConnexion();
  const liens = [
    { href: "/admin", libelle: "Tableau de bord", visible: true },
    {
      href: compte.idEquipe ? `/admin/equipes/${compte.idEquipe}` : "/admin/equipes",
      libelle: acteur.role === "admin" ? "Équipes" : "Mon équipe",
      visible: true,
    },
    { href: "/admin/tournois", libelle: "Tournois", visible: peut(acteur, "tournoi.creer") },
    { href: "/admin/jeux", libelle: "Jeux", visible: peut(acteur, "jeu.gerer") },
    { href: "/admin/comptes", libelle: "Comptes", visible: peut(acteur, "role.attribuer") },
  ];
  const role = acteur.role === "membre" ? (compte.idEquipe ? "capitaine" : "membre") : acteur.role;
  return (
    <>
      <nav
        aria-label="Gestion"
        className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-2 text-sm"
      >
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Gestion · {role}</span>
        {liens
          .filter((l) => l.visible)
          .map((l) => (
            <Link key={l.href} href={l.href} className="underline-offset-4 hover:underline">
              {l.libelle}
            </Link>
          ))}
      </nav>
      {children}
    </>
  );
}
