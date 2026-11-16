import { expect, test } from '@playwright/test';
import { completeCardManually } from './helpers.ts';

test('after the four one-time purchases the game runs by itself', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  for (const card of [1, 2, 3]) await completeCardManually(page, card);

  // Test setup only: grant Credits through the development store instead of playing twenty tasks by hand.
  await page.evaluate(() => {
    const store = window.__vibecode?.store;
    if (!store) throw new Error('development store is not exposed');
    const { game } = store.getState();
    store.setState({
      game: {
        ...game,
        economy: { ...game.economy, credits: 2000 },
        upgrades: {
          ...game.upgrades,
          discovered: Object.fromEntries(Object.keys(game.upgrades.discovered).map((id) => [id, true])) as typeof game.upgrades.discovered,
        },
      },
    });
  });

  const shop = page.getByRole('region', { name: 'Shop' });
  for (const id of ['aiDeveloper', 'autoAssign', 'autoSubmit', 'autoComplete']) {
    const item = shop.locator(`li[data-upgrade="${id}"]`);
    await item.getByRole('button', { name: 'Buy' }).click();
    await expect(item).toHaveCount(0);
  }
  await expect(page.getByTestId('credits')).toHaveText('1,160 Credits');

  const automation = page.getByRole('region', { name: 'Automation' });
  await expect(automation.getByRole('progressbar')).toHaveCount(1);
  for (const [column, name] of [['todo', 'Auto Assign'], ['inProgress', 'Auto Submit'], ['review', 'Auto Complete']]) {
    await expect(page.locator(`section[data-column="${column}"] header`).getByRole('progressbar', { name: `${name} timer` })).toBeVisible();
  }

  const tasksDone = page.getByTestId('tasks-done');
  await expect(tasksDone).toHaveText('3 tasks done');
  await expect(tasksDone).toHaveText(/^(?:[6-9]|\d{2,}) tasks done$/, { timeout: 20_000 });
  await expect(page.locator('section[data-column="done"] article').first()).toBeVisible();
});
