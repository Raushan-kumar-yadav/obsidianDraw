import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from './commands/settings';
import { ExcalidrawRenderChild } from './obsidian/ExcalidrawRenderChild';
import { buildLivePreviewPlugin } from './editor/LivePreviewPlugin';

// esbuild loads this as a raw text string (loader: { '.css': 'text' })
import excalidrawCss from '../node_modules/@excalidraw/excalidraw/dist/prod/index.css';

export default class ObsidianDrawPlugin extends Plugin {
	settings!: MyPluginSettings;
	private excalidrawStyleEl: HTMLStyleElement | null = null;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Inject Excalidraw's stylesheet so its layout renders correctly
		this.excalidrawStyleEl = document.createElement('style');
		this.excalidrawStyleEl.id = 'obsidian-draw__excalidraw-styles';
		this.excalidrawStyleEl.textContent = excalidrawCss;
		document.head.appendChild(this.excalidrawStyleEl);

		// CM6 ViewPlugin — handles Live Preview (writing mode)
		this.registerEditorExtension(buildLivePreviewPlugin(this));

		// Code block processor — handles Reading View
		this.registerMarkdownCodeBlockProcessor(
			'excalidraw',
			(source, el, ctx) => {
				const child = new ExcalidrawRenderChild(el, source, ctx, this);
				ctx.addChild(child);
			},
		);
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
}
