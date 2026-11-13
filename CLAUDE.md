# JetzySelect

Playwright + TypeScript E2E tests for the Jetzy Select plans/subscription page (`/app`),
Stripe checkout and the Stripe billing portal. Tests run in the
`mcr.microsoft.com/playwright:v1.59.0-noble` Docker image, both locally and on CI.
Setup steps for Docker and Dev Containers are in [README.md](README.md).

**Target environment: staging, always.** Stripe checkout only accepts test cards on staging
and can't be mocked on production, so nothing in this project runs against production.

## Commands

```bash
docker compose up -d                                           # start the container once
docker compose exec playwright npx playwright test             # full suite, all 3 browsers
docker compose exec playwright npx playwright test tests/signup-trial.spec.ts --project=chromium
docker compose exec playwright npx playwright show-report --host 0.0.0.0   # → http://localhost:9323
docker compose exec playwright npx playwright-cli open         # interactive browser (playwright-cli skill)

npx playwright test --project=chromium --project=firefox       # on the Mac (WebKit needs macOS 14+, so use Docker)
npm run test:ui                                                # UI mode, chromium
npx tsc --noEmit                                               # type check
```

Staging is the default: with `TEST_ENV` unset the config loads `.env.staging` (`npm run test:staging` does the same).
Do **not** use `npm run test:prod` or `TEST_ENV=production`.

**Playwright CLI lives in the Docker container.** Always prefix every `playwright-cli` command with
`docker compose exec playwright npx`, e.g. `docker compose exec playwright npx playwright-cli snapshot`.
The examples in the `playwright-cli` skill show bare `playwright-cli ...`; add the prefix to them as well.

## Layout

- `playwright.config.ts`: loads `.env.${TEST_ENV}` with `process.loadEnvFile`, which fails fast on a typo. Sets the CI-only retries, workers and reporters, and defines the chromium, firefox and webkit projects.
- `tests/fixtures/index.ts`: the custom `test`, with the `testCard` and `newUser` fixtures, plus the `planCard`, `signUp` and `payWithTestCard` helpers.
- `tests/signup-trial.spec.ts` and `tests/concierge-free-premium.spec.ts`: E2E purchase flows.
- `tests/plans.visual.spec.ts`: screenshot tests of the 4 plan cards.
- `tests/__screenshots__/staging/<spec>/<name>-<project>-<platform>.png`: visual baselines.
- `.github/workflows/playwright.yml`: CI, always on staging.
- `.claude/skills/playwright-cli/`: project skill for interactive browser automation and test generation. Its commands run in the container (see Commands).

## Rules

- **Staging only.** Never run tests, generate tests or point `baseURL` at production, locally or on CI.
  New specs target staging. E2E purchase specs keep the guard
  `test.skip((process.env.TEST_ENV ?? 'staging') !== 'staging', ...)`. CI pins `TEST_ENV: staging`; leave it that way.
- **Version lock.** The `@playwright/test` version in `package.json` must equal the Docker image tag in
  `docker-compose.yml`, `.devcontainer/devcontainer.json` and the workflow. Change all four together, then `docker compose pull`.
- **Real side effects.** Each E2E run creates a real staging account (`qa.e2e+<id>@example.com`) and a
  Stripe test-mode subscription. Don't add needless retries, loops or repeat runs.
- **Secrets.** Never read, print or commit `gittoken*`, SSH keys or `.env*.local`. `.env.staging` holds only the public `BASE_URL`.
- **Visual baselines.** Only `tests/__screenshots__/staging/` counts, and CI compares against the `*-linux.png` files.
  Regenerate them inside Docker (`--update-snapshots`), never on macOS, and only for an intended UI change.

## Writing tests

- E2E specs import `test` and `expect` from `./fixtures`, not from `@playwright/test`.
- Locate elements by role or text (`getByRole`, `getByText(..., { exact: true })`). Find plan cards with `planCard(page, title)`.
  Use CSS/id selectors only on Stripe-hosted fields.
- Use web-first assertions. Wrap form input that doesn't stick in `expect(async () => ...).toPass()`. Never use `waitForTimeout`.
- Long flows call `test.setTimeout(180_000)`. Stripe redirects get explicit timeouts (`waitForURL(..., { timeout: 60_000 })`).
- In screenshots, mask dynamic content such as trial-end dates and disable animations. The plans page uses a 1440px
  viewport because the cards overflow at 1280 (a known layout bug).
- Add a short comment explaining *why* for any non-obvious wait or workaround.
- No `test.only`: CI fails on it (`forbidOnly`).

## CI

- Runs on push and PR to `main`, nightly at 02:00 UTC, and on manual dispatch.
- Uses 1 retry, 2 workers, and a trace on the first retry.
- Artifacts: `playwright-report` (kept 30 days), and `test-results` on failure (kept 7 days).
- `HOME=/root` is required, or Firefox won't run in the container.

## Known quirks

- Stripe checkout picks the country from the visitor's IP. `payWithTestCard` pins it to US with ZIP `10001` and unchecks
  "Save my information with Link", which would otherwise make a phone number required.
- The auth form can reset while the page loads, so `signUp` refills it until the values stick.
- WebKit is slow in Docker (`test.slow`). Firefox can take more than 5s to leave `/app/payments/confirm`.
