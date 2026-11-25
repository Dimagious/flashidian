import { gist, mask, plainTerm, plainText } from "./quiz";

/**
 * Which side of a card faces the reader first. `definition` and `mixed` ask for the term from its answer, like
 * Quizlet's "Front: Definition". The schedule is the card's either way.
 */
export type Side = "term" | "definition" | "mixed";

export const SIDES: readonly Side[] = ["term", "definition", "mixed"];

export function isSide(value: unknown): value is Side {
    return SIDES.includes(value as Side);
}

/** True when the card shows its answer first. `mixed` flips a coin per card. */
export function answerFirst(side: Side, random: () => number = Math.random): boolean {
    return side === "definition" || (side === "mixed" && random() < 0.5);
}

/** The answer as a question: the term hidden in it, so the card does not answer itself. */
export function answerAsFront(front: string, back: string): string {
    return mask(back, front);
}

/**
 * What text-to-speech reads for one side: the term as plain text, or the first plain paragraph of an answer (the
 * definition, not the callouts and tables under it).
 */
export function speechText(markdown: string, isTerm: boolean): string {
    const text = isTerm ? plainTerm(markdown.replace(/\s+/g, " ")) : gist(markdown, 600);
    return plainText(text).replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, "$1").trim();
}

/**
 * The language to read a side in: the deck's own (`flashy-lang`) for the term side, else guessed from the script:
 * Cyrillic is Russian, anything else English. A voice of the wrong language reads a word as gibberish, so the guess
 * matters more than its precision.
 */
export function speechLang(text: string, declared?: string): string {
    if (declared?.trim()) return declared.trim();
    return /[Ѐ-ӿ]/.test(text) ? "ru" : "en";
}
