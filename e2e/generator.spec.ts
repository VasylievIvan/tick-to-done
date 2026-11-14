import { expect, test } from '@playwright/test';
import { cardIn, column, completeCardManually } from './helpers.ts';

test('regular tasks flow into To Do after the scripted tasks until ToDoLimit', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  for (const card of [1, 2, 3]) await completeCardManually(page, card);

  await expect(cardIn(page, 'todo', 4)).toBeVisible();
  await expect(cardIn(page, 'todo', 4)).toContainText(/Task 0004\s*Another task\s*Complexity: (1\d|2\d|30)/);
  await expect(cardIn(page, 'todo', 5)).toBeVisible();
  await expect(column(page, 'todo').locator('article')).toHaveCount(5);

  await page.waitForTimeout(1_500);
  await expect(column(page, 'todo').locator('article')).toHaveCount(5);
  await expect(cardIn(page, 'todo', 9)).toHaveCount(0);
});
