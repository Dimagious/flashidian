import { readFileSync } from "node:fs";
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
    expect(deck).not.toContain("flashy");
});

test("says so when a note has no cards", async ({ obsidian, win }) => {
    await obsidian.openFile("Welcome.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".notice")).toContainText("No flashcards found");
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

test("a deck list in a note starts a review with one tap and redraws after it", async ({ obsidian, win }) => {
    await obsidian.openFile("Study.md", { mode: "preview" });
    // Obsidian also renders the block in the hidden editor of the tab; the reading view is the one on screen.
    const rows = win.locator(".markdown-reading-view .flashy-deck-row");
    await expect(rows).toHaveCount(5);
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

test.describe("a vault in use", () => {
    test.use({ seed: { files: { "Flashy/log-demo.md": demoHistory(new Date()) } } });

    test("the seeded history shows learned, due and new cards in every deck", async ({ obsidian, win }) => {
        await obsidian.openFile("Study.md", { mode: "preview" });
        const rows = win.locator(".markdown-reading-view .flashy-deck-row");
        await expect(rows).toHaveCount(5);
        // Spanish: cards 1 and 6 new, 2 and 7 missed yesterday, the other six learned.
        await expect(rows.nth(4).locator(".flashy-deck-meta")).toHaveText("6 of 10 learned, 2 new");
        await rows.nth(4).click();
        await expect(win.locator(".flashy-home-cell.is-new .flashy-home-n")).toHaveText("2");
        await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("6");
        expect(Number(await win.locator(".flashy-home-cell.is-today .flashy-home-n").textContent())).toBeGreaterThanOrEqual(4);
    });
});
