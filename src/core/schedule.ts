import { type Card as FsrsCard, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";
import type { CardId } from "./key";
import type { Entry } from "./log";

/**
 * No fuzz, so every device replays the same logs into the same due dates. No short-term steps: a swipe left brings
 * the card back tomorrow, a swipe right on a new card in a few days.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false }));

export interface CardState {
    /** The key the history is logged under. Differs from the card's own key after its front was edited. */
    key: string;
    fsrs: FsrsCard;
    /** Answer hash at the last review, to find the card again after its front was edited. */
    back: string;
    /** Day of the first review, local time, YYYY-MM-DD: counts new cards per day. */
    firstDay: string;
    /** The last rating: a card sent left is not learned, even while it waits for tomorrow. */
    last: Exclude<Entry["rating"], 0>;
}

export function localDay(d: Date): string {
    const p = (n: number): string => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Replays merged log entries into the current state of every card key ever reviewed. */
export function replay(entries: readonly Entry[]): Map<string, CardState> {
    const cancelled = new Set(entries.filter((e) => e.rating === 0).map((e) => `${e.key} ${e.back}`));
    const states = new Map<string, CardState>();
    for (const e of entries) {
        if (e.rating === 0 || cancelled.has(`${e.key} ${e.at.getTime()}`)) continue;
        const prev = states.get(e.key);
        const card: FsrsCard = prev ? prev.fsrs : createEmptyCard(e.at);
        const next = scheduler.next(card, e.at, e.rating).card;
        states.set(e.key, { key: e.key, fsrs: next, back: e.back, firstDay: prev?.firstDay ?? localDay(e.at), last: e.rating });
    }
    return states;
}

/**
 * The state of each card of a deck. A card whose key has no history but whose answer matches a key that no longer
 * belongs to any card (its front was edited) takes over that history. Old keys stay in the logs either way.
 */
export function attach(ids: readonly CardId[], states: ReadonlyMap<string, CardState>, allKeys: ReadonlySet<string>): (CardState | undefined)[] {
    const orphans = new Map<string, CardState>();
    for (const [key, s] of states) if (!allKeys.has(key) && !orphans.has(s.back)) orphans.set(s.back, s);
    return ids.map((id) => {
        const own = states.get(id.key);
        if (own) return own;
        const moved = orphans.get(id.back);
        if (moved) orphans.delete(id.back);
        return moved;
    });
}

export interface Stats {
    total: number;
    fresh: number;
    due: number;
    learned: number;
    learning: number;
}

/**
 * New = never reviewed, due = its date has come, learned = not due and last kept, learning = not due but last sent
 * left (it comes back tomorrow).
 */
export function stats(states: readonly (CardState | undefined)[], now: Date): Stats {
    let fresh = 0, due = 0, learned = 0;
    for (const s of states) {
        if (!s) fresh++;
        else if (s.fsrs.due.getTime() <= now.getTime()) due++;
        else if (s.last >= 3) learned++;
    }
    return { total: states.length, fresh, due, learned, learning: states.length - fresh - due - learned };
}

/**
 * Today's round: due cards, the most overdue first, then new cards in deck order up to what is left of the daily
 * limit after the new cards already started today.
 */
export function todayQueue<T>(items: readonly T[], states: readonly (CardState | undefined)[], now: Date, newPerDay: number, newToday: number): T[] {
    const due: [T, number][] = [];
    const fresh: T[] = [];
    items.forEach((item, i) => {
        const s = states[i];
        if (!s) fresh.push(item);
        else if (s.fsrs.due.getTime() <= now.getTime()) due.push([item, s.fsrs.due.getTime()]);
    });
    due.sort((a, b) => a[1] - b[1]);
    return [...due.map(([item]) => item), ...fresh.slice(0, Math.max(0, newPerDay - newToday))];
}

/** How many card keys had their first review today. */
export function startedToday(states: ReadonlyMap<string, CardState>, now: Date): number {
    const today = localDay(now);
    let n = 0;
    for (const s of states.values()) if (s.firstDay === today) n++;
    return n;
}
