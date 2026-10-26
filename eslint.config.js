import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'playwright-report', 'test-results', 'node_modules', '.vercel'],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.strict,
    languageOptions: { ...jsxA11y.flatConfigs.strict.languageOptions, globals: globals.browser },
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      // Labels wrap rich content (badges, amounts); allow the text to sit a few elements deep.
      'jsx-a11y/label-has-associated-control': ['error', { depth: 5 }],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      // The core is shared with the server and must stay framework- and DOM-free.
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-dom', '../state/*', '../features/*'] },
      ],
    },
  },
  {
    // Mocks are passed around unbound and indexed results are asserted on, which is idiomatic in tests.
    files: ['**/*.test.{ts,tsx}', 'tests/**'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },
);
