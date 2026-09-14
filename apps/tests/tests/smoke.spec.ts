import { expect, test } from "@playwright/test";

/**
 * The cheapest possible guard: the app serves, renders, and does not throw in the console.
 *
 * Worth having from the first milestone because a build that compiles but blows up at runtime is
 * the failure mode that wastes the most time — it looks fine until you open it.
 */
test("the app serves a page without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  const response = await page.goto("/");
  expect(response?.status()).toBeLessThan(400);
  await expect(page.locator("body")).toBeVisible();
  expect(errors).toEqual([]);
});
