import { defineConfig, devices } from "@playwright/test";

/**
 * Integration tests run against a real build of apps/web, not a mocked one.
 *
 * The things most likely to break in this product are not units — they are the joins: does
 * clicking a transcript line actually move the audio, does an Ask citation land on the moment it
 * claims, does the library still render when a transcript has 2,326 segments. None of that is
 * visible to a unit test, and all of it is what a reviewer will click first.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  use: {
    baseURL: process.env.BASE_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Reuse a server if one is already up, so running these alongside `bun dev` is not a fight.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "bun run --cwd ../web dev",
        url: "http://127.0.0.1:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
