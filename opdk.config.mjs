import { defineConfig } from "obsidian-plugin-dev-kit";

export default defineConfig({
    build: {
        // styles.css is hand-written, there is no CSS source to bundle.
        css: false,
    },
});
