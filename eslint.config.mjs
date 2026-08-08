import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'vite-template-temp/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
    },
  },
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['**/app/**', '**/application/**', '**/features/**', '**/infrastructure/**'],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['**/app/**', '**/features/**', '**/infrastructure/**'] },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/infrastructure/**'] }],
    },
  },
  {
    files: ['src/app/**/*.tsx', 'src/features/**/*.tsx', 'src/shared/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\S/]',
          message: 'User-visible JSX text must come from a keyed translation resource.',
        },
        {
          selector:
            'JSXAttribute[name.name=/^(alt|aria-label|aria-description|placeholder|title)$/] > Literal[value=/\\S/]',
          message: 'User-visible accessibility text must come from a keyed translation resource.',
        },
      ],
    },
  },
  {
    files: ['e2e/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['**/*.{js,mjs,cjs}'],
  },
  prettier,
);
