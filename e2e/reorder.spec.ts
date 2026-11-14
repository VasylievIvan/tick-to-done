import { expect, test } from '@playwright/test';
import { cardIn, column, completeCardManually } from './helpers.ts';

test('neighbours slide aside during a sort gesture and the order changes on release', async ({ page }) => {
  await page.goto('/?seed=5&speed=8');
  for (const card of [1, 2, 3]) await completeCardManually(page, card);
  await expect(cardIn(page, 'todo', 5)).toBeVisible();

  const dragged = cardIn(page, 'todo', 4);
  const neighbour = cardIn(page, 'todo', 5).locator('..');
  const from = await dragged.boundingBox();
  const to = await cardIn(page, 'todo', 5).boundingBox();
  if (!from || !to) throw new Error('missing layout');

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 5, { steps: 12 });

  await expect.poll(() => neighbour.evaluate((element) => element.style.transition)).toContain('transform');
  await expect.poll(() => neighbour.evaluate((element) => element.style.transform)).toMatch(/translate/);

  await page.mouse.up();
  const order = column(page, 'todo').locator('article[data-card]');
  await expect(order.nth(0)).toHaveAttribute('data-card', '5');
  await expect(order.nth(1)).toHaveAttribute('data-card', '4');
  await expect.poll(() => neighbour.evaluate((element) => element.style.transition)).toBe('');
});
