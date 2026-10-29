import { test, expect, planCard, signUp, payWithTestCard } from './fixtures';

// E2E: buying Select Concierge (Monthly or Annual) includes Jetzy Premium for free,
// so Premium can no longer be bought and the Concierge subscription can be cancelled.
// Creates a real account + test-mode subscription, so it only runs against staging.

test.skip((process.env.TEST_ENV ?? 'staging') !== 'staging', 'Stripe test cards only work on staging');

for (const period of ['Monthly', 'Annual'] as const) {
  test(`Free Premium with Concierge (${period})`, async ({ page, testCard, newUser }) => {
    test.setTimeout(180_000);

    await page.goto('/app');
    const concierge = () => planCard(page, 'Jetzy Select Concierge');
    const premium = () => planCard(page, 'Jetzy Premium');
    await concierge().getByRole('button', { name: new RegExp(`^${period}`) }).click();
    await concierge().getByRole('button', { name: /Start 1-month free trial|Upgrade/ }).click();

    await signUp(page, newUser);
    await payWithTestCard(page, testCard);

    // Premium is included with Concierge, so it can't be started or bought separately.
    await expect(premium().getByRole('button', { name: 'Included with Concierge' })).toBeDisabled();
    await expect(premium().getByRole('button', { name: 'Start 1-month free trial' })).toHaveCount(0);

    // Manage Subscription lists the purchased Concierge plan with Cancel subscription to its right.
    await page.getByRole('button', { name: 'Manage Subscription' }).click();
    await page.waitForURL(/billing\.stripe\.com/, { timeout: 60_000 });
    // Stripe portal names the product e.g. "Concierge Annual New".
    const purchased = page.getByText(new RegExp(`^Concierge ${period}`));
    const cancel = page.getByRole('link', { name: 'Cancel subscription' });
    await expect(purchased).toBeVisible({ timeout: 30_000 });
    await expect(cancel).toBeVisible();
    const [planBox, cancelBox] = [await purchased.boundingBox(), await cancel.boundingBox()];
    expect(cancelBox!.x).toBeGreaterThan(planBox!.x);
  });
}
