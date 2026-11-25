import { type App, normalizePath, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import { isSide, type Side } from "../core/side";
import type FlashyPlugin from "../main";
import { strings } from "../ui/strings";

export interface FlashySettings {
    folder: string;
    newPerDay: number;
    /** The side a card shows first; also switchable on the deck screen, which saves it here. */
    side: Side;
}

export const DEFAULTS: FlashySettings = { folder: "Flashy", newPerDay: 20, side: "term" };

/** The settings tab, declared rather than drawn: Obsidian renders, searches and persists it (1.13+). */
export class FlashySettingTab extends PluginSettingTab {
    constructor(
        app: App,
        private readonly plugin: FlashyPlugin,
    ) {
        super(app, plugin);
    }

    override getSettingDefinitions(): SettingDefinitionItem[] {
        const t = strings();
        return [
            { name: t.setFolder, desc: t.setFolderDesc, control: { type: "text", key: "folder", placeholder: DEFAULTS.folder } },
            { name: t.setNew, desc: t.setNewDesc, control: { type: "slider", key: "newPerDay", min: 0, max: 100, step: 5 } },
            {
                name: t.side,
                desc: t.setSideDesc,
                control: { type: "dropdown", key: "side", options: { term: t.sideTerm, definition: t.sideDefinition, mixed: t.sideMixed } },
            },
        ];
    }

    override getControlValue(key: string): unknown {
        if (key === "folder") return this.plugin.settings.folder;
        if (key === "newPerDay") return this.plugin.settings.newPerDay;
        if (key === "side") return this.plugin.settings.side;
        return undefined;
    }

    override async setControlValue(key: string, value: unknown): Promise<void> {
        if (key === "folder" && typeof value === "string") {
            this.plugin.settings.folder = value.trim() ? normalizePath(value.trim()) : DEFAULTS.folder;
        } else if (key === "newPerDay" && typeof value === "number") {
            this.plugin.settings.newPerDay = Math.max(0, Math.round(value));
        } else if (key === "side" && isSide(value)) {
            this.plugin.settings.side = value;
        } else return;
        await this.plugin.saveSettings();
    }
}
