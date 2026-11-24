import { createObsidianTest } from "obsidian-plugin-dev-kit/e2e";

export const { test, expect, onlyWhen } = createObsidianTest({
    seedVault: "e2e-vault.pristine",
});
