import { describe, expect, it } from "vitest";
import { deckNote, parsePasted } from "./paste";
import { parseCards } from "./parse";
import { modeOf, noteCard, noteFront, parseStructured } from "./structured";

describe("modeOf", () => {
    it("reads the flashy property", () => {
        expect(modeOf(true)).toBe("auto");
        expect(modeOf("true")).toBe("auto");
        expect(modeOf("auto")).toBe("auto");
        expect(modeOf("table")).toBe("table");
        expect(modeOf("headings")).toBe("headings");
        expect(modeOf("list")).toBe("list");
        expect(modeOf("callouts")).toBe("callouts");
        expect(modeOf("note")).toBe("note");
        expect(modeOf(false)).toBeNull();
        expect(modeOf(undefined)).toBeNull();
        expect(modeOf("cards")).toBeNull();
    });
});

const glossary = [
    "---",
    "flashy: true",
    "---",
    "# Glossary 1",
    "",
    "Intro line.",
    "",
    "## Agentic Loop",
    "",
    "A control flow that repeats.",
    "",
    "> [!tip] Exam context",
    "> Termination conditions.",
    "",
    "| a | b |",
    "|---|---|",
    "| x | y |",
    "",
    "## Empty",
    "",
    "## stop_reason ##",
    "",
    "Why the model stopped.",
    "```",
    "## not a heading",
    "```",
    "---",
    "# Next part",
    "## Late",
    "late answer",
].join("\n");

describe("parseStructured", () => {
    it("reads headings: level 2 fronts, text up to the next level 1 or 2 heading, code kept in the back", () => {
        const cards = parseStructured(glossary, "auto");
        expect(cards.map((c) => c.front)).toEqual(["Agentic Loop", "stop_reason", "Late"]);
        expect(cards[0]?.back).toContain("> [!tip] Exam context");
        expect(cards[0]?.back).toContain("| x | y |");
        expect(cards[1]?.back).toBe("Why the model stopped.\n```\n## not a heading\n```");
        expect(cards[0]?.line).toBe(7);
    });

    it("reads a table when there are no headings, and only the table when asked", () => {
        const md = ["| Term | Meaning | Note |", "| :--- | --- | ---: |", "| MCP | Model Context Protocol | open |", "| a \\| b | pipe | |", "| empty | |", "", "- x - y"].join("\n");
        expect(parseStructured(md, "auto")).toEqual([
            { front: "MCP", back: "Model Context Protocol\n\nopen", line: 2 },
            { front: "a | b", back: "pipe", line: 3 },
        ]);
        expect(parseStructured(md, "table")).toHaveLength(2);
        expect(parseStructured("| only |\n|---|\n| one |", "table")).toEqual([]);
        expect(parseStructured("| a | b |\nnot a separator", "table")).toEqual([]);
    });

    it("reads list items in three shapes and skips tasks and plain items", () => {
        const md = ["- **Hook** runs code around a tool call", "- Subagent - a separate instance", "- Plan mode: read only", "- [ ] a task: not a card", "- just a line", "  - nested - skipped", "* Skill – a packaged prompt"].join("\n");
        expect(parseStructured(md, "auto").map((c) => [c.front, c.back])).toEqual([
            ["Hook", "runs code around a tool call"],
            ["Subagent", "a separate instance"],
            ["Plan mode", "read only"],
            ["Skill", "a packaged prompt"],
        ]);
        expect(parseStructured(md, "list")).toHaveLength(4);
        expect(parseStructured(md, "headings")).toEqual([]);
        expect(parseStructured("nothing here", "auto")).toEqual([]);
    });
});

describe("parsePasted", () => {
    it("reads Quizlet's tab export and spreadsheet rows", () => {
        expect(parsePasted("Agentic Loop\tA control flow\r\nstop_reason\tWhy it stopped\textra\n\nlonely\t")).toEqual([
            { front: "Agentic Loop", back: "A control flow" },
            { front: "stop_reason", back: "Why it stopped extra" },
        ]);
    });

    it("reads CSV with quotes and semicolon CSV", () => {
        expect(parsePasted('"Hook, pre","Runs ""before"" a call"\nSkill,Prompt')).toEqual([
            { front: "Hook, pre", back: 'Runs "before" a call' },
            { front: "Skill", back: "Prompt" },
        ]);
        expect(parsePasted("Hook;runs code\nSkill;a prompt")).toEqual([
            { front: "Hook", back: "runs code" },
            { front: "Skill", back: "a prompt" },
        ]);
    });

    it("reads dash and colon lists, with or without bullets and numbers", () => {
        expect(parsePasted("- Hook - runs code, then more\n2. Skill: a prompt\nno separator")).toEqual([
            { front: "Hook", back: "runs code, then more" },
            { front: "Skill", back: "a prompt" },
        ]);
    });

    it("writes a deck note Flashy reads back", () => {
        const pairs = parsePasted("Hook\truns code\nSkill\ta prompt");
        expect(parseCards(deckNote(pairs)).map((c) => [c.front, c.back])).toEqual([
            ["Hook", "runs code"],
            ["Skill", "a prompt"],
        ]);
    });
});

describe("callout cards", () => {
    const note = [
        "---",
        "flashy: callouts",
        "---",
        "> [!Question|exam]- How far is the moon?",
        "> 384,400 km",
        ">",
        "> On average.",
        "",
        "> [!faq]+ **Bold** front",
        "> back",
        "",
        "> [!question]",
        "> Which planet is the largest,",
        "> and how big is it?",
        "> > [!answer]-",
        "> > Jupiter.",
        ">>",
        ">> About 11 Earths across.",
        "",
        "> [!question]",
        "> No title and no answer: not a card.",
        "",
        "> [!question] Open question, nothing under it",
        "",
        "> [!help]- A hint, not a card",
        "> text",
        "",
        "```",
        "> [!question] Inside code",
        "> no",
        "```",
        "",
        "> [!question] Answer callout with a title",
        "> > [!answer] Paris",
        "> > The capital.",
    ].join("\n");

    it("reads question callouts: title front, body back, blank lines kept, fold marks and metadata ignored", () => {
        const cards = parseStructured(note, "callouts");
        expect(cards.map((c) => c.front)).toEqual([
            "How far is the moon?",
            "**Bold** front",
            "Which planet is the largest,\nand how big is it?",
            "Answer callout with a title",
        ]);
        expect(cards[0]?.back).toBe("384,400 km\n\nOn average.");
        expect(cards[0]?.line).toBe(3);
        expect(cards[1]?.back).toBe("back");
        expect(cards[2]?.back).toBe("Jupiter.\n\nAbout 11 Earths across.");
        expect(cards[3]?.back).toBe("Paris\nThe capital.");
    });

    it("come last in auto, so a note that had cards keeps them", () => {
        const both = ["## Heading", "", "text", "", "> [!question] Q", "> A"].join("\n");
        expect(parseStructured(both, "auto").map((c) => c.front)).toEqual(["Heading"]);
        expect(parseStructured("> [!question] Q\n> A", "auto").map((c) => c.front)).toEqual(["Q"]);
    });
});

describe("a note as one card", () => {
    it("takes the prompt, else the file name, with the folder when the name is not unique", () => {
        expect(noteFront("Osmosis", "Biology", false)).toBe("Osmosis");
        expect(noteFront("Introduction", "Biology", true)).toBe("Introduction (Biology)");
        expect(noteFront("Introduction", "", true)).toBe("Introduction");
        expect(noteFront("Osmosis", "Biology", true, " What is osmosis? ")).toBe("What is osmosis?");
        expect(noteFront("Osmosis", "Biology", false, 42)).toBe("Osmosis");
        expect(noteFront("Osmosis", "Biology", false, "  ")).toBe("Osmosis");
    });

    it("is the whole body: no frontmatter, no heading that repeats the name, no SR comments", () => {
        const md = ["---", "flashy: note", "---", "# Osmosis", "", "Water moves across a membrane.", "", "> [!tip] Remember", "> Low to high concentration.", "<!--SR:!2026-01-01,3,250-->"].join("\n");
        const card = noteCard(md, "Osmosis", "Osmosis");
        expect(card?.front).toBe("Osmosis");
        expect(card?.back).toBe("Water moves across a membrane.\n\n> [!tip] Remember\n> Low to high concentration.");
        expect(card?.line).toBe(3);
    });

    it("keeps a first heading that says something else, and gives no card for an empty note", () => {
        expect(noteCard("# Summary\ntext", "Osmosis", "Osmosis")?.back).toBe("# Summary\ntext");
        expect(noteCard("---\nflashy: note\n---\n# Osmosis\n", "Osmosis", "Osmosis")).toBeNull();
        expect(noteCard("text", " ", "x")).toBeNull();
    });
});
