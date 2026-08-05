import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ObsidianDrawSettings, ObsidianDrawSettingTab } from './commands/settings';
import { registerCommands } from './commands/commands';
import { ExcalidrawRenderChild } from './obsidian/ExcalidrawRenderChild';
import { buildLivePreviewPlugin } from './editor/LivePreviewPlugin';
import type { BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

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
	settings!: ObsidianDrawSettings;

	get contentDir(): string {
		return `${this.manifest.dir}/content`;
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new ObsidianDrawSettingTab(this.app, this));

		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.contentDir))) {
			await adapter.mkdir(this.contentDir);
		}

		this.registerEditorExtension(buildLivePreviewPlugin(this));

		this.registerMarkdownCodeBlockProcessor(
			'excalidraw',
			(source, el, ctx) => {
				const child = new ExcalidrawRenderChild(el, source, ctx, this);
				ctx.addChild(child);
			},
		);

		registerCommands(this);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<ObsidianDrawSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Save Binary  */
	async saveContentFiles(files: BinaryFiles): Promise<void> {
		const adapter = this.app.vault.adapter;
		if (!(await adapter.exists(this.contentDir))) {
			await adapter.mkdir(this.contentDir);
		}

		for (const [fileId, fileData] of Object.entries(files)) {
			if (!fileData?.dataURL) continue;

			const ext = MIME_TO_EXT[fileData.mimeType] ?? 'bin';
			const filePath = `${this.contentDir}/${fileId}.${ext}`;

			try {
				await adapter.write(filePath, fileData.dataURL);
			} catch (e) {
				console.error(`[ObsidianDraw] Failed to save content file ${fileId}:`, e);
			}
		}
	}

	/** Load content   */
	async loadContentFiles(fileIds: string[]): Promise<BinaryFiles> {
		const adapter = this.app.vault.adapter;
		const result: BinaryFiles = {};

		for (const fileId of fileIds) {
			for (const [mime, ext] of Object.entries(MIME_TO_EXT)) {
				const filePath = `${this.contentDir}/${fileId}.${ext}`;
				if (await adapter.exists(filePath)) {
					try {
						const dataURL = await adapter.read(filePath);
						result[fileId] = {
							id: fileId as unknown as BinaryFiles[string]['id'],
							dataURL: dataURL as BinaryFiles[string]['dataURL'],
							mimeType: mime as BinaryFiles[string]['mimeType'],
							created: Date.now(),
							lastRetrieved: Date.now(),
						};
					} catch (e) {
						console.error(`[ObsidianDraw] Failed to load content file ${fileId}:`, e);
					}
					break;
				}
			}
		}

		return result;
	}

	async loadLibraryItems(): Promise<Record<string, unknown>[]> {
		const folderPath = `${this.manifest.dir}/libraries`;
		const adapter = this.app.vault.adapter;

		if (!(await adapter.exists(folderPath))) {
			return [];
		}

		const listed = await adapter.list(folderPath);
		const files = listed.files.filter((f) => f.endsWith('.excalidrawlib'));

		let allLibraryItems: Record<string, unknown>[] = [];
		for (const file of files) {
			try {
				const content = await adapter.read(file);
				const parsed = JSON.parse(content) as { libraryItems?: Record<string, unknown>[]; library?: Record<string, unknown>[] };
				if (parsed?.libraryItems) {
					allLibraryItems = allLibraryItems.concat(parsed.libraryItems);
				} else if (parsed?.library) {
					allLibraryItems = allLibraryItems.concat(parsed.library);
				}
			} catch (e) {
				console.error(`[ObsidianDraw] Failed to parse library file ${file}:`, e);
			}
		}

		return allLibraryItems;
	}
}
