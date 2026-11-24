/** One flashcard read from a note. `line` is the 0-based line of the `?` separator, for jumping back to the source. */
export interface Card {
    front: string;
    back: string;
    line: number;
}

const SEPARATOR = /^\?{1,2}$/;
const FENCE = /^\s*(```|~~~)/;
const SR_COMMENT = /<!--SR:[^>]*-->/g;

/**
 * Reads cards in the Spaced Repetition plugin's multi-line format: the front is the paragraph right above a line that
 * holds only `?` (or `??`), the back is the paragraph right below it. The plugin's scheduling comments
 * (`<!--SR:...-->`) are dropped from the back. Frontmatter and fenced code are skipped, so a `?` inside them is not a card.
 */
export function parseCards(markdown: string): Card[] {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const cards: Card[] = [];
    let start = 0;
    if (lines[0]?.trim() === "---") {
        const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
        if (end > 0) start = end + 1;
    }
    let inFence = false;
    for (let i = start; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (FENCE.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence || !SEPARATOR.test(line.trim())) continue;

        let top = i;
        while (top > start && (lines[top - 1] ?? "").trim() !== "") top--;
        let bottom = i;
        while (bottom + 1 < lines.length && (lines[bottom + 1] ?? "").trim() !== "") bottom++;

        const front = lines.slice(top, i).join("\n").trim();
        const back = lines
            .slice(i + 1, bottom + 1)
            .join("\n")
            .replace(SR_COMMENT, "")
            .trim();
        if (front && back) cards.push({ front, back, line: i });
        i = bottom;
    }
    return cards;
}
