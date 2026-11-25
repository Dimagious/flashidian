import { readFileSync } from "node:fs";
import type { Locator, Page } from "@playwright/test";
import type { App } from "obsidian";
import type { DemoHelpers, Film, ObsidianHelpers } from "obsidian-plugin-dev-kit/e2e";
import { expect, onlyWhen, test } from "./fixtures";
import { demoHistory } from "./history";

/**
 * Films for the README and the community listing, from the real plugin in real Obsidian on the seed vault. Off unless
 * CAPTURE=1 (`npm run capture`). Frames land in .opdk/demo; `opdk demo` turns them into GIFs in docs/screens, with the
 * phone films set beside their captions (opdk.config.mjs). The clock is not frozen: the match clock and the drag measure
 * time with performance.now(). The review log is dated back from now instead, so a deck always has cards due today.
 */
onlyWhen("CAPTURE");
test.setTimeout(240_000);

const PHONE = { width: 390, height: 780 };
const CAPITALS = "Decks/Geography - Capitals.md";
const SPANISH = "Decks/Spanish - Kitchen.md";
const card = ".flashy-card[data-depth='0']";
const CAPITAL: Record<string, string> = {
    France: "Paris", Japan: "Tokyo", Brazil: "Brasília", Australia: "Canberra", Canada: "Ottawa",
    Egypt: "Cairo", Kenya: "Nairobi", Italy: "Rome", Mexico: "Mexico City", Turkey: "Ankara",
};
const HISTORY = { "Flashy/log-demo.md": demoHistory(new Date()) };

/** A tap with a frame of the press. */
async function tap(demo: DemoHelpers, target: Locator, film: Film, caption?: number): Promise<void> {
    await demo.tap(target, { whilePressed: () => film.shot({ hold: 0.15, ...(caption === undefined ? {} : { caption }) }) });
}

/** Drags the top card sideways in steps, a frame at each, then lets go. */
async function swipe(win: Page, film: Film, direction: 1 | -1, caption: number): Promise<void> {
    const box = await win.locator(card).boundingBox();
    if (!box) throw new Error("no card");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await win.mouse.move(cx, cy);
    await win.mouse.down();
    for (const share of [0.15, 0.3, 0.45]) {
        await win.mouse.move(cx + direction * box.width * share, cy + 6, { steps: 4 });
        await film.shot({ hold: 0.12, caption });
    }
    await win.mouse.move(cx + direction * box.width * 0.65, cy + 10, { steps: 4 });
    await win.mouse.up();
}

/** Opens a note's deck screen, starts studying and shows the front and the back of the first card. */
async function frontAndBack(obsidian: ObsidianHelpers, win: Page, demo: DemoHelpers, film: Film, caption: number): Promise<void> {
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".flashy-home")).toBeVisible();
    await tap(demo, win.locator(".flashy-home .mod-cta"), film, caption);
    await expect(win.locator(card)).toBeVisible();
    await film.shot({ hold: 1.1, caption, settle: true });
    await tap(demo, win.locator(card), film, caption);
    await expect(win.locator(card)).toHaveClass(/is-flipped/);
    await win.waitForTimeout(700);
    await film.shot({ hold: 1.8, caption, settle: true });
    await win.locator(".flashy-close").click();
    await expect(win.locator(".flashy-modal")).toHaveCount(0);
    await demo.hideCursor();
}

async function phone(obsidian: ObsidianHelpers, demo: DemoHelpers): Promise<void> {
    await obsidian.mobile(PHONE);
    await demo.cleanUi();
}

test.describe("with a review history", () => {
    test.use({ seed: { files: HISTORY } });

    test("hero: a table in a note becomes a deck, reviewed with taps and swipes", async ({ obsidian, win, demo }) => {
        await phone(obsidian, demo);
        await obsidian.readingView(CAPITALS);
        await obsidian.settle();

        const film = demo.film({
            name: "hero",
            kind: "phone",
            cursor: false,
            captions: ["A table in a note", "A deck, with today's cards", "Tap to flip", "Swipe right: got it", "Swipe left: again", "See how the round went"],
        });
        await film.shot({ hold: 2, caption: 0, settle: true });

        await obsidian.readingView("Study.md");
        const row = win.locator(".markdown-reading-view .flashy-deck-row", { hasText: "Geography - Capitals" });
        await expect(row).toBeVisible();
        await film.shot({ hold: 1.2, caption: 1, settle: true });
        await tap(demo, row, film, 1);
        await expect(win.locator(".flashy-home")).toBeVisible();
        await film.shot({ hold: 1.6, caption: 1, settle: true });

        await tap(demo, win.locator(".flashy-home .mod-cta"), film, 1);
        await expect(win.locator(card)).toBeVisible();
        await film.shot({ hold: 1, caption: 2, settle: true });
        await tap(demo, win.locator(card), film, 2);
        await expect(win.locator(card)).toHaveClass(/is-flipped/);
        await win.waitForTimeout(700);
        await film.shot({ hold: 1.4, caption: 2, settle: true });

        await swipe(win, film, 1, 3);
        await win.waitForTimeout(500);
        await film.shot({ hold: 0.8, caption: 3, settle: true });

        await tap(demo, win.locator(card), film, 4);
        await win.waitForTimeout(700);
        await film.shot({ hold: 1, caption: 4, settle: true });
        await swipe(win, film, -1, 4);
        await win.waitForTimeout(500);
        await film.shot({ hold: 0.8, caption: 4, settle: true });

        // The rest of the round by keyboard, off camera.
        for (let i = 0; i < 40 && !(await win.locator(".flashy-done").isVisible()); i++) {
            await win.keyboard.press("ArrowRight");
            await win.waitForTimeout(450);
        }
        await expect(win.locator(".flashy-done")).toBeVisible();
        await win.waitForTimeout(1200);
        await film.shot({ hold: 2.6, caption: 5, settle: true });
    });

    test("untouched: a review leaves the note as it was, progress goes to the Flashy folder", async ({ obsidian, win, demo }) => {
        await phone(obsidian, demo);
        // Source mode: reading view would hide a scheduling comment, the thing this film says is not there.
        await obsidian.openFile(SPANISH, { mode: "source" });
        await obsidian.settle();
        const before = await obsidian.evaluate((app: App, p: string) => app.vault.read(app.vault.getFileByPath(p)!), SPANISH);

        const film = demo.film({
            name: "untouched",
            kind: "phone",
            cursor: false,
            captions: ["Cards in your note", "Review them", "The note stays as it was", "Progress goes to Flashy/"],
        });
        await film.shot({ hold: 1.8, caption: 0, settle: true });

        await obsidian.runCommand("flashidian:review-note");
        await tap(demo, win.locator(".flashy-home .mod-cta"), film, 1);
        await expect(win.locator(card)).toBeVisible();
        await film.shot({ hold: 0.9, caption: 1, settle: true });
        await tap(demo, win.locator(card), film, 1);
        await win.waitForTimeout(700);
        await film.shot({ hold: 0.9, caption: 1, settle: true });
        await swipe(win, film, 1, 1);
        await win.waitForTimeout(500);
        await film.shot({ hold: 0.6, caption: 1, settle: true });
        await tap(demo, win.locator(".flashy-close"), film, 1);
        await expect(win.locator(".flashy-modal")).toHaveCount(0);

        // Written on close: the summary note of the deck. The note with the cards has not changed by a byte.
        const summary = "Flashy/Spanish - Kitchen.md";
        await expect.poll(() => obsidian.evaluate((app: App, p: string) => !!app.vault.getFileByPath(p), summary)).toBe(true);
        expect(await obsidian.evaluate((app: App, p: string) => app.vault.read(app.vault.getFileByPath(p)!), SPANISH)).toBe(before);
        await demo.hideCursor();
        await obsidian.openFile(SPANISH, { mode: "source" });
        await obsidian.settle();
        await film.shot({ hold: 1.8, caption: 2, settle: true });

        await obsidian.readingView(summary);
        await expect(win.locator(".workspace-leaf.mod-active .metadata-container")).toBeVisible();
        await obsidian.settle();
        await film.shot({ hold: 2.6, caption: 3, settle: true });
    });

    test("modes: a quiz and the match game", async ({ obsidian, win, demo }) => {
        await phone(obsidian, demo);
        await obsidian.readingView(CAPITALS);
        await obsidian.runCommand("flashidian:review-note");
        await expect(win.locator(".flashy-home")).toBeVisible();

        const film = demo.film({
            name: "modes",
            kind: "phone",
            cursor: false,
            captions: ["Four ways to study a deck", "Quiz: pick the right one", "Match: pairs against the clock"],
        });
        await film.shot({ hold: 1.6, caption: 0, settle: true });

        await tap(demo, win.locator(".flashy-mode", { hasText: "Quiz" }), film, 0);
        for (let i = 0; i < 2; i++) {
            await expect(win.locator(".flashy-quiz-text")).toBeVisible();
            await film.shot({ hold: 1.4, caption: 1, settle: true });
            const prompt = (await win.locator(".flashy-quiz-text").textContent()) ?? "";
            const country = Object.keys(CAPITAL).find((c) => prompt.includes(CAPITAL[c] ?? "\u0000"));
            if (!country) throw new Error(`unknown prompt: ${prompt}`);
            await tap(demo, win.locator(".flashy-quiz-option", { hasText: country }), film, 1);
            await expect(win.locator(".flashy-quiz-option.is-right")).toHaveCount(1);
            await film.shot({ hold: 0.9, caption: 1, settle: true });
            await expect(win.locator(".flashy-quiz-option.is-right")).toHaveCount(0, { timeout: 5000 });
        }

        await win.locator(".flashy-close").click();
        await obsidian.runCommand("flashidian:review-note");
        await tap(demo, win.locator(".flashy-mode", { hasText: "Match" }), film, 2);
        const terms = win.locator(".flashy-match-tile.is-term:not(.is-matched)");
        await expect(win.locator(".flashy-match-tile")).toHaveCount(12);
        await film.shot({ hold: 1.2, caption: 2 });
        const countries = (await terms.allTextContents()).map((t) => t.trim());
        for (const country of countries.slice(0, 3)) {
            await tap(demo, win.locator(".flashy-match-tile.is-term").filter({ hasText: new RegExp(`^${country}$`) }), film, 2);
            await film.shot({ hold: 0.4, caption: 2 });
            await tap(demo, win.locator(".flashy-match-tile.is-definition").filter({ hasText: new RegExp(`^${CAPITAL[country] ?? ""}$`) }), film, 2);
            await win.waitForTimeout(350);
            await film.shot({ hold: 0.6, caption: 2 });
        }
        for (const country of countries.slice(3)) {
            await win.locator(".flashy-match-tile.is-term").filter({ hasText: new RegExp(`^${country}$`) }).click();
            await win.locator(".flashy-match-tile.is-definition").filter({ hasText: new RegExp(`^${CAPITAL[country] ?? ""}$`) }).click();
        }
        await expect(win.locator(".flashy-done")).toBeVisible();
        await win.waitForTimeout(800);
        await film.shot({ hold: 2.4, caption: 2, settle: true });
    });
});

test("formats: headings, question callouts and a whole note are decks", async ({ obsidian, win, demo }) => {
    await phone(obsidian, demo);
    const film = demo.film({
        name: "formats",
        kind: "phone",
        cursor: false,
        captions: ["A glossary of headings", "Each heading is a card", "Question callouts", "Each question is a card", "A short note", "The whole note is one card"],
    });

    await obsidian.readingView("Decks/Biology - The Cell.md");
    await obsidian.settle();
    await film.shot({ hold: 1.8, caption: 0, settle: true });
    await frontAndBack(obsidian, win, demo, film, 1);

    await obsidian.readingView("Decks/Stars - The Night Sky.md");
    await obsidian.settle();
    await film.shot({ hold: 1.8, caption: 2, settle: true });
    await frontAndBack(obsidian, win, demo, film, 3);

    await obsidian.readingView("Decks/Wildlife - Animals/Octopus.md");
    await obsidian.settle();
    await film.shot({ hold: 1.8, caption: 4, settle: true });
    await frontAndBack(obsidian, win, demo, film, 5);
});

test.describe("with lecture notes and an assistant's reply", () => {
    test.use({
        seed: {
            files: {
                "Lectures/Econ 101 - week 3.md": readFileSync("e2e/data/econ-lecture.md", "utf8"),
                "Econ 101 - Week 3.md": readFileSync("e2e/data/econ-glossary.md", "utf8"),
            },
        },
    });

    test("prompt: copy a prompt, paste the reply, study the deck", async ({ obsidian, win, demo }) => {
        await phone(obsidian, demo);
        // The machine's own clipboard is left alone.
        await win.evaluate(() => {
            navigator.clipboard.writeText = () => Promise.resolve();
        });
        await obsidian.openFile("Lectures/Econ 101 - week 3.md", { mode: "source" });
        await obsidian.settle();
        const film = demo.film({
            name: "prompt",
            kind: "phone",
            cursor: false,
            captions: ["Your lecture notes", "Copy a prompt for them", "Paste it and the notes into your assistant", "Save its reply as a note", "Study the deck"],
        });
        await film.shot({ hold: 2, caption: 0, settle: true });

        await obsidian.runCommand("flashidian:copy-prompt");
        await expect(win.locator(".suggestion-item")).toHaveCount(4);
        await film.shot({ hold: 1.8, caption: 1, settle: true });
        await tap(demo, win.locator(".suggestion-item", { hasText: "Lecture notes into a glossary" }), film, 1);
        await expect(win.locator(".notice")).toContainText("Prompt copied");
        await film.shot({ hold: 2.6, caption: 2 });
        await obsidian.clearNotices();
        await demo.hideCursor();

        await obsidian.readingView("Econ 101 - Week 3.md");
        await obsidian.settle();
        await film.shot({ hold: 2.2, caption: 3, settle: true });

        await obsidian.runCommand("flashidian:review-note");
        await expect(win.locator(".flashy-home")).toBeVisible();
        await film.shot({ hold: 1.4, caption: 4, settle: true });
        await tap(demo, win.locator(".flashy-home .mod-cta"), film, 4);
        await expect(win.locator(card)).toBeVisible();
        await film.shot({ hold: 1, caption: 4, settle: true });
        await tap(demo, win.locator(card), film, 4);
        await win.waitForTimeout(700);
        await film.shot({ hold: 2.2, caption: 4, settle: true });
    });
});
