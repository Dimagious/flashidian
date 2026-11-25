import { type App, Notice, SuggestModal } from "obsidian";
import chapter from "../../prompts/questions-from-a-chapter.md";
import glossary from "../../prompts/glossary-from-lecture-notes.md";
import notes from "../../prompts/notes-as-cards.md";
import vocabulary from "../../prompts/vocabulary-cards.md";
import { type Strings, strings } from "../i18n";

/**
 * The prompts from `prompts/`, bundled as text: a user copies one, pastes it into an assistant with their material, and
 * gets a note in a format Flashy reads. `evals/prompts/` measures them; nothing here calls a model.
 */
export interface Recipe {
    text: string;
    name: (t: Strings) => string;
    desc: (t: Strings) => string;
}

export const RECIPES: readonly Recipe[] = [
    { text: glossary, name: (t) => t.promptGlossary, desc: (t) => t.promptGlossaryDesc },
    { text: vocabulary, name: (t) => t.promptVocabulary, desc: (t) => t.promptVocabularyDesc },
    { text: chapter, name: (t) => t.promptChapter, desc: (t) => t.promptChapterDesc },
    { text: notes, name: (t) => t.promptNotes, desc: (t) => t.promptNotesDesc },
];

/** Puts a prompt on the clipboard and says what to do next. */
export async function copyPrompt(recipe: Recipe): Promise<void> {
    const t = strings();
    try {
        await navigator.clipboard.writeText(recipe.text);
        new Notice(t.promptCopied);
    } catch (e) {
        console.error("Flashy: copying a prompt failed", e);
        new Notice(t.promptCopyFailed(e instanceof Error ? e.message : String(e)));
    }
}

/** The command's picker: one row per recipe, with what it makes. */
export class PromptPicker extends SuggestModal<Recipe> {
    private readonly t = strings();

    constructor(app: App) {
        super(app);
        this.setPlaceholder(this.t.promptPick);
    }

    getSuggestions(query: string): Recipe[] {
        const q = query.toLowerCase();
        return RECIPES.filter((r) => `${r.name(this.t)} ${r.desc(this.t)}`.toLowerCase().includes(q));
    }

    renderSuggestion(recipe: Recipe, el: HTMLElement): void {
        el.createDiv({ text: recipe.name(this.t) });
        el.createEl("small", { cls: "flashy-prompt-desc", text: recipe.desc(this.t) });
    }

    onChooseSuggestion(recipe: Recipe): void {
        void copyPrompt(recipe);
    }
}
