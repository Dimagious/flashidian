import type { TFile } from "obsidian";
import type { CardId } from "../core/key";
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
