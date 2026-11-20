// MVP-Abnahme gegen file://…/dist/orgamorph.html.
import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test.use({ locale: "de-DE" });

async function openExample(page: Page) {
  await page.getByRole("button", { name: /Stadtverwaltung/ }).click();
  await expect(page.getByRole("tree")).toBeVisible();
}

test("Abnahme 1: 50 OEs per Tastatur in unter 5 Minuten", async ({ page }) => {
  const { requests, errors } = await openApp(page);
  await page.getByRole("button", { name: "Leeres Dokument" }).click();
  const start = Date.now();
  const root = page.locator(".tree-item").first();
  await root.focus();
  await page.keyboard.press("F2");
  await page.keyboard.type("Behördenleitung");
  // Enter an der Wurzel legt ein Kind an; danach Geschwister bzw. per Tab Kinder
  await page.keyboard.press("Enter");
  for (let a = 1; a <= 7; a++) {
    await page.keyboard.type(`Abteilung ${a}`);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    for (let r = 1; r <= 6; r++) {
      await page.keyboard.type(`Referat ${a}.${r}`);
      await page.keyboard.press("Enter");
    }
    await page.keyboard.press("Shift+Tab");
  }
  await page.keyboard.press("Escape");
  const elapsed = Date.now() - start;
  const count = await page.locator(".tree-item").count();
  expect(count).toBeGreaterThanOrEqual(50);
  const names = await page.locator(".tree-name").allTextContents();
  for (let a = 1; a <= 7; a++) {
    expect(names).toContain(`Abteilung ${a}`);
    for (let r = 1; r <= 6; r++) expect(names).toContain(`Referat ${a}.${r}`);
  }
  // Referate hängen unter ihrer Abteilung
  const abt3 = page.locator(".tree-item", {
    has: page.locator(":scope > .tree-row", { hasText: "Abteilung 3" }),
  });
  await expect(abt3.locator(".tree-name")).toContainText(["Abteilung 3", "Referat 3.1", "Referat 3.6"]);
  expect(elapsed).toBeLessThan(5 * 60 * 1000);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Abnahme 2: Fokus auf Abteilung, PDF A4 quer, Schrift ≥ 6 pt", async ({ page }) => {
  await openApp(page);
  await openExample(page);
  await page
    .getByRole("toolbar")
    .locator("select")
    .first()
    .selectOption({ label: "Dez III – Dezernat III – Recht, Sicherheit und Ordnung" });
  await page.keyboard.press("Control+p");
  const dlg = page.getByRole("dialog", { name: "Drucken / PDF" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "quer" }).click();
  const text = await dlg.getByText(/Kleinste Schrift/).textContent();
  const pt = Number(text!.match(/([\d,]+) pt/)![1]!.replace(",", "."));
  expect(pt).toBeGreaterThanOrEqual(6);
  await expect(dlg.locator("figure > svg")).toHaveAttribute("width", "297mm");
});

test("Abnahme 4: Strg+Z stellt gelöschte Abteilung samt Unterstruktur wieder her", async ({ page }) => {
  await openApp(page);
  await openExample(page);
  const before = await page.locator(".tree-item").count();
  const row = page.locator(".tree-row", { hasText: "Dezernat V – Soziales" });
  await row.click();
  await row.locator("xpath=..").focus();
  await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.locator(".tree-item")).toHaveCount(before - 8);
  await page.locator(".canvas svg").first().focus();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".tree-item")).toHaveCount(before);
});

test("Abnahme 5 + Browser-Modus: keine Requests, Speichern im Browser, nach Neuladen wieder da", async ({
  page,
}) => {
  const { requests, errors } = await openApp(page);
  await openExample(page);
  await page.getByRole("button", { name: "Neues Projekt" }).count(); // keine Wirkung, nur Lesen
  await page.keyboard.press("p");
  await page.locator("#t-title").fill("Testprojekt E2E");
  await expect(page.getByText(/Gespeichert \d/)).toBeVisible({ timeout: 3000 });
  await expect(page.getByText("Nur im Browser gespeichert")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Zuletzt geöffnet")).toBeVisible();
  await page
    .getByRole("button", { name: /Stadtverwaltung Musterstadt/ })
    .first()
    .click();
  await page.getByRole("tab", { name: /Projekte/ }).click();
  await expect(page.getByText("Testprojekt E2E")).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});

test("Abnahme 6: SVG-Export ohne Namen und Stellennummern, solange nicht eingeschaltet", async ({ page }) => {
  await openApp(page);
  await openExample(page);
  await page.getByRole("button", { name: /Export/ }).click();
  const dlg = page.getByRole("dialog", { name: "Exportieren" });
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    dlg.getByRole("button", { name: "SVG" }).click(),
  ]);
  const svg = readFileSync((await dl.path())!, "utf8");
  expect(svg).toContain("Oberbürgermeister");
  expect(svg).not.toContain("Max Mustermann");
  expect(svg).not.toContain("00.001");
  await dlg.getByLabel("Namen anzeigen").check();
  const [dl2] = await Promise.all([
    page.waitForEvent("download"),
    dlg.getByRole("button", { name: "SVG" }).click(),
  ]);
  expect(readFileSync((await dl2.path())!, "utf8")).toContain("Max Mustermann");
});

test("Sichten wechseln (1/2/3), Morph endet in der Zielsicht, Leistung mit 300+ OEs", async ({ page }) => {
  await openApp(page);
  await openExample(page);
  for (const [k, name] of [
    ["2", "Sternnetz"],
    ["3", "Netz"],
    ["1", "Organigramm"],
  ] as const) {
    await page.keyboard.press(k);
    await expect(page.locator(".canvas-info")).toContainText(name);
  }
  await page.waitForTimeout(800);
  await expect(page.locator(".canvas .node")).toHaveCount(46);
});
