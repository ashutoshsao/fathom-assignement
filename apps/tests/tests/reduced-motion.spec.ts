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

test("the loader stays alive under reduced motion, without travelling or flashing", async ({ page }) => {
  await page.route("**/api/ask", () => {
    /* held open so the waiting state stays on screen */
  });

  await page.goto("/calls/hpr4314");
  await page.getByPlaceholder("Ask anything...").fill("anything");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toBeVisible();

  const read = () =>
    page.evaluate(() => {
      const grid = document.querySelector('[role="status"] .inline-grid')!;
      return [...grid.children].map((el) => Number(getComputedStyle(el).opacity));
    });

  const a = await read();
  await page.waitForTimeout(700);
  const b = await read();

  // Still changing — a frozen indicator during a 30s wait reads as a hang.
  expect(a.join()).not.toBe(b.join());

  // The spiral still runs — the setting targets vestibular triggers (large movement, parallax,
  // zoom, flashing), and a 15px trail is none of those. What it must not do is flash: no dot may
  // swing the full range between consecutive frames.
  await page.waitForTimeout(150);
  const c = await read();
  const maxSwing = Math.max(...c.map((v, i) => Math.abs(v - (b[i] ?? 0))));
  expect(maxSwing).toBeLessThan(0.75);

  // And it is visibly calmer than the unreduced version rather than identical to it.
  const peak = Math.max(...c);
  expect(peak).toBeLessThanOrEqual(0.85);
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
