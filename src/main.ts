import { type App, FuzzySuggestModal, getFrontMatterInfo, getLanguage, Notice, parseYaml, Plugin, TFile, TFolder, type TAbstractFile } from "obsidian";
import { type Deck, type DeckCard, DeckProgress } from "./app/progress";
import { DEFAULTS, FlashySettingTab, type FlashySettings } from "./app/settings";
import { ProgressStore } from "./app/store";
import { cardIds } from "./core/key";
import { isSide } from "./core/side";
import { type Card, parseCards } from "./core/parse";
import { modeOf, noteCard, noteFront, parseStructured } from "./core/structured";
import { DecksBlock, parseBlock } from "./ui/decks-block";
import { PasteModal } from "./ui/paste";
import { PromptPicker } from "./ui/prompts";
import { ReviewModal, type ReviewPrefs } from "./ui/review";
import { isLangChoice, setLanguage, strings } from "./i18n";

export default class FlashyPlugin extends Plugin {
    settings: FlashySettings = { ...DEFAULTS };
    private store!: ProgressStore;

    async onload(): Promise<void> {
        this.settings = { ...DEFAULTS, ...((await this.loadData()) as Partial<FlashySettings> | null) };
        if (!isSide(this.settings.side)) this.settings.side = DEFAULTS.side;
        if (!isLangChoice(this.settings.language)) this.settings.language = DEFAULTS.language;
        setLanguage(this.settings.language, getLanguage());
        const t = strings();
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

        this.addCommand({
            id: "copy-prompt",
            name: t.cmdPrompt,
            callback: () => new PromptPicker(this.app).open(),
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

    /**
     * The cards of these notes bound to the progress already loaded; null when none of them has a card. A note is a deck
     * of its own; notes that are one card each (`flashy: note`) make one deck per folder.
     */
    private async build(files: TFile[]): Promise<DeckProgress | null> {
        const progressDir = `${this.settings.folder}/`;
        const notes = files.filter((f) => !f.path.startsWith(progressDir));
        const cards: DeckCard[] = [];
        const decks = new Map<string, Deck>();
        // A card that two notes share (a glossary and a deck made from it) is reviewed once.
        const seen = new Set<string>();
        let names: Map<string, number> | null = null;
        for (const file of notes) {
            const text = await this.app.vault.cachedRead(file);
            const fm = frontmatterOf(text);
            const mode = modeOf(fm?.flashy);
            const lang: unknown = fm?.["flashy-lang"];
            let parsed: Card[];
            let deck: Deck;
            if (mode === "note") {
                names ??= basenameCounts(this.app);
                const folder = file.parent?.isRoot() ? "" : (file.parent?.path ?? "");
                const folderName = file.parent && !file.parent.isRoot() ? file.parent.name : this.app.vault.getName();
                const front = noteFront(file.basename, folderName, (names.get(file.basename) ?? 0) > 1, fm?.["flashy-prompt"]);
                const card = noteCard(text, front, file.basename);
                parsed = card ? [card] : [];
                const key = `folder:${folder}`;
                deck = decks.get(key) ?? { name: folderName, files: [], folder };
                decks.set(key, deck);
            } else {
                parsed = [...parseCards(text), ...(mode ? parseStructured(text, mode) : [])];
                deck = { name: file.basename, files: [], note: file };
                decks.set(`note:${file.path}`, deck);
            }
            const ids = cardIds(parsed);
            let added = 0;
            parsed.forEach((card, i) => {
                const id = ids[i];
                if (!id || seen.has(id.key)) return;
                seen.add(id.key);
                cards.push({ card, path: file.path, deck: deck.name, id, ...(typeof lang === "string" && lang.trim() ? { lang: lang.trim() } : {}) });
                added++;
            });
            if (added) deck.files.push(file);
        }
        if (!cards.length) return null;
        const withCards = Array.from(decks.values()).filter((d) => d.files.length);
        return new DeckProgress(cards, withCards, this.store, () => this.settings.newPerDay);
    }
}

/**
 * The properties of a note from its own text. The metadata cache can still be indexing a note when a deck list first
 * draws (on startup, or right after a sync brings new notes), and a note without its `flashy` property is no deck.
 */
function frontmatterOf(text: string): Record<string, unknown> | undefined {
    const info = getFrontMatterInfo(text);
    if (!info.exists) return undefined;
    try {
        const data: unknown = parseYaml(info.frontmatter);
        return data && typeof data === "object" ? (data as Record<string, unknown>) : undefined;
    } catch (e) {
        // Broken YAML is the note's problem, not a reason to drop its `?` cards; Obsidian shows the error itself.
        console.warn("Flashy: unreadable properties, the note is read without them", e);
        return undefined;
    }
}

/** How many markdown notes in the vault carry each file name, so a note-card's front can tell two of them apart. */
function basenameCounts(app: App): Map<string, number> {
    const counts = new Map<string, number>();
    for (const f of app.vault.getMarkdownFiles()) counts.set(f.basename, (counts.get(f.basename) ?? 0) + 1);
    return counts;
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
