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
