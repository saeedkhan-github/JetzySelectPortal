# Playwright + Docker starter

Run the latest Playwright (Chromium + Firefox + WebKit) in Docker, write tests
in VS Code on your Mac, and use the exact same setup later in GitHub CI.
Works on macOS 13.5, where the latest Playwright can't run WebKit locally.

## One-time setup

1. Install and start **Docker Desktop** on your Mac.
2. Unzip this project, open the folder in **VS Code**.
3. Start the container (stays alive in the background):

   ```bash
   docker compose up -d
   ```

4. Install dependencies once, inside the container:

   ```bash
   docker compose exec playwright npm install
   ```

   (This creates `node_modules` and `package-lock.json` in your project folder.)

## Daily workflow — write tests, run, repeat

Edit tests in VS Code as normal (files live in `tests/`). Nothing to rebuild:
your folder is mounted into the container, so changes are picked up instantly.

Run the full suite (all 3 browsers):

```bash
docker compose exec playwright npx playwright test
```

Run one file / one browser while developing:

```bash
docker compose exec playwright npx playwright test tests/example.spec.ts --project=chromium
```

Get a shell inside the container (then just run `npx playwright test` etc.):

```bash
docker compose exec playwright bash
```

## See the results

After a run, an HTML report is saved to `playwright-report/` in your folder.
View it in your Mac browser:

```bash
docker compose exec playwright npx playwright show-report --host 0.0.0.0
```

Then open http://localhost:9323 — failed tests show screenshots and traces there.

Stop everything when done:

```bash
docker compose down
```

## Alternative: VS Code Dev Containers

Install the **Dev Containers** extension in VS Code, then
`Cmd+Shift+P` → **Dev Containers: Reopen in Container**. VS Code itself moves
inside the container — integrated terminal, debugging and the Playwright
extension all run in Docker. Same folder, same image.

## GitHub CI/CD

`.github/workflows/playwright.yml` runs the suite **in the same Docker image** as
your local runs, always against **staging**:

- on every push and pull request to `main`,
- nightly at 02:00 UTC,
- on demand: Actions tab → **Playwright Tests** → **Run workflow**.

Production is never run on CI; run it manually with `npm run test:prod`.

Each run uploads the HTML report as an artifact (`playwright-report`), and
failed runs also upload `test-results` with traces and screenshots
(Actions tab → run → Artifacts).

On CI (`CI=true`) the config retries a failed test once (recording a trace),
uses 2 workers and fails if a `test.only` was left in.

Note: the E2E tests create a real staging account and Stripe test subscription
on each run.

## The one rule

The Docker image tag **must match** your `@playwright/test` version exactly:

- `package.json` → `"@playwright/test": "1.59.0"`
- `docker-compose.yml`, `.devcontainer/devcontainer.json`, workflow →
  `mcr.microsoft.com/playwright:v1.59.0-noble`

Upgrading Playwright = change both places, then `docker compose pull`.
