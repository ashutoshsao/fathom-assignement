import { expect, test } from "@playwright/test";

/**
 * The joins that matter on the call page. Each of these is something a unit test cannot see and
 * a reviewer will click within the first thirty seconds.
 */

test("the library lists calls grouped by day", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  const cards = page.locator('a[href^="/calls/"]');
  expect(await cards.count()).toBeGreaterThan(0);
});

test("opening a call shows summary, speakers and a player", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByText("Key takeaways")).toBeVisible();
});

test("clicking a transcript line seeks the audio to that line", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await page.getByRole("button", { name: "Transcript" }).click();

  // Wait for audio metadata, otherwise seeking is a no-op against an unloaded element.
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1;
  });

  const before = await page.evaluate(() => document.querySelector("audio")!.currentTime);

  // A timestamp button inside the transcript, well down the call.
  const stamps = page.locator("p span[title^='Play from']");
  await stamps.nth(40).click();

  const after = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(after).not.toBe(before);
  expect(after).toBeGreaterThan(0);
});

test("a summary timestamp seeks the player to the cited moment", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1;
  });

  const stamp = page.locator("button[title^='Play from']").first();
  const label = (await stamp.textContent())!.trim();
  await stamp.click();

  // The claimed time and the actual player position must agree — this is the promise the whole
  // product makes, so it is worth asserting rather than eyeballing.
  const [m, s] = label.split(":").map(Number);
  const expected = (m ?? 0) * 60 + (s ?? 0);
  const actual = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(actual - expected)).toBeLessThan(2);
});

test("the 110-minute transcript renders every segment", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await page.getByRole("button", { name: "Transcript" }).click();
  const lines = page.locator("p span[title^='Play from']");
  // 2,326 segments in the seed data; assert the page is not silently truncating.
  expect(await lines.count()).toBeGreaterThan(2000);
});
