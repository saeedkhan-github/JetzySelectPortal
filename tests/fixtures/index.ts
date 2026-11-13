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
  // The whole payment form (method list, card fields, pay button) now lives in a Stripe Elements iframe.
  const form = page.locator('iframe[title="Secure embedded form frame"]').contentFrame();
  const cardNumber = form.locator('#payment-numberInput');
  // Payment methods are an accordion; with more than one method (e.g. a US visitor on CI) the card
  // fields stay collapsed until "Card" is clicked. With card as the only method it's already open.
  const cardOption = form.locator('[data-value="card"]');
  await expect(cardOption.or(cardNumber).first()).toBeVisible({ timeout: 30_000 });
  if (!(await cardNumber.isVisible())) await cardOption.click();
  await cardNumber.fill(testCard.number);
  await form.locator('#payment-expiryInput').fill(testCard.expiry);
  await form.locator('#payment-cvcInput').fill(testCard.cvc);
  await form.locator('#payment-nameInput').fill(testCard.name);
  // Checkout defaults the country from the visitor's IP (US on GitHub runners, which adds a required ZIP),
  // so pin it to keep the form identical locally and on CI.
  await form.locator('#payment-countryInput').selectOption('US');
  await form.getByRole('textbox', { name: /ZIP/ }).fill('10001');
  // "Save my information for faster checkout" (Link) makes a phone number required; opt out.
  const saveWithLink = form.getByRole('checkbox', { name: /Save my information/ });
  if (await saveWithLink.isVisible() && await saveWithLink.isChecked()) await saveWithLink.uncheck();
  await form.getByTestId('payment-form-submit-button').click();

  await expect(page.getByRole('heading', { name: 'Welcome to Jetzy' })).toBeVisible({ timeout: 90_000 });
  await page.getByRole('link', { name: 'Back to plans' }).click();
  // Leave /app/payments/confirm before callers assert on plan cards (Firefox can take >5s here).
  await expect(page).toHaveURL(/\/app(\?.*)?$/, { timeout: 30_000 });
}

export { expect };
