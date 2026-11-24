import { defineUnitConfig } from "obsidian-plugin-dev-kit/vitest";

export default defineUnitConfig({
  rootDir: import.meta.dirname,
  // The gate counts the pure core. The review modal and main.ts run in real Obsidian under e2e/.
  coverage: { include: ["src/core/**/*.ts"] },
});
