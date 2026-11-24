import { type App, Modal, normalizePath, Notice, Setting, type TFolder } from "obsidian";
import { deckNote, parsePasted } from "../core/paste";
import { strings } from "./strings";

/** Paste terms and definitions from Quizlet, a spreadsheet, a CSV or a list; get a deck note in `folder`. */
export class PasteModal extends Modal {
    private text = "";
    private name = "";

    constructor(
        app: App,
        private readonly folder: TFolder,
    ) {
        super(app);
    }

    onOpen(): void {
        const t = strings();
        this.modalEl.addClass("flashy-paste-modal");
        this.setTitle(t.pasteTitle);
        const el = this.contentEl;
        el.createEl("p", { cls: "flashy-paste-hint", text: t.pasteHint });
        const area = el.createEl("textarea", { cls: "flashy-paste-area", attr: { placeholder: "Agentic Loop\tA control flow that repeats\nstop_reason\tWhy the model stopped", rows: "8" } });
        const found = el.createDiv({ cls: "flashy-paste-found", text: t.pasteFound(0) });
        new Setting(el).setName(t.pasteName).addText((x) => x.setPlaceholder(t.pasteNamePlaceholder).onChange((v) => (this.name = v.trim())));
        const create = new Setting(el).addButton((b) =>
            b
                .setButtonText(t.pasteCreate)
                .setCta()
                .setDisabled(true)
                .onClick(() => void this.create()),
        );
        area.addEventListener("input", () => {
            this.text = area.value;
            const n = parsePasted(this.text).length;
            found.setText(t.pasteFound(n));
            create.components[0]?.setDisabled(n === 0);
        });
        area.focus();
    }

    private async create(): Promise<void> {
        const t = strings();
        const pairs = parsePasted(this.text);
        if (!pairs.length) return;
        const base = (this.name || t.pasteNamePlaceholder).replace(/[\\/:*?"<>|#^[\]]/g, " ").trim() || "Deck";
        const dir = this.folder.isRoot() ? "" : `${this.folder.path}/`;
        let path = normalizePath(`${dir}${base}.md`);
        for (let n = 2; this.app.vault.getAbstractFileByPath(path); n++) path = normalizePath(`${dir}${base} ${n}.md`);
        const file = await this.app.vault.create(path, deckNote(pairs));
        new Notice(t.pasteDone(pairs.length, file.basename));
        this.close();
        await this.app.workspace.getLeaf(false).openFile(file);
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
