import { Board } from './board/Board.tsx';
import { useGame } from './GameContext.tsx';
import styles from './GameScreen.module.css';
import { StatsBar } from './stats/StatsBar.tsx';

export function GameScreen() {
  const balanceRevealed = useGame((game) => game.scenario.revealed.balance);
  return (
    <div className={styles.screen}>
      {balanceRevealed && (
        <header className={styles.topBar}>
          <StatsBar />
        </header>
      )}
      <main className={styles.main}>
        <Board />
      </main>
    </div>
  );
}
