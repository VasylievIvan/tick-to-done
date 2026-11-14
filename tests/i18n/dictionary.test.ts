import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { balance, upgradeIds } from '../../src/config/balance.ts';
import { columnIds } from '../../src/core/state.ts';
import { i18n } from '../../src/i18n/index.ts';
import { en } from '../../src/i18n/locales/en.ts';

type Dictionary = { readonly [key: string]: string | Dictionary };

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function leaves(dictionary: Dictionary, prefix = ''): [string, string][] {
  return Object.entries(dictionary).flatMap(([key, value]) =>
    typeof value === 'string' ? [[`${prefix}${key}`, value]] : leaves(value, `${prefix}${key}.`),
  );
}

const entries = leaves(en);
const baseKeys = new Set(entries.map(([key]) => key.replace(PLURAL_SUFFIX, '')));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const uiSources = sourceFiles(join(import.meta.dirname, '../../src/ui')).map((path) => readFileSync(path, 'utf8'));
const staticKeys = new Set(uiSources.flatMap((source) => [...source.matchAll(/\bt\(\s*'([^']+)'/g)].map((match) => match[1] ?? '')));
const keyPatterns = uiSources.flatMap((source) =>
  [...source.matchAll(/\bt\(\s*`([^`]+)`/g)].map(
    (match) => new RegExp(`^${(match[1] ?? '').replace(/\./g, '\\.').replace(/\$\{[^}]+\}/g, '[^.]+')}$`),
  ),
);

const actors = ['player', 'autoAssign', 'autoSubmit', 'autoComplete'] as const;

describe('dictionary', () => {
  it('has a name for every column, upgrade and task title', () => {
    for (const column of columnIds) expect(baseKeys.has(`board.column.${column}`), column).toBe(true);
    for (const id of upgradeIds) {
      expect(baseKeys.has(`shop.upgrade.${id}.name`), id).toBe(true);
      expect(baseKeys.has(`shop.upgrade.${id}.effect`), id).toBe(true);
    }
    expect(baseKeys.has(`card.title.${balance.taskTitleKey}`)).toBe(true);
  });

  it('has a template for every journal record kind and every actor', () => {
    for (const actor of actors) {
      expect(baseKeys.has(`journal.moved.${actor}`), actor).toBe(true);
      expect(baseKeys.has(`journal.completed.${actor}`), actor).toBe(true);
    }
    expect(baseKeys.has('journal.reviewPassed')).toBe(true);
    expect(baseKeys.has('journal.reviewReturned')).toBe(true);
  });

  it('uses every key it defines, either literally or through a key template in the interface', () => {
    expect(staticKeys.size).toBeGreaterThan(10);
    expect(keyPatterns.length).toBeGreaterThan(3);
    const unused = [...baseKeys].filter(
      (key) => !staticKeys.has(key) && !keyPatterns.some((pattern) => pattern.test(key)),
    );
    expect(unused).toEqual([]);
  });

  it('defines every key the interface uses literally', () => {
    expect([...staticKeys].filter((key) => !baseKeys.has(key))).toEqual([]);
  });

  it('fills every parameter of every template', () => {
    for (const [key, template] of entries) {
      const names = [...template.matchAll(/\{\{\s*([\w]+)/g)].map((match) => match[1] ?? '');
      const params = Object.fromEntries(names.map((name) => [name, name === 'card' || name === 'column' ? 'X' : 3]));
      const base = key.replace(PLURAL_SUFFIX, '');
      const count = key.endsWith('_one') ? 1 : 3;
      const text = i18n.t(base, { ...params, count });
      expect(text, key).not.toMatch(/\{\{|\}\}/);
      expect(text, key).not.toBe(base);
    }
  });

  it('contains no balance numbers: values are passed in from the core', () => {
    const withDigits = entries.filter(([, value]) => /\d/.test(value.replace(/\{\{[^}]*\}\}/g, '')));
    expect(withDigits).toEqual([]);
  });
});
