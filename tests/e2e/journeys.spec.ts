import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Mirrors the production CSP so that any inline script or style violation fails the test. */
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'";

async function open(page: Page) {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text());
  });
  await page.route('**/*', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    if ((headers['content-type'] ?? '').includes('text/html'))
      headers['content-security-policy'] = CSP;
    await route.fulfill({ response, headers });
  });
  await page.goto('/');
  return violations;
}

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

test('a combined change, end to end, with every ripple previewed before applying', async ({
  page,
}) => {
  const errors = await open(page);
  await expectNoAxeViolations(page);

  await page.getByRole('button', { name: /A wedding, 4 months away/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Riya & Arjun’s wedding');
  await expect(page.getByText('Tight: under 5% left').first()).toBeVisible();

  await page.getByRole('button', { name: 'Try a sample change' }).click();
  const dialog = page.getByRole('dialog', { name: 'Something changed?' });
  await dialog.getByRole('button', { name: 'Preview the ripple' }).click();
  await expect(dialog.getByText('Budget ripple')).toBeVisible();
  await expect(dialog.getByText(/Ask for a revised quote for 250/).first()).toBeVisible();
  await expectNoAxeViolations(page);
  await dialog.getByRole('button', { name: 'Apply changes' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('tab', { name: /Budget/ }).click();
  const tradeoffs = page.getByRole('region', { name: /What matters most/ });
  await expect(tradeoffs).toBeVisible();
  await tradeoffs.getByRole('button', { name: 'Select Lehar’s suggestion' }).click();
  await expect(tradeoffs.getByText(/within budget/)).toBeVisible();
  await tradeoffs.getByRole('button', { name: 'Apply selected' }).click();
  await expect(page.getByRole('heading', { level: 1 }).locator('..')).not.toContainText(
    'Over budget',
  );

  // The plan survives a reload (validated localStorage).
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Riya & Arjun’s wedding');
  expect(errors.filter((e) => /Content Security Policy/i.test(e))).toEqual([]);
});

test('keyboard only: create a plan through the intake wizard', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.getByRole('button', { name: 'Start a new plan' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Plan a new celebration' })).toBeVisible();

  await page.getByRole('radio', { name: /Community event/ }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Continue' }).focus();
  await page.keyboard.press('Enter');

  await page.getByLabel(/How many guests/).fill('300');
  await page.getByLabel('Total budget').fill('2 lakh');
  await expect(page.getByText('= ₹2,00,000')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /What matters most/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expectNoAxeViolations(page);
  await page.getByRole('button', { name: 'Create my plan' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your community event');

  // Arrow keys move between tabs.
  await page.getByRole('tab', { name: 'Overview' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: /Budget/ })).toBeFocused();
});

test('dark theme passes axe, and the AI path is labelled', async ({ page }) => {
  await open(page);
  await page.route('**/api/ai', (route) =>
    route.fulfill({
      json: {
        ok: true,
        task: 'ideas',
        data: {
          ideas: [
            {
              title: 'Eco Diwali mela',
              summary: 'Plastic-free stalls run by residents.',
              decor: 'Clay diyas',
              food: 'Veg chaat',
              activity: 'Rangoli contest',
              whyItFits: 'Every age joins in',
              costLevel: 'lower',
            },
          ],
        },
        meta: { source: 'gemini', model: 'gemini-3.8-flash', cached: false, requestId: 'e2e' },
      },
    }),
  );
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await page.getByRole('button', { name: /A society Diwali mela/ }).click();
  await page.getByRole('tab', { name: 'Ideas' }).click();
  await page.getByRole('button', { name: 'Suggest 3 ideas for my event' }).click();
  await expect(page.getByRole('heading', { name: 'Eco Diwali mela' })).toBeVisible();
  await expect(page.getByText('AI suggestion · Google Gemini')).toBeVisible();
  await expectNoAxeViolations(page);
});

test('works without the AI service (static hosting) using built-in suggestions', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: /A 6th birthday party/ }).click();
  await page.getByRole('tab', { name: 'Ideas' }).click();
  await page.getByRole('button', { name: 'Suggest 3 ideas for my event' }).click();
  await expect(page.getByText('Built-in suggestion', { exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('built-in suggestions');
});

test('no horizontal scrolling at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await open(page);
  await page.getByRole('button', { name: /A wedding, 4 months away/ }).click();
  for (const tab of ['Overview', 'Budget', 'Timeline', 'Vendors', 'Ideas', 'History']) {
    await page.getByRole('tab', { name: new RegExp(tab) }).click();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${tab} overflows`).toBeLessThanOrEqual(0);
  }
});
