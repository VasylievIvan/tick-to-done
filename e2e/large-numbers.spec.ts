import { expect, test, type Locator } from '@playwright/test';

/** Elements whose content sticks out of their own box, horizontally. */
async function overflowing(container: Locator): Promise<string[]> {
  return container.evaluateAll((elements) =>
    elements.flatMap((element) => {
      const box = element.getBoundingClientRect();
      const name = element.getAttribute('data-card') ?? element.getAttribute('data-upgrade') ?? element.tagName;
      const out = [element, ...element.querySelectorAll('*')].filter((child) => {
        const rect = child.getBoundingClientRect();
        const outside = rect.right > box.right + 0.5 || rect.left < box.left - 0.5;
        return rect.width > 0 && (outside || child.scrollWidth > child.clientWidth + 1);
      });
      return out.map((child) => `${name}: ${child.textContent}`);
    }),
  );
}

test('cards, shop and balance keep their layout with five-digit complexity and long balances', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.evaluate(() => {
    const store = window.__vibecode?.store;
    if (!store) throw new Error('development hooks are missing');
    const { game } = store.getState();
    const card = (number: number, overrides: Record<string, unknown>) => ({
      number,
      titleKey: 'anotherTask' as const,
      originalComplexity: 50_000,
      implementationDone: 0,
      reworkRequired: 0,
      reworkDone: 0,
      returnCount: 0,
      review: { status: 'none' as const },
      scriptedReview: null,
      doneAtUs: null,
      ...overrides,
    });
    const discovered = Object.fromEntries(Object.keys(game.upgrades.discovered).map((id) => [id, true]));
    store.setState({
      game: {
        ...game,
        cards: {
          12_341: card(12_341, {}),
          12_342: card(12_342, { implementationDone: 50_000, reworkRequired: 39_999, reworkDone: 12_345, returnCount: 3 }),
          12_343: card(12_343, { implementationDone: 49_995 }),
          12_344: card(12_344, { implementationDone: 50_000, reworkRequired: 19_998, reworkDone: 19_997, returnCount: 2 }),
          12_345: card(12_345, { implementationDone: 50_000, review: { status: 'accepted' } }),
          12_340: card(12_340, { implementationDone: 50_000, doneAtUs: 0 }),
        },
        columns: { todo: [12_341, 12_342], inProgress: [12_343, 12_344], review: [12_345], done: [12_340] },
        nextCardNumber: 12_346,
        economy: { ...game.economy, credits: 123_456_789_012, completedTasks: 123_456, totalEarned: 987_654_321_098 },
        upgrades: {
          levels: { betterKeyboard: 25, aiWorkPower: 40, aiTickSpeed: 7, parallelProcessing: 9, fasterBacklog: 3, biggerTasks: 12 },
          owned: { aiDeveloper: true, autoAssign: true, autoSubmit: true, autoComplete: true },
          discovered: discovered as typeof game.upgrades.discovered,
        },
        scenario: {
          scriptedTasksIssued: 3,
          revealed: { codeReview: true, done: true, balance: true, shop: true },
          spawnerEnabled: false,
        },
      },
    });
  });

  await expect(page.getByTestId('credits')).toHaveText('123,456,789,012 Credits');
  await expect(page.locator('article[data-card="12341"]')).toContainText('Complexity: 50,000');
  await expect(page.locator('article[data-card="12343"]')).toContainText('Implementation: 49,995/50,000');
  const shop = page.getByRole('region', { name: 'Shop' });
  await expect(shop.locator('li[data-upgrade="biggerTasks"]')).toContainText('40,000–120,000 → 80,000–240,000');
  await expect(shop.locator('li[data-upgrade]')).toHaveCount(6);

  expect(await overflowing(page.locator('article[data-card]'))).toEqual([]);
  expect(await overflowing(shop.locator('li[data-upgrade]'))).toEqual([]);
  expect(await overflowing(page.locator('[data-testid="credits"]').locator('..'))).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.screenshot({ path: 'test-results/large-numbers.png', fullPage: true });
});
