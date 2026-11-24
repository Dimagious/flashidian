import type { App } from "obsidian";
import { expect, test } from "./fixtures";

const card = ".flashy-card[data-depth='0']";

test("a scheduled round: deck screen, flip, swipes, undo, then the log and the deck numbers in the vault", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Agentic.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");

    // The deck screen: three new cards, all of them today's.
    await expect(win.locator(".flashy-home-cell.is-today .flashy-home-n")).toHaveText("3");
    await expect(win.locator(".flashy-home-cell.is-new .flashy-home-n")).toHaveText("3");
    await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("0");
    await win.getByRole("button", { name: "Study 3" }).click();

    await expect(win.locator(".flashy-count")).toHaveText("1 / 3");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("Agentic Loop");

    // A tap flips the card and shows the rendered back.
    await win.locator(card).click();
    await expect(win.locator(card)).toHaveClass(/is-flipped/);
    await expect(win.locator(`${card} .flashy-scroll code`).first()).toHaveText("end_turn");

    // A drag past the threshold to the right keeps the card.
    const box = await win.locator(card).boundingBox();
    if (!box) throw new Error("no card box");
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await win.mouse.move(cx, cy);
    await win.mouse.down();
    await win.mouse.move(cx + box.width * 0.6, cy + 10, { steps: 10 });
    await win.mouse.up();
    await expect(win.locator(".flashy-pill.is-keep .flashy-n")).toHaveText("1");
    await expect(win.locator(".flashy-count")).toHaveText("2 / 3");

    // A short drag springs back and grades nothing.
    await win.mouse.move(cx, cy);
    await win.mouse.down();
    await win.mouse.move(cx - 40, cy, { steps: 10 });
    await win.waitForTimeout(150);
    await win.mouse.up();
    await win.waitForTimeout(400);
    await expect(win.locator(".flashy-count")).toHaveText("2 / 3");

    // The buttons grade too, and undo takes the grade back.
    await win.getByRole("button", { name: "Again" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("1");
    await win.getByRole("button", { name: "Undo last card" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("0");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("stop_reason");

    await win.keyboard.press("ArrowLeft");
    await expect(win.locator(".flashy-count")).toHaveText("3 / 3");
    await win.keyboard.press("ArrowRight");

    // End of round: a practice round of the card sent left, then back to the deck, where nothing is left today.
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Repeat 1" }).click();
    await expect(win.locator(".flashy-count")).toHaveText("1 / 1");
    await win.keyboard.press("ArrowRight");
    await win.getByRole("button", { name: "Back to the deck" }).click();
    await expect(win.locator(".flashy-home-cell.is-today .flashy-home-n")).toHaveText("0");
    await expect(win.locator(".flashy-home-cell.is-learned .flashy-home-n")).toHaveText("2");
    await expect(win.getByRole("button", { name: "Done for today" })).toBeDisabled();
    await expect(win.locator(".flashy-home-note")).toContainText("Next cards on");

    await expect(win.locator(".flashy-title")).toHaveText("Agentic");
    await win.getByRole("button", { name: "Close" }).first().click();
    await expect(win.locator(".flashy-modal")).toHaveCount(0);

    // The log holds three reviews (the practice round writes nothing, undo took one back); the deck note is untouched.
    await expect
        .poll(() =>
            obsidian.evaluate(async (app: App) => {
                const log = app.vault.getFiles().find((f) => f.path.startsWith("Flashy/log-"));
                const summary = app.vault.getFileByPath("Flashy/Agentic.md");
                if (!log || !summary) return null;
                const lines = (await app.vault.read(log)).split("\n").filter((l) => /^\d{4}-\d\d-\d\dT/.test(l));
                const fm = app.metadataCache.getFileCache(summary)?.frontmatter ?? {};
                return `${lines.length} ${lines.map((l) => l.split(" ")[2]).join("")} ${fm["flashy-total"]} ${fm["flashy-learned"]} ${fm["flashy-learning"]} ${fm["flashy-due"]}`;
            }),
        )
        .toBe("3 313 3 2 1 0");
    const deck = await obsidian.evaluate(async (app: App) => app.vault.read(app.vault.getFileByPath("Decks/Agentic.md")!));
    expect(deck).not.toContain("flashy");
});

test("says so when a note has no cards", async ({ obsidian, win }) => {
    await obsidian.openFile("Welcome.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await expect(win.locator(".notice")).toContainText("No flashcards found");
});

test("fits the phone layout", async ({ obsidian, win }) => {
    await obsidian.mobile();
    await obsidian.openFile("Decks/Agentic.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await obsidian.settle({ root: ".flashy-modal" });
    // Fails with a list of problems: overflow, touch targets under 44 px.
    await obsidian.checkLayout({ root: ".flashy-modal" });
    await win.screenshot({ path: ".e2e/phone-deck.png" });
    await win.getByRole("button", { name: "Study 3" }).click();
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
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator(".flashy-deck-name")).toHaveText("All decks");
    await expect(rows.nth(0).locator(".flashy-deck-today-n")).toHaveText("4");
    await expect(rows.nth(1).locator(".flashy-deck-name")).toHaveText("Agentic");
    await expect(rows.nth(2).locator(".flashy-deck-meta")).toHaveText("0 of 1 learned, 1 new");

    await rows.nth(2).click();
    await expect(win.locator(".flashy-title")).toHaveText("Tools");
    await win.getByRole("button", { name: "Study 1" }).click();
    await win.keyboard.press("ArrowRight");
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Close" }).first().click();

    await expect(rows.nth(2).locator(".flashy-deck-meta")).toHaveText("1 of 1 learned, 0 new");
    await expect(rows.nth(2).locator(".flashy-deck-today-n")).toHaveText("0");
    await expect(rows.nth(0).locator(".flashy-deck-today-n")).toHaveText("3");

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
    await obsidian.openFile("Glossary/Terms.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");
    await win.getByRole("button", { name: "Study 2" }).click();
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("Agentic Loop");
    await win.locator(card).click();
    await expect(win.locator(`${card} .flashy-scroll .callout`)).toBeVisible();
});

test("pasted text from Quizlet becomes a deck note", async ({ obsidian, win }) => {
    await obsidian.openFile("Welcome.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:paste-deck");
    await win.locator(".flashy-paste-area").fill("Hook\truns code around a tool call\nSkill\ta packaged prompt");
    await expect(win.locator(".flashy-paste-found")).toHaveText("Cards found: 2");
    await win.locator(".flashy-paste-modal input[type=text]").fill("Pasted");
    await win.getByRole("button", { name: "Create deck" }).click();
    await expect
        .poll(() => obsidian.evaluate(async (app: App) => {
            const f = app.vault.getFileByPath("Pasted.md");
            return f ? app.vault.read(f) : "";
        }))
        .toBe("Hook\n?\nruns code around a tool call\n\nSkill\n?\na packaged prompt\n");
});

test("undo after the reviews were written appends a cancelling line", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Tools.md", { mode: "preview" });
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
