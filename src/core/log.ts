/**
 * The review log. Every device appends to its own file and never touches another device's, so no sync service can
 * produce a conflict in it. The state of every card is replayed from the logs of all devices (see schedule.ts).
 *
 * One review per line inside a fenced block: `<ISO time> <card key> <rating> <answer hash>`.
 * Rating is FSRS's: 1 again, 2 hard, 3 good, 4 easy. Flashy writes 1 and 3.
 */
export interface Entry {
    at: Date;
    key: string;
    rating: 1 | 2 | 3 | 4;
    back: string;
}

const FENCE = "```flashy-log";
const LINE = /^(\d{4}-\d{2}-\d{2}T[\d:.]+Z) (\S+) ([1-4]) (\S+)$/;

export function formatEntry(e: Entry): string {
    return `${e.at.toISOString()} ${e.key} ${e.rating} ${e.back}`;
}

/** Reads the entries of one log file. Lines that do not parse are skipped, so a hand edit cannot break the replay. */
export function parseLog(text: string): Entry[] {
    const out: Entry[] = [];
    let inside = false;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line === FENCE) {
            inside = true;
            continue;
        }
        if (inside && line.startsWith("```")) {
            inside = false;
            continue;
        }
        if (!inside) continue;
        const m = LINE.exec(line);
        if (!m) continue;
        const at = new Date(m[1] as string);
        if (Number.isNaN(at.getTime())) continue;
        out.push({ at, key: m[2] as string, rating: Number(m[3]) as Entry["rating"], back: m[4] as string });
    }
    return out;
}

/** A new log file for one device. */
export function newLog(device: string, entries: readonly Entry[]): string {
    return [
        "---",
        `flashy-device: ${device}`,
        "---",
        "",
        "%% Flashy review log of one device. Flashy only appends to it; editing it by hand changes your progress. %%",
        "",
        FENCE,
        ...entries.map(formatEntry),
        "```",
        "",
    ].join("\n");
}

/** Appends entries to an existing log, before its closing fence; a file without a log block gets one at the end. */
export function appendLog(text: string, device: string, entries: readonly Entry[]): string {
    if (!entries.length) return text;
    const lines = text.split("\n");
    const open = lines.findIndex((l) => l.trim() === FENCE);
    if (open < 0) return newLog(device, entries);
    let close = lines.findIndex((l, i) => i > open && l.trim().startsWith("```"));
    if (close < 0) {
        lines.push("```");
        close = lines.length - 1;
    }
    lines.splice(close, 0, ...entries.map(formatEntry));
    return lines.join("\n");
}

/** All entries of all devices in time order, each review once even if a file was copied or synced twice. */
export function merge(logs: readonly Entry[][]): Entry[] {
    const seen = new Set<string>();
    const out: Entry[] = [];
    for (const e of logs.flat()) {
        const id = `${e.at.getTime()} ${e.key}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(e);
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
