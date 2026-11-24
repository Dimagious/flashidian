import type { Card } from "./parse";

/**
 * Text as the reader sees it: markdown marks dropped, whitespace collapsed, case folded. Bold on, bold off or a
 * reflowed paragraph keeps the same card.
 */
export function normalize(text: string): string {
    return text
        .replace(/[*_`~#>=[\]]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

/** cyrb53: a fast 53-bit string hash, rendered in base 36. Stable across devices and versions. */
export function hash(text: string): string {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** A card's identity and the fingerprint of its answer, used to carry progress over when the front is edited. */
export interface CardId {
    key: string;
    back: string;
}

/**
 * Keys for the cards of one note: the hash of the front, plus `-2`, `-3` for repeats of the same front in that note.
 * The note's path is not part of the key, so moving or renaming a deck keeps its progress.
 */
export function cardIds(cards: readonly Card[]): CardId[] {
    const seen = new Map<string, number>();
    return cards.map((c) => {
        const base = hash(normalize(c.front));
        const n = (seen.get(base) ?? 0) + 1;
        seen.set(base, n);
        return { key: n === 1 ? base : `${base}-${n}`, back: hash(normalize(c.back)) };
    });
}
