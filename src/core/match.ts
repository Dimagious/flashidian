import { gist, mask, plainTerm, plainText, shuffleWith } from "./quiz";

/**
 * The match game: terms and short definitions shuffled into one grid, tapped in pairs against a clock. Like the quiz,
 * it writes nothing to the review log.
 */

/** Pairs in one game: twelve tiles fit a phone screen. */
export const MATCH_PAIRS = 6;
/** A definition on a tile: about six short lines in a third of a phone's width. */
const MAX_TILE = 80;

export type TileSide = "term" | "definition";

export interface Tile<T> {
    /** Tiles with the same pair number match. */
    pair: number;
    item: T;
    side: TileSide;
    /** Plain text, shown as is. */
    label: string;
}

export interface MatchOptions {
    random?: () => number;
    pairs?: number;
}

/**
 * Up to `pairs` random cards as twice as many shuffled tiles. Two cards never share a front or a definition text:
 * otherwise a tile would match a twin that looks the same and the game would call a right tap wrong. Cards whose answer
 * has no plain paragraph are left out. Fewer than two usable cards: no game.
 */
export function buildMatch<T>(
    items: readonly T[],
    front: (t: T) => string,
    back: (t: T) => string,
    { random = Math.random, pairs = MATCH_PAIRS }: MatchOptions = {},
): Tile<T>[] {
    const usable = items
        .map((item) => {
            const f = front(item).trim();
            return { item, term: plainTerm(f), definition: mask(plainText(tileText(back(item))), f) };
        })
        .filter((x) => x.term && x.definition);
    const picked: typeof usable = [];
    for (const u of shuffleWith(usable, random)) {
        if (picked.length === pairs) break;
        const clash = picked.some(
            (p) => p.term.toLowerCase() === u.term.toLowerCase() || p.definition.toLowerCase() === u.definition.toLowerCase(),
        );
        if (!clash) picked.push(u);
    }
    if (picked.length < 2) return [];
    const tiles = picked.flatMap((p, pair): Tile<T>[] => [
        { pair, item: p.item, side: "term", label: p.term },
        { pair, item: p.item, side: "definition", label: p.definition },
    ]);
    return shuffleWith(tiles, random);
}

/** What a tap on tile `i` does, with tile `selected` (or none) picked before it. */
export type Tap = "select" | "deselect" | "match" | "miss";

/**
 * The second tap of a pair decides: the same pair matches, another pair misses. A tap on the picked tile drops it; a
 * tap on another tile of the same side moves the pick there instead of counting a miss.
 */
export function tap<T>(tiles: readonly Tile<T>[], selected: number | null, i: number): Tap {
    const a = selected === null ? undefined : tiles[selected];
    const b = tiles[i];
    if (!a || !b) return "select";
    if (selected === i) return "deselect";
    if (a.side === b.side) return "select";
    return a.pair === b.pair ? "match" : "miss";
}

/** The definition on a tile: the first sentence when it fits, else the start of the first paragraph cut at a word. */
export function tileText(back: string): string {
    const sentence = /^(.+?[.!?])(\s|$)/.exec(gist(back))?.[1];
    return sentence && sentence.length <= MAX_TILE ? sentence : gist(back, MAX_TILE);
}

/** Elapsed time for the clock and the best time: seconds with one decimal, `7.0`, `63.4`. */
export function formatTime(ms: number): string {
    return toSeconds(ms).toFixed(1);
}

/** Seconds with one decimal, the unit the best time is kept in. */
export function toSeconds(ms: number): number {
    return Math.max(0, Math.floor(ms / 100)) / 10;
}

/** A best time read back from a note property: a positive number of seconds, anything else is no best. */
export function readBest(value: unknown): number | undefined {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** True when a finished game beats the best so far (or there is none). */
export function isNewBest(best: number | undefined, ms: number): boolean {
    const s = toSeconds(ms);
    return s > 0 && (best === undefined || s < best);
}
