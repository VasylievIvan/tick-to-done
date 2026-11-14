import { expect, test } from '@playwright/test';
import { awaitReview, dragCard, workUntilFinished } from './helpers.ts';

test('the activity journal records moves, review results and completions, but not Work clicks', async ({ page }) => {
  await page.goto('/?seed=1&speed=4');
  const journal = page.getByRole('region', { name: 'Activity' });
  await expect(journal).toHaveCount(0);

  await dragCard(page, 1, 'todo', 'inProgress');
  await expect(journal.getByRole('listitem')).toHaveText(['You moved Task 0001 to In Progress']);

  await workUntilFinished(page, 1);
  await expect(journal.getByRole('listitem')).toHaveCount(1);

  await dragCard(page, 1, 'inProgress', 'review');
  expect(await awaitReview(page, 1)).toBe('accepted');
  await dragCard(page, 1, 'review', 'done');

  await expect(journal.getByRole('listitem')).toHaveText([
    'You completed Task 0001',
    'Task 0001 passed review',
    'You moved Task 0001 to Code Review',
    'You moved Task 0001 to In Progress',
  ]);
});
