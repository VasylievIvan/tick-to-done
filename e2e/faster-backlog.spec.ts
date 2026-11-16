import { expect, test } from '@playwright/test';

test('Faster Backlog can be bought up to its minimum interval and then shows Max', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.evaluate(() => {
    const store = window.__vibecode?.store;
    if (!store) throw new Error('development hooks are missing');
    const { game } = store.getState();
    store.setState({
      game: {
        ...game,
        economy: { ...game.economy, credits: 100_000 },
        upgrades: { ...game.upgrades, discovered: { ...game.upgrades.discovered, fasterBacklog: true } },
        scenario: { ...game.scenario, revealed: { ...game.scenario.revealed, balance: true, shop: true } },
      },
    });
  });

  const item = page.getByRole('region', { name: 'Shop' }).locator('li[data-upgrade="fasterBacklog"]');
  await expect(item).toContainText('Faster Backlog');
  await expect(item).toContainText('New task every 3 s → 2.4 s');
  const buy = item.getByRole('button', { name: 'Buy' });
  for (let purchase = 0; purchase < 5; purchase += 1) await buy.click();

  await expect(item).toContainText('Level 5');
  await expect(item).toContainText('Max');
  await expect(item).toContainText('New task every 1 s');
  await expect(buy).toHaveCount(0);
});
