/** A pair read from pasted text. */
export interface Pair {
    front: string;
    back: string;
}

/** Splits one CSV line on commas outside double quotes; `""` inside quotes is a quote. */
function csvCells(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (quoted) {
            if (ch === '"' && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else if (ch === '"') quoted = false;
            else cur += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ",") {
            out.push(cur);
            cur = "";
        } else cur += ch;
    }
    out.push(cur);
    return out.map((c) => c.trim());
}

/**
 * Term and definition pairs from text copied out of Quizlet (its export puts a tab between term and definition and a
 * new line between cards), a spreadsheet (tabs), a CSV file, or a list written as `term - definition`. The separator
 * is picked from the text: tabs if any line has one, then semicolons or commas for CSV, then ` - ` or `: `.
 */
export function parsePasted(text: string): Pair[] {
    const lines = text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((l) => l.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").trimEnd())
        .filter((l) => l.trim());
    const split: (l: string) => string[] = lines.some((l) => l.includes("\t"))
        ? (l) => l.split("\t").map((c) => c.trim())
        : lines.every((l) => l.includes(";")) && !lines.every((l) => l.includes(","))
          ? (l) => l.split(";").map((c) => c.trim())
          : lines.every((l) => /,/.test(l)) && !lines.some((l) => / - |: /.test(l))
            ? csvCells
            : (l) => {
                  const m = /^(.+?)\s+[-–]\s+(.+)$/.exec(l) ?? /^([^:]+?):\s+(.+)$/.exec(l);
                  return m ? [m[1] as string, m[2] as string] : [l];
              };
    const pairs: Pair[] = [];
    for (const l of lines) {
        const [front, ...rest] = split(l);
        const back = rest.filter(Boolean).join(" ");
        if (front && back) pairs.push({ front, back });
    }
    return pairs;
}

/** A deck note in the multi-line format, readable by Flashy and by the Spaced Repetition plugin alike. */
export function deckNote(pairs: readonly Pair[]): string {
    return pairs.map((p) => `${p.front}\n?\n${p.back}`).join("\n\n") + "\n";
}
