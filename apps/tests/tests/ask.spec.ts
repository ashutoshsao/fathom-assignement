import { expect, test } from "@playwright/test";

/**
 * Ask, tested against a stubbed /api/ask.
 *
 * The model call itself is not what can silently break here, and exercising it in CI would burn a
 * hard daily quota and make the suite non-deterministic. What must keep working is the contract
 * around it: the stream renders progressively, and a citation chip seeks the player to the moment
 * it claims. That claim is the product's whole credibility, so it gets asserted numerically.
 */

const ndjson = (lines: unknown[]) => lines.map((l) => JSON.stringify(l)).join("\n") + "\n";

test("an answer streams in and its citation seeks the player", async ({ page }) => {
  await page.route("**/api/ask", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: ndjson([
        { type: "delta", text: "They moved to a mirror network " },
        { type: "delta", text: "after the archive went down." },
        {
          type: "done",
          citations: [
            {
              callId: "hpr4314",
              callTitle: "13th Annual HPR New Year's Eve Show",
              atSec: 1500,
              label: "Internet Archive downtime prompts CDN setup",
            },
          ],
        },
      ]),
    });
  });

  await page.goto("/calls/hpr4314");
  await page.waitForFunction(() => {
    const a = document.querySelector("audio");
    return !!a && a.readyState >= 1;
  });

  await page.getByPlaceholder("Ask anything...").fill("What happened with the archive?");
  await page.keyboard.press("Enter");

  await expect(page.getByText("They moved to a mirror network after the archive went down.")).toBeVisible();

  const chip = page.getByRole("button", { name: /Internet Archive downtime/ });
  await expect(chip).toBeVisible();
  await chip.click();

  // The chip says 25:00; the player must actually be there.
  const at = await page.evaluate(() => document.querySelector("audio")!.currentTime);
  expect(Math.abs(at - 1500)).toBeLessThan(2);
});

test("suggested prompts are offered before the first question", async ({ page }) => {
  await page.goto("/calls/hpr4314");
  await expect(page.getByRole("button", { name: "What was decided?" })).toBeVisible();
});

test("an API failure is reported, not swallowed", async ({ page }) => {
  await page.route("**/api/ask", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: ndjson([{ type: "error", message: "all models unavailable" }]),
    }),
  );

  await page.goto("/calls/hpr4314");
  await page.getByPlaceholder("Ask anything...").fill("anything");
  await page.keyboard.press("Enter");
  await expect(page.getByText("all models unavailable")).toBeVisible();
});
