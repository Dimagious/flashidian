import { obsidianPlugin } from 'obsidian-plugin-dev-kit/eslint';

export default [
  ...obsidianPlugin({
    rootDir: import.meta.dirname,
    ignores: [
      // Build output of the e2e runs.
      '.e2e/**',
      'playwright-report/**',
      'test-results/**',
    ],
  }),
];
