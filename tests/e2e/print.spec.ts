// Phase 0 / ADR 0006: Druckseite mit dynamischem @page, Ausgabe als PDF (nur Chromium: page.pdf).
import { expect, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test.use({ locale: "de-DE" });

for (const [format, orientation, w, h] of [
  ["A4", "quer", 842, 595],
  ["A3", "hoch", 842, 1191],
] as const) {
  test(`PDF ${format} ${orientation}: Seitengröße aus @page, Schriftfeld und Grafik vorhanden`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "page.pdf gibt es nur in Chromium");
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await openApp(page);
    await page.getByRole("button", { name: /Stadtverwaltung/ }).click();
    await page.keyboard.press("Control+p");
    const dlg = page.getByRole("dialog", { name: "Drucken / PDF" });
    await dlg.getByRole("button", { name: format, exact: true }).click();
    await dlg.getByRole("button", { name: orientation }).click();
    await dlg.getByRole("button", { name: "Drucken" }).click();
    await expect(page.locator("#print-root svg").first()).toBeAttached();
    await expect(page.locator("style#om-page")).toBeAttached();
    const printed = await page.locator("#print-root").evaluate((el) => el.textContent ?? "");
    expect(printed).toContain("erstellt mit Orgamorph");
    expect(printed).toContain("Stadtverwaltung Musterstadt");
    expect(printed).not.toContain("Max Mustermann");
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const text = pdf.toString("latin1");
    const box = text.match(/\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/);
    expect(box).not.toBeNull();
    expect(Math.abs(Number(box![1]) - w)).toBeLessThan(2);
    expect(Math.abs(Number(box![2]) - h)).toBeLessThan(2);
    expect((text.match(/\/Type\s*\/Page\b/g) ?? []).length).toBe(1);
    // afterprint räumt die Druckseite wieder ab
    await expect(page.locator("style#om-page")).not.toBeAttached();
  });
}
