import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page } from "@playwright/test";

export const APP_URL = pathToFileURL(resolve("dist/orgamorph.html")).href;

/** Öffnet die App unter file:// und sammelt Netzwerk-Requests sowie Konsolenfehler. */
export async function openApp(page: Page): Promise<{ requests: string[]; errors: string[] }> {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (r) => {
    if (r.url() !== APP_URL) requests.push(r.url());
  });
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP_URL);
  await expect(page.locator("#orgamorph-root")).toBeVisible();
  return { requests, errors };
}
