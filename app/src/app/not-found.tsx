import Link from "next/link";

export default function Introuvable() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-3xl font-bold">Page introuvable</h1>
      <p className="mt-2 text-muted-foreground">Ce tournoi, cette équipe ou ce joueur n&apos;existe pas.</p>
      <p className="mt-6">
        <Link href="/" className="underline underline-offset-4">
          Retour à l&apos;accueil
        </Link>
      </p>
    </div>
  );
}
