import { type App, FuzzySuggestModal, Notice, Plugin, TFile, TFolder, type TAbstractFile } from "obsidian";
import { type DeckCard, DeckProgress } from "./app/progress";
import { DEFAULTS, FlashySettingTab, type FlashySettings } from "./app/settings";
import { ProgressStore } from "./app/store";
import { cardIds } from "./core/key";
import { isSide } from "./core/side";
import { parseCards } from "./core/parse";
import { modeOf, parseStructured } from "./core/structured";
import { DecksBlock, parseBlock } from "./ui/decks-block";
import { PasteModal } from "./ui/paste";
import { ReviewModal, type ReviewPrefs } from "./ui/review";
import { strings } from "./ui/strings";

export default class FlashyPlugin extends Plugin {
    settings: FlashySettings = { ...DEFAULTS };
    private store!: ProgressStore;

    async onload(): Promise<void> {
        const t = strings();
        this.settings = { ...DEFAULTS, ...((await this.loadData()) as Partial<FlashySettings> | null) };
        if (!isSide(this.settings.side)) this.settings.side = DEFAULTS.side;
        this.store = new ProgressStore(this.app, () => this.settings.folder);
        this.addSettingTab(new FlashySettingTab(this.app, this));

        this.addCommand({
            id: "review-note",
            name: t.cmdNote,
            checkCallback: (checking) => {
                const file = this.app.workspace.getActiveFile();
                if (!file || file.extension !== "md") return false;
                if (!checking) void this.review([file]);
                return true;
            },
        });

        this.addCommand({
            id: "review-folder",
            name: t.cmdFolder,
            callback: () => new FolderPicker(this.app, t.pickFolder, (f) => void this.review(notesIn(f))).open(),
        });

        this.addRibbonIcon("layers", t.cmdFolder, () => {
            new FolderPicker(this.app, t.pickFolder, (f) => void this.review(notesIn(f))).open();
        });

        this.addCommand({
            id: "paste-deck",
            name: t.cmdPaste,
            callback: () => new PasteModal(this.app, this.app.workspace.getActiveFile()?.parent ?? this.app.vault.getRoot()).open(),
        });

        this.registerMarkdownCodeBlockProcessor("flashy", (source, el, ctx) => {
            ctx.addChild(
                new DecksBlock(
                    el,
                    this.app,
                    { reload: () => this.store.load().then(() => undefined), build: (f) => this.build(f), notesIn, prefs: () => this.prefs() },
                    parseBlock(source).folder,
                ),
            );
        });

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file) => {
                if (!(file instanceof TFolder)) return;
                menu.addItem((item) => item.setTitle(t.menuFolder).setIcon("layers").onClick(() => void this.review(notesIn(file))));
            }),
        );
    }

    onunload(): void {
        this.store.dispose();
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    private async review(files: TFile[]): Promise<void> {
        await this.store.load();
        const progress = await this.build(files);
        if (!progress) {
            new Notice(strings().noCards);
            return;
        }
        new ReviewModal(this.app, progress, this.prefs()).open();
    }

    /** The review choices a modal reads and changes: the side shown first. */
    private prefs(): ReviewPrefs {
        return {
            side: () => this.settings.side,
            setSide: async (side) => {
                this.settings.side = side;
                await this.saveSettings();
            },
        };
    }

    /** The cards of these notes bound to the progress already loaded; null when none of them has a card. */
    private async build(files: TFile[]): Promise<DeckProgress | null> {
        const progressDir = `${this.settings.folder}/`;
        const decks = files.filter((f) => !f.path.startsWith(progressDir));
        const cards: DeckCard[] = [];
        const withCards: TFile[] = [];
        // A card that two notes share (a glossary and a deck made from it) is reviewed once.
        const seen = new Set<string>();
        for (const file of decks) {
            const text = await this.app.vault.cachedRead(file);
            const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
            const mode = modeOf(fm?.flashy);
            const lang: unknown = fm?.["flashy-lang"];
            const parsed = [...parseCards(text), ...(mode ? parseStructured(text, mode) : [])];
            const ids = cardIds(parsed);
            let added = 0;
            parsed.forEach((card, i) => {
                const id = ids[i];
                if (!id || seen.has(id.key)) return;
                seen.add(id.key);
                cards.push({ card, path: file.path, deck: file.basename, id, ...(typeof lang === "string" && lang.trim() ? { lang: lang.trim() } : {}) });
                added++;
            });
            if (added) withCards.push(file);
        }
        if (!cards.length) return null;
        return new DeckProgress(cards, withCards, this.store, () => this.settings.newPerDay);
    }
}

/** Markdown notes in a folder and its subfolders, sorted by path so decks keep their order. */
function notesIn(folder: TFolder): TFile[] {
    const out: TFile[] = [];
    const walk = (f: TAbstractFile): void => {
        if (f instanceof TFile && f.extension === "md") out.push(f);
        else if (f instanceof TFolder) f.children.forEach(walk);
    };
    walk(folder);
    return out.sort((a, b) => a.path.localeCompare(b.path));
}

class FolderPicker extends FuzzySuggestModal<TFolder> {
    constructor(
        app: App,
        placeholder: string,
        private readonly pick: (f: TFolder) => void,
    ) {
        super(app);
        this.setPlaceholder(placeholder);
    }
    getItems(): TFolder[] {
        return this.app.vault.getAllFolders(true);
    }
    getItemText(f: TFolder): string {
        return f.path || "/";
    }
    onChooseItem(f: TFolder): void {
        this.pick(f);
    }
}
