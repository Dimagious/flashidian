import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardIds } from "./key";
import { type Card, parseCards } from "./parse";
import { parsePasted } from "./paste";
import { buildMatch, MATCH_PAIRS } from "./match";
import { buildQuiz, plainTerm } from "./quiz";
import { modeOf, noteCard, noteFront, parseStructured } from "./structured";

/** The seed vault is the base of the e2e tests and the demo films; these checks keep it usable for both. */
const VAULT = "e2e-vault.pristine";

function deck(path: string): Card[] {
    const md = readFileSync(`${VAULT}/${path}`, "utf8");
    const mode = modeOf(/^flashy:\s*(\S+)\s*$/m.exec(md)?.[1]);
    return mode && mode !== "note" ? parseStructured(md, mode) : parseCards(md);
}

const DECKS: [string, number][] = [
    ["Decks/Spanish - Kitchen.md", 10],
    ["Decks/Biology - The Cell.md", 8],
    ["Decks/Geography - Capitals.md", 10],
    ["Decks/Cooking - Techniques.md", 8],
    ["Decks/Stars - The Night Sky.md", 6],
];

describe("seed vault", () => {
    it.each(DECKS)("%s has %i cards with unique keys, all usable in both quizzes without giving the answer away", (path, n) => {
        const cards = deck(path);
        expect(cards).toHaveLength(n);
        expect(new Set(cardIds(cards).map((c) => c.key)).size).toBe(n);
        for (const reverse of [false, true]) {
            const qs = buildQuiz(cards, (c) => c.front, (c) => c.back, 99, { reverse });
            expect(qs).toHaveLength(n);
            for (const q of qs) {
                expect(q.options).toHaveLength(4);
                // A sentence never names its own term; a short answer may (Mexico, Mexico City).
                const term = plainTerm(q.item.front).toLowerCase();
                const shown = (reverse ? q.labels[q.answer] : q.prompt) ?? "";
                if (shown.split(/\s+/).length > 3) expect(shown.toLowerCase()).not.toContain(term);
                expect(shown).not.toMatch(/^___ \S+$/);
            }
        }
    });

    it.each(DECKS)("%s makes a full match game of short tiles that never name their own term", (path) => {
        const tiles = buildMatch(deck(path), (c) => c.front, (c) => c.back);
        expect(tiles).toHaveLength(MATCH_PAIRS * 2);
        for (const t of tiles.filter((x) => x.side === "definition")) {
            expect(t.label.length).toBeLessThanOrEqual(81);
            const term = plainTerm(t.item.front).toLowerCase();
            if (t.label.split(/\s+/).length > 3) expect(t.label.toLowerCase()).not.toContain(term);
        }
    });

    it("the stars deck reads question callouts only, the nested answer split from a two-line question", () => {
        const cards = deck("Decks/Stars - The Night Sky.md");
        expect(cards[2]?.front).toBe("The Moon always shows Earth the same face.\nWhy?");
        expect(cards[2]?.back).toContain("about 27 days");
        expect(cards.some((c) => c.front.includes("Tonight"))).toBe(false);
    });

    it("the wildlife folder is five notes of one card each, the octopus asks its own question", () => {
        const dir = `${VAULT}/Decks/Wildlife - Animals`;
        const cards = readdirSync(dir).sort().map((f) => {
            const md = readFileSync(`${dir}/${f}`, "utf8");
            expect(modeOf(/^flashy:\s*(\S+)\s*$/m.exec(md)?.[1])).toBe("note");
            const name = f.replace(/\.md$/, "");
            return noteCard(md, noteFront(name, "Wildlife - Animals", false, /^flashy-prompt:\s*(.+)$/m.exec(md)?.[1]), name);
        });
        expect(cards.map((c) => c?.front)).toEqual(["Camel", "Elephant", "Hummingbird", "Why does an octopus have three hearts?", "Penguin"]);
        expect(cards[0]?.back.startsWith("A camel stores fat")).toBe(true);
        expect(new Set(cardIds(cards.filter((c) => c !== null)).map((c) => c.key)).size).toBe(5);
    });

    it("the glossary keeps its callout, list and table inside the answers", () => {
        const cards = deck("Decks/Biology - The Cell.md");
        expect(cards.find((c) => c.front === "Nucleus")?.back).toContain("> [!tip]");
        expect(cards.find((c) => c.front === "Chloroplast")?.back).toContain("| Leaf | many |");
    });

    it("the edge cases: SR comment dropped, repeated front, shared answer, long answer, code block ignored", () => {
        const cards = deck("Edge cases/Tricky.md");
        expect(cards.map((c) => c.front)).toEqual(["**stop_reason**", "Bark", "Bark", "Shell", "Husk", "Photosynthesis"]);
        expect(cards[0]?.back).not.toContain("<!--SR");
        expect(cardIds(cards)[2]?.key).toMatch(/-2$/);
        // Longer than the 280 characters a quiz question shows.
        expect(cards[5]?.back.length ?? 0).toBeGreaterThan(280);
    });

    it("the Quizlet export pastes as eight cards", () => {
        expect(parsePasted(readFileSync("e2e/data/music-tempo-quizlet.tsv", "utf8"))).toHaveLength(8);
    });
});
