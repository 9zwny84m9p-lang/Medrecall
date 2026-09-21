import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3210);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Escape hatch for sandboxes that ship a Chromium build of their own rather
 * than the revision this Playwright version downloads. CI leaves it unset and
 * uses `playwright install chromium`.
 */
const executablePath = process.env.MEDRECALL_CHROMIUM_PATH;

/**
 * End-to-end tests run against a production build.
 *
 * The milestone this project is built around is a whole journey — teach, test,
 * get it wrong, move to the next lecture, meet the weak concept again, reload —
 * and only a real browser exercises IndexedDB persistence and the grading round
 * trip together.
 *
 * The one project runs at iPad dimensions with touch enabled, because that is
 * the device the product is designed around. Chromium rather than WebKit keeps
 * CI to a single browser download; Safari-specific checks belong in a later
 * milestone with a real device.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "ipad",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1180, height: 820 },
        deviceScaleFactor: 2,
        hasTouch: true,
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
