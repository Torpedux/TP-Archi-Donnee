import { expect, test, type Page } from "@playwright/test";

// ENF-06 : navigation au clavier, contrastes suffisants, libellés sur tous les champs, et rien qui ne
// repose sur la couleur seule. Ces tests ne modifient pas la base (ils se connectent, c'est tout).

/** Contraste WCAG entre la couleur de texte d'un élément et le fond réellement peint derrière lui. */
async function contraste(page: Page, selecteur: string) {
  return page
    .locator(selecteur)
    .first()
    .evaluate((el) => {
      // Le navigateur convertit n'importe quelle couleur CSS (oklch compris) en RGB sur un canvas.
      const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
      const rgba = (couleur: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = couleur;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        return { r, g, b, a: a / 255 };
      };
      // Le fond effectif : on empile les fonds des ancêtres, du plus lointain au plus proche.
      const fonds: ReturnType<typeof rgba>[] = [];
      for (let n: Element | null = el; n; n = n.parentElement)
        fonds.unshift(rgba(getComputedStyle(n).backgroundColor));
      let fond = { r: 0, g: 0, b: 0 };
      for (const f of fonds)
        fond = {
          r: f.r * f.a + fond.r * (1 - f.a),
          g: f.g * f.a + fond.g * (1 - f.a),
          b: f.b * f.a + fond.b * (1 - f.a),
        };
      const t = rgba(getComputedStyle(el).color);
      const texte = {
        r: t.r * t.a + fond.r * (1 - t.a),
        g: t.g * t.a + fond.g * (1 - t.a),
        b: t.b * t.a + fond.b * (1 - t.a),
      };
      const luminance = ({ r, g, b }: { r: number; g: number; b: number }) => {
        const [R, G, B] = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      };
      const [clair, sombre] = [luminance(texte), luminance(fond)].sort((a, b) => b - a);
      return (clair + 0.05) / (sombre + 0.05);
    });
}

test("contrastes : au moins 4,5:1 pour chaque couleur de texte du thème (WCAG AA)", async ({ page }) => {
  await page.goto("/tournois/1");
  const mesures: Record<string, string> = {
    "texte courant": "h1",
    "texte secondaire sur le fond": "main p.text-muted-foreground",
    "texte secondaire sur une carte": 'a[href^="/matchs/"] .text-muted-foreground',
    "accent (vainqueur) sur une carte": 'a[href^="/matchs/"] .text-direct',
    "accent (qualifié) sur le fond": "main td .text-direct",
    "lien de navigation": "header nav a",
    "pied de page": "footer",
  };
  for (const [quoi, selecteur] of Object.entries(mesures))
    expect(await contraste(page, selecteur), quoi).toBeGreaterThanOrEqual(4.5);

  await page.goto("/"); // la pastille « En direct » : texte sombre sur fond lime
  expect(
    await contraste(page, "span.bg-direct.text-direct-foreground"),
    "pastille En direct",
  ).toBeGreaterThanOrEqual(4.5);

  await page.goto("/connexion"); // un message d'erreur
  await page.getByLabel("E-mail").fill("personne@bracket.test");
  await page.getByLabel("Mot de passe").fill("faux-mot-de-passe");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "incorrect" })).toBeVisible();
  expect(await contraste(page, '[role="alert"].text-destructive'), "message d'erreur").toBeGreaterThanOrEqual(
    4.5,
  );
  expect(await contraste(page, "main button[type=submit]"), "bouton principal").toBeGreaterThanOrEqual(4.5);
});

test("clavier : lien d'évitement, focus visible, connexion et navigation sans souris", async ({ page }) => {
  await page.goto("/");
  // Le premier arrêt de tabulation est le lien d'évitement, qui devient visible.
  await page.keyboard.press("Tab");
  const evitement = page.getByRole("link", { name: "Aller au contenu" });
  await expect(evitement).toBeFocused();
  await expect(evitement).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#contenu$/);

  // Chaque élément atteint au clavier montre son focus (contour ou anneau).
  await page.goto("/tournois"); // une autre page : le focus repart du haut du document
  const vus: string[] = [];
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Tab");
    const f = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const s = getComputedStyle(el);
      return {
        nom: (el.getAttribute("aria-label") ?? el.textContent ?? el.getAttribute("placeholder") ?? "")
          .trim()
          .slice(0, 30),
        visible: (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none",
      };
    });
    expect(f.visible, `focus visible sur « ${f.nom} »`).toBe(true);
    vus.push(f.nom);
  }
  expect(vus.slice(0, 6)).toEqual([
    "Aller au contenu",
    "Bracket.",
    "Tournois",
    "Équipes",
    "Joueurs",
    "Graphe",
  ]);

  // Se connecter et ouvrir un tournoi sans toucher la souris.
  await page.goto("/connexion");
  await page.getByLabel("E-mail").focus();
  await page.keyboard.type("orga@bracket.test");
  await page.keyboard.press("Tab");
  await page.keyboard.type("orga-bracket");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin$/);
  await page.locator('a[href^="/admin/tournois/"]', { hasText: "Bracket Masters" }).first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/tournois\/\d+$/);
});

test("libellés : chaque champ a un nom accessible ; l'arbre et le direct se lisent sans la couleur", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Entrer comme admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const sansNom = async () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>("input:not([type=hidden]), select, textarea")]
        .filter(
          (c) => !(c.labels?.length || c.getAttribute("aria-label") || c.getAttribute("aria-labelledby")),
        )
        .map((c) => c.name || c.id),
    );
  const matchEnCours = await page.locator('a[href^="/admin/matchs/"]').first().getAttribute("href");
  for (const url of [
    "/admin/jeux",
    "/admin/comptes",
    "/admin/tournois",
    "/admin/equipes/1",
    matchEnCours!,
    "/graphe",
    "/joueurs",
  ]) {
    await page.goto(url);
    expect(await sansNom(), `champs sans libellé sur ${url}`).toEqual([]);
  }
  // Un tournoi du générateur : arbre nommé, vainqueurs dits en toutes lettres pour les lecteurs d'écran.
  await page.goto("/tournois/1");
  const arbre = page.getByRole("list", { name: "Arbre d'élimination directe" });
  await expect(arbre.getByRole("heading", { name: "Demi-finales" })).toBeVisible();
  await expect(arbre.getByRole("heading", { name: "Finale", exact: true })).toBeVisible();
  expect(await arbre.getByText("(vainqueur)").count()).toBe(3); // 2 demi-finales et la finale
  await expect(page.getByText("qualifié", { exact: true })).toHaveCount(4);
  // « En direct » est écrit, pas seulement coloré.
  await page.goto("/");
  await expect(page.getByText("En direct", { exact: true }).first()).toBeVisible();
  // Le graphe a une alternative textuelle et un tableau.
  await page.goto("/graphe");
  await expect(page.getByRole("img", { name: /^Graphe de \d+ équipes/ })).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "e2e/captures/9-graphe-cercles.png", fullPage: true });
});
