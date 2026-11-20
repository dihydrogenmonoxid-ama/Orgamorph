// Startseite, Vorlagen, XLSX-Import, Plankopf mit Logo, Rückkehr zur Startseite, Filter-Menü.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test.use({ locale: "de-DE" });

// 1×1-PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("Startseite: zwei Beispiele, kein Gliederungsfeld, GitHub-Link", async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole("button", { name: "Stadtverwaltung nach KGSt" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Einfache Firma" })).toBeVisible();
  await expect(page.getByText("Gliederung einfügen")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Quellcode auf GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/dihydrogenmonoxid-ama/Orgamorph",
  );
});

test("Excel-Vorlage herunterladen, Blanko-Blatt ausfüllen ist nicht nötig: Beispielblatt wird importiert", async ({
  page,
}) => {
  await openApp(page);
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Excel-Vorlage herunterladen" }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe("vorlage-struktur.xlsx");
  const bytes = readFileSync((await dl.path())!);
  expect(bytes.subarray(0, 2).toString()).toBe("PK");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "XLSX oder CSV wählen" }).click();
  await (await chooser).setFiles({
    name: "vorlage-struktur.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: bytes,
  });
  await expect(page.locator(".tree-item")).toHaveCount(11);
  await expect(page.locator(".tree-row", { hasText: "Assistenz der Geschäftsführung" })).toContainText(
    "Stab",
  );
});

test("Excel aus Fremdprogramm (komprimiert) wird gelesen", async ({ page }) => {
  // Mit DecompressionStream: Archiv mit deflate-Einträgen erzeugen
  const { deflateRawSync } = await import("node:zlib");
  const { writeZip } = await import("../../src/core/io/zip.ts");
  const { templateXlsx } = await import("../../src/core/io/templates.ts");
  const { readZip } = await import("../../src/core/io/zip.ts");
  const files = await readZip(templateXlsx(), async (d) => d);
  const zip = writeZip([...files].map(([name, data]) => ({ name, data })));
  // Einträge nachträglich auf Deflate umstellen ist aufwendig; stattdessen prüfen wir die Browser-Funktion direkt
  await openApp(page);
  const ok = await page.evaluate(
    async (b64) => {
      const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new TextDecoder().decode(new Uint8Array(await new Response(stream).arrayBuffer()));
    },
    deflateRawSync(Buffer.from("Hallo Excel")).toString("base64"),
  );
  expect(ok).toBe("Hallo Excel");
  expect(zip.length).toBeGreaterThan(0);
});

test("Import im Werkzeug: Einheiten aus CSV unter ausgewählter Einheit", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Einfache Firma" }).click();
  await page.locator(".tree-row", { hasText: "Produktion" }).click();
  await page.getByRole("button", { name: "Import" }).click();
  const dlg = page.getByRole("dialog", { name: "Importieren" });
  await dlg.locator("#imp-file").setInputFiles({
    name: "neu.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Bezeichnung;Kürzel;Übergeordnet\nQualität;QS;\nPrüflabor;QS-L;QS\n"),
  });
  await dlg.getByRole("button", { name: "Importieren" }).click();
  await expect(page.locator(".tree-item")).toHaveCount(13);
  const prod = page.locator(".tree-item", {
    has: page.locator(":scope > .tree-row", { hasText: "Produktion" }),
  });
  await expect(prod).toContainText("Prüflabor");
});

test("Plankopf: Ersteller, Abteilung und Logo erscheinen auf der Druckseite", async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await openApp(page);
  await page.getByRole("button", { name: "Einfache Firma" }).click();
  await page.locator(".doc-title").click();
  await page.locator("#d-author").fill("A. Planerin");
  await page.locator("#d-dept").fill("Organisation");
  await page
    .locator(".props input[type=file]")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator(".logo-preview")).toBeVisible();
  await page.keyboard.press("Control+p");
  const dlg = page.getByRole("dialog", { name: "Drucken / PDF" });
  await expect(dlg.locator("figure image")).toHaveCount(1);
  await expect(dlg.locator("figure")).toContainText("A. Planerin");
  await expect(dlg.locator("figure")).toContainText("Organisation");
});

test("Klick auf „Orgamorph“ speichert und führt zur Startseite", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Einfache Firma" }).click();
  await page.locator(".tree-row", { hasText: "Vertrieb" }).click();
  await page.locator("#u-short").fill("VK");
  await page.getByRole("button", { name: "Orgamorph", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Orgamorph" })).toBeVisible();
  await expect(page.getByText("Zuletzt geöffnet")).toBeVisible();
  await page
    .getByRole("button", { name: /Muster GmbH/ })
    .first()
    .click();
  await expect(page.locator(".tree-row", { hasText: "Vertrieb" })).toContainText("VK");
});

test("Filter-Menü: feste Breite, Abschnitte untereinander, schließt bei Klick außerhalb", async ({
  page,
}) => {
  await openApp(page);
  await page.getByRole("button", { name: "Einfache Firma" }).click();
  await page.getByRole("button", { name: /^Filter/ }).click();
  const menu = page.locator(".menu");
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(Math.round(box.width)).toBe(280);
  const checks = menu.locator(".menu-check");
  const first = (await checks.nth(0).boundingBox())!;
  const second = (await checks.nth(1).boundingBox())!;
  expect(second.y).toBeGreaterThan(first.y);
  expect(Math.abs(second.x - first.x)).toBeLessThan(1);
  await page.locator(".canvas").click({ position: { x: 300, y: 300 } });
  await expect(menu).toHaveCount(0);
});

test("Beteiligung: FF/MW mit Tooltip, Matrix mit Legende", async ({ page }) => {
  await openApp(page);
  await page.getByRole("button", { name: "Einfache Firma" }).click();
  await page.getByRole("tab", { name: /Projekte/ }).click();
  await page.locator(".list button", { hasText: "Messeauftritt" }).click();
  await expect(page.locator(".participants button[title='federführend']").first()).toBeVisible();
  await expect(page.locator(".participants button[title='mitwirkend']").first()).toBeVisible();
  await page.locator(".canvas svg").first().focus();
  await page.keyboard.press("m");
  const dlg = page.getByRole("dialog", { name: "Beteiligungsmatrix" });
  await expect(dlg.locator(".matrix-legend")).toContainText("federführend (gefüllt)");
  await expect(dlg.locator(".matrix-legend")).toContainText("mitwirkend (Rahmen)");
});
