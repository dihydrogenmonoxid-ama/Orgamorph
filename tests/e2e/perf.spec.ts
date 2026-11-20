// Leistung (§14): 300 OEs flüssig (Morph ≥ 30 fps), 1000 OEs bedienbar. Ergebnisse in ADR 0006/0013.
import { expect, type Page, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test.use({ locale: "de-DE", viewport: { width: 1600, height: 1000 } });

/** CSV mit n Einheiten: Leitung, Abteilungen, Referate, Sachgebiete. */
function csv(n: number): string {
  const rows = ["ID;Übergeordnet;Bezeichnung", "0;;Leitung"];
  let made = 1;
  for (let a = 1; made < n; a++) {
    rows.push(`A${a};0;Abteilung ${a}`);
    made++;
    for (let r = 1; r <= 6 && made < n; r++) {
      rows.push(`R${a}.${r};A${a};Referat ${a}.${r}`);
      made++;
      for (let s = 1; s <= 3 && made < n; s++) {
        rows.push(`S${a}.${r}.${s};R${a}.${r};Sachgebiet ${a}.${r}.${s}`);
        made++;
      }
    }
  }
  return rows.join("\n");
}

async function load(page: Page, n: number) {
  await openApp(page);
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "XLSX oder CSV wählen" }).click();
  await (await chooser).setFiles({ name: "gross.csv", mimeType: "text/csv", buffer: Buffer.from(csv(n)) });
  await expect(page.locator(".canvas .node")).toHaveCount(n);
}

async function morphFps(page: Page, key: string): Promise<number> {
  return page.evaluate(async (k) => {
    let frames = 0;
    let running = true;
    const tick = () => {
      frames++;
      if (running) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    const t0 = performance.now();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    await new Promise((r) => setTimeout(r, 600));
    running = false;
    return frames / ((performance.now() - t0) / 1000);
  }, key);
}

test("300 OEs: Morph Organigramm ↔ Sternnetz ≥ 30 fps", async ({ page, browserName }) => {
  await load(page, 300);
  const toStar = await morphFps(page, "2");
  await page.waitForTimeout(300);
  const toTree = await morphFps(page, "1");
  console.log(
    `[${browserName}] Morph 300 OEs: →Stern ${toStar.toFixed(1)} fps, →Baum ${toTree.toFixed(1)} fps`,
  );
  expect(Math.min(toStar, toTree)).toBeGreaterThanOrEqual(30);
});

test("1000 OEs: Sichtwechsel und Bearbeiten bedienbar (< 3 s)", async ({ page, browserName }) => {
  await load(page, 1000);
  for (const k of ["2", "3", "1"]) {
    const t0 = Date.now();
    await page.locator(".canvas svg").first().focus();
    await page.keyboard.press(k);
    await page.waitForTimeout(700);
    await expect(page.locator(".canvas .node")).toHaveCount(1000);
    console.log(`[${browserName}] 1000 OEs, Sicht ${k}: ${Date.now() - t0} ms`);
    expect(Date.now() - t0).toBeLessThan(3000);
  }
  const t0 = Date.now();
  await page.locator(".tree-row", { hasText: "Abteilung 1" }).first().click();
  await page.locator("#u-short").fill("A1");
  await expect(page.locator(".tree-short", { hasText: "A1" })).toBeVisible();
  console.log(`[${browserName}] 1000 OEs, Bearbeiten: ${Date.now() - t0} ms`);
  expect(Date.now() - t0).toBeLessThan(3000);
});
