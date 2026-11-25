import { defineConfig } from "obsidian-plugin-dev-kit";

/** The phone films' frame: a title and the steps beside the phone, in Flashy's purple. */
function phone(title) {
    return { title, background: "#f4f1fd", text: "#222222", muted: "#444444", accent: "#6f4fe0" };
}

export default defineConfig({
    build: {
        // styles.css is hand-written, there is no CSS source to bundle.
        css: false,
        // The prompts in prompts/ ship inside main.js as text.
        loader: { ".md": "text" },
    },
    demo: {
        // README films are GIFs; no video, no poster. Every film is a tour that ends somewhere else than it starts.
        mp4: false,
        poster: false,
        loop: "off",
        // The community directory listing's pictures go to their own folder.
        outputs: { listing: "docs/listing" },
        gif: { colors: 160, fps: 12, width: 1000 },
        films: {
            hero: { layout: "phone-captions", phone: phone("Your notes are\nalready flashcards") },
            formats: { layout: "phone-captions", phone: phone("Any note\ncan be a deck") },
            untouched: { layout: "phone-captions", phone: phone("Your notes\nstay untouched") },
            modes: { layout: "phone-captions", phone: phone("Quiz and\nMatch") },
            prompt: { layout: "phone-captions", phone: phone("Cards from your\nlecture notes") },
        },
    },

});
