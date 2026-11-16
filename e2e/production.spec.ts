import { expect, test } from '@playwright/test';
import { cardIn, dragCard, workUntilFinished } from './helpers.ts';

test.describe('production build for testers', () => {
  test('starts the game without development tools', async ({ page }) => {
    await page.goto('/?seed=1&speed=8');
    await expect(page).toHaveTitle('Tick to Done');
    await expect(page.locator('section[data-column]')).toHaveCount(2);
    await expect(cardIn(page, 'todo', 1)).toContainText('Complexity: 10');
    expect(await page.evaluate(() => typeof window.__vibecode)).toBe('undefined');

    // `?speed=8` would finish the 2-second review in a quarter of a second in the development build.
    await dragCard(page, 1, 'todo', 'inProgress');
    await workUntilFinished(page, 1);
    await dragCard(page, 1, 'inProgress', 'review');
    await page.waitForTimeout(1_000);
    await expect(cardIn(page, 'review', 1)).toContainText('In review');
    await expect(cardIn(page, 'review', 1)).toContainText('Approved', { timeout: 3_000 });
  });

  test('ships no cookies, databases or development hooks', async ({ page, request }) => {
    await page.goto('/');
    const scripts = await page.locator('script[src]').evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('src') ?? ''),
    );
    expect(scripts.length).toBeGreaterThan(0);
    for (const src of scripts) {
      const code = await (await request.get(src)).text();
      for (const forbidden of ['sessionStorage', 'indexedDB', '__vibecode', 'document.cookie']) {
        expect(code.includes(forbidden), `${src} mentions ${forbidden}`).toBe(false);
      }
    }
  });
});
