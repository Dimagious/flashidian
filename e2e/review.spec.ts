import { expect, test } from "./fixtures";

const card = ".flashy-card[data-depth='0']";

test("reviews the cards of a note: flip, swipe right, swipe left, undo, finish", async ({ obsidian, win }) => {
    await obsidian.openFile("Decks/Agentic.md", { mode: "preview" });
    await obsidian.runCommand("flashidian:review-note");

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

    // The buttons grade too, and undo brings the last card back.
    await win.getByRole("button", { name: "Again" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("1");
    await win.getByRole("button", { name: "Undo last card" }).click();
    await expect(win.locator(".flashy-pill.is-repeat .flashy-n")).toHaveText("0");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("stop_reason");

    await win.keyboard.press("ArrowLeft");
    await expect(win.locator(".flashy-count")).toHaveText("3 / 3");
    await win.keyboard.press("ArrowRight");

    // The end of the round offers the one card to repeat, and that round has one card.
    await expect(win.locator(".flashy-done")).toBeVisible();
    await win.getByRole("button", { name: "Repeat 1" }).click();
    await expect(win.locator(".flashy-count")).toHaveText("1 / 1");
    await expect(win.locator(`${card} .flashy-term`)).toHaveText("stop_reason");

    // The close button in the top bar ends the review.
    await expect(win.locator(".flashy-title")).toHaveText("Agentic");
    await win.getByRole("button", { name: "Close" }).first().click();
    await expect(win.locator(".flashy-modal")).toHaveCount(0);
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
    await win.screenshot({ path: ".e2e/phone.png" });
    await win.locator(card).click();
    await win.waitForTimeout(800);
    await win.screenshot({ path: ".e2e/phone-back.png" });
});
