import { expect, test } from "@playwright/test";
import { openApp } from "./helpers.ts";

test("startet unter file:// ohne Netzwerk-Requests und ohne CSP-Fehler", async ({ page }) => {
  const { requests, errors } = await openApp(page);
  await page.waitForTimeout(300);
  expect(requests.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
  expect(errors).toEqual([]);
});
