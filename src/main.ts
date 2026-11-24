import { type App, FuzzySuggestModal, Notice, Plugin, TFile, TFolder, type TAbstractFile } from "obsidian";
import { type DeckCard, DeckProgress } from "./app/progress";
import { DEFAULTS, FlashySettingTab, type FlashySettings } from "./app/settings";
import { ProgressStore } from "./app/store";
import { cardIds } from "./core/key";
import { parseCards } from "./core/parse";
import { ReviewModal } from "./ui/review";
import { strings } from "./ui/strings";

export default class FlashyPlugin extends Plugin {
    settings: FlashySettings = { ...DEFAULTS };
    private store!: ProgressStore;

    async onload(): Promise<void> {
        const t = strings();
        this.settings = { ...DEFAULTS, ...((await this.loadData()) as Partial<FlashySettings> | null) };
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
        const progressDir = `${this.settings.folder}/`;
        const decks = files.filter((f) => !f.path.startsWith(progressDir));
        const cards: DeckCard[] = [];
        const withCards: TFile[] = [];
        for (const file of decks) {
            const parsed = parseCards(await this.app.vault.cachedRead(file));
            const ids = cardIds(parsed);
            parsed.forEach((card, i) => {
                const id = ids[i];
                if (id) cards.push({ card, path: file.path, deck: file.basename, id });
            });
            if (parsed.length) withCards.push(file);
        }
        if (!cards.length) {
            new Notice(strings().noCards);
            return;
        }
        await this.store.load();
        new ReviewModal(this.app, new DeckProgress(cards, withCards, this.store, () => this.settings.newPerDay)).open();
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
