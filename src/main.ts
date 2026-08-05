import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab } from './commands/settings';
import { registerCommands } from './commands/commands';
import { ExcalidrawRenderChild } from './obsidian/ExcalidrawRenderChild';
import { buildLivePreviewPlugin } from './editor/LivePreviewPlugin';
import type { BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

import excalidrawCss from '../node_modules/@excalidraw/excalidraw/dist/prod/index.css';

/** Extension for each MIME type we support storing. */
const MIME_TO_EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/jpg': 'jpg',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'image/svg+xml': 'svg',
	'image/bmp': 'bmp',
};

export default class ObsidianDrawPlugin extends Plugin {
	settings!: MyPluginSettings;
	private excalidrawStyleEl: HTMLStyleElement | null = null;

	get contentDir(): string {
		return `${this.manifest.dir}/content`;
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Excalidraw  stylesheet
		this.excalidrawStyleEl = document.createElement('style');
		this.excalidrawStyleEl.id = 'obsidian-draw__excalidraw-styles';
		this.excalidrawStyleEl.textContent = excalidrawCss;
		document.head.appendChild(this.excalidrawStyleEl);

		// Ensure content folder exists
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.contentDir))) {
			await adapter.mkdir(this.contentDir);
		}

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

	/**
	 * Save all BinaryFiles from Excalidraw into the content folder.
	 * Each file is saved as `{fileId}.{ext}` using its dataURL.
	 * Returns the set of fileIds actually saved so the caller can reference them.
	 */
	async saveContentFiles(files: BinaryFiles): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.contentDir))) {
			await adapter.mkdir(this.contentDir);
		}

		for (const [fileId, fileData] of Object.entries(files)) {
			if (!fileData?.dataURL) continue;

			const ext = MIME_TO_EXT[fileData.mimeType] ?? 'bin';
			const filePath = `${this.contentDir}/${fileId}.${ext}`;

			// Write the dataURL directly — on reload we reconstruct the full BinaryFile
			try {
				await adapter.write(filePath, fileData.dataURL);
			} catch (e) {
				console.error(`[ObsidianDraw] Failed to save content file ${fileId}:`, e);
			}
		}
	}

	/**
	 * Load all content files referenced by the given fileIds back into a BinaryFiles map.
	 * Reads from the content folder and reconstructs dataURL strings.
	 */
	async loadContentFiles(fileIds: string[]): Promise<BinaryFiles> {
		const adapter = this.app.vault.adapter;
		const result: BinaryFiles = {};

		for (const fileId of fileIds) {
			// Try all known extensions
			for (const [mime, ext] of Object.entries(MIME_TO_EXT)) {
				const filePath = `${this.contentDir}/${fileId}.${ext}`;
				if (await adapter.exists(filePath)) {
					try {
						const dataURL = await adapter.read(filePath);
						result[fileId] = {
							id: fileId as any,
							dataURL: dataURL as any,
							mimeType: mime as any,
							created: Date.now(),
							lastRetrieved: Date.now(),
						};
					} catch (e) {
						console.error(`[ObsidianDraw] Failed to load content file ${fileId}:`, e);
					}
					break; // found it, move on to next fileId
				}
			}
		}

		return result;
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

