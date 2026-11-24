import { type App, FuzzySuggestModal, Notice, Plugin, TFile, TFolder, type TAbstractFile } from "obsidian";
import { parseCards } from "./core/parse";
import { type DeckCard, ReviewModal } from "./ui/review";
import { strings } from "./ui/strings";

export default class FlashyPlugin extends Plugin {
    onload(): void {
        const t = strings();

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

    private async review(files: TFile[]): Promise<void> {
        const cards: DeckCard[] = [];
        for (const file of files) {
            const text = await this.app.vault.cachedRead(file);
            for (const card of parseCards(text)) cards.push({ card, path: file.path, deck: file.basename });
        }
        if (!cards.length) {
            new Notice(strings().noCards);
            return;
        }
        new ReviewModal(this.app, cards).open();
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
