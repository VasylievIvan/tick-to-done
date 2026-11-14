import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const layerImport = (layers, message) =>
  layers.map((layer) => ({ regex: `(^|/)${layer}(/|$)`, message }));

const browserAndClockGlobals = [
  'Date',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'setImmediate',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'performance',
  'crypto',
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'indexedDB',
].map((name) => ({ name, message: 'The core is deterministic: time and randomness come from the engine inputs.' }));

const userFacingAttributes = '/^(title|alt|placeholder|label|aria-label|aria-description|aria-roledescription|aria-valuetext)$/';
const dictionaryMessage = 'Visible text must come from the i18n dictionary by key.';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['eslint.config.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.tsx'],
    extends: [reactHooks.configs.flat.recommended],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'JSXText[value=/\\S/]', message: dictionaryMessage },
        { selector: 'JSXExpressionContainer > Literal[value=/\\S/]', message: dictionaryMessage },
        { selector: 'JSXExpressionContainer > TemplateLiteral', message: dictionaryMessage },
        { selector: `JSXAttribute[name.name=${userFacingAttributes}] > Literal`, message: dictionaryMessage },
        {
          selector: `JSXAttribute[name.name=${userFacingAttributes}] > JSXExpressionContainer > :matches(Literal, TemplateLiteral)`,
          message: dictionaryMessage,
        },
      ],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'zustand', 'i18next', 'react-i18next', '@dnd-kit/core', '@dnd-kit/sortable'].map(
            (name) => ({ name, message: 'The core does not depend on UI, store or localization libraries.' }),
          ),
          patterns: layerImport(['ui', 'app', 'i18n', 'dev'], 'Layers depend one way: ui -> app -> core.'),
        },
      ],
      'no-restricted-globals': ['error', ...browserAndClockGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the seeded generator from core/rng.' },
      ],
    },
  },
  {
    files: ['src/app/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: layerImport(['ui', 'i18n'], 'The app layer carries data, not UI or text.') },
      ],
    },
  },
  {
    files: ['src/config/**/*.ts', 'src/i18n/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: layerImport(['ui', 'app', 'core', 'dev'], 'Config and dictionaries are leaf modules.') },
      ],
    },
  },
]);
