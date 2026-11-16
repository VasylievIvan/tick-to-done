import { AutomationPanel } from './automation/AutomationPanel.tsx';
import { Board } from './board/Board.tsx';
import { Footer } from './footer/Footer.tsx';
import { useGame } from './GameContext.tsx';
import styles from './GameScreen.module.css';
import { Shop } from './shop/Shop.tsx';
import { StatsBar } from './stats/StatsBar.tsx';

export function GameScreen() {
  const balanceRevealed = useGame((game) => game.scenario.revealed.balance);
  const shopRevealed = useGame((game) => game.scenario.revealed.shop);
  return (
    <div className={styles.screen}>
      {balanceRevealed && (
        <header className={styles.topBar} data-testid="top-bar">
          <StatsBar />
        </header>
      )}
      <main className={styles.main}>
        <div className={styles.boardArea} data-testid="board-area">
          <Board />
        </div>
        {shopRevealed && (
          <aside className={styles.sidebar} data-testid="sidebar">
            <AutomationPanel />
            <Shop />
          </aside>
        )}
      </main>
      <Footer />
    </div>
  );
}
