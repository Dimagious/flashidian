import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import type { App } from "obsidian";
import { expect, test } from "./fixtures";
import { demoHistory } from "./history";

const card = ".flashy-card[data-depth='0']";
const SPANISH = "Decks/Spanish - Kitchen.md";
const CAPITALS = "Decks/Geography - Capitals.md";

test("a scheduled round: deck screen, flip, swipes, undo, then the log and the deck numbers in the vault", async ({ obsidian, win }) => {
    await obsidian.openFile(SPANISH, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");

    // The deck screen: ten new cards, all of them today's.
    await expect(win.locator(".flashy-home-cell.is-today .flashy-home-n")).toHaveText("10");
    await expect(win.locator(".flashy-home-cell.is-new .flashy-home-n")).toHaveText("10");
    await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("0");
    await win.getByRole("button", { name: "Study 10" }).click();

    await expect(win.locator(".flashy-count")).toHaveText("1 / 10");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("la cuchara");

    // A tap flips the card and shows the rendered back.
    await win.locator(card).click();
    await expect(win.locator(card)).toHaveClass(/is-flipped/);
    await expect(win.locator(`${card} .flashy-scroll em`).first()).toHaveText("Pásame la cuchara, por favor.");

    // A drag past the threshold to the right keeps the card.
    const box = await win.locator(card).boundingBox();
    if (!box) throw new Error("no card box");
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await win.mouse.move(cx, cy);
    await win.mouse.down();
    await win.mouse.move(cx + box.width * 0.6, cy + 10, { steps: 10 });
    await win.mouse.up();
    await expect(win.locator(".flashy-pill.is-keep .flashy-n")).toHaveText("1");
    await expect(win.locator(".flashy-count")).toHaveText("2 / 10");

    // A short drag springs back and grades nothing.
    await win.mouse.move(cx, cy);
    await win.mouse.down();
    await win.mouse.move(cx - 40, cy, { steps: 10 });
    await win.waitForTimeout(150);
    await win.mouse.up();
    await win.waitForTimeout(400);
    await expect(win.locator(".flashy-count")).toHaveText("2 / 10");

    // The buttons grade too, and undo takes the grade back.
    await win.getByRole("button", { name: "Again" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("1");
    await win.getByRole("button", { name: "Undo last card" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("0");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("el tenedor");

    await win.keyboard.press("ArrowLeft");
    await expect(win.locator(".flashy-count")).toHaveText("3 / 10");
    for (let i = 3; i <= 10; i++) {
        await expect(win.locator(".flashy-count")).toHaveText(`${i} / 10`);
        await win.keyboard.press("ArrowRight");
    }

    // End of round: a practice round of the card sent left, then back to the deck, where nothing is left today.
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Repeat 1" }).click();
    await expect(win.locator(".flashy-count")).toHaveText("1 / 1");
    await win.keyboard.press("ArrowRight");
    await win.getByRole("button", { name: "Back to the deck" }).click();
    await expect(win.locator(".flashy-home-cell.is-today .flashy-home-n")).toHaveText("0");
    await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("9");
    await expect(win.getByRole("button", { name: "Done for today" })).toBeDisabled();
    await expect(win.locator(".flashy-home-note")).toContainText("Next cards on");

    await expect(win.locator(".flashy-title")).toHaveText("Spanish - Kitchen");
    await win.getByRole("button", { name: "Close" }).first().click();
    await expect(win.locator(".flashy-modal")).toHaveCount(0);

    // The log holds ten reviews (the practice round writes nothing, undo took one back); the deck note is untouched.
    await expect
        .poll(() =>
            obsidian.evaluate(async (app: App) => {
                const log = app.vault.getFiles().find((f) => f.path.startsWith("Flashy/log-"));
                const summary = app.vault.getFileByPath("Flashy/Spanish - Kitchen.md");
                if (!log || !summary) return null;
                const lines = (await app.vault.read(log)).split("\n").filter((l) => /^\d{4}-\d\d-\d\dT/.test(l));
                const fm = app.metadataCache.getFileCache(summary)?.frontmatter ?? {};
                return `${lines.length} ${lines.map((l) => l.split(" ")[2]).join("")} ${fm["flashy-total"]} ${fm["flashy-learned"]} ${fm["flashy-learning"]} ${fm["flashy-due"]}`;
            }),
        )
        .toBe("10 3133333333 10 9 1 0");
    const deck = await obsidian.evaluate(async (app: App, path: string) => app.vault.read(app.vault.getFileByPath(path)!), SPANISH);
    expect(deck).toBe(readFileSync(`e2e-vault.pristine/${SPANISH}`, "utf8"));
});

test("the deck screen: four modes, and the front side it remembers; definition first hides the term", async ({ obsidian, win }) => {
    await obsidian.openFile(SPANISH, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".flashy-mode .flashy-mode-label")).toHaveText(["Cards", "Quiz", "Reverse", "Match"]);
    await expect(win.locator(".flashy-mode .flashy-mode-n")).toHaveText(["10", "10", "10", "6"]);
    await expect(win.getByRole("radio", { name: "Term" })).toHaveAttribute("aria-checked", "true");

    await win.getByRole("radio", { name: "Definition" }).click();
    await expect(win.getByRole("radio", { name: "Definition" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => obsidian.evaluate((app: App) => (app as unknown as { plugins: { plugins: Record<string, { settings: { side: string } }> } }).plugins.plugins.flashidian?.settings.side)).toBe("definition");

    await win.getByRole("button", { name: "Study 10" }).click();
    await expect(win.locator(card)).toHaveClass(/is-answer-first/);
    await expect(win.locator(`${card} .flashy-prompt`)).toContainText("Pásame ___, por favor.");
    await expect(win.locator(`${card} .flashy-prompt`)).not.toContainText("cuchara");
    await win.screenshot({ path: ".e2e/answer-first.png" });
    await win.locator(card).click();
    await expect(win.locator(`${card} .flashy-answer-term`)).toHaveText("la cuchara");

    // The choice outlives the modal.
    await win.getByRole("button", { name: "Close" }).first().click();
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.getByRole("radio", { name: "Definition" })).toHaveAttribute("aria-checked", "true");
});

test("a card reads itself aloud: the term in the deck's language, the answer in its own, and the speaker does not flip", async ({ obsidian, win }) => {
    await obsidian.openFile(SPANISH, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.evaluate(() => {
        const w = window as unknown as { said: string[][] };
        w.said = [];
        window.speechSynthesis.speak = (u: SpeechSynthesisUtterance): void => void w.said.push([u.text, u.lang]);
    });
    const said = (): Promise<string[][]> => win.evaluate(() => (window as unknown as { said: string[][] }).said);
    await win.getByRole("button", { name: "Study 10" }).click();

    await win.locator(`${card} .flashy-front .flashy-speak`).click();
    await expect.poll(said).toEqual([["la cuchara", "es-ES"]]);
    await expect(win.locator(card)).not.toHaveClass(/is-flipped/);

    // One speaker in view on each side, in the top right corner (WebKit showed the front one through the back).
    const speakers = win.locator(`${card} .flashy-speak`);
    const visible = (): Promise<number> => speakers.evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility === "visible").length);
    expect(await visible()).toBe(1);
    await win.keyboard.press(" ");
    await expect(win.locator(card)).toHaveClass(/is-flipped/);
    expect(await visible()).toBe(1);
    await expect(win.locator(`${card} .flashy-back .flashy-speak`)).toHaveCSS("visibility", "visible");
    await expect(win.locator(`${card} .flashy-front .flashy-speak`)).toHaveCSS("visibility", "hidden");
    await win.keyboard.press("s");
    await expect.poll(said).toEqual([
        ["la cuchara", "es-ES"],
        ["spoon Pásame la cuchara, por favor. - Pass me the spoon, please.", "en-US"],
    ]);
});

test("says so when a note has no cards", async ({ obsidian, win }) => {
    await obsidian.openFile("Welcome.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".notice")).toContainText("No flashcards found");
});

test("copies a prompt for making cards: from the command and from settings, with what to do next", async ({ obsidian, win }) => {
    // Catch the clipboard: the test checks the text, not the system clipboard.
    await win.evaluate(() => {
        const w = window as unknown as { copied: string[] };
        w.copied = [];
        navigator.clipboard.writeText = (text: string) => {
            w.copied.push(text);
            return Promise.resolve();
        };
    });
    const copied = (): Promise<string[]> => win.evaluate(() => (window as unknown as { copied: string[] }).copied);

    await obsidian.runCommand("flashidian:copy-prompt");
    await expect(win.locator(".suggestion-item")).toHaveCount(4);
    await win.locator(".prompt-input").fill("chapter");
    await expect(win.locator(".suggestion-item")).toHaveCount(1);
    await win.locator(".suggestion-item").click();
    await expect(win.locator(".notice")).toContainText("Prompt copied");
    const chapter = (await copied())[0] ?? "";
    expect(chapter).toContain("flashy: callouts");
    expect(chapter.trimEnd().endsWith("The text:")).toBe(true);

    await obsidian.evaluate((app: App) => {
        const s = (app as unknown as { setting: { open: () => void; openTabById: (id: string) => void } }).setting;
        s.open();
        s.openTabById("flashidian");
    });
    await win.locator(".setting-item", { hasText: "Foreign words into cards" }).click();
    await expect.poll(async () => (await copied()).length).toBe(2);
    expect((await copied())[1]).toContain("flashy-lang:");
});

test("fits the phone layout", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile(SPANISH, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await obsidian.settle({ root: ".flashy-modal" });
    // Fails with a list of problems: overflow, touch targets under 44 px.
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.screenshot({ path: ".e2e/phone-deck.png" });
    await win.getByRole("button", { name: "Study 10" }).click();
    await obsidian.settle({ root: ".flashy-modal" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.screenshot({ path: ".e2e/phone.png" });
    await win.locator(card).click();
    await win.waitForTimeout(800);
    await win.screenshot({ path: ".e2e/phone-back.png" });
});

for (const lang of ["ru", "de", "fr", "es", "pt", "ja"]) {
    test(`fits the phone in ${lang}: the deck screen and a flipped card`, async ({ obsidian, win }) => {
        await obsidian.evaluate(async (app: App, code: string) => {
            const plugins = (app as unknown as {
                plugins: { plugins: Record<string, { settings: { language: string }; saveSettings: () => Promise<void> }>; disablePlugin: (id: string) => Promise<void>; enablePlugin: (id: string) => Promise<void> };
            }).plugins;
            const flashy = plugins.plugins.flashidian!;
            flashy.settings.language = code;
            await flashy.saveSettings();
            await plugins.disablePlugin("flashidian");
            await plugins.enablePlugin("flashidian");
        }, lang);
        await obsidian.mobile();
        await obsidian.openFile(SPANISH, { mode: "preview" });
        await obsidian.runCommand("flashidian:review-note");
        await obsidian.settle({ root: ".flashy-modal" });
        await obsidian.checkLayout({ root: ".flashy-modal" });
        await win.screenshot({ path: `.e2e/phone-deck-${lang}.png` });
        await win.locator(".flashy-home .mod-cta").click();
        await obsidian.settle({ root: ".flashy-modal" });
        await win.locator(card).click();
        await win.waitForTimeout(800);
        await obsidian.checkLayout({ root: ".flashy-modal" });
        // The swipe legend sits under the card in one line; a second line hides behind the card.
        const legend = await win.locator(".flashy-legend span").evaluateAll((els) =>
            els.map((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || "16")),
        );
        expect(legend.every((lines) => lines < 1.5), `legend lines: ${legend.join(", ")}`).toBe(true);
        await win.screenshot({ path: `.e2e/phone-${lang}.png` });
    });
}

test("a deck list in a note starts a review with one tap and redraws after it", async ({ obsidian, win }) => {
    await obsidian.openFile("Study.md", { mode: "preview" });
    // Obsidian also renders the block in the hidden editor of the tab; the reading view is the one on screen.
    const rows = win.locator(".markdown-reading-view .flashy-deck-row");
    await expect(rows).toHaveCount(7);
    await expect(rows.nth(0).locator(".flashy-deck-name")).toHaveText("All decks");
    await expect(rows.nth(0).locator(".flashy-deck-today-n")).toHaveText("20");
    await expect(rows.nth(1).locator(".flashy-deck-name")).toHaveText("Biology - The Cell");
    await expect(rows.nth(2).locator(".flashy-deck-meta")).toHaveText("0 of 8 learned, 8 new");

    await rows.nth(2).click();
    await expect(win.locator(".flashy-title")).toHaveText("Cooking - Techniques");
    await win.getByRole("button", { name: "Study 8" }).click();
    for (let i = 1; i <= 8; i++) {
        await expect(win.locator(".flashy-count")).toHaveText(`${i} / 8`);
        await win.keyboard.press("ArrowRight");
    }
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Close" }).first().click();

    await expect(rows.nth(2).locator(".flashy-deck-meta")).toHaveText("8 of 8 learned, 0 new");
    await expect(rows.nth(2).locator(".flashy-deck-today-n")).toHaveText("0");
    // Eight of today's twenty new cards are used up.
    await expect(rows.nth(0).locator(".flashy-deck-today-n")).toHaveText("12");

    await obsidian.mobile();
    await obsidian.openFile("Study.md", { mode: "preview" });
    await obsidian.settle();
    await obsidian.checkLayout({ root: ".flashy-decks" });
    await win.screenshot({ path: ".e2e/phone-decks.png" });
});

test("the deck list names a missing folder", async ({ obsidian, win }) => {
    await obsidian.evaluate(async (app: App) => {
        await app.vault.create("Broken.md", "```flashy\nfolder: Nope\n```\n");
    });
    await obsidian.openFile("Broken.md", { mode: "preview" });
    await expect(win.locator(".markdown-reading-view .flashy-decks-empty")).toHaveText('No folder "Nope".');
});

test("a glossary with flashy: true is a deck of its headings", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Biology - The Cell.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    // Eight headings; the table and the list inside the answers are not cards of their own.
    await win.getByRole("button", { name: "Study 8" }).click();
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("Nucleus");
    await win.locator(card).click();
    await expect(win.locator(`${card} .flashy-scroll .callout`)).toBeVisible();
});

test("question callouts are cards: the title asks, the body answers, a nested answer splits a longer question", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Stars - The Night Sky.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Study 6" }).click();
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("What is the brightest star in the night sky?");
    await win.locator(card).click();
    await expect(win.locator(`${card} .flashy-scroll`)).toContainText("Sirius");
    await win.keyboard.press("ArrowRight");
    await expect(win.locator(".flashy-count")).toHaveText("2 / 6");
    await win.keyboard.press("ArrowRight");
    await expect(win.locator(".flashy-count")).toHaveText("3 / 6");
    await expect(win.locator(`${card} .flashy-term`)).toContainText("The Moon always shows Earth the same face.");
    await expect(win.locator(`${card} .flashy-term`)).toContainText("Why?");
    await win.locator(card).click();
    await expect(win.locator(`${card} .flashy-scroll`)).toContainText("about 27 days");
});

test("a folder of notes that are one card each is one deck with one summary note", async ({ obsidian, win }) => {
    await obsidian.openFile("Study.md", { mode: "preview" });
    const rows = win.locator(".markdown-reading-view .flashy-deck-row");
    await expect(rows).toHaveCount(7);
    const wildlife = rows.filter({ hasText: "Wildlife - Animals" });
    await expect(wildlife.locator(".flashy-deck-meta")).toHaveText("0 of 5 learned, 5 new");
    await wildlife.click();
    await expect(win.locator(".flashy-title")).toHaveText("Wildlife - Animals");
    await win.getByRole("button", { name: "Study 5" }).click();
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("Camel");
    await win.locator(card).click();
    // The heading that repeats the note's name is left out of the answer.
    await expect(win.locator(`${card} .flashy-scroll`)).toContainText("A camel stores fat");
    await expect(win.locator(`${card} .flashy-scroll h1`)).toHaveCount(0);
    for (let i = 1; i <= 5; i++) {
        await expect(win.locator(".flashy-count")).toHaveText(`${i} / 5`);
        if (i === 4) await expect(win.locator(`${card} .flashy-term`)).toHaveText("Why does an octopus have three hearts?");
        await win.keyboard.press("ArrowRight");
    }
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Close" }).first().click();
    await expect(wildlife.locator(".flashy-deck-meta")).toHaveText("5 of 5 learned, 0 new");
    const summary = await obsidian.evaluate((app: App) => {
        const f = app.vault.getFileByPath("Flashy/Wildlife - Animals (notes).md");
        const fm = f ? app.metadataCache.getFileCache(f)?.frontmatter : undefined;
        return { deck: fm?.["flashy-deck"], total: fm?.["flashy-total"], perNote: app.vault.getFileByPath("Flashy/Camel.md") !== null };
    });
    expect(summary).toEqual({ deck: "Decks/Wildlife - Animals", total: 5, perNote: false });
});

test.describe("two notes with the same name", () => {
    test.use({ seed: { files: { "Dupes.md": "```flashy\nfolder: Edge cases\n```\n" } } });

    test("are two cards, each named with its folder", async ({ obsidian, win }) => {
        await obsidian.openFile("Dupes.md", { mode: "preview" });
        const rows = win.locator(".markdown-reading-view .flashy-deck-row");
        await rows.filter({ hasText: "Notes A" }).click();
        await win.getByRole("button", { name: "Study 1" }).click();
        await expect(win.locator(`${card} .flashy-term`)).toHaveText("Introduction (Notes A)");
        await win.getByRole("button", { name: "Close" }).first().click();
        await rows.filter({ hasText: "Notes B" }).click();
        await win.getByRole("button", { name: "Study 1" }).click();
        await expect(win.locator(`${card} .flashy-term`)).toHaveText("Introduction (Notes B)");
    });
});

test("pasted text from Quizlet becomes a deck note", async ({ obsidian, win }) => {
    await obsidian.openFile("Welcome.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:paste-deck");
    // A real Quizlet export: tab between term and definition, one card per line.
    const tsv = readFileSync("e2e/data/music-tempo-quizlet.tsv", "utf8");
    await win.locator(".flashy-paste-area").fill(tsv);
    await expect(win.locator(".flashy-paste-found")).toHaveText("Cards found: 8");
    await win.locator(".flashy-paste-modal input[type=text]").fill("Music - Tempo");
    await win.getByRole("button", { name: "Create deck" }).click();
    const expected = tsv.trim().split("\n").map((l) => l.replace("\t", "\n?\n")).join("\n\n") + "\n";
    await expect
        .poll(() => obsidian.evaluate(async (app: App) => {
            const f = app.vault.getFileByPath("Music - Tempo.md");
            return f ? app.vault.read(f) : "";
        }))
        .toBe(expected);
});

test("undo after the reviews were written appends a cancelling line", async ({ obsidian, win }) => {
    await obsidian.openFile("Edge cases/Single card.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Study 1" }).click();
    await win.keyboard.press("ArrowRight");
    await expect(win.locator(".flashy-done")).toBeVisible();
    // The end of the round writes the log; undo after that cannot drop the line, it cancels it.
    await expect.poll(() => obsidian.evaluate((app: App) => app.vault.getFiles().some((f) => f.path.startsWith("Flashy/log-")))).toBe(true);
    await win.getByRole("button", { name: "Undo last card" }).click();
    await win.getByRole("button", { name: "Close" }).first().click();
    await expect
        .poll(() => obsidian.evaluate(async (app: App) => {
            const log = app.vault.getFiles().find((f) => f.path.startsWith("Flashy/log-"));
            const lines = log ? (await app.vault.read(log)).split("\n").filter((l) => /^\d{4}-/.test(l)) : [];
            return lines.map((l) => l.split(" ")[2]).join("");
        }))
        .toBe("30");
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".flashy-home-cell.is-new .flashy-home-n")).toHaveText("1");
});

test("a quiz: pick the term for a definition, a right pick moves on, a wrong one waits, then retry the missed", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Cooking - Techniques.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Quiz: 8 questions" }).click();

    const answers: [string, string][] = [
        ["small pieces quickly", "Sauté"],
        ["brown meat first", "Braise"],
        ["boiling water for a minute", "Blanch"],
        ["thin matchsticks", "Julienne"],
        ["browned bits", "Deglaze"],
        ["oil and vinegar", "Emulsify"],
        ["keeps its air", "Fold"],
        ["yeast dough", "Proof"],
    ];
    for (let i = 0; i < 8; i++) {
        await expect(win.locator(".flashy-count")).toHaveText(`${i + 1} / 8`);
        const prompt = (await win.locator(".flashy-quiz-text").textContent()) ?? "";
        const hit = answers.find(([p]) => prompt.includes(p));
        if (!hit) throw new Error(`unknown prompt: ${prompt}`);
        const term = hit[1];
        // The definition names its own term; the question hides it.
        expect(prompt.toLowerCase()).not.toContain(term.toLowerCase());
        expect(prompt).toContain("___");
        const options = win.locator(".flashy-quiz-option");
        if (i === 1) {
            // A wrong pick: red on the pick, green on the answer, and the round waits for Next.
            await options.filter({ hasNotText: term }).first().click();
            await expect(win.locator(".flashy-quiz-option.is-wrong")).toHaveCount(1);
            await expect(win.locator(".flashy-quiz-option.is-right")).toContainText(term);
            await win.getByRole("button", { name: "Next" }).click();
        } else {
            await options.filter({ hasText: term }).click();
            await expect(win.locator(".flashy-quiz-option.is-right")).toHaveCount(1);
        }
    }

    await expect(win.locator(".flashy-done h2")).toHaveText("7 of 8 right");
    await expect(win.locator(".flashy-pill.is-keep .flashy-n")).toHaveText("7");
    await win.getByRole("button", { name: "Retry the 1 missed" }).click();
    await expect(win.locator(".flashy-count")).toHaveText("1 / 1");

    // The quiz writes nothing to the review log.
    await win.getByRole("button", { name: "Close" }).first().click();
    expect(await obsidian.evaluate((app: App) => app.vault.getFiles().some((f) => f.path.startsWith("Flashy/log-")))).toBe(false);
});

test("a reverse quiz: pick the definition for a term, then retry the missed in the same direction", async ({ obsidian, win }) => {
    await obsidian.openFile(CAPITALS, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Reverse quiz: 10 terms" }).click();
    await expect(win.locator(".flashy-quiz.is-reverse .flashy-deck")).toContainText("which definition fits?");

    // A table deck: the country is the front, the capital the first line of the back. A short answer is not masked, so
    // "Mexico City" stays whole.
    const capitals: Record<string, string> = {
        France: "Paris", Japan: "Tokyo", Brazil: "Brasília", Australia: "Canberra", Canada: "Ottawa",
        Egypt: "Cairo", Kenya: "Nairobi", Italy: "Rome", Mexico: "Mexico City", Turkey: "Ankara",
    };
    for (let i = 0; i < 10; i++) {
        await expect(win.locator(".flashy-count")).toHaveText(`${i + 1} / 10`);
        const country = (await win.locator(".flashy-quiz-text").textContent())?.trim() ?? "";
        const capital = capitals[country];
        if (!capital) throw new Error(`unknown country: ${country}`);
        const options = win.locator(".flashy-quiz-option");
        await expect(options).toHaveCount(4);
        if (i === 0) {
            await options.filter({ hasNotText: capital }).first().click();
            await expect(win.locator(".flashy-quiz-option.is-right")).toContainText(capital);
            await win.getByRole("button", { name: "Next" }).click();
        } else {
            await options.filter({ hasText: capital }).click();
            await expect(win.locator(".flashy-quiz-option.is-right")).toHaveCount(1);
        }
    }
    await expect(win.locator(".flashy-done h2")).toHaveText("9 of 10 right");
    await win.getByRole("button", { name: "Retry the 1 missed" }).click();
    await expect(win.locator(".flashy-quiz.is-reverse")).toHaveCount(1);
});

test("the reverse quiz fits the phone", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile(CAPITALS, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Reverse quiz: 10 terms" }).click();
    await obsidian.settle({ root: ".flashy-modal" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.locator(".flashy-quiz-option").first().click();
    await win.waitForTimeout(450);
    await win.screenshot({ path: ".e2e/phone-quiz-reverse.png" });
});

test("the quiz fits the phone", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile("Decks/Cooking - Techniques.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Quiz: 8 questions" }).click();
    await obsidian.settle({ root: ".flashy-modal" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.locator(".flashy-quiz-option").first().click();
    await win.waitForTimeout(450);
    await win.screenshot({ path: ".e2e/phone-quiz.png" });
});

const CAPITAL: Record<string, string> = {
    France: "Paris", Japan: "Tokyo", Brazil: "Brasília", Australia: "Canberra", Canada: "Ottawa",
    Egypt: "Cairo", Kenya: "Nairobi", Italy: "Rome", Mexico: "Mexico City", Turkey: "Ankara",
};

/** Plays one match game on the capitals: one wrong pair first, then every pair right. */
async function playCapitals(win: Page, miss: boolean): Promise<void> {
    const terms = win.locator(".flashy-match-tile.is-term:not(.is-matched)");
    const defs = win.locator(".flashy-match-tile.is-definition");
    await expect(win.locator(".flashy-match-tile")).toHaveCount(12);
    const countries = (await terms.allTextContents()).map((t) => t.trim());
    expect(countries).toHaveLength(6);
    if (miss) {
        const [a, b] = countries;
        await terms.filter({ hasText: new RegExp(`^${a}$`) }).click();
        await expect(win.locator(".flashy-match-tile.is-selected")).toHaveCount(1);
        await defs.filter({ hasText: new RegExp(`^${CAPITAL[b ?? ""]}$`) }).click();
        await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("1");
        await expect(win.locator(".flashy-match-tile.is-selected")).toHaveCount(0);
    }
    for (const [i, country] of countries.entries()) {
        await win.locator(".flashy-match-tile.is-term").filter({ hasText: new RegExp(`^${country}$`) }).click();
        await defs.filter({ hasText: new RegExp(`^${CAPITAL[country]}$`) }).click();
        if (i < 5) await expect(win.locator(".flashy-pill.is-keep .flashy-n")).toHaveText(String(i + 1));
    }
}

test("a match game: tap pairs against the clock, a miss counts, the best time lands in the deck's summary note", async ({ obsidian, win }) => {
    await obsidian.openFile(CAPITALS, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Match: 6 pairs" }).click();
    await expect(win.locator(".flashy-count")).toHaveText(/^\d+\.\d s$/);
    // Tapping the picked tile again drops it.
    const first = win.locator(".flashy-match-tile.is-term").first();
    await first.click();
    await expect(first).toHaveClass(/is-selected/);
    await first.click();
    await expect(first).not.toHaveClass(/is-selected/);

    await playCapitals(win, true);
    await expect(win.locator(".flashy-done h2")).toHaveText("New best time");
    await expect(win.locator(".flashy-match-summary")).toHaveText("1 miss");
    const shown = (await win.locator(".flashy-match-time").textContent()) ?? "";
    const seconds = Number(shown.replace(" s", ""));
    expect(seconds).toBeGreaterThan(0);
    await expect
        .poll(() =>
            obsidian.evaluate((app: App) => {
                const f = app.vault.getFileByPath("Flashy/Geography - Capitals.md");
                return f ? app.metadataCache.getFileCache(f)?.frontmatter?.["flashy-match-best"] : undefined;
            }),
        )
        .toBe(seconds);

    // Another game deals a new grid; the match writes nothing to the review log.
    await win.getByRole("button", { name: "Play again" }).click();
    await expect(win.locator(".flashy-match-tile")).toHaveCount(12);
    await expect(win.locator(".flashy-pill.is-keep .flashy-n")).toHaveText("0");
    await win.getByRole("button", { name: "Close" }).first().click();
    expect(await obsidian.evaluate((app: App) => app.vault.getFiles().some((f) => f.path.startsWith("Flashy/log-")))).toBe(false);
});

test.describe("a match best time to beat", () => {
    test.use({ seed: { files: { "Flashy/Geography - Capitals.md": "---\nflashy-match-best: 0.1\n---\n" } } });

    // 0.1 s cannot be beaten: a new best must be at least a tenth faster.
    test("a slower game keeps the best time and names it", async ({ obsidian, win }) => {
        await obsidian.openFile(CAPITALS, { mode: "preview" });
        await obsidian.runCommand("flashidian:review-note");
        await win.getByRole("button", { name: "Match: 6 pairs" }).click();
        await playCapitals(win, false);
        await expect(win.locator(".flashy-done h2")).toHaveText("All pairs matched");
        await expect(win.locator(".flashy-match-summary")).toHaveText("0 misses · Best time: 0.1 s");
        const best = await obsidian.evaluate((app: App) => {
            const f = app.vault.getFileByPath("Flashy/Geography - Capitals.md");
            return f ? app.metadataCache.getFileCache(f)?.frontmatter?.["flashy-match-best"] : undefined;
        });
        expect(best).toBe(0.1);
    });
});

test("the match game fits the phone, with the longest definitions", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile("Decks/Biology - The Cell.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await obsidian.settle({ root: ".flashy-modal" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.screenshot({ path: ".e2e/phone-deck-modes.png" });
    await win.getByRole("button", { name: "Match: 6 pairs" }).click();
    // The clock redraws every 100 ms, so only the grid can go quiet.
    await obsidian.settle({ root: ".flashy-match" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.locator(".flashy-match-tile.is-term").first().click();
    await win.screenshot({ path: ".e2e/phone-match.png" });
});

test("the match end screen fits the phone", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile(CAPITALS, { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Match: 6 pairs" }).click();
    await playCapitals(win, true);
    await expect(win.locator(".flashy-done h2")).toHaveText("New best time");
    await obsidian.settle({ root: ".flashy-modal" });
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.screenshot({ path: ".e2e/phone-match-done.png" });
});

test.describe("a vault in use", () => {
    test.use({ seed: { files: { "Flashy/log-demo.md": demoHistory(new Date()) } } });

    test("the seeded history shows learned, due and new cards in every deck", async ({ obsidian, win }) => {
        await obsidian.openFile("Study.md", { mode: "preview" });
        const rows = win.locator(".markdown-reading-view .flashy-deck-row");
        await expect(rows).toHaveCount(7);
        // Spanish: cards 1 and 6 new, 2 and 7 missed yesterday, the other six learned.
        await expect(rows.nth(4).locator(".flashy-deck-meta")).toHaveText("6 of 10 learned, 2 new");
        await rows.nth(4).click();
        await expect(win.locator(".flashy-home-cell.is-new .flashy-home-n")).toHaveText("2");
        await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("6");
        expect(Number(await win.locator(".flashy-home-cell.is-today .flashy-home-n").textContent())).toBeGreaterThanOrEqual(4);
    });
});
