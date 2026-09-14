import { expect, test } from "@playwright/test";

/**
 * The library: finding a call among many, and asking across all of them.
 */

test("a ?t= deep link opens the call at that moment", async ({ page }) => {
  await page.goto("/calls/hpr4314?t=1500");
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1 && a.currentTime > 0;
  });
  const at = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(at - 1500)).toBeLessThan(2);
});

test("an out-of-range ?t= does not break the page", async ({ page }) => {
  await page.goto("/calls/hpr4314?t=999999");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const at = await page.evaluate(() => document.querySelector("audio")?.currentTime ?? 0);
  const dur = await page.evaluate(() => document.querySelector("audio")?.duration ?? 0);
  expect(at).toBeLessThanOrEqual(Math.max(dur, 1) + 1);
});

test("search finds words spoken inside a call and lands on the moment", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search call recordings").fill("internet archive");

  const result = page.locator('a[href*="?t="]').first();
  await expect(result).toBeVisible({ timeout: 15_000 });

  const href = await result.getAttribute("href");
  expect(href).toMatch(/\/calls\/\w+\?t=\d+/);
  const expected = Number(new URL(href!, "http://x").searchParams.get("t"));

  await result.click();
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1 && a.currentTime > 0;
  });
  const at = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(at - expected)).toBeLessThan(2);
});

test("search reports honestly when nothing was said about it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search call recordings").fill("zzzqqxnothing");
  await expect(page.getByText(/Nothing said about/)).toBeVisible({ timeout: 15_000 });
});

test("cross-call Ask opens and its citation navigates to the right call and second", async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({ type: "delta", text: "They discussed the mirror network." }) +
        "\n" +
        JSON.stringify({
          type: "done",
          citations: [
            {
              callId: "hpr4314",
              callTitle: "13th Annual HPR New Year's Eve Show",
              atSec: 1282,
              label: "Ken explains the mirror origin server",
            },
          ],
        }) +
        "\n",
    }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Ask across all calls" }).click();
  await page.getByPlaceholder("Ask anything...").fill("what about mirrors?");
  await page.keyboard.press("Enter");

  const chip = page.getByRole("button", { name: /mirror origin server/ });
  await expect(chip).toBeVisible();
  await chip.click();

  await page.waitForURL(/\/calls\/hpr4314\?t=1282/);
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1 && a.currentTime > 0;
  });
  const at = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(at - 1282)).toBeLessThan(2);
});
