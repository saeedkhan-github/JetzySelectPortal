import { test, expect, planCard, signUp, payWithTestCard } from './fixtures';

// E2E: Select Hotels free trial -> sign up -> Stripe checkout -> plan state after purchase.
// Creates a real account + test-mode subscription, so it only runs against staging.

test.skip((process.env.TEST_ENV ?? 'staging') !== 'staging', 'Stripe test cards only work on staging');

test('Select Hotels trial: sign up, pay with test card, see current plan', async ({ page, testCard, newUser }) => {
  test.setTimeout(180_000);

  await page.goto('/app');
  const hotels = () => planCard(page, 'Jetzy Select Hotels');
  await hotels().getByRole('button', { name: 'Start 1-month free trial' }).click();

  await signUp(page, newUser);
  await payWithTestCard(page, testCard);

  // The plans page loads the new subscription after it renders; Firefox can take >5s for that.
  await expect(page.getByRole('button', { name: /manage subscription/i }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Subscription', { exact: true })).toBeVisible();

  // Select Hotels (Monthly) is now the current plan; Annual offers an upgrade.
  await expect(hotels().getByRole('button', { name: 'Current Plan' })).toBeVisible();
  await expect(hotels().getByRole('button', { name: 'Start 1-month free trial' })).toHaveCount(0);
  await hotels().getByRole('button', { name: /^Annual/ }).click();
  await expect(hotels().getByRole('button', { name: 'Upgrade to this plan' })).toBeVisible();
});
