import { type App, MarkdownRenderChild, normalizePath, setIcon, type TFile, TFolder } from "obsidian";
import type { DeckProgress } from "../app/progress";
import { ReviewModal } from "./review";
import { strings } from "./strings";

/** What the plugin lends the block: reading the logs once, building a review from notes, the notes of a folder. */
export interface DeckSource {
    reload(): Promise<void>;
    build(files: TFile[]): Promise<DeckProgress | null>;
    notesIn(folder: TFolder): TFile[];
}

/** `folder: <path>` on its own line; the block is the deck list of that folder and its subfolders. */
export function parseBlock(source: string): { folder: string } {
    const m = /^\s*folder\s*:\s*(.+?)\s*$/m.exec(source);
    return { folder: m?.[1] ? normalizePath(m[1].replace(/^["']|["']$/g, "")) : "" };
}

/**
 * A deck list for a note: one row per note with cards, today's count and a learned bar, and a row for all of them.
 * A tap starts the review; the list redraws when the review closes.
 */
export class DecksBlock extends MarkdownRenderChild {
    /** Each render takes a number; a render that finds a newer one started after its awaits draws nothing. */
    private generation = 0;

    constructor(
        containerEl: HTMLElement,
        private readonly app: App,
        private readonly source: DeckSource,
        private readonly folderPath: string,
    ) {
        super(containerEl);
    }

    onload(): void {
        void this.render();
    }

    private async render(): Promise<void> {
        const t = strings();
        const el = this.containerEl;
        const mine = ++this.generation;
        el.addClass("flashy-decks");
        const folder = this.folderPath ? this.app.vault.getAbstractFileByPath(this.folderPath) : null;
        if (!(folder instanceof TFolder)) {
            el.empty();
            el.createDiv({ cls: "flashy-decks-empty", text: t.blockNoFolder(this.folderPath) });
            return;
        }
        const notes = this.source.notesIn(folder);
        await this.source.reload();
        const all = await this.source.build(notes);
        const decks: { file: TFile; progress: DeckProgress }[] = [];
        for (const file of notes) {
            const p = await this.source.build([file]);
            if (p) decks.push({ file, progress: p });
        }
        if (mine !== this.generation) return;
        el.empty();
        if (!all) {
            el.createDiv({ cls: "flashy-decks-empty", text: t.noCards });
            return;
        }
        if (decks.length > 1) this.row(el, t.allDecks, all, true);
        for (const d of decks) this.row(el, d.file.basename, d.progress, false);
    }

    private row(parent: HTMLElement, name: string, progress: DeckProgress, isAll: boolean): void {
        const t = strings();
        const s = progress.stats();
        const today = progress.today().length;
        const row = parent.createEl("button", { cls: `flashy-deck-row${isAll ? " is-all" : ""}` });
        const icon = row.createDiv({ cls: "flashy-deck-icon" });
        setIcon(icon, isAll ? "library" : "layers");
        const main = row.createDiv({ cls: "flashy-deck-main" });
        main.createDiv({ cls: "flashy-deck-name", text: name });
        const bar = main.createDiv({ cls: "flashy-deck-bar" }).createDiv();
        bar.setCssProps({ "--flashy-learned": `${s.total ? (s.learned / s.total) * 100 : 0}%` });
        main.createDiv({ cls: "flashy-deck-meta", text: t.blockMeta(s.learned, s.total, s.fresh) });
        const badge = row.createDiv({ cls: `flashy-deck-today${today ? "" : " is-zero"}` });
        badge.createDiv({ cls: "flashy-deck-today-n", text: String(today) });
        badge.createDiv({ cls: "flashy-deck-today-label", text: t.today });
        row.addEventListener("click", () => {
            const modal = new ReviewModal(this.app, progress);
            modal.onClosed = () => void this.render();
            modal.open();
        });
    }
}
