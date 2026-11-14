import { act } from '@testing-library/react';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en.ts';
import { renderGame } from '../test/renderGame.tsx';
import { showcaseState } from '../test/showcaseState.ts';
import { GameScreen } from './GameScreen.tsx';

type Dictionary = { readonly [key: string]: string | Dictionary };

function wrapEveryString(dictionary: Dictionary): Dictionary {
  return Object.fromEntries(
    Object.entries(dictionary).map(([key, value]) => [key, typeof value === 'string' ? `⟦${value}⟧` : wrapEveryString(value)]),
  );
}

async function pseudoLocale() {
  const instance = i18next.createInstance();
  await instance.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: false,
    resources: { en: { translation: wrapEveryString(en) } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

/** Numbers formatted by locale are not text; everything else must come from the dictionary. */
const NUMBER = /^[\d\s.,\u00a0]+$/;

async function renderShowcase() {
  const rendered = renderGame(showcaseState(), <GameScreen />, await pseudoLocale());
  act(() => {
    rendered.store.setState({
      journal: [
        { id: 0, kind: 'moved', card: 10, to: 'inProgress', by: 'player' },
        { id: 1, kind: 'moved', card: 11, to: 'review', by: 'autoSubmit' },
        { id: 2, kind: 'reviewPassed', card: 15 },
        { id: 3, kind: 'reviewReturned', card: 11, rework: 3 },
        { id: 4, kind: 'completed', card: 17, by: 'autoComplete' },
      ],
      journalWritten: 5,
    });
  });
  return rendered;
}

describe('localization', () => {
  it('renders no visible text outside the dictionary on a board with every element revealed', async () => {
    const { container } = await renderShowcase();
    const walker = document.createTreeWalker(container.ownerDocument.body, NodeFilter.SHOW_TEXT);
    const strays: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? '';
      if (text === '' || NUMBER.test(text)) continue;
      if (!(text.startsWith('⟦') && text.endsWith('⟧'))) strays.push(text);
    }
    expect(container.textContent).toContain('⟦');
    expect(container.querySelectorAll('section[aria-label]').length).toBeGreaterThanOrEqual(7);
    expect(strays).toEqual([]);
  });

  it('takes accessible names from the dictionary too', async () => {
    const { container } = await renderShowcase();
    const labelled = [...container.querySelectorAll('[aria-label], [aria-roledescription], [title], [alt], [placeholder]')];
    const strays = labelled.flatMap((element) =>
      ['aria-label', 'aria-roledescription', 'title', 'alt', 'placeholder'].flatMap((name) => {
        const value = element.getAttribute(name);
        return value !== null && !(value.startsWith('⟦') && value.endsWith('⟧')) ? [`${name}=${value}`] : [];
      }),
    );
    expect(labelled.length).toBeGreaterThan(0);
    expect(strays).toEqual([]);
  });
});
