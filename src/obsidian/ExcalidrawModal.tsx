import { App, Modal, TFile } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawWrapper } from '../components/ExcalidrawWrapper';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

export interface ParsedCanvasData {
	elements?: ExcalidrawElement[];
	appState?: { viewBackgroundColor?: string };
	files?: Record<string, { mimeType: string; created: number }>;
	previewHeight?: number;
	previewZoom?: number;
}

export class ExcalidrawModal extends Modal {
	private reactRoot: Root | null = null;
	private excalidrawApi: ExcalidrawImperativeAPI | null = null;
	private lastSavedJson: string;
	private file: TFile | null;
	private saveTimeout: number | null = null;
	private latestFiles: BinaryFiles = {};
	private loadedFiles: BinaryFiles = {};

	constructor(
		app: App,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly initialData: ParsedCanvasData | null,
		initialJson: string,
		private readonly blockIndex: number = 0,
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

		const fileIds: string[] = [];
		for (const el of this.initialData?.elements ?? []) {
			const imgEl = el as ExcalidrawElement & { fileId?: string };
			if (imgEl.type === 'image' && imgEl.fileId) {
				fileIds.push(imgEl.fileId);
			}
		}
		for (const id of Object.keys(this.initialData?.files ?? {})) {
			if (!fileIds.includes(id)) fileIds.push(id);
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

		const initialDataWithFiles: { elements?: ExcalidrawElement[]; appState?: { viewBackgroundColor?: string }; files: BinaryFiles } = {
			...this.initialData,
			files: { ...this.loadedFiles },
		};

		this.reactRoot.render(
			<ExcalidrawWrapper
				initialData={initialDataWithFiles}
				onSave={this.handleSave}
				onExcalidrawAPI={(api) => {
					void (async () => {
						this.excalidrawApi = api;
						const items = await this.plugin.loadLibraryItems();
						if (items.length > 0) {
							api.updateLibrary({ libraryItems: items as unknown as Parameters<typeof api.updateLibrary>[0]['libraryItems'], merge: true });
						}
					})();
				}}
				theme={theme}
				transparentBackground={this.plugin.settings.transparentBackground}
				onToggleTransparentBackground={(val) => {
					this.plugin.settings.transparentBackground = val;
					void this.plugin.saveSettings().then(() => {
						if (this.excalidrawApi) {
							this.excalidrawApi.updateScene({
								appState: { viewBackgroundColor: val ? '#00000000' : '#ffffff' }
							});
						}
						this.renderReact();
					});
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
			const allFiles: BinaryFiles = { ...this.latestFiles, ...files };
			this.performSave(elements, appState, allFiles);
		}
		this.reactRoot?.unmount();
		this.reactRoot = null;
		this.contentEl.empty();
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
			const imgEl = el as ExcalidrawElement & { fileId?: string };
			if (imgEl.type === 'image' && imgEl.fileId) {
				usedFileIds.add(imgEl.fileId);
			}
		}

		const filesIndex: Record<string, { mimeType: string; created: number }> = {};
		for (const fileId of usedFileIds) {
			const f = files[fileId];
			if (f) {
				filesIndex[fileId] = { mimeType: f.mimeType, created: f.created };
			}
		}

		const targetFile = this.file;
		if (!targetFile) return;

		if (Object.keys(files).length > 0) {
			void this.plugin.saveContentFiles(files).catch((e: unknown) =>
				console.error('[ObsidianDraw] Failed to save content files:', e),
			);
		}

		void this.plugin.app.vault.read(targetFile).then((content) => {
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

			if (fencePos === -1) return;

			const contentStart = fencePos + openFence.length;
			const closeFenceIdx = content.indexOf('\n```', contentStart);
			if (closeFenceIdx === -1) return;

			let previewExtras: Record<string, unknown> = {};
			try {
				const existing = JSON.parse(content.slice(contentStart, closeFenceIdx)) as ParsedCanvasData;
				if (existing.previewHeight !== undefined) previewExtras.previewHeight = existing.previewHeight;
				if (existing.previewZoom   !== undefined) previewExtras.previewZoom   = existing.previewZoom;
			} catch {
				// ignore parse errors
			}

			const payload = { elements, appState: savedAppState, files: filesIndex, ...previewExtras };
			const finalJson = JSON.stringify(payload, null, 2);
			this.lastSavedJson = finalJson;

			const newContent = (
				content.slice(0, contentStart) +
				finalJson +
				content.slice(closeFenceIdx)
			);

			void this.plugin.app.vault.modify(targetFile, newContent);
		});
	};
}
