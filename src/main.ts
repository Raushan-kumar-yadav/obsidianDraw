import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from './commands/settings';
import { registerCommands } from './commands/commands';
import { ExcalidrawRenderChild } from './obsidian/ExcalidrawRenderChild';
import { buildLivePreviewPlugin } from './editor/LivePreviewPlugin';

 
import excalidrawCss from '../node_modules/@excalidraw/excalidraw/dist/prod/index.css';

export default class ObsidianDrawPlugin extends Plugin {
	settings!: MyPluginSettings;
	private excalidrawStyleEl: HTMLStyleElement | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Excalidraw  stylesheet 
		this.excalidrawStyleEl = document.createElement('style');
		this.excalidrawStyleEl.id = 'obsidian-draw__excalidraw-styles';
		this.excalidrawStyleEl.textContent = excalidrawCss;
		document.head.appendChild(this.excalidrawStyleEl);

		// CM6 ViewPlugin 
		this.registerEditorExtension(buildLivePreviewPlugin(this));

		// Code block processor  
		this.registerMarkdownCodeBlockProcessor(
			'excalidraw',
			(source, el, ctx) => {
				const child = new ExcalidrawRenderChild(el, source, ctx, this);
				ctx.addChild(child);
			},
		);

		// Register command  
		registerCommands(this);
	}

	onunload() {
		this.excalidrawStyleEl?.remove();
		this.excalidrawStyleEl = null;
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<MyPluginSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async loadLibraryItems(): Promise<any[]> {
		const folderPath = `${this.manifest.dir}/libraries`;
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(folderPath))) {
			return [];
		}

		const listed = await adapter.list(folderPath);
		const files = listed.files.filter((f) => f.endsWith('.excalidrawlib'));

		let allLibraryItems: any[] = [];
		for (const file of files) {
			try {
				const content = await adapter.read(file);
				const parsed = JSON.parse(content);
				if (parsed && Array.isArray(parsed.libraryItems)) {
					allLibraryItems = allLibraryItems.concat(parsed.libraryItems);
				} else if (parsed && Array.isArray(parsed.library)) {
					// Handle older format
					allLibraryItems = allLibraryItems.concat(parsed.library);
				}
			} catch (e) {
				console.error(`[ObsidianDraw] Failed to parse library file ${file}:`, e);
			}
		}

		return allLibraryItems;
	}
}
