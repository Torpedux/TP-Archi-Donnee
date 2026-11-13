import { expect, test, type Page } from "@playwright/test";

// Cahier des charges § 10 : le scénario de démo, joué dans le navigateur, étapes 1 à 8.
// À lancer sur une base fraîche (`docker compose down -v && docker compose up -d --build`) :
// il crée le tournoi « Ynov Cup ».

const jour = (decalage: number) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toLocaleDateString("sv-SE");
};

/** L'identifiant en fin d'URL : /admin/tournois/31 → 31. */
const idDe = (url: string) => Number(url.split("/").pop());

/** Les liens de saisie des matchs d'une section « Matchs · phase N ». */
async function liensDesMatchs(page: Page, phase: number) {
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: new RegExp(`Matchs · phase ${phase}`) }),
  });
  return section
    .locator('a[href^="/admin/matchs/"]')
    .evaluateAll((liens) => liens.map((a) => a.getAttribute("href")!));
}

/** Saisit une manche gagnée par l'équipe de gauche (A) ou de droite (B), et attend qu'elle soit comptée. */
async function saisirManche(page: Page, gagneA: boolean) {
  const titre = await page.getByRole("heading", { name: /^Manches \(\d+\)$/ }).innerText();
  const n = Number(titre.match(/\d+/)![0]);
  const formulaire = page.locator("form", {
    has: page.getByRole("button", { name: "Enregistrer la manche" }),
  });
  await formulaire.getByLabel("Carte").fill("Ascent");
  await formulaire.locator('input[name="pointsA"]').fill(gagneA ? "13" : "7");
  await formulaire.locator('input[name="pointsB"]').fill(gagneA ? "7" : "13");
  await formulaire.getByRole("button", { name: "Enregistrer la manche" }).click();
  await expect(page.getByRole("heading", { name: `Manches (${n + 1})` })).toBeVisible();
}

/** Joue un match jusqu'au bout : la même équipe gagne toutes les manches. */
async function jouer(page: Page, lien: string, gagneA: boolean) {
  await page.goto(lien);
  await expect(page.getByRole("heading", { name: /^Manches \(\d+\)$/ })).toBeVisible(); // page chargée
  while (await page.getByRole("button", { name: "Enregistrer la manche" }).isVisible())
    await saisirManche(page, gagneA);
  await expect(page.getByText("Terminé", { exact: true }).first()).toBeVisible();
}

test("scénario de démo : de la création de « Ynov Cup » au palmarès et au graphe", async ({
  page,
  browser,
}) => {
  page.on("dialog", (d) => d.accept());

  // 1. Se connecter en organisateur de démo.
  await page.goto("/connexion");
  await page.getByRole("button", { name: "Entrer comme organisateur" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.screenshot({ path: "e2e/captures/1-gestion.png" });

  // 2. Créer le tournoi « Ynov Cup » sur un jeu existant, phases : poules (BO1, 4 qualifiés) puis élimination (BO3).
  await page.goto("/admin/tournois");
  await page.getByLabel("Nom").fill("Ynov Cup");
  await page.getByLabel("Début").fill(jour(0));
  await page.getByLabel("Fin").fill(jour(5));
  await page.getByRole("button", { name: "Créer le tournoi" }).click();
  await expect(page).toHaveURL(/\/admin\/tournois\/\d+$/);
  const idTournoi = idDe(page.url());
  await page.getByLabel("Type").selectOption("poules");
  await page.getByLabel("Format des matchs").selectOption("1");
  await page.getByLabel("Qualifiés (poules)").fill("4");
  await page.getByRole("button", { name: "Ajouter la phase" }).click();
  await expect(page.getByText("BO1 · 4 qualifiés")).toBeVisible();
  await page.getByLabel("Type").selectOption("elimination");
  await page.getByLabel("Format des matchs").selectOption("3");
  await page.getByRole("button", { name: "Ajouter la phase" }).click();
  await expect(page.getByRole("heading", { name: /^Phases \(2\)/ })).toBeVisible();

  // 3. Ouvrir les inscriptions ; inscrire 6 équipes ; ordonner les têtes de série.
  await page.getByRole("button", { name: "Ouvrir les inscriptions" }).click();
  for (let i = 1; i <= 6; i++) {
    await page.getByRole("button", { name: "Inscrire", exact: true }).click();
    await expect(page.getByRole("heading", { name: new RegExp(`têtes de série \\(${i}\\)`) })).toBeVisible();
  }
  const inscrites = page
    .locator("section", { has: page.getByRole("heading", { name: /têtes de série/ }) })
    .locator("ol > li");
  const deuxieme = (await inscrites.nth(1).locator("span").nth(1).innerText()).trim();
  await inscrites
    .nth(1)
    .getByRole("button", { name: /^Monter/ })
    .click();
  await expect(inscrites.nth(0)).toContainText(deuxieme); // elle est passée tête de série n° 1
  await expect(inscrites.nth(0).locator("span").first()).toHaveText("1");

  // 4. Générer la poule : 15 matchs créés.
  await page.getByRole("button", { name: "Générer les matchs" }).first().click();
  await expect(page.getByRole("heading", { name: /Matchs · phase 1 · Poules \(15\)/ })).toBeVisible();
  await expect(page.getByText("En cours", { exact: true }).first()).toBeVisible(); // le tournoi a démarré
  const poule = await liensDesMatchs(page, 1);
  expect(poule).toHaveLength(15);
  await page.screenshot({ path: "e2e/captures/4-poule-generee.png", fullPage: true });

  // 6. Dans un second navigateur, un visiteur ouvre le classement.
  const visiteur = await (await browser.newContext()).newPage();
  await visiteur.goto(`/tournois/${idTournoi}`);
  const classement = visiteur.getByRole("table").first();
  await expect(classement.locator("tbody tr")).toHaveCount(6);
  const victoires = async () =>
    (await classement.locator("tbody tr").first().locator("td").nth(3).innerText()).trim();
  expect(await victoires()).toBe("0");

  // 5. Saisir quelques résultats, dont un forfait ; le classement de poule se met à jour.
  await page.goto(poule[0]);
  await page.getByLabel("Carte").fill("Ascent");
  await page.locator('input[name="pointsA"]').fill("9");
  await page.locator('input[name="pointsB"]').fill("9");
  await page.getByRole("button", { name: "Enregistrer la manche" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "égalité" })).toBeVisible(); // RG11 : pas de nul
  await saisirManche(page, true);
  await expect(page.getByText("Terminé", { exact: true }).first()).toBeVisible();

  // 6 (suite). Le classement du visiteur se met à jour en direct, sans rechargement, en moins de 2 s (EF-13).
  await expect.poll(victoires, { timeout: 2000 }).toBe("1");

  await page.goto(poule[1]);
  await page
    .getByRole("button", { name: /^Forfait de / })
    .last()
    .click();
  await expect(page.getByText(/Forfait de .* \(RG12\)/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manches (0)" })).toBeVisible(); // aucune manche (RG12)
  await page.screenshot({ path: "e2e/captures/5-forfait.png", fullPage: true });

  // 7. Terminer les poules, générer l'arbre (4 qualifiés), jouer demi-finales et finale.
  for (const lien of poule.slice(2)) await jouer(page, lien, true);
  await visiteur.screenshot({ path: "e2e/captures/7-classement-public.png", fullPage: true });
  await page.goto(`/admin/tournois/${idTournoi}`);
  await page.getByRole("button", { name: "Générer les matchs" }).click();
  await expect(
    page.getByRole("heading", { name: /Matchs · phase 2 · Élimination directe \(2\)/ }),
  ).toBeVisible();
  await expect(page.getByText("À déterminer")).toBeVisible(); // la finale attend ses deux équipes
  const demis = await liensDesMatchs(page, 2);
  expect(demis).toHaveLength(2);
  await jouer(page, demis[0], true);
  await jouer(page, demis[1], false);
  await page.goto(`/admin/tournois/${idTournoi}`);
  const apres = await liensDesMatchs(page, 2);
  expect(apres).toHaveLength(3); // la finale a été créée toute seule avec les deux vainqueurs
  const finale = apres.find((l) => !demis.includes(l))!;
  await jouer(page, finale, true);

  // 8. Le palmarès du vainqueur affiche « Ynov Cup » ; le graphe montre ses victoires.
  await visiteur.goto(`/tournois/${idTournoi}`);
  await expect(visiteur.getByText("Terminé", { exact: true }).first()).toBeVisible();
  await visiteur.screenshot({ path: "e2e/captures/8-tournoi-termine.png", fullPage: true });
  const lienVainqueur = visiteur.locator("p", { hasText: "Vainqueur :" }).getByRole("link");
  const vainqueur = (await lienVainqueur.innerText()).trim();
  await lienVainqueur.click();
  await expect(visiteur).toHaveURL(/\/equipes\/\d+$/);
  const palmares = visiteur.locator("section", { has: visiteur.getByRole("heading", { name: /^Palmarès/ }) });
  await expect(palmares.getByRole("link", { name: "Ynov Cup" })).toBeVisible();
  await visiteur.screenshot({ path: "e2e/captures/8-palmares.png", fullPage: true });

  await visiteur.goto(`/graphe?vue=battues&equipe=${idDe(visiteur.url())}`);
  await expect(visiteur.getByRole("img", { name: /^Graphe de/ })).toBeVisible();
  await expect(visiteur.getByRole("row").filter({ hasText: "Ynov Cup" }).first()).toBeVisible();
  await expect(visiteur.getByRole("link", { name: vainqueur, exact: true })).toBeVisible(); // le point de départ du graphe
  await visiteur.waitForTimeout(1500); // le temps que Cytoscape dessine, pour la capture
  await visiteur.screenshot({ path: "e2e/captures/8-graphe.png", fullPage: true });
  await visiteur.goto("/");
  await visiteur.screenshot({ path: "e2e/captures/0-accueil.png", fullPage: true });
});
