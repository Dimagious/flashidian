import { describe, expect, it } from "vitest";
import { cardIds, hash, normalize } from "./key";
import { appendLog, type Entry, formatEntry, merge, newLog, parseLog } from "./log";
import { attach, localDay, replay, startedToday, stats, todayQueue } from "./schedule";

const at = (iso: string): Date => new Date(iso);
const entry = (iso: string, key: string, rating: Entry["rating"], back = "b"): Entry => ({ at: at(iso), key, rating, back });

describe("card keys", () => {
    it("ignore markdown, spacing and case", () => {
        expect(normalize("**Agentic   Loop**\n")).toBe("agentic loop");
        expect(hash(normalize("**Agentic Loop**"))).toBe(hash(normalize("agentic loop")));
        expect(hash("a")).not.toBe(hash("b"));
    });

    it("number repeated fronts within a note and fingerprint the answer", () => {
        const ids = cardIds([
            { front: "Q", back: "one", line: 1 },
            { front: "**Q**", back: "two", line: 5 },
            { front: "Other", back: "one", line: 9 },
        ]);
        expect(ids[1]?.key).toBe(`${ids[0]?.key}-2`);
        expect(ids[2]?.key).not.toBe(ids[0]?.key);
        expect(ids[0]?.back).toBe(ids[2]?.back);
    });
});

describe("review log", () => {
    it("round-trips entries through a new file and an append", () => {
        const a = entry("2026-11-24T10:00:00.000Z", "k1", 3);
        const b = entry("2026-11-24T10:01:00.000Z", "k2", 1, "x");
        const file = appendLog(newLog("dev1", [a]), "dev1", [b]);
        expect(file).toContain("flashy-device: dev1");
        expect(parseLog(file)).toEqual([a, b]);
        expect(appendLog(file, "dev1", [])).toBe(file);
        expect(formatEntry(a)).toBe("2026-11-24T10:00:00.000Z k1 3 b");
    });

    it("skips broken lines and text outside the block, and repairs a missing block or fence", () => {
        const text = ["2026-11-24T10:00:00.000Z k0 3 b", "```flashy-log", "garbage", "2026-13-45T99:00:00.000Z k9 3 b", "2026-11-24T10:00:00.000Z k1 3 b", "```", "2026-11-24T10:00:00.000Z k2 3 b"].join("\n");
        expect(parseLog(text).map((e) => e.key)).toEqual(["k1"]);
        const e = entry("2026-11-24T11:00:00.000Z", "k3", 3);
        expect(parseLog(appendLog("just text", "d", [e]))).toEqual([e]);
        expect(parseLog(appendLog("```flashy-log\n2026-11-24T10:00:00.000Z k1 3 b", "d", [e])).map((x) => x.key)).toEqual(["k1", "k3"]);
    });

    it("merges devices in time order and drops a review seen twice", () => {
        const a = entry("2026-11-24T10:00:00.000Z", "k", 3);
        const b = entry("2026-11-23T10:00:00.000Z", "k", 1);
        expect(merge([[a], [b, a]])).toEqual([b, a]);
    });
});

describe("schedule", () => {
    const now = at("2026-11-24T12:00:00.000Z");

    it("replays good into days and again into tomorrow, and remembers the first day", () => {
        const s = replay([entry("2026-11-24T10:00:00.000Z", "good", 3), entry("2026-11-24T10:00:00.000Z", "again", 1), entry("2026-11-27T10:00:00.000Z", "good", 3)]);
        expect(s.get("again")?.fsrs.due.toISOString()).toBe("2026-11-25T10:00:00.000Z");
        expect(s.get("good")?.fsrs.scheduled_days).toBeGreaterThan(3);
        expect(s.get("good")?.firstDay).toBe(localDay(at("2026-11-24T10:00:00.000Z")));
        expect(startedToday(s, at("2026-11-24T10:30:00.000Z"))).toBe(2);
        expect(startedToday(s, at("2026-12-30T10:00:00.000Z"))).toBe(0);
    });

    it("counts new, due and learned, and builds today's queue", () => {
        const states = replay([entry("2026-11-20T10:00:00.000Z", "late", 1), entry("2026-11-22T10:00:00.000Z", "later", 1), entry("2026-11-24T10:00:00.000Z", "fine", 3)]);
        const items = ["fresh1", "fine", "later", "late", "fresh2", "fresh3"];
        const per = items.map((k) => states.get(k));
        expect(stats(per, now)).toEqual({ total: 6, fresh: 3, due: 2, learned: 1, learning: 0 });
        const fresh = replay([entry("2026-11-24T11:00:00.000Z", "sent-left", 1)]);
        expect(stats([fresh.get("sent-left")], now)).toEqual({ total: 1, fresh: 0, due: 0, learned: 0, learning: 1 });
        expect(todayQueue(items, per, now, 2, 0)).toEqual(["late", "later", "fresh1", "fresh2"]);
        expect(todayQueue(items, per, now, 2, 5)).toEqual(["late", "later"]);
    });

    it("carries history over to a card whose front was edited, once", () => {
        const states = replay([entry("2026-11-24T10:00:00.000Z", "old", 3, "ans")]);
        const attached = attach(
            [
                { key: "new", back: "ans" },
                { key: "new-2", back: "ans" },
                { key: "other", back: "zzz" },
            ],
            states,
            new Set(["new", "new-2", "other"]),
        );
        expect(attached[0]?.back).toBe("ans");
        expect(attached[0]?.key).toBe("old");
        expect(attached[1]).toBeUndefined();
        expect(attached[2]).toBeUndefined();
        expect(attach([{ key: "new", back: "ans" }], states, new Set(["new", "old"]))[0]).toBeUndefined();
    });
});
