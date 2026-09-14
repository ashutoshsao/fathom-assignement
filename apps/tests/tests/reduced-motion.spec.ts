import { expect, test } from "@playwright/test";

/**
 * Reduced motion must actually reduce motion.
 *
 * The widely-copied snippet sets `animation-duration: 0.01ms` and nothing else. That disables a
 * finite animation, but an INFINITE one repeats a hundred thousand times a second — a strobe,
 * which is the opposite of what the setting asks for and is harmful to photosensitive users. Our
 * loading dots and typing caret are both infinite and both strobed until the iteration count was
 * capped. Asserted rather than eyeballed, because the failure is invisible to anyone who does not
 * have the setting switched on.
 */

test.use({ reducedMotion: "reduce" });

test("infinite animations stop instead of strobing", async ({ page }) => {
  await page.route("**/api/ask", () => {
    /* held open so the waiting state stays on screen */
  });

  await page.goto("/calls/hpr4314");
  await page.getByPlaceholder("Ask anything...").fill("anything");
  await page.keyboard.press("Enter");

  const dot = page.locator(".thinking-dot").first();
  await expect(dot).toBeVisible();

  const style = await dot.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { iterations: cs.animationIterationCount, opacity: Number(cs.opacity) };
  });

  // The iteration cap is the part that actually stops a strobe.
  expect(style.iterations).toBe("1");
  // And it must still be legible once stopped, not faded to nothing.
  expect(style.opacity).toBeGreaterThan(0.5);
});

test("the wait still shows progress when motion is switched off", async ({ page }) => {
  await page.route("**/api/ask", () => {
    /* held open */
  });

  await page.goto("/calls/hpr4314");
  await page.getByPlaceholder("Ask anything...").fill("anything");
  await page.keyboard.press("Enter");

  // With the dots held still, an elapsed counter is what keeps a 30s wait from reading as a
  // hang. It is content changing rather than movement, so it is allowed under the setting.
  const status = page.getByRole("status");
  await expect(status).toContainText("Reading the transcript");
  await expect(status).toContainText(/[1-9]s/, { timeout: 4000 });
});

test("no element is left animating indefinitely under reduced motion", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((el) => getComputedStyle(el).animationIterationCount === "infinite")
      .map((el) => el.className?.toString().slice(0, 40)),
  );
  expect(offenders).toEqual([]);
});
