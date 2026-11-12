"use client";

import { useActionState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EtatAction = { erreur?: string; ok?: string };
type Action = (etat: EtatAction, donnees: FormData) => Promise<EtatAction>;

/**
 * Un formulaire branché sur une Server Action : bouton désactivé pendant l'envoi, message d'erreur
 * annoncé aux lecteurs d'écran (role="alert"). `caches` = champs cachés (identifiants).
 */
export function FormAction({
  action,
  children,
  libelle = "Enregistrer",
  variante = "default",
  caches = {},
  className = "flex flex-wrap items-end gap-3",
  confirmer,
  titre,
}: {
  action: Action;
  children?: ReactNode;
  libelle?: string;
  variante?: "default" | "outline" | "destructive" | "secondary" | "ghost";
  caches?: Record<string, string | number>;
  className?: string;
  confirmer?: string;
  /** Nom accessible du bouton quand le libellé est un simple symbole. */
  titre?: string;
}) {
  const [etat, envoyer, enCours] = useActionState(action, {});
  return (
    <form
      action={envoyer}
      className={className}
      onSubmit={(e) => {
        if (confirmer && !window.confirm(confirmer)) e.preventDefault();
      }}
    >
      {Object.entries(caches).map(([nom, valeur]) => (
        <input key={nom} type="hidden" name={nom} value={valeur} />
      ))}
      {children}
      <Button type="submit" variant={variante} size="sm" disabled={enCours} aria-label={titre} title={titre}>
        {enCours ? "…" : libelle}
      </Button>
      {etat.erreur && (
        <p role="alert" className="basis-full text-sm text-destructive">
          {etat.erreur}
        </p>
      )}
      {etat.ok && (
        <p role="status" className="basis-full text-sm text-muted-foreground">
          {etat.ok}
        </p>
      )}
    </form>
  );
}

/** Un champ avec son libellé (ENF-06 : libellés sur tous les champs). */
export function Champ({
  libelle,
  name,
  className = "w-44",
  ...props
}: { libelle: string; name: string } & React.ComponentProps<typeof Input>) {
  const idChamp = `${name}-${props.form ?? ""}${props.id ?? ""}`;
  return (
    <div className="grid gap-1">
      <Label htmlFor={idChamp}>{libelle}</Label>
      <Input {...props} id={idChamp} name={name} className={`h-8 ${className}`} />
    </div>
  );
}

export const classeSelect =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

/** Une liste déroulante native avec son libellé. */
export function Choix({
  libelle,
  name,
  options,
  defaultValue,
  vide,
}: {
  libelle: string;
  name: string;
  options: { valeur: string | number; libelle: string }[];
  defaultValue?: string | number;
  vide?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={`choix-${name}`}>{libelle}</Label>
      <select id={`choix-${name}`} name={name} defaultValue={defaultValue ?? ""} className={classeSelect}>
        {vide !== undefined && <option value="">{vide}</option>}
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
    </div>
  );
}
