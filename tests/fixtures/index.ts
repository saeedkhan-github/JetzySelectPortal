import { test as base, expect, type Page } from '@playwright/test';
import card from './test-card.json';

// Stripe test card (test mode only) plus per-run random expiry and cardholder name.
type TestCard = { number: string; cvc: string; expiry: string; name: string };
type NewUser = { email: string; password: string };

const FIRST_NAMES = ['Alex', 'Sam', 'Jordan', 'Taylor', 'Morgan', 'Riley'];
const LAST_NAMES = ['Smith', 'Lee', 'Garcia', 'Khan', 'Brown', 'Nguyen'];
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function randomFutureExpiry() {
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const year = String((new Date().getFullYear() + 1 + Math.floor(Math.random() * 5)) % 100).padStart(2, '0');
  return `${month} / ${year}`;
}

export const test = base.extend<{ testCard: TestCard; newUser: NewUser }>({
  testCard: async ({}, use) => {
    await use({ ...card, expiry: randomFutureExpiry(), name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}` });
  },
  newUser: async ({}, use) => {
    const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await use({ email: `qa.e2e+${id}@example.com`, password: `Qa!${id}Aa` });
  },
});

// Plan card = innermost div holding its title and its action button (whose label changes after purchase).
export function planCard(page: Page, title: string) {
  return page.locator('div')
    .filter({ has: page.getByText(title, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: /Start 1-month free trial|Current Plan|Upgrade|Not Available|Included with Concierge/ }) })
    .last();
}

export async function signUp(page: Page, newUser: NewUser) {
  await expect(page).toHaveURL(/\/auth/);
  // The form can reset while the auth page is still loading, so refill until the values stick.
  await page.waitForLoadState('networkidle');
  const email = page.getByRole('textbox', { name: 'Enter your email address' });
  const password = page.getByRole('textbox', { name: 'Enter Password' });
  await expect(async () => {
    await email.fill(newUser.email);
    await password.fill(newUser.password);
    await expect(email).toHaveValue(newUser.email, { timeout: 1_000 });
    await expect(password).toHaveValue(newUser.password, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
}

// Pays on Stripe checkout, then returns to the plans page.
export async function payWithTestCard(page: Page, testCard: TestCard) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
  await page.locator('#cardNumber').fill(testCard.number);
  await page.locator('#cardExpiry').fill(testCard.expiry);
  await page.locator('#cardCvc').fill(testCard.cvc);
  await page.locator('#billingName').fill(testCard.name);
  await page.getByTestId('hosted-payment-submit-button').click();

  await expect(page.getByRole('heading', { name: 'Welcome to Jetzy' })).toBeVisible({ timeout: 90_000 });
  await page.getByRole('link', { name: 'Back to plans' }).click();
}

export { expect };
