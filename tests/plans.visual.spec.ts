import { test, expect, type Page } from '@playwright/test';

// Visual tests for the 4 plan cards on the Jetzy subscription page:
// default (Monthly) state, and Annual selected on cards 2–4.

const CARD_TITLES = ['Jetzy Basic', 'Jetzy Select Hotels', 'Jetzy Premium', 'Jetzy Select Concierge'];

// Visual baselines are browser-specific; keep one set (chromium).
test.skip(({ browserName }) => browserName !== 'chromium', 'visual baselines are chromium-only');

// The wrapper holding all 4 cards = innermost div containing both the first and last card.
function planCards(page: Page) {
  return page.locator('div')
    .filter({ has: page.getByText('Jetzy Basic', { exact: true }) })
    .filter({ has: page.getByText('Jetzy Select Concierge', { exact: true }) })
    .last();
}

// Trial-end dates ("... from Nov 23, 2026") come from the server and change daily, so mask them.
function dateMask(page: Page) {
  return [page.getByText(/from \w{3} \d{1,2}, \d{4}/)];
}

test.beforeEach(async ({ page }) => {
  // 1440: at 1280 the Monthly card content overflows cards 2–3 (known layout bug).
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/app'); // BASE_URL comes from .env.<TEST_ENV>
  for (const title of CARD_TITLES) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await page.evaluate(() => document.fonts.ready);
});

test('plan cards – monthly (default)', async ({ page }) => {
  await expect(planCards(page)).toHaveScreenshot('plan-cards-monthly.png', {
    animations: 'disabled',
    mask: dateMask(page),
    maxDiffPixelRatio:0.1
  });
});

test('plan cards – annual selected on cards 2–4', async ({ page }) => {
  for (const name of ['Annual $49.50/Year', 'Annual $100/Year', 'Annual $595/Year']) {
    await page.getByRole('button', { name }).click();
  }
  await expect(page.getByText('Billed annually')).toHaveCount(3);
  await expect(planCards(page)).toHaveScreenshot('plan-cards-annual.png', {
    animations: 'disabled',
    mask: dateMask(page),
  });
});
