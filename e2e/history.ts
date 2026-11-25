import { readdirSync, readFileSync } from "node:fs";
import { cardIds } from "../src/core/key";
import { type Entry, newLog } from "../src/core/log";
import { parseCards } from "../src/core/parse";
import { modeOf, parseStructured } from "../src/core/structured";

const DAY = 24 * 60 * 60 * 1000;

/**
 * A review log for the decks of the seed vault, dated back from `now`, so a test or a demo film shows a deck in use
 * on any day: of every five cards one is new, one was missed yesterday and is due, three were learned over a month.
 * Seed it as `Flashy/log-demo.md`.
 */
export function demoHistory(now: Date, folder = "e2e-vault.pristine/Decks"): string {
    const entries: Entry[] = [];
    const at = (days: number): Date => new Date(now.getTime() - days * DAY);
    for (const name of readdirSync(folder).filter((f) => f.endsWith(".md")).sort()) {
        const md = readFileSync(`${folder}/${name}`, "utf8");
        const mode = modeOf(/^flashy:\s*(\S+)\s*$/m.exec(md)?.[1]);
        cardIds(mode ? parseStructured(md, mode) : parseCards(md)).forEach(({ key, back }, i) => {
            if (i % 5 === 0) return;
            if (i % 5 === 1) entries.push({ at: at(1), key, rating: 1, back });
            else for (const d of [30, 21, 9]) entries.push({ at: at(d + (i % 3)), key, rating: 3, back });
        });
    }
    entries.sort((a, b) => a.at.getTime() - b.at.getTime());
    return newLog("demo", entries);
}
