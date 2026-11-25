import { describe, expect, it } from "vitest";
import { buildMatch, formatTime, isNewBest, MATCH_PAIRS, readBest, tap, type Tile, tileText, toSeconds } from "./match";

interface C {
    front: string;
    back: string;
}

const card = (front: string, back: string): C => ({ front, back });
const build = (cards: C[], pairs?: number): Tile<C>[] =>
    buildMatch(cards, (c) => c.front, (c) => c.back, { random: seeded(7), ...(pairs ? { pairs } : {}) });

/** A small deterministic generator, so the shuffles repeat. */
function seeded(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

const deck = Array.from({ length: 10 }, (_, i) => card(`Term ${i}`, `Definition number ${i} of the deck.`));

describe("buildMatch", () => {
    it("makes six pairs from a bigger deck: one term and one definition tile each", () => {
        const tiles = build(deck);
        expect(tiles).toHaveLength(MATCH_PAIRS * 2);
        for (let pair = 0; pair < MATCH_PAIRS; pair++) {
            const two = tiles.filter((t) => t.pair === pair);
            expect(two.map((t) => t.side).sort()).toEqual(["definition", "term"]);
            expect(two[0]?.item).toBe(two[1]?.item);
        }
    });

    it("uses every card of a deck smaller than a game", () => {
        expect(build(deck.slice(0, 3))).toHaveLength(6);
    });

    it("needs two usable cards", () => {
        expect(build(deck.slice(0, 1))).toEqual([]);
        expect(build([card("A", "> only a callout"), card("B", "A plain answer.")])).toEqual([]);
        expect(build([])).toEqual([]);
    });

    it("never puts two cards with the same front or the same definition in one game", () => {
        const twins = [card("Bark", "The outer layer of a tree."), card("Bark", "The sound a dog makes."), card("Husk", "Dry outer covering"), card("Shell", "Dry outer covering")];
        const tiles = build(twins);
        const terms = tiles.filter((t) => t.side === "term").map((t) => t.label);
        const defs = tiles.filter((t) => t.side === "definition").map((t) => t.label);
        expect(new Set(terms).size).toBe(terms.length);
        expect(new Set(defs).size).toBe(defs.length);
        expect(tiles).toHaveLength(4);
    });

    it("shows plain text: no bold marks on terms, the term hidden in a sentence, a long answer cut", () => {
        const tiles = build([
            card("**Mitosis**", "Mitosis is the division of one cell into two identical cells, step by step, through four phases in a row."),
            card("Paris", "Capital of France"),
        ]);
        expect(tiles.find((t) => t.side === "term" && t.pair === tiles.find((x) => x.label === "Mitosis")?.pair)?.label).toBe("Mitosis");
        const def = tiles.find((t) => t.side === "definition" && t.label.startsWith("___"))?.label ?? "";
        expect(def).not.toContain("Mitosis");
        expect(def.endsWith("…")).toBe(true);
        expect(def.length).toBeLessThanOrEqual(81);
    });

    it("takes a different game on another shuffle", () => {
        const a = buildMatch(deck, (c) => c.front, (c) => c.back, { random: seeded(1) }).map((t) => t.label);
        const b = buildMatch(deck, (c) => c.front, (c) => c.back, { random: seeded(2) }).map((t) => t.label);
        expect(a).not.toEqual(b);
    });
});

describe("tileText", () => {
    it("takes the first sentence when it fits, else cuts the paragraph at a word", () => {
        expect(tileText("A short one. And more after it that would not fit on a small tile at all, no way.")).toBe("A short one.");
        expect(tileText("Paris")).toBe("Paris");
        const long = `${"word ".repeat(30)}end.`;
        expect(tileText(long).endsWith("…")).toBe(true);
        expect(tileText(long).length).toBeLessThanOrEqual(81);
    });
});

describe("tap", () => {
    const tiles: Tile<string>[] = [
        { pair: 0, item: "a", side: "term", label: "A" },
        { pair: 1, item: "b", side: "definition", label: "b" },
        { pair: 0, item: "a", side: "definition", label: "a" },
        { pair: 1, item: "b", side: "term", label: "B" },
    ];

    it("picks the first tile, drops it on a second tap", () => {
        expect(tap(tiles, null, 0)).toBe("select");
        expect(tap(tiles, 0, 0)).toBe("deselect");
    });

    it("matches a pair and misses another", () => {
        expect(tap(tiles, 0, 2)).toBe("match");
        expect(tap(tiles, 1, 3)).toBe("match");
        expect(tap(tiles, 0, 1)).toBe("miss");
    });

    it("moves the pick to another tile of the same side", () => {
        expect(tap(tiles, 0, 3)).toBe("select");
    });

    it("selects when the earlier pick is gone", () => {
        expect(tap(tiles, 9, 0)).toBe("select");
    });
});

describe("time", () => {
    it("shows tenths of a second, rounded down", () => {
        expect(formatTime(0)).toBe("0.0");
        expect(formatTime(7_049)).toBe("7.0");
        expect(formatTime(63_480)).toBe("63.4");
        expect(formatTime(-5)).toBe("0.0");
        expect(toSeconds(12_345)).toBe(12.3);
    });

    it("reads a best time back from a property", () => {
        expect(readBest(21.4)).toBe(21.4);
        expect(readBest("18.2")).toBe(18.2);
        expect(readBest(0)).toBeUndefined();
        expect(readBest(-3)).toBeUndefined();
        expect(readBest("fast")).toBeUndefined();
        expect(readBest(null)).toBeUndefined();
        expect(readBest(Number.POSITIVE_INFINITY)).toBeUndefined();
    });

    it("counts a new best when there is none or the game was faster", () => {
        expect(isNewBest(undefined, 20_000)).toBe(true);
        expect(isNewBest(21.4, 20_000)).toBe(true);
        expect(isNewBest(20, 20_050)).toBe(false);
        expect(isNewBest(19.9, 20_000)).toBe(false);
        expect(isNewBest(undefined, 50)).toBe(false);
    });
});
