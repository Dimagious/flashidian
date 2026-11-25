import type { TFile } from "obsidian";
import type { CardId } from "../core/key";
import { isNewBest, toSeconds } from "../core/match";
import type { Card } from "../core/parse";
import { attach, type CardState, startedToday, type Stats, stats, todayQueue } from "../core/schedule";
import type { Grade } from "../core/session";
import type { ProgressStore } from "./store";

/** A card plus the note it came from, its identity and its current review state. */
export interface DeckCard {
    card: Card;
    path: string;
    deck: string;
    /** The language of the term side for text-to-speech, from the note's `flashy-lang` property. */
    lang?: string;
    id: CardId;
    state?: CardState;
}

/** The cards of one review (a note or a folder) bound to the progress store. */
export class DeckProgress {
    private newToday = 0;
    /** The best match time set in this session: right after a write the metadata cache can still serve the old one. */
    private best: number | undefined;

    constructor(
        readonly items: DeckCard[],
        private readonly files: TFile[],
        private readonly store: ProgressStore,
        private readonly newPerDay: () => number,
    ) {
        this.refresh();
    }

    /** Re-attaches every card to the state replayed from the logs and the reviews of this session. */
    refresh(): void {
        const states = this.store.current();
        const attached = attach(
            this.items.map((i) => i.id),
            states,
            new Set(this.items.map((i) => i.id.key)),
        );
        this.items.forEach((item, i) => (item.state = attached[i]));
        this.newToday = startedToday(states, new Date());
    }

    stats(now = new Date()): Stats {
        return stats(
            this.items.map((i) => i.state),
            now,
        );
    }

    today(now = new Date()): DeckCard[] {
        return todayQueue(
            this.items,
            this.items.map((i) => i.state),
            now,
            this.newPerDay(),
            this.newToday,
        );
    }

    /** The earliest date a card of this review comes back, for "nothing due today". */
    nextDue(): Date | undefined {
        let next: number | undefined;
        for (const i of this.items) {
            const t = i.state?.fsrs.due.getTime();
            if (t !== undefined && (next === undefined || t < next)) next = t;
        }
        return next === undefined ? undefined : new Date(next);
    }

    record(item: DeckCard, g: Grade): void {
        this.store.record({ at: new Date(), key: item.state?.key ?? item.id.key, rating: g === "keep" ? 3 : 1, back: item.id.back });
    }

    unrecord(item: DeckCard): void {
        this.store.unrecord(item.state?.key ?? item.id.key);
    }

    /** The one note a match best time belongs to; a review of several notes keeps none. */
    private matchDeck(): TFile | undefined {
        return this.files.length === 1 ? this.files[0] : undefined;
    }

    /** True when this review is one note, so a match game has a best time to beat. */
    hasMatchDeck(): boolean {
        return this.matchDeck() !== undefined;
    }

    /** The best match time of this deck in seconds, or none (no game yet, or a review of several notes). */
    matchBest(): number | undefined {
        const deck = this.matchDeck();
        if (!deck) return undefined;
        const saved = this.store.matchBest(deck);
        return saved === undefined || (this.best !== undefined && this.best < saved) ? this.best : saved;
    }

    /** Keeps a finished game's time when it beats the best; returns whether it did. */
    async finishMatch(ms: number): Promise<boolean> {
        const deck = this.matchDeck();
        if (!deck || !isNewBest(this.matchBest(), ms)) return false;
        this.best = toSeconds(ms);
        await this.store.writeMatchBest(deck, this.best);
        return true;
    }

    /** Writes the reviews, then each deck's numbers. */
    async save(): Promise<void> {
        await this.store.flush();
        this.refresh();
        const now = new Date();
        for (const file of this.files) {
            const own = this.items.filter((i) => i.path === file.path);
            if (own.length) await this.store.writeSummary(file, stats(own.map((i) => i.state), now));
        }
    }
}
