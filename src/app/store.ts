import { type App, normalizePath, type TFile } from "obsidian";
import { appendLog, type Entry, merge, newLog, parseLog } from "../core/log";
import { readBest } from "../core/match";
import { type CardState, replay, type Stats } from "../core/schedule";

const DEVICE_KEY = "flashy-device";
/** Reviews are written in batches: at the end of a round, on close, and this long after the last grade. */
const FLUSH_DELAY_MS = 15_000;
/** The summary note property with the match game's best time. */
const MATCH_BEST = "flashy-match-best";

/**
 * Review progress in the vault. Each device appends to its own `<folder>/log-<device>.md` and reads everyone's.
 * The device id lives in Obsidian's per-vault local storage, which no sync service copies.
 */
export class ProgressStore {
    private readonly device: string;
    private entries: Entry[] = [];
    private pending: Entry[] = [];
    private timer: number | null = null;

    constructor(
        private readonly app: App,
        private readonly folder: () => string,
    ) {
        const saved: unknown = app.loadLocalStorage(DEVICE_KEY);
        if (typeof saved === "string" && /^[a-z0-9]{4,}$/.test(saved)) this.device = saved;
        else {
            this.device = Math.random().toString(36).slice(2, 10);
            app.saveLocalStorage(DEVICE_KEY, this.device);
        }
    }

    private dir(): string {
        return normalizePath(this.folder() || "Flashy");
    }

    private logPath(): string {
        return normalizePath(`${this.dir()}/log-${this.device}.md`);
    }

    /** Reads every device's log and returns the replayed state of every card key. */
    async load(): Promise<Map<string, CardState>> {
        const prefix = `${this.dir()}/log-`;
        const files = this.app.vault.getFiles().filter((f) => f.path.startsWith(prefix) && f.extension === "md");
        const logs = await Promise.all(files.map(async (f) => parseLog(await this.app.vault.cachedRead(f))));
        // What this session already knows stays: right after a write the metadata cache can still serve the old file.
        this.entries = merge([...logs, this.entries]);
        return replay(merge([this.entries, this.pending]));
    }

    /** The state after the reviews recorded so far, written or not. */
    current(): Map<string, CardState> {
        return replay(merge([this.entries, this.pending]));
    }

    record(e: Entry): void {
        this.pending.push(e);
        if (this.timer !== null) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(() => void this.flush(), FLUSH_DELAY_MS);
    }

    /**
     * Takes back the last review of a card: drops it if it is not written yet, otherwise appends a cancelling entry
     * (rating 0) that points at its time.
     */
    unrecord(key: string): void {
        const last = this.pending[this.pending.length - 1];
        if (last && last.key === key && last.rating !== 0) {
            this.pending.pop();
            return;
        }
        const all = merge([this.entries, this.pending]);
        const cancelled = new Set(all.filter((e) => e.rating === 0).map((e) => `${e.key} ${e.back}`));
        const target = all.filter((e) => e.key === key && e.rating !== 0 && !cancelled.has(`${e.key} ${e.at.getTime()}`)).pop();
        if (target) this.record({ at: new Date(), key, rating: 0, back: String(target.at.getTime()) });
    }

    async flush(): Promise<void> {
        if (this.timer !== null) {
            window.clearTimeout(this.timer);
            this.timer = null;
        }
        if (!this.pending.length) return;
        const batch = this.pending;
        this.pending = [];
        await this.ensureFolder();
        const path = this.logPath();
        const file = this.app.vault.getFileByPath(path);
        if (file) await this.app.vault.process(file, (text) => appendLog(text, this.device, batch));
        else await this.app.vault.create(path, newLog(this.device, batch));
        this.entries = merge([this.entries, batch]);
    }

    /**
     * One note per deck with its numbers as properties, for Bases, Dataview or Dashy. Derived data: a conflict in it
     * loses nothing, the next review writes it again from the logs. The one exception is the match best time kept next
     * to them: a conflict can lose it, which a game score can afford.
     */
    async writeSummary(deck: TFile, s: Stats): Promise<void> {
        const path = this.summaryPath(deck);
        const file = await this.summaryFile(deck);
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm["flashy-deck"] = this.app.fileManager.generateMarkdownLink(deck, path);
            fm["flashy-total"] = s.total;
            fm["flashy-new"] = s.fresh;
            fm["flashy-due"] = s.due;
            fm["flashy-learned"] = s.learned;
            fm["flashy-learning"] = s.learning;
        });
    }

    /**
     * The best time of the match game for a deck, in seconds, kept in the same summary note. `writeSummary` sets only
     * its own keys, so the best time survives every review.
     */
    matchBest(deck: TFile): number | undefined {
        const file = this.app.vault.getFileByPath(this.summaryPath(deck));
        return file ? readBest(this.app.metadataCache.getFileCache(file)?.frontmatter?.[MATCH_BEST]) : undefined;
    }

    async writeMatchBest(deck: TFile, seconds: number): Promise<void> {
        const file = await this.summaryFile(deck);
        await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
            fm[MATCH_BEST] = seconds;
        });
    }

    private summaryPath(deck: TFile): string {
        return normalizePath(`${this.dir()}/${deck.basename}.md`);
    }

    private async summaryFile(deck: TFile): Promise<TFile> {
        await this.ensureFolder();
        const path = this.summaryPath(deck);
        return (
            this.app.vault.getFileByPath(path) ??
            (await this.app.vault.create(
                path,
                `%% Flashy progress of ${this.app.fileManager.generateMarkdownLink(deck, path)}. Flashy rewrites these properties after every review. %%\n`,
            ))
        );
    }

    private async ensureFolder(): Promise<void> {
        const dir = this.dir();
        if (!this.app.vault.getFolderByPath(dir)) await this.app.vault.createFolder(dir);
    }

    dispose(): void {
        if (this.timer !== null) window.clearTimeout(this.timer);
        void this.flush();
    }
}
