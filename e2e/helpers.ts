import { expect, type Locator, type Page } from '@playwright/test';

export type ColumnId = 'todo' | 'inProgress' | 'review' | 'done';

export function column(page: Page, id: ColumnId): Locator {
  return page.locator(`section[data-column="${id}"]`);
}

export function cardIn(page: Page, id: ColumnId, card: number): Locator {
  return column(page, id).locator(`article[data-card="${card}"]`);
}

/** Drags with real pointer events: press on the card, move past the activation distance, release over the column. */
export async function dragCard(page: Page, card: number, from: ColumnId, to: ColumnId): Promise<void> {
  const source = await cardIn(page, from, card).boundingBox();
  const target = await column(page, to).boundingBox();
  if (!source || !target) throw new Error(`Cannot drag Task ${card} from ${from} to ${to}`);
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 4, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height - 80, { steps: 12 });
  await page.mouse.up();
  // dnd-kit swallows clicks for 50 ms after a drag ends so that the release does not click what is under it.
  await page.waitForTimeout(80);
}

/** Clicks Work until it becomes disabled; returns the number of clicks. */
export async function workUntilFinished(page: Page, card: number): Promise<number> {
  const work = cardIn(page, 'inProgress', card).getByRole('button', { name: 'Work' });
  let clicks = 0;
  while (await work.isEnabled()) {
    await work.click();
    clicks += 1;
  }
  return clicks;
}

/** Waits for the review of a card to finish; returns whether it was accepted (otherwise it went back to To Do). */
export async function awaitReview(page: Page, card: number): Promise<'accepted' | 'returned'> {
  const approved = cardIn(page, 'review', card).getByText('Approved');
  const returned = cardIn(page, 'todo', card);
  await expect(approved.or(returned)).toBeVisible({ timeout: 10_000 });
  return (await returned.count()) > 0 ? 'returned' : 'accepted';
}

/** Takes a card from To Do through Work and Code Review until it is accepted, then to Done; returns all Work clicks. */
export async function completeCardManually(page: Page, card: number): Promise<number> {
  let clicks = 0;
  for (;;) {
    await dragCard(page, card, 'todo', 'inProgress');
    clicks += await workUntilFinished(page, card);
    await dragCard(page, card, 'inProgress', 'review');
    if ((await awaitReview(page, card)) === 'accepted') break;
  }
  await dragCard(page, card, 'review', 'done');
  await expect(cardIn(page, 'done', card)).toBeVisible();
  return clicks;
}
