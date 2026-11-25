import { describe, expect, it } from "vitest";
import { isLangChoice, language, LANGS, LOCALES, pickLang, setLanguage, strings } from "./index";

/** Names that must survive translation wherever the English text has them. */
const KEEP = ["Flashy", "Quizlet", "CSV", "Obsidian", "folder:", "(S)", "?"];

/** Every text of a locale by key; functions are called with sample arguments. */
function texts(code: (typeof LANGS)[number]["code"]): Map<string, string> {
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(LOCALES[code])) {
        out.set(k, typeof v === "function" ? String((v as (...a: unknown[]) => unknown)(7, 3, 2)) : String(v));
    }
    return out;
}
const english = texts("en");
const codes = LANGS.map((l) => l.code);

describe("locales", () => {
    it("offers English first, then Russian, and seven in all", () => {
        expect(codes).toEqual(["en", "ru", "es", "de", "fr", "pt", "ja"]);
    });

    it.each(codes)("%s has every text, none empty, no em dash", (code) => {
        const mine = texts(code);
        expect([...english.keys()].filter((k) => !mine.has(k))).toEqual([]);
        expect([...mine.keys()].filter((k) => !english.has(k))).toEqual([]);
        expect([...mine].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
        expect([...mine].filter(([, v]) => v.includes("\u2014")).map(([k]) => k)).toEqual([]);
    });

    it.each(codes)("%s keeps product names and syntax where the English text has them", (code) => {
        const mine = texts(code);
        const lost: string[] = [];
        for (const [k, en] of english) for (const w of KEEP) if (en.includes(w) && !(mine.get(k) ?? "").includes(w)) lost.push(`${k}: ${w}`);
        expect(lost).toEqual([]);
    });

    it.each(codes.filter((c) => c !== "en"))("%s is a translation, not a copy of English", (code) => {
        const same = [...texts(code)].filter(([k, v]) => v === english.get(k) && v.length > 12);
        expect(same.map(([k]) => k)).toEqual([]);
    });

    it.each(codes)("%s puts the numbers and names it is given into the text", (code) => {
        const t = LOCALES[code];
        expect(t.summary(7, 3)).toMatch(/7[\s\S]*3|3[\s\S]*7/);
        expect(t.blockMeta(4, 9, 2)).toContain("9");
        expect(t.pasteDone(5, "Kitchen")).toContain("Kitchen");
        expect(t.blockNoFolder("Decks")).toContain("Decks");
        expect(t.blockNoFolder("")).not.toContain("undefined");
        expect(t.matchMisses(1)).toContain("1");
        expect(t.matchMisses(4)).toContain("4");
    });

    it.each(codes)("%s names the copy-prompt command in the no-cards message as the command is called", (code) => {
        expect(LOCALES[code].noCards).toContain(LOCALES[code].cmdPrompt);
    });
});

describe("language choice", () => {
    it("maps Obsidian language codes, with English as the fallback", () => {
        expect(["en", "ru", "de", "pt-BR", "pt", "ja", "fr_CA", "ES", "zh-TW", ""].map(pickLang)).toEqual([
            "en", "ru", "de", "pt", "pt", "ja", "fr", "es", "en", "en",
        ]);
    });

    it("follows Obsidian on auto and the user's pick otherwise", () => {
        setLanguage("auto", "de");
        expect(language()).toBe("de");
        expect(strings().keep).toBe(LOCALES.de.keep);
        setLanguage("ja", "de");
        expect(language()).toBe("ja");
        setLanguage("auto", "ko");
        expect(strings()).toBe(LOCALES.en);
    });

    it("accepts only auto and the languages it ships", () => {
        expect(["auto", "en", "ja"].every(isLangChoice)).toBe(true);
        expect([undefined, "", "zh", 3].some(isLangChoice)).toBe(false);
    });
});
