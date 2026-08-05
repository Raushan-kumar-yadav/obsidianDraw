import { App, Modal } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawWrapper } from '../components/ExcalidrawWrapper';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

export class ExcalidrawModal extends Modal {
	private reactRoot: Root | null = null;
	private excalidrawApi: ExcalidrawImperativeAPI | null = null;
	private lastSavedJson: string;
	private file: import('obsidian').TFile | null;
	private saveTimeout: number | null = null;
 	private latestFiles: BinaryFiles = {};
 	private loadedFiles: BinaryFiles = {};

	/**
	 * @param blockIndex   
	 *                    
	 */
	constructor(
		app: App,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly initialData: object | null,
		initialJson: string,
		private readonly blockIndex: number = 0,
		/** Called synchronously at the very end of onClose, before focus/scroll changes settle. */
		private readonly onAfterClose?: () => void,
	) {
		super(app);
		this.lastSavedJson = initialJson;
		this.file = app.workspace.getActiveFile();
		this.modalEl.addClass('obsidian-draw__modal');
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obsidian-draw__modal-body');

 		const data = this.initialData as any;
		const fileIds: string[] = [];
		if (data?.elements) {
			for (const el of data.elements) {
				if (el.type === 'image' && el.fileId) {
					fileIds.push(el.fileId);
				}
			}
		}
		// Also load  
		if (data?.files) {
			for (const id of Object.keys(data.files)) {
				if (!fileIds.includes(id)) fileIds.push(id);
			}
		}

		if (fileIds.length > 0) {
			this.loadedFiles = await this.plugin.loadContentFiles(fileIds);
		}

		this.reactRoot = createRoot(contentEl);
		this.renderReact();
	}

	private renderReact = () => {
		if (!this.reactRoot) return;
		const isDark = document.body.classList.contains('theme-dark');
		const theme = isDark ? 'dark' : 'light';

 		const initialDataWithFiles = {
			...(this.initialData as any),
			files: {
				...(this.initialData as any)?.files,
				...this.loadedFiles,
			},
		};

		this.reactRoot.render(
			<ExcalidrawWrapper
				initialData={initialDataWithFiles}
				onSave={this.handleSave}
				onExcalidrawAPI={async (api) => {
					this.excalidrawApi = api;
					const items = await this.plugin.loadLibraryItems();
					if (items.length > 0) {
						api.updateLibrary({ libraryItems: items, merge: true });
					}
				}}
				theme={theme}
				transparentBackground={this.plugin.settings.transparentBackground}
				onToggleTransparentBackground={async (val) => {
					this.plugin.settings.transparentBackground = val;
					await this.plugin.saveSettings();
					if (this.excalidrawApi) {
						this.excalidrawApi.updateScene({
							appState: { viewBackgroundColor: val ? '#00000000' : '#ffffff' }
						});
					}
					this.renderReact();
				}}
			/>,
		);
	};

	onClose() {
		if (this.excalidrawApi) {
			const elements = this.excalidrawApi.getSceneElements();
			const appState = this.excalidrawApi.getAppState();
			const files = this.excalidrawApi.getFiles();
			if (this.saveTimeout) {
				window.clearTimeout(this.saveTimeout);
			}
			const allFiles = { ...this.latestFiles, ...files };
			this.performSave(elements, appState as unknown as AppState, allFiles);
		}
		this.reactRoot?.unmount();
		this.reactRoot = null;
		this.contentEl.empty();
		// Notify caller so it can restore scroll position
		this.onAfterClose?.();
	}

	private handleSave = (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	): void => {
 		this.latestFiles = { ...this.latestFiles, ...files };

		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = window.setTimeout(() => {
			this.performSave(elements, appState, this.latestFiles);
		}, 300);
	};

	private performSave = (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	): void => {
		const savedAppState = { viewBackgroundColor: appState.viewBackgroundColor };

 		const usedFileIds = new Set<string>();
		for (const el of elements) {
			if ((el as any).type === 'image' && (el as any).fileId) {
				usedFileIds.add((el as any).fileId);
			}
		}

 		const filesIndex: Record<string, { mimeType: string; created: number }> = {};
		for (const fileId of usedFileIds) {
			const f = files[fileId];
			if (f) {
				filesIndex[fileId] = {
					mimeType: f.mimeType,
					created: f.created,
				};
			}
		}

		const newJson = JSON.stringify(
			{ elements, appState: savedAppState, files: filesIndex },
			null,
			2,
		);
		if (newJson === this.lastSavedJson) return;

		const targetFile = this.file;
		if (!targetFile) return;

		this.lastSavedJson = newJson;

 		if (Object.keys(files).length > 0) {
			this.plugin.saveContentFiles(files).catch((e) =>
				console.error('[ObsidianDraw] Failed to save content files:', e),
			);
		}

 		this.plugin.app.vault.process(targetFile, (content: string) => {
			const openFence = '```excalidraw\n';

 			let searchPos = 0;
			let foundCount = 0;
			let fencePos = -1;

			while (searchPos < content.length) {
				const idx = content.indexOf(openFence, searchPos);
				if (idx === -1) break;
				if (foundCount === this.blockIndex) {
					fencePos = idx;
					break;
				}
				foundCount++;
				searchPos = idx + openFence.length;
			}

			if (fencePos === -1) return content;

			const contentStart = fencePos + openFence.length;
			const closeFenceIdx = content.indexOf('\n```', contentStart);
			if (closeFenceIdx === -1) return content;

			return (
				content.slice(0, contentStart) +
				newJson +
				content.slice(closeFenceIdx)
			);
		});
	};
}
