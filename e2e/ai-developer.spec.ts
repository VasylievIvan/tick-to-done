import { expect, test } from '@playwright/test';
import { cardIn, completeCardManually, dragCard } from './helpers.ts';

test('AI Developer works on In Progress by itself and shows its tick', async ({ page }) => {
  await page.goto('/?seed=5&speed=4');
  for (const card of [1, 2, 3]) await completeCardManually(page, card);
  await expect(cardIn(page, 'todo', 4)).toBeVisible();
  await completeCardManually(page, 4);

  const shop = page.getByRole('region', { name: 'Shop' });
  await expect(shop.locator('li[data-upgrade]')).not.toContainText(['AI Work Power']);
  const aiDeveloper = shop.locator('li[data-upgrade="aiDeveloper"]');
  await expect(aiDeveloper.getByRole('button', { name: 'Buy' })).toBeEnabled();
  await aiDeveloper.getByRole('button', { name: 'Buy' }).click();
  await expect(aiDeveloper).toHaveCount(0);
  await expect(shop.locator('li[data-upgrade="aiWorkPower"]')).toBeVisible();

  const automation = page.getByRole('region', { name: 'Automation' });
  await expect(automation).toBeVisible();
  const ring = automation.getByRole('progressbar', { name: 'AI Developer timer' });
  await expect(automation).toContainText('Idle');
  await expect(ring).toHaveAttribute('aria-valuenow', '0');

  await dragCard(page, 5, 'todo', 'inProgress');
  await expect(automation).toContainText('Working');
  await expect(cardIn(page, 'inProgress', 5)).toContainText(/Implementation: 4\/\d+/);
  await expect(cardIn(page, 'inProgress', 5)).toContainText(/Implementation: 8\/\d+/);
  await expect(cardIn(page, 'inProgress', 5).getByRole('button', { name: 'Work' })).toBeDisabled({ timeout: 10_000 });
  await expect(automation).toContainText('Idle');
});
