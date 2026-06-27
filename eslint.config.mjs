import { fixupPluginRules } from '@eslint/compat';
import js from '@eslint/js';
import globals from 'globals';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const typescriptRecommendedRules = {
  ...js.configs.recommended.rules,
  ...tsPlugin.configs.recommended.rules,
  // TypeScript already validates type-only names such as React, JSX, Electron, and NodeJS.
  'no-undef': 'off',
  // The current codebase still uses explicit gateway/IPC payload shapes in a few broad surfaces.
  '@typescript-eslint/no-explicit-any': 'warn',
};

const reactHooksRules = {
  ...reactHooksPlugin.configs.recommended.rules,
  // These rules target React Compiler readiness. This app is React 18 and does not enable the compiler yet.
  'react-hooks/immutability': 'off',
  'react-hooks/preserve-manual-memoization': 'off',
  'react-hooks/purity': 'off',
  'react-hooks/set-state-in-effect': 'off',
};

export default [
  {
    ignores: ['dist/', 'dist-electron/', 'release/', 'node_modules/'],
  },

  // Electron main process files
  {
    files: ['electron/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...typescriptRecommendedRules,
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Renderer (React) files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': fixupPluginRules(reactHooksPlugin),
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...typescriptRecommendedRules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksRules,
      'no-console': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
    },
  },

  // Test files - allow require() and node globals
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...typescriptRecommendedRules,
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
];
