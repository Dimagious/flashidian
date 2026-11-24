import type { Card } from "./parse";

/**
 * Cards from ordinary markdown, for notes that opt in with a `flashy` property. One shape per note, so a glossary's
 * tables and lists stay inside its answers instead of turning into cards of their own:
 *
 * - `headings`: every `## Heading` is a front, the text up to the next heading of level 1 or 2 is the back.
 * - `table`: every row of a table with two or more columns: the first cell is the front, the others the back.
 * - `list`: every top-level item `term - definition`, `term: definition` or `**term** definition`.
 *
 * `auto` (the property set to `true`) takes headings if the note has any with text under them, else tables, else lists.
 */
export type Shape = "headings" | "table" | "list";
export type Mode = Shape | "auto";

/** Reads the `flashy` property: true or "auto", or a shape name. Anything else means the note did not opt in. */
export function modeOf(value: unknown): Mode | null {
    if (value === true || value === "true" || value === "auto") return "auto";
    if (value === "headings" || value === "table" || value === "list") return value;
    return null;
}

/** Lines outside frontmatter and fenced code, with their line numbers; code lines come back as blanks. */
function bodyLines(markdown: string): string[] {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    let start = 0;
    if (lines[0]?.trim() === "---") {
        const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
        if (end > 0) start = end + 1;
    }
    let fence = false;
    return lines.map((l, i) => {
        if (i < start) return "";
        if (/^\s*(```|~~~)/.test(l)) {
            fence = !fence;
            return "";
        }
        return fence ? "" : l;
    });
}

function headingCards(markdown: string): Card[] {
    const all = markdown.replace(/\r\n?/g, "\n").split("\n");
    const visible = bodyLines(markdown);
    const cards: Card[] = [];
    for (let i = 0; i < visible.length; i++) {
        const m = /^##\s+(.+?)\s*#*\s*$/.exec(visible[i] ?? "");
        if (!m?.[1]) continue;
        let end = i + 1;
        while (end < visible.length && !/^#{1,2}\s/.test(visible[end] ?? "")) end++;
        // The back keeps fenced code: a code sample can be the answer.
        const back = all
            .slice(i + 1, end)
            .join("\n")
            .replace(/\n-{3,}\s*$/, "")
            .trim();
        if (back) cards.push({ front: m[1], back, line: i });
        i = end - 1;
    }
    return cards;
}

/** Cells of a table row; `\|` is a pipe inside a cell. No lookbehind: iOS before 16.4 cannot parse one. */
function cells(row: string): string[] {
    const PIPE = "\u0000";
    return row
        .trim()
        .replace(/\\\|/g, PIPE)
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim().split(PIPE).join("|"));
}

function tableCards(markdown: string): Card[] {
    const lines = bodyLines(markdown);
    const cards: Card[] = [];
    for (let i = 0; i + 1 < lines.length; i++) {
        const head = lines[i] ?? "";
        const sep = lines[i + 1] ?? "";
        if (!head.trim().startsWith("|") || !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(sep)) continue;
        if (cells(head).length < 2) continue;
        let r = i + 2;
        for (; r < lines.length && (lines[r] ?? "").trim().startsWith("|"); r++) {
            const [front, ...rest] = cells(lines[r] ?? "");
            const back = rest.filter(Boolean).join("\n\n");
            if (front && back) cards.push({ front, back, line: r });
        }
        i = r - 1;
    }
    return cards;
}

const LIST = [
    /^\*\*(.+?)\*\*\s*(?:[:\-–]\s*)?(.+)$/,
    /^(.{1,80}?)\s+[-–]\s+(.+)$/,
    /^([^:]{1,80}?):\s+(.+)$/,
];

function listCards(markdown: string): Card[] {
    const cards: Card[] = [];
    bodyLines(markdown).forEach((line, i) => {
        const item = /^[-*+]\s+(?!\[[ xX]\]\s)(.+)$/.exec(line);
        if (!item?.[1]) return;
        for (const re of LIST) {
            const m = re.exec(item[1].trim());
            if (m?.[1] && m[2]?.trim()) {
                cards.push({ front: m[1].trim(), back: m[2].trim(), line: i });
                return;
            }
        }
    });
    return cards;
}

/** Cards of a note that opted in. */
export function parseStructured(markdown: string, mode: Mode): Card[] {
    if (mode === "headings") return headingCards(markdown);
    if (mode === "table") return tableCards(markdown);
    if (mode === "list") return listCards(markdown);
    for (const read of [headingCards, tableCards, listCards]) {
        const cards = read(markdown);
        if (cards.length) return cards;
    }
    return [];
}
