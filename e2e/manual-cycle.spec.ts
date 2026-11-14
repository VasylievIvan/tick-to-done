import { expect, test } from '@playwright/test';
import { awaitReview, cardIn, column, completeCardManually, dragCard, workUntilFinished } from './helpers.ts';

test.describe('manual cycle in the browser', () => {
  test('plays the three scripted tasks with the mouse', async ({ page }) => {
    await page.goto('/?seed=1');
    await expect(page).toHaveTitle('Tick to Done');

    // Initial screen: To Do and In Progress, one card without buttons, no balance.
    await expect(page.locator('section[data-column]')).toHaveCount(2);
    await expect(cardIn(page, 'todo', 1)).toHaveText(/Task 0001\s*Another task\s*Complexity: 10/);
    await expect(page.locator('button')).toHaveCount(0);
    await expect(page.getByTestId('credits')).toHaveCount(0);

    // Task 1: drag, Work ×10, Code Review appears, drag, review passes, Done appears, drag, balance appears.
    await dragCard(page, 1, 'todo', 'inProgress');
    await expect(cardIn(page, 'inProgress', 1)).toContainText('Implementation: 0/10');
    await expect(column(page, 'review')).toHaveCount(0);
    expect(await workUntilFinished(page, 1)).toBe(10);
    await expect(cardIn(page, 'inProgress', 1).getByRole('button', { name: 'Work' })).toBeDisabled();
    await expect(column(page, 'review')).toBeVisible();
    await expect(column(page, 'done')).toHaveCount(0);

    await dragCard(page, 1, 'inProgress', 'review');
    await expect(cardIn(page, 'review', 1)).toContainText('In review');
    expect(await awaitReview(page, 1)).toBe('accepted');
    await expect(column(page, 'done')).toBeVisible();
    await expect(page.getByTestId('credits')).toHaveCount(0);

    await dragCard(page, 1, 'review', 'done');
    await expect(cardIn(page, 'done', 1)).toBeVisible();
    await expect(page.getByTestId('credits')).toHaveText('20 Credits');
    await expect(page.getByTestId('tasks-done')).toHaveText('1 task done');

    // Task 2 appears after task 1 reaches Done.
    await expect(cardIn(page, 'todo', 2)).toContainText('Complexity: 15');
    await completeCardManually(page, 2);
    await expect(page.getByTestId('credits')).toHaveText('50 Credits');
    await expect(page.getByTestId('tasks-done')).toHaveText('2 tasks done');

    // Task 3: its first review returns it with a label and a rework bar visible already in To Do.
    await expect(cardIn(page, 'todo', 3)).toContainText('Complexity: 20');
    await dragCard(page, 3, 'todo', 'inProgress');
    expect(await workUntilFinished(page, 3)).toBe(20);
    await dragCard(page, 3, 'inProgress', 'review');
    expect(await awaitReview(page, 3)).toBe('returned');
    const returned = cardIn(page, 'todo', 3);
    await expect(returned).toContainText('Returned from review');
    await expect(returned).toContainText('Implementation: 20/20');
    await expect(returned).toContainText(/Rework: 0\/[4-8]/);
    await expect(returned.getByRole('button')).toHaveCount(0);

    const reworkClicks = await completeCardManually(page, 3);
    expect(reworkClicks).toBeGreaterThanOrEqual(4);
    await expect(page.getByTestId('credits')).toHaveText('90 Credits');
    await expect(page.getByTestId('tasks-done')).toHaveText('3 tasks done');
    await expect(column(page, 'done').locator('article')).toHaveCount(3);
    const doneOrder = await column(page, 'done').locator('article').evaluateAll((cards) =>
      cards.map((card) => card.getAttribute('data-card')),
    );
    expect(doneOrder).toEqual(['3', '2', '1']);
  });

  test('does not let Done cards be dragged', async ({ page }) => {
    await page.goto('/?seed=1&speed=8');
    await completeCardManually(page, 1);
    await expect(cardIn(page, 'done', 1)).not.toHaveAttribute('aria-roledescription');
    const source = await cardIn(page, 'done', 1).boundingBox();
    const target = await column(page, 'review').boundingBox();
    if (!source || !target) throw new Error('missing layout');
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 120, { steps: 12 });
    await expect(page.locator('article[data-card="1"]')).toHaveCount(1);
    await page.mouse.up();
    await expect(cardIn(page, 'done', 1)).toBeVisible();
    await expect(page.getByTestId('credits')).toHaveText('20 Credits');
  });

  test('cancels a drop backwards and keeps the card in place', async ({ page }) => {
    await page.goto('/?seed=1');
    await dragCard(page, 1, 'todo', 'inProgress');
    await dragCard(page, 1, 'inProgress', 'todo');
    await expect(cardIn(page, 'inProgress', 1)).toBeVisible();
    await expect(cardIn(page, 'todo', 1)).toHaveCount(0);
  });

  test('starts a new session on reload', async ({ page }) => {
    await page.goto('/?seed=1');
    await dragCard(page, 1, 'todo', 'inProgress');
    await workUntilFinished(page, 1);
    await expect(column(page, 'review')).toBeVisible();
    await page.reload();
    await expect(page.locator('section[data-column]')).toHaveCount(2);
    await expect(cardIn(page, 'todo', 1)).toContainText('Complexity: 10');
    await expect(page.locator('button')).toHaveCount(0);
  });

  test('pauses while the tab is hidden and resumes from the same point', async ({ page }) => {
    await page.goto('/?seed=1');
    await dragCard(page, 1, 'todo', 'inProgress');
    await workUntilFinished(page, 1);
    await dragCard(page, 1, 'inProgress', 'review');
    await expect(cardIn(page, 'review', 1)).toContainText('In review');

    const setHidden = (hidden: boolean) =>
      page.evaluate((value) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (value ? 'hidden' : 'visible') });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    const progress = () =>
      cardIn(page, 'review', 1).getByRole('progressbar').getAttribute('aria-valuenow').then(Number);

    await setHidden(true);
    const before = await progress();
    await page.waitForTimeout(2_500);
    expect(await progress()).toBe(before);
    await expect(cardIn(page, 'review', 1)).toContainText('In review');

    await setHidden(false);
    expect(await awaitReview(page, 1)).toBe('accepted');
  });
});
