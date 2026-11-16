import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createCard, createInitialState, type Card, type ColumnId } from '../../core/state.ts';
import { renderGame } from '../../test/renderGame.tsx';
import { testRules } from '../../test/testRules.ts';
import { CardView } from './CardView.tsx';

function card(overrides: Partial<Card> & { complexity?: number; number?: number } = {}): Card {
  const { complexity = 10, number = 1, ...rest } = overrides;
  return { ...createCard(testRules, number, complexity, null), ...rest };
}

function renderCard(value: Card, column: ColumnId) {
  const { container } = renderGame(createInitialState(testRules, 1), <CardView card={value} column={column} />);
  const element = container.querySelector('article');
  if (!element) throw new Error('card not rendered');
  return element;
}

/** Visible lines of the card in order, as the rules describe them. */
function lines(element: HTMLElement): string[] {
  return [...element.querySelectorAll<HTMLElement>(':scope > *')].flatMap((child) => {
    const labels = [...child.querySelectorAll<HTMLElement>('[role="progressbar"]')];
    if (labels.length > 0) return [child.textContent];
    const button = child.querySelector('button');
    return button ? [`[${button.textContent}]`] : [child.textContent];
  });
}

describe('card view', () => {
  it('shows only number, title and complexity in To Do, with no buttons', () => {
    const element = renderCard(card(), 'todo');
    expect(lines(element)).toEqual(['Task 0001', 'Another task', 'Complexity: 10']);
    expect(within(element).queryByRole('button')).toBeNull();
  });

  it('shows the implementation bar and Work in In Progress', () => {
    const element = renderCard(card({ implementationDone: 3 }), 'inProgress');
    expect(lines(element)).toEqual(['Task 0001', 'Another task', 'Implementation: 3/10', '[Work]']);
    expect(within(element).getByRole('button', { name: 'Work' })).toBeEnabled();
    expect(within(element).getByRole('progressbar', { name: 'Implementation: 3/10' })).toHaveAttribute(
      'aria-valuenow',
      '3',
    );
  });

  it('disables Work once the implementation bar is full', () => {
    const element = renderCard(card({ implementationDone: 10 }), 'inProgress');
    expect(within(element).getByRole('button', { name: 'Work' })).toBeDisabled();
  });

  it('shows the return label and a separate rework bar under the full implementation', () => {
    const returned = card({ number: 3, complexity: 20, implementationDone: 20, reworkRequired: 6, reworkDone: 1, returnCount: 1 });
    const element = renderCard(returned, 'inProgress');
    expect(lines(element)).toEqual([
      'Task 0003',
      'Another task',
      'Returned from review',
      'Implementation: 20/20',
      'Rework: 1/6',
      '[Work]',
    ]);
    expect(within(element).getByRole('button', { name: 'Work' })).toBeEnabled();
  });

  it('shows the return label and the rework bar already in To Do, without buttons', () => {
    const returned = card({ number: 3, complexity: 20, implementationDone: 20, reworkRequired: 6, returnCount: 1 });
    const element = renderCard(returned, 'todo');
    expect(lines(element)).toEqual(['Task 0003', 'Another task', 'Returned from review', 'Implementation: 20/20', 'Rework: 0/6']);
    expect(within(element).queryByRole('button')).toBeNull();
  });

  it('shows the review bar while the review runs and the approval once accepted', () => {
    const running = renderCard(card({ implementationDone: 10, review: { status: 'running', elapsedUs: 500_000 } }), 'review');
    expect(lines(running)).toEqual(['Task 0001', 'Another task', 'In review']);
    expect(within(running).getByRole('progressbar', { name: 'In review' })).toHaveAttribute('aria-valuenow', '500000');

    const accepted = renderCard(card({ implementationDone: 10, review: { status: 'accepted' } }), 'review');
    expect(lines(accepted)).toEqual(['Task 0001', 'Another task', 'Approved+20 Credits']);
    expect(within(accepted).getByText('+20 Credits')).toBeInTheDocument();
    expect(within(accepted).queryByRole('button')).toBeNull();
  });

  it('shows only number and title in Done', () => {
    const element = renderCard(card({ implementationDone: 10, doneAtUs: 0 }), 'done');
    expect(lines(element)).toEqual(['Task 0001', 'Another task']);
  });

  it('keeps at least four digits in the number and grows past 9999', () => {
    renderGame(
      createInitialState(testRules, 1),
      <>
        <CardView card={card({ number: 21 })} column="todo" />
        <CardView card={card({ number: 10000 })} column="todo" />
      </>,
    );
    expect(screen.getByText('Task 0021')).toBeInTheDocument();
    expect(screen.getByText('Task 10000')).toBeInTheDocument();
  });
});
