import { obsidianPlugin } from 'obsidian-plugin-dev-kit/eslint';

export default [
  ...obsidianPlugin({
    rootDir: import.meta.dirname,
    ignores: [
      // Build output of the e2e runs.
      '.e2e/**',
      // The prompt eval: a Node script, typechecked by tsconfig.evals.json like e2e/ by tsconfig.e2e.json.
      'evals/**',
      '.eval/**',
      'playwright-report/**',
      'test-results/**',
    ],
  }),
];
