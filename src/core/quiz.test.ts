import { describe, expect, it } from "vitest";
import { buildQuiz, gist, mask, plainTerm } from "./quiz";

describe("gist", () => {
    it("takes the first plain paragraph and skips callouts, tables, lists, headings, code and images", () => {
        const back = [
            "> [!tip] Exam context",
            "> Not this.",
            "",
            "| a | b |",
            "",
            "- a list",
            "",
            "### Sub",
            "",
            "```",
            "code",
            "",
            "more code",
            "```",
            "",
            "![[pic.png]]",
            "",
            "A control flow where **Claude** repeats",
            "until the task is done.",
            "",
            "Second paragraph.",
        ].join("\n");
        expect(gist(back)).toBe("A control flow where Claude repeats until the task is done.");
        expect(gist("> only a callout")).toBe("");
    });

    it("cuts a long paragraph at a word boundary", () => {
        const long = `${"word ".repeat(80)}end`;
        const g = gist(long);
        expect(g.endsWith("…")).toBe(true);
        expect(g.length).toBeLessThanOrEqual(281);
        expect(g).not.toMatch(/wor…$/);
    });
});

describe("mask", () => {
    it("hides the term in its definition, ignoring case and markdown", () => {
        expect(mask("The Agent SDK runs agents. agent sdk again.", "**Agent SDK**")).toBe("The ___ runs agents. ___ again.");
        expect(mask("a.b c", "a.b")).toBe("___ c");
        expect(mask("an ok text", "ok")).toBe("an ok text");
        expect(mask("A stop_reason value.", "**stop_reason**")).toBe("A ___ value.");
    });
});

describe("plainTerm", () => {
    it("drops bold, italics around the whole term and code marks, keeps underscores in names", () => {
        expect(plainTerm("**stop_reason**")).toBe("stop_reason");
        expect(plainTerm("`tool_use`")).toBe("tool_use");
        expect(plainTerm("*Hook*")).toBe("Hook");
        expect(plainTerm("__Skill__")).toBe("Skill");
    });
});

describe("buildQuiz", () => {
    type C = { f: string; b: string };
    const cards: C[] = [
        { f: "Hook", b: "Code that runs around a tool call." },
        { f: "Skill", b: "A packaged prompt." },
        { f: "Subagent", b: "A separate Claude instance." },
        { f: "Plan mode", b: "Read only exploration." },
        { f: "hook", b: "Same front in another case." },
        { f: "Callout only", b: "> [!tip] nothing plain" },
    ];
    let seed = 7;
    const random = (): number => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

    it("asks each usable card once with four distinct options and the right answer among them", () => {
        const qs = buildQuiz(cards, (c) => c.f, (c) => c.b, 20, random);
        expect(qs).toHaveLength(5);
        for (const q of qs) {
            const fronts = q.options.map((o) => o.f.toLowerCase());
            expect(new Set(fronts).size).toBe(q.options.length);
            expect(q.options[q.answer]).toBe(q.item);
            expect(q.options.length).toBeLessThanOrEqual(4);
            expect(q.prompt).not.toMatch(/hook/i);
        }
        expect(qs.find((q) => q.item.f === "Hook")?.options.some((o) => o.f === "hook")).toBe(false);
    });

    it("limits the count and needs two usable cards", () => {
        expect(buildQuiz(cards, (c) => c.f, (c) => c.b, 2)).toHaveLength(2);
        expect(buildQuiz(cards.slice(5), (c) => c.f, (c) => c.b, 20)).toEqual([]);
        const two = buildQuiz(cards.slice(0, 2), (c) => c.f, (c) => c.b, 20);
        expect(two.every((q) => q.options.length === 2)).toBe(true);
    });
});
