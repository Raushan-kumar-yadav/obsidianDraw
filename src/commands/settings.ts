import { App, PluginSettingTab, Setting } from 'obsidian';
import MyPlugin from '../main';

export interface MyPluginSettings {
	transparentBackground: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	transparentBackground: true,
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Transparent background')
			.setDesc('Force a transparent background and disable the canvas background color picker.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.transparentBackground)
					.onChange(async (value) => {
						this.plugin.settings.transparentBackground = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
