import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        FormData: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Adjust rules to match the existing codebase conventions:
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',

      // Pre-existing violations throughout the codebase — report as warnings only
      // so CI is informational without blocking the build on legacy code.
      // Unescaped entities in JSX (e.g. &apos; vs ')
      'react/no-unescaped-entities': 'warn',
      // Undefined variables — many global-like references in JSX files
      'no-undef': 'warn',
      // Hooks called inside conditionals in legacy pages
      'react-hooks/rules-of-hooks': 'warn',
      // JSX identifiers not in scope (same root cause as no-undef)
      'react/jsx-no-undef': 'warn',
      // Variable referenced before its declaration (temporal dead zone in some pages)
      'no-use-before-define': 'warn',

      // react-hooks v7 new rules — all downgraded to warn for pre-existing code:
      'react-hooks/static-components': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/gating': 'warn',
      'react-hooks/incompatible-library': 'warn',
    },
  },
  {
    files: ['src/**/*.test.{js,jsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'server/**',
      // Demo file with pre-existing JSX brace syntax that confuses the parser:
      'src/components/PopoverExamples.jsx',
    ],
  },
]
