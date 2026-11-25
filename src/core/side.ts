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

const REGIONS: Record<string, string> = {
    en: "en-US", ru: "ru-RU", es: "es-ES", de: "de-DE", fr: "fr-FR", it: "it-IT", pt: "pt-BR",
    ja: "ja-JP", zh: "zh-CN", ko: "ko-KR", nl: "nl-NL", pl: "pl-PL", tr: "tr-TR", uk: "uk-UA",
};

/** A full tag for a bare language code: iOS speaks `en-US` but may stay silent on `en`. A tag with a region is kept. */
export function speechLocale(lang: string): string {
    const l = lang.trim().replace("_", "-");
    if (l.includes("-")) return l;
    return REGIONS[l.toLowerCase()] ?? l;
}

/** The voice for a tag: the exact one, else any of the same language. */
export function pickVoice<V extends { lang: string }>(voices: readonly V[], tag: string): V | undefined {
    const want = tag.toLowerCase().replace("_", "-");
    const base = want.split("-")[0] ?? want;
    const norm = (v: V): string => v.lang.toLowerCase().replace("_", "-");
    return voices.find((v) => norm(v) === want) ?? voices.find((v) => norm(v).split("-")[0] === base);
}
