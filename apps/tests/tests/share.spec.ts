import { expect, test } from "@playwright/test";

/**
 * The public share view.
 *
 * These run in a fresh browser context with no storage, which is as close as the harness gets to
 * "somebody who is not signed in" — the brief's final check.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test("a shared call opens for a stranger, with playback and summary", async ({ page }) => {
  await page.goto("/share/hpr4314");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(page.getByText("Key takeaways")).toBeVisible();
});

test("the shared view withholds the owner's other calls", async ({ page }) => {
  await page.goto("/share/hpr4314");
  // No library search, no cross-call Ask, no nav into someone else's meetings.
  await expect(page.getByLabel("Search call recordings")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ask across all calls" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Back to My Calls" })).toHaveCount(0);
});

test("a shared clip starts at the clip and stops at its end", async ({ page }) => {
  await page.goto("/share/hpr4314?clip=1500-1530");

  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1 && a.currentTime > 0;
  });
  const start = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(start - 1500)).toBeLessThan(2);

  // The header says it is a clip, not a whole call.
  await expect(page.getByText(/clip ·/)).toBeVisible();

  // Seeking past the end is clamped — a clip that runs on into the rest of the call is not a clip.
  await page.evaluate(() => {
    document.querySelector("audio")!.currentTime = 2000;
  });
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(after).toBeLessThanOrEqual(1531);
});

test("a malformed clip falls back to the whole call rather than an empty window", async ({ page }) => {
  await page.goto("/share/hpr4314?clip=notanumber");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/clip ·/)).toHaveCount(0);
});

test("the call page offers share links for a call, a moment and a clip", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByText("Whole call")).toBeVisible();
  await expect(page.getByText("From this moment")).toBeVisible();
  await expect(page.getByText("Just this clip")).toBeVisible();
  await expect(page.getByText(/no account needed/)).toBeVisible();
});
