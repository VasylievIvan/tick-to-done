import { expect, test } from '@playwright/test';
import { cardIn, completeCardManually, dragCard } from './helpers.ts';

test('the shop opens after the third task and Better Keyboard makes Work stronger', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  await expect(page.getByRole('region', { name: 'Shop' })).toHaveCount(0);
  for (const card of [1, 2, 3]) await completeCardManually(page, card);

  const shop = page.getByRole('region', { name: 'Shop' });
  await expect(shop).toBeVisible();
  await expect(shop.locator('li[data-upgrade]')).toHaveText([/Better Keyboard/, /AI Developer/, /Auto Assign/]);
  await expect(page.getByTestId('credits')).toHaveText('90 Credits');

  const keyboard = shop.locator('li[data-upgrade="betterKeyboard"]');
  await keyboard.getByRole('button', { name: 'Buy' }).click();
  await expect(page.getByTestId('credits')).toHaveText('60 Credits');
  await expect(keyboard).toContainText('Level 1');
  await expect(keyboard).toContainText('48 Credits');
  await expect(shop.locator('li[data-upgrade]')).toHaveCount(3);

  await expect(cardIn(page, 'todo', 4)).toBeVisible();
  await dragCard(page, 4, 'todo', 'inProgress');
  await cardIn(page, 'inProgress', 4).getByRole('button', { name: 'Work' }).click();
  await expect(cardIn(page, 'inProgress', 4)).toContainText(/Implementation: 2\/\d+/);
});
