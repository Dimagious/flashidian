import { type App, normalizePath, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type FlashyPlugin from "../main";
import { strings } from "../ui/strings";

export interface FlashySettings {
    folder: string;
    newPerDay: number;
}

export const DEFAULTS: FlashySettings = { folder: "Flashy", newPerDay: 20 };

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
        ];
    }

    override getControlValue(key: string): unknown {
        if (key === "folder") return this.plugin.settings.folder;
        if (key === "newPerDay") return this.plugin.settings.newPerDay;
        return undefined;
    }

    override async setControlValue(key: string, value: unknown): Promise<void> {
        if (key === "folder" && typeof value === "string") {
            this.plugin.settings.folder = value.trim() ? normalizePath(value.trim()) : DEFAULTS.folder;
        } else if (key === "newPerDay" && typeof value === "number") {
            this.plugin.settings.newPerDay = Math.max(0, Math.round(value));
        } else return;
        await this.plugin.saveSettings();
    }
}
