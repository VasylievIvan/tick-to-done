import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GameSession } from '../app/session.ts';
import { GameStoreProvider } from './GameContext.tsx';
import { GameScreen } from './GameScreen.tsx';

export function App({ session }: { session: GameSession }) {
  const { t } = useTranslation();
  const title = t('app.title');

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => session.start(), [session]);

  return (
    <GameStoreProvider store={session.store}>
      <GameScreen />
    </GameStoreProvider>
  );
}
