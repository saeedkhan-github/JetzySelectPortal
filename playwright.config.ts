import { defineConfig, devices } from '@playwright/test';

/**
 * IMPORTANT: the Docker image tag (v1.59.0-noble) must match your
 * @playwright/test version exactly. Check it in package.json:
 *   "devDependencies": { "@playwright/test": "1.59.0" }
 * If yours differs, swap the image tag in .devcontainer/devcontainer.json
 * and docker-compose.yml to match (e.g. v1.58.0-noble for 1.58.x).
 *
 * WORKFLOW (macOS 13.5, Playwright 1.58+):
 * - Day-to-day writing/debugging on your Mac (chromium + firefox work locally;
 *   WebKit needs macOS 14+, so it is skipped locally):
 *     npx playwright test --project=chromium --project=firefox
 *     npx playwright test --project=chromium --ui        # debugging UI mode
 * - Full suite incl. WebKit, inside Docker:
 *     docker compose run --rm playwright npx playwright test
 * - VS Code Dev Containers (extension installed): Cmd+Shift+P ->
 *   "Dev Containers: Reopen in Container" — VS Code then runs inside the
 *   container, same folder, Playwright extension included.
 *
 * ENVIRONMENTS: settings live in .env.<name> (staging is the default).
 *     npm run test:staging          # or: TEST_ENV=staging npx playwright test
 *     npm run test:prod             # or: TEST_ENV=production npx playwright test
 * Visual baselines are stored per environment in tests/__screenshots__/<name>/.
 */
const TEST_ENV = process.env.TEST_ENV ?? 'staging';
process.loadEnvFile(`.env.${TEST_ENV}`); // throws if the file is missing, so a typo fails fast
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  snapshotPathTemplate: `{testDir}/__screenshots__/${TEST_ENV}/{testFilePath}/{arg}{-projectName}{-platform}{ext}`,
  fullyParallel: true,
  forbidOnly: CI,
  // One retry on CI records a trace without creating too many extra staging accounts.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['html', { open: 'never' }], ['github']] : 'html',
  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Maximized window is for local headed runs only; --start-maximized is a Chromium flag.
        // (deviceScaleFactor must be cleared: Playwright rejects it with a null viewport.)
        ...(CI ? {} : { viewport: null, deviceScaleFactor: undefined, launchOptions: { args: ['--start-maximized'] } }),
      },
    },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // webkit runs in Docker (and on CI macOS runners), not locally on macOS 13.5
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
