import { AutomationPanel } from './automation/AutomationPanel.tsx';
import { Board } from './board/Board.tsx';
import { useGame, useHasJournal } from './GameContext.tsx';
import styles from './GameScreen.module.css';
import { JournalPanel } from './journal/JournalPanel.tsx';
import { Shop } from './shop/Shop.tsx';
import { StatsBar } from './stats/StatsBar.tsx';

export function GameScreen() {
  const balanceRevealed = useGame((game) => game.scenario.revealed.balance);
  const shopRevealed = useGame((game) => game.scenario.revealed.shop);
  const hasJournal = useHasJournal();
  return (
    <div className={styles.screen}>
      {balanceRevealed && (
        <header className={styles.topBar} data-testid="top-bar">
          <StatsBar />
        </header>
      )}
      <main className={styles.main}>
        <div className={styles.boardArea}>
          <Board />
        </div>
        {(shopRevealed || hasJournal) && (
          <aside className={styles.sidebar}>
            <AutomationPanel />
            {shopRevealed && <Shop />}
            <JournalPanel />
          </aside>
        )}
      </main>
    </div>
  );
}
