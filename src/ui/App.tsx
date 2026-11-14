import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export function App() {
  const { t } = useTranslation();
  const title = t('app.title');

  useEffect(() => {
    document.title = title;
  }, [title]);

  return <h1>{title}</h1>;
}
