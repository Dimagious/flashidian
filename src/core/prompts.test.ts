import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cardIds } from "./key";
import { type Card, parseCards } from "./parse";
import { buildMatch } from "./match";
import { gist } from "./quiz";
import { modeOf, noteCard, noteFront, parseStructured } from "./structured";

/**
 * The prompts in `prompts/` ask an assistant for notes in Flashy's formats. The example output in each one goes through
 * the real parsers here, so a change to a format or to a prompt that breaks the other fails.
 */
function prompt(name: string): string {
    return readFileSync(`prompts/${name}.md`, "utf8");
}

/** Bodies of the fenced blocks of one language that start a line. */
function blocks(md: string, lang: string): string[] {
    const out: string[] = [];
    const re = new RegExp(`^\`\`\`${lang}\\n([\\s\\S]*?)^\`\`\`$`, "gm");
    for (let m = re.exec(md); m; m = re.exec(md)) out.push(m[1] ?? "");
    return out;
}

function example(name: string): string {
    const found = blocks(prompt(name), "markdown");
    expect(found).toHaveLength(1);
    return found[0] ?? "";
}

/** The path `build()` takes: SR cards always, plus the shape the `flashy` property names. */
function cardsOf(md: string): Card[] {
    const mode = modeOf(/^flashy:\s*(\S+)\s*$/m.exec(md)?.[1]);
    return [...parseCards(md), ...(mode && mode !== "note" ? parseStructured(md, mode) : [])];
}

function usable(cards: Card[]): void {
    expect(new Set(cardIds(cards).map((c) => c.key)).size).toBe(cards.length);
    for (const c of cards) expect(gist(c.back)).not.toBe("");
    expect(buildMatch(cards, (c) => c.front, (c) => c.back)).toHaveLength(cards.length * 2);
}

describe("prompts", () => {
    it.each(["glossary-from-lecture-notes", "vocabulary-cards", "questions-from-a-chapter", "notes-as-cards"])(
        "%s has no em dash",
        (name) => expect(prompt(name)).not.toContain("\u2014"),
    );

    it("the glossary example is three heading cards, each answer opening with a plain sentence", () => {
        const cards = cardsOf(example("glossary-from-lecture-notes"));
        expect(cards.map((c) => c.front)).toEqual(["Cumulus", "Stratus", "Cirrus"]);
        expect(cards[0]?.back).toBe("A puffy cloud with a flat base that forms on warm, sunny days.\n\nGrows into a storm cloud when the air keeps rising.");
        expect(cards[2]?.back).toContain("- Height: above 6 km");
        usable(cards);
    });

    it("the vocabulary example is three ? cards with the example sentence on the back", () => {
        const md = example("vocabulary-cards");
        expect(/^flashy-lang:\s*fr$/m.test(md)).toBe(true);
        const cards = cardsOf(md);
        expect(cards.map((c) => c.front)).toEqual(["la pomme", "le fromage", "peser"]);
        expect(cards[1]?.back).toBe("cheese\n*Ce fromage vient de Normandie.* - This cheese comes from Normandy.");
        usable(cards);
    });

    it("the chapter example is three callout cards, the long one split at its nested answer", () => {
        const cards = cardsOf(example("questions-from-a-chapter"));
        expect(cards.map((c) => c.front)).toEqual([
            "Why do volcanoes form along plate edges?",
            "What makes an eruption explosive?",
            "Hawaii sits in the middle of a plate, far from any edge.\nHow did its volcanoes form?",
        ]);
        expect(cards[1]?.back).toBe("Thick magma traps gas until the pressure bursts it open.\nRunny magma lets the gas out and flows instead.");
        expect(cards[2]?.back).toBe("A hot spot under the plate melts rock as the plate slides over it.");
        usable(cards);
    });

    it("the note-card example gives properties that make each note one card, the prompt replacing a weak name", () => {
        const props = blocks(prompt("notes-as-cards"), "yaml");
        expect(props).toHaveLength(2);
        const names = ["Golden Gate Bridge", "Rainbow"];
        const cards = props.map((yaml, i) => {
            const md = `---\n${yaml}---\nSome text of the note.\n`;
            expect(modeOf(/^flashy:\s*(\S+)\s*$/m.exec(md)?.[1])).toBe("note");
            const name = names[i] ?? "";
            return noteCard(md, noteFront(name, "Notes", false, /^flashy-prompt:\s*(.+)$/m.exec(md)?.[1]), name);
        });
        expect(cards.map((c) => c?.front)).toEqual(["Golden Gate Bridge", "Why is a rainbow curved?"]);
        expect(cards[1]?.back).toBe("Some text of the note.");
    });
});
