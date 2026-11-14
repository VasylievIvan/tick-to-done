import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { i18n } from '../i18n/index.ts';
import { en } from '../i18n/locales/en.ts';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the title from the dictionary', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: en.app.title })).toBeInTheDocument();
    expect(document.title).toBe(en.app.title);
  });
});
