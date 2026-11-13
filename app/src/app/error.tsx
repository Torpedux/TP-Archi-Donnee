"use client";

import { Button } from "@/components/ui/button";

export default function Erreur({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="py-16 text-center">
      <h1 className="text-3xl font-bold">Une erreur est survenue</h1>
      <p className="mt-2 text-muted-foreground">
        La page n&apos;a pas pu s&apos;afficher. La base de données est peut-être en train de démarrer.
      </p>
      <Button onClick={reset} variant="outline" className="mt-6">
        Réessayer
      </Button>
    </div>
  );
}
