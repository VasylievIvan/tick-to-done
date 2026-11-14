import { Board } from './board/Board.tsx';
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
        <header className={styles.topBar}>
          <StatsBar />
        </header>
      )}
      <main className={styles.main}>
        <div className={styles.boardArea}>
          <Board />
        </div>
        {shopRevealed && (
          <aside className={styles.sidebar}>
            <Shop />
          </aside>
        )}
      </main>
    </div>
  );
}
