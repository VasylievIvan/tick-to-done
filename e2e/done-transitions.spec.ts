import { expect, test } from '@playwright/test';

test('a card entering Done opens its slot and drops in, the card it pushes out fades away over a second', async ({ page }) => {
  await page.goto('/?seed=5');
  await page.evaluate(() => {
    const store = window.__vibecode?.store;
    if (!store) throw new Error('development hooks are missing');
    const { game } = store.getState();
    const card = (number: number, accepted: boolean) => ({
      number,
      titleKey: 'anotherTask' as const,
      originalComplexity: 10,
      implementationDone: 10,
      reworkRequired: 0,
      reworkDone: 0,
      returnCount: 0,
      review: accepted ? { status: 'accepted' as const } : { status: 'none' as const },
      scriptedReview: null,
      doneAtUs: accepted ? null : 0,
    });
    store.setState({
      game: {
        ...game,
        cards: Object.fromEntries([1, 2, 3, 4, 5, 6].map((number) => [number, card(number, number === 1)])),
        columns: { todo: [], inProgress: [], review: [1], done: [2, 3, 4, 5, 6] },
        nextCardNumber: 7,
        economy: { ...game.economy, completedTasks: 5 },
        scenario: {
          scriptedTasksIssued: 3,
          revealed: { codeReview: true, done: true, balance: true, shop: true },
          spawnerEnabled: false,
        },
      },
    });
  });
  await expect(page.locator('section[data-column="done"] article')).toHaveCount(5);

  const opacities = await page.evaluate(async () => {
    const store = window.__vibecode?.store as unknown as { getState: () => { dispatch: (command: unknown) => boolean } };
    store.getState().dispatch({ type: 'moveCard', card: 1, from: 'review', to: 'done', index: 0 });
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const opacity = () => {
      const element = document.querySelector('[data-leaving]');
      return element ? Number(getComputedStyle(element).opacity) : null;
    };
    const slot = () => document.querySelector('[data-arriving]')?.getBoundingClientRect().height ?? null;
    await wait(50);
    const early = opacity();
    const openingSlot = slot();
    const fullCard = document.querySelector('section[data-column="done"] article[data-card="2"]')?.getBoundingClientRect().height ?? 0;
    await wait(450);
    const middle = opacity();
    await wait(700);
    return { early, middle, late: opacity(), openingSlot, fullCard, slotAfter: slot() };
  });
  expect(opacities.early).toBeGreaterThan(0.6);
  expect(opacities.middle).toBeLessThan(opacities.early ?? 0);
  expect(opacities.middle).toBeGreaterThan(0);
  expect(opacities.late).toBeNull();
  expect(opacities.openingSlot).toBeGreaterThan(0);
  expect(opacities.openingSlot).toBeLessThan(opacities.fullCard);
  expect(opacities.slotAfter).toBeNull();
  await expect(page.locator('section[data-column="done"] article').first()).toHaveAttribute('data-card', '1');
  await expect(page.locator('section[data-column="done"] article[data-card="6"]')).toHaveCount(0);
});
