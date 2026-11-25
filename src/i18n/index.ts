import { de } from "./de";
import { en, type Strings } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { pt } from "./pt";
import { ru } from "./ru";

/**
 * Flashy's interface languages, one file each. The language is the user's choice in the settings, or Obsidian's when
 * the choice is automatic, or English when Obsidian speaks something Flashy does not. Nothing here imports Obsidian:
 * the plugin passes Obsidian's language code in, so the tests run without it.
 */
export type { Strings };
export type Lang = "en" | "ru" | "es" | "de" | "fr" | "pt" | "ja";
export type LangChoice = "auto" | Lang;

/** In the order the settings offer them; `native` is how each language names itself. */
export const LANGS: ReadonlyArray<{ code: Lang; native: string }> = [
    { code: "en", native: "English" },
    { code: "ru", native: "Русский" },
    { code: "es", native: "Español" },
    { code: "de", native: "Deutsch" },
    { code: "fr", native: "Français" },
    { code: "pt", native: "Português" },
    { code: "ja", native: "日本語" },
];

export const LOCALES: Record<Lang, Strings> = { en, ru, es, de, fr, pt, ja };

export function isLangChoice(value: unknown): value is LangChoice {
    return value === "auto" || LANGS.some((l) => l.code === value);
}

/** The language for an Obsidian language code (`de`, `pt-BR`, `zh-TW`...): its base, or English. */
export function pickLang(code: string): Lang {
    const base = code.toLowerCase().split(/[-_]/)[0] ?? "";
    return LANGS.find((l) => l.code === base)?.code ?? "en";
}

let current: Lang = "en";

/** Sets the interface language from the user's choice and Obsidian's language code. */
export function setLanguage(choice: LangChoice, obsidian: string): void {
    current = choice === "auto" ? pickLang(obsidian) : choice;
}

/** The interface language now, for dates and anything else formatted by locale. */
export function language(): Lang {
    return current;
}

export function strings(): Strings {
    return LOCALES[current];
}
