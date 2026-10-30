import js from '@eslint/js';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import unicorn from 'eslint-plugin-unicorn';

// Files that must stay free of page globals: the emulator package works with any host page.
// Only the adapter itself touches the browser (iframe, DOM events).
const PAGE_GLOBALS = ['window', 'document', 'location', 'localStorage', 'sessionStorage', 'navigator'];

export default [
  {
    ignores: [
      'public/**',
      'build/**',
      'node_modules/**',
      'artifacts/**',
      'test-results/**',
      'playwright-report/**',
      'coverage/**',
      'src/emulator/zx81/**', // vendored GPL-2.0 emulator, kept as upstream wrote it
      'packages/*/vendor/**',
      'packages/*/types/**',
      'tools/zxtext2p/**',
      'test/browser/__screenshots__/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    plugins: { 'import-x': importX, unicorn },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-console': 'error',
      'no-shadow': 'error',
      curly: ['error', 'multi-line'],
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-unresolved': 'error',
      'import-x/first': 'error',
      'import-x/no-self-import': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-add-event-listener': 'error',
      'unicorn/prefer-modern-dom-apis': 'error',
      'unicorn/prefer-number-properties': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/no-useless-undefined': 'error',
      'unicorn/throw-new-error': 'error',
      'unicorn/no-array-push-push': 'error',
      'unicorn/prefer-includes': 'error',
      'unicorn/prefer-string-slice': 'error',
      'unicorn/no-new-array': 'error',
    },
  },
  // code that runs in a page
  {
    files: ['src/web/**/*.js', 'src/emulator/**/*.js', 'packages/*/src/**/*.js', 'apps/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  // build tools, tests and configs run in Node; browser tests also send functions into the page
  {
    files: ['tools/**/*.js', 'test/**/*.js', '*.config.js'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' }, // command-line tools report to the terminal
  },
  {
    files: ['test/browser/**/*.js', 'tools/capture-screen.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-shadow': 'off' }, // page.evaluate callbacks reuse the names of outer helpers on purpose
  },
  // the emulator package and the pure helpers must not reach for the page
  {
    files: ['src/emulator/**/*.js', 'packages/zx81-emulator/src/**/*.js'],
    ignores: ['**/emulator-adapter.js'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...PAGE_GLOBALS.map((name) => ({ name, message: 'the emulator package must not touch the page' })),
      ],
    },
  },
];
