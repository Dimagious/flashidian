import { obsidianPlugin } from 'obsidian-plugin-dev-kit/eslint';

export default [
  ...obsidianPlugin({
    rootDir: import.meta.dirname,
    ignores: [
      // Build output of the e2e runs.
      '.e2e/**',
      // Built eval runner and local scratch scripts.
      '.eval/**',
      'playwright-report/**',
      'test-results/**',
    ],
  }),
  {
    // The prompt eval runs in Node on a developer's machine, never inside Obsidian.
    files: ['evals/**/*.ts'],
    rules: {
      'obsidianmd/no-nodejs-modules': 'off',
      'obsidianmd/prefer-window-timers': 'off',
    },
  },
];
