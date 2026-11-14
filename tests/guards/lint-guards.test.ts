import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

// Snippets are linted as virtual files, so type-aware rules are switched off; the guarded rules are syntactic.
const eslint = new ESLint({
  overrideConfig: [{ files: ['**/*.ts', '**/*.tsx'], ...tseslint.configs.disableTypeChecked }],
});

async function ruleIdsFor(filePath: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath });
  if (!result) throw new Error(`No lint result for ${filePath}`);
  return result.messages.map((message) => message.ruleId ?? `fatal: ${message.message}`);
}

describe('lint guards', () => {
  it('accepts a clean core module', async () => {
    const ids = await ruleIdsFor('src/core/guard-sample.ts', 'export const double = (value: number): number => value * 2;\n');
    expect(ids).toEqual([]);
  });

  it('rejects a core import from the UI layer', async () => {
    const ids = await ruleIdsFor(
      'src/core/guard-sample.ts',
      "import { App } from '../ui/App.tsx';\nexport const app = App;\n",
    );
    expect(ids).toContain('no-restricted-imports');
  });

  it('rejects a core import from the app layer and from React', async () => {
    const fromApp = await ruleIdsFor('src/core/guard-sample.ts', "export { store } from '../app/store.ts';\n");
    const fromReact = await ruleIdsFor('src/core/guard-sample.ts', "export { useState } from 'react';\n");
    expect(fromApp).toContain('no-restricted-imports');
    expect(fromReact).toContain('no-restricted-imports');
  });

  it('rejects Math.random, Date and timers in the core', async () => {
    const random = await ruleIdsFor('src/core/guard-sample.ts', 'export const roll = (): number => Math.random();\n');
    const clock = await ruleIdsFor('src/core/guard-sample.ts', 'export const now = (): number => Date.now();\n');
    const timer = await ruleIdsFor('src/core/guard-sample.ts', 'setTimeout(() => undefined, 1);\n');
    expect(random).toContain('no-restricted-properties');
    expect(clock).toContain('no-restricted-globals');
    expect(timer).toContain('no-restricted-globals');
  });

  it('rejects an app import from the UI layer', async () => {
    const ids = await ruleIdsFor('src/app/guard-sample.ts', "export { App } from '../ui/App.tsx';\n");
    expect(ids).toContain('no-restricted-imports');
  });

  it('accepts markup that takes text from the dictionary', async () => {
    const ids = await ruleIdsFor(
      'src/ui/GuardSample.tsx',
      'export const Sample = ({ label }: { label: string }) => (\n  <p title={label} data-testid="sample">\n    {label}\n  </p>\n);\n',
    );
    expect(ids).toEqual([]);
  });

  it('rejects string literals in component markup', async () => {
    const text = await ruleIdsFor('src/ui/GuardSample.tsx', 'export const Sample = () => <p>Hello</p>;\n');
    const expression = await ruleIdsFor('src/ui/GuardSample.tsx', "export const Sample = () => <p>{'Hello'}</p>;\n");
    const attribute = await ruleIdsFor('src/ui/GuardSample.tsx', 'export const Sample = () => <p title="Hello" />;\n');
    expect(text).toContain('no-restricted-syntax');
    expect(expression).toContain('no-restricted-syntax');
    expect(attribute).toContain('no-restricted-syntax');
  });
});
