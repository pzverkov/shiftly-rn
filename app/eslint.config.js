// Flat config, which is the only format ESLint 9 reads.
//
// Pinned to the ESLint 9 line rather than 10: `eslint-config-expo` still bundles an
// `eslint-plugin-react` that crashes on 10's rule context API. Expo's config carries
// the React, React Hooks, and React Native rules matched to this SDK, so what follows
// is only what it leaves open. `eslint-config-prettier` goes last to switch off
// stylistic rules that would fight the formatter: layout is Prettier's job,
// correctness is ESLint's.
const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');
const tseslint = require('typescript-eslint');

module.exports = [
  { ignores: ['node_modules/', '.expo/', 'docs/api/', 'dist/', 'expo-env.d.ts'] },

  ...expo,
  ...tseslint.configs.recommended,
  prettier,

  {
    rules: {
      // `_`-prefixed args stay legal so a signature can document a parameter it
      // deliberately ignores.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // No allowlist on purpose. Diagnostics belong in src/telemetry/report.ts,
      // which is the seam a real crash reporter plugs into; the two places that
      // legitimately write to the console carry a disable that says why.
      'no-console': 'error',
    },
  },

  {
    // Tooling config and jest setup run in Node under CommonJS, not in the app bundle.
    files: ['*.config.js', 'jest.setup.js', 'eslint.config.js'],
    languageOptions: {
      globals: { __dirname: 'readonly', module: 'writable', require: 'readonly', jest: 'readonly' },
    },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    // Tests reach for `require` on purpose: re-importing a module inside
    // `jest.isolateModules` is how the locale and telemetry singletons get
    // re-evaluated per case, and an ESM import cannot do that. Hook rules are off
    // for the same reason - a test harness calls hooks from plain helpers.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  {
    // The benchmark is a standalone Node script whose entire output is the console.
    files: ['**/*.bench.mts'],
    rules: { 'no-console': 'off' },
  },
];
