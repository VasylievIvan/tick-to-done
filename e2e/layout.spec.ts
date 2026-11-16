import { expect, test } from '@playwright/test';

/** Fills the board and the shop far beyond one screen through the development hook. */
async function overfill(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__vibecode?.store;
    if (!store) throw new Error('development hooks are missing');
    const { game } = store.getState();
    const numbers = Array.from({ length: 40 }, (_, index) => index + 1);
    const cards = Object.fromEntries(
      numbers.map((number) => [
        number,
        {
          number,
          titleKey: 'anotherTask' as const,
          originalComplexity: 20,
          implementationDone: number > 20 ? 20 : 0,
          reworkRequired: 0,
          reworkDone: 0,
          returnCount: 0,
          review: { status: 'none' as const },
          scriptedReview: null,
          doneAtUs: null,
        },
      ]),
    );
    const discovered = Object.fromEntries(Object.keys(game.upgrades.discovered).map((id) => [id, true]));
    store.setState({
      game: {
        ...game,
        cards,
        columns: { todo: numbers.slice(0, 20), inProgress: numbers.slice(20), review: [], done: [] },
        nextCardNumber: 41,
        economy: { ...game.economy, credits: 1_000_000, completedTasks: 3 },
        upgrades: {
          ...game.upgrades,
          owned: { aiDeveloper: false, autoAssign: false, autoSubmit: false, autoComplete: false },
          discovered: discovered as typeof game.upgrades.discovered,
        },
        scenario: {
          scriptedTasksIssued: 3,
          revealed: { codeReview: true, done: true, balance: true, shop: true },
          spawnerEnabled: false,
        },
      },
    });
  });
}

test.describe('screen layout', () => {
  test.use({ viewport: { width: 1280, height: 600 } });

  test('the page never scrolls; columns and the side panel scroll on their own', async ({ page }) => {
    await page.goto('/?seed=5');
    await overfill(page);
    await expect(page.locator('article[data-card]')).toHaveCount(40);

    const pageSize = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      width: document.documentElement.scrollWidth,
      view: window.innerHeight,
      viewWidth: window.innerWidth,
    }));
    expect(pageSize.scroll).toBeLessThanOrEqual(pageSize.view);
    expect(pageSize.width).toBeLessThanOrEqual(pageSize.viewWidth);

    const todo = page.locator('section[data-column="todo"]');
    const review = page.locator('section[data-column="review"]');
    const todoBox = await todo.boundingBox();
    const reviewBox = await review.boundingBox();
    expect(todoBox?.height).toBe(reviewBox?.height);

    const cards = todo.locator('> div');
    const scroller = await cards.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
    }));
    expect(scroller.overflowY).toBe('auto');
    expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);

    await cards.hover();
    await page.mouse.wheel(0, 2000);
    await expect(todo.locator('article[data-card="20"]')).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const sidebar = page.getByTestId('sidebar');
    const side = await sidebar.evaluate((element) => ({
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
    }));
    expect(side.scrollHeight).toBeGreaterThan(side.clientHeight);
    await sidebar.hover();
    await page.mouse.wheel(0, 3000);
    await expect(page.locator('li[data-upgrade="biggerTasks"]')).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    const footer = page.locator('footer');
    await expect(footer).toBeInViewport();
    await expect(footer).toContainText(/Tick to Done v\d+\.\d+\.\d+/);
    await expect(footer.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/VasylievIvan/tick-to-done',
    );
  });

  test('a sideways scroll over a column moves the board, not the cards inside it', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto('/?seed=5');
    await overfill(page);
    const area = page.getByTestId('board-area');
    const width = await area.evaluate((element) => ({ scroll: element.scrollWidth, client: element.clientWidth }));
    expect(width.scroll).toBeGreaterThan(width.client);
    await page.locator('section[data-column="todo"] > div').hover();
    await page.mouse.wheel(300, 0);
    await expect.poll(() => area.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    expect(await page.locator('section[data-column="todo"] > div').evaluate((element) => element.scrollLeft)).toBe(0);
  });

  test('a card still drops into a column whose list is scrolled', async ({ page }) => {
    await page.goto('/?seed=5');
    await overfill(page);
    const todo = page.locator('section[data-column="todo"]');
    await todo.locator('> div').hover();
    await page.mouse.wheel(0, 2000);
    const card = todo.locator('article[data-card="20"]');
    await expect(card).toBeInViewport();
    const source = await card.boundingBox();
    const target = await page.locator('section[data-column="inProgress"]').boundingBox();
    if (!source || !target) throw new Error('layout is missing');
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2 + 4, { steps: 3 });
    await page.mouse.move(target.x + target.width / 2, target.y + 80, { steps: 12 });
    await page.mouse.up();
    await expect(page.locator('section[data-column="inProgress"] article[data-card="20"]')).toBeAttached();
  });
});
