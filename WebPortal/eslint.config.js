// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import importXPlugin from 'eslint-plugin-import-x';

/** @type {import('eslint').Linter.Config[]} */
export default tseslint.config(
  // Global ignores
  {
    ignores: [
      'dist/',
      'dist-electron/',
      'release/',
      'node_modules/',
      '_legacy_archive/',
      'public/',
      'wasm/',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.js',
      'tools/',
    ],
  },

  // Base JS recommended
  js.configs.recommended,

  // TypeScript strict + stylistic
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  // React + hooks plugin
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'import-x': importXPlugin,
    },
    settings: {
      react: {
        version: '19.0',
      },
    },
    rules: {
      // React recommended
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // React 19 with react-jsx transform — no import needed
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      'react/prop-types': 'off', // We use TypeScript

      // ---- Strict rules ----

      // No console (warn only, allow dedicated logger methods)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // No unused variables (error, underscore prefix = intentional)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // No explicit any (warn → can escalate to error later)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Additional strictness
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-require-imports': 'error',

      // Ban ts-ignore (use ts-expect-error with description)
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
        },
      ],

      // Import ordering (on src files)
      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
    },
  },

  // Override for test files — relaxed rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.bench.ts', '**/*.spec.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Override for vite config and scripts
  {
    files: ['vite.config.ts', 'scripts/**/*'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);