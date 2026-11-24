import { describe, expect, it } from "vitest";
import { parseCards } from "./parse";
import { Session, shuffle } from "./session";

describe("parseCards", () => {
    it("reads the Spaced Repetition multi-line format", () => {
        const md = [
            "# Deck",
            "",
            "**Agentic Loop**",
            "?",
            "A control flow where Claude repeats.",
            "**Exam:** termination.",
            "",
            "**stop_reason**",
            "?",
            "Why the model stopped.",
        ].join("\n");
        expect(parseCards(md)).toEqual([
            { front: "**Agentic Loop**", back: "A control flow where Claude repeats.\n**Exam:** termination.", line: 3 },
            { front: "**stop_reason**", back: "Why the model stopped.", line: 8 },
        ]);
    });

    it("takes the whole paragraph above as the front and accepts ??", () => {
        const md = "intro\n\nline one\nline two\n??\nanswer";
        expect(parseCards(md)).toEqual([{ front: "line one\nline two", back: "answer", line: 4 }]);
    });

    it("drops the scheduling comments of the Spaced Repetition plugin", () => {
        const md = "Q\n?\nA\n<!--SR:!2026-12-01,3,250-->";
        expect(parseCards(md)[0]?.back).toBe("A");
    });

    it("skips frontmatter and fenced code", () => {
        const md = ["---", "tags: x", "?", "---", "```", "a", "?", "b", "```", "", "Q", "?", "A"].join("\n");
        expect(parseCards(md)).toEqual([{ front: "Q", back: "A", line: 11 }]);
    });

    it("ignores a separator without a front or a back, and CRLF line ends", () => {
        expect(parseCards("?\nA")).toEqual([]);
        expect(parseCards("Q\n?\n")).toEqual([]);
        expect(parseCards("Q\r\n?\r\nA")).toEqual([{ front: "Q", back: "A", line: 1 }]);
    });

    it("reads frontmatter that never closes as text", () => {
        expect(parseCards("---\nQ\n?\nA")).toEqual([{ front: "---\nQ", back: "A", line: 2 }]);
    });
});

describe("Session", () => {
    it("walks a round, counts grades and lists the cards to repeat", () => {
        const s = new Session(["a", "b", "c"]);
        expect(s.peek()).toBe("a");
        expect(s.peek(2)).toBe("c");
        expect(s.peek(3)).toBeUndefined();
        s.grade("keep");
        s.grade("repeat");
        s.grade("repeat");
        expect(s.done).toBe(true);
        expect(s.index).toBe(3);
        expect(s.total).toBe(3);
        expect(s.count("keep")).toBe(1);
        expect(s.graded("repeat")).toEqual(["b", "c"]);
        s.grade("keep");
        expect(s.count("keep")).toBe(1);
    });

    it("undoes the last grade and nothing before the start", () => {
        const s = new Session([1, 2]);
        expect(s.canUndo).toBe(false);
        expect(s.undo()).toBeUndefined();
        s.grade("repeat");
        expect(s.canUndo).toBe(true);
        expect(s.undo()).toBe("repeat");
        expect(s.peek()).toBe(1);
        expect(s.count("repeat")).toBe(0);
    });
});

describe("shuffle", () => {
    it("keeps every item and leaves the input alone", () => {
        const input = [1, 2, 3, 4];
        const out = shuffle(input, () => 0);
        expect(out.slice().sort()).toEqual(input);
        expect(out).not.toEqual(input);
        expect(input).toEqual([1, 2, 3, 4]);
        expect(shuffle(input).length).toBe(4);
    });
});
