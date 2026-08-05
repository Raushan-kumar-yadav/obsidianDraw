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

	/**
	 * @param blockIndex  0-based index of the excalidraw fence block inside the file.
	 *                    Used to target the correct block when multiple blocks exist.
	 */
	constructor(
		app: App,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly initialData: object | null,
		initialJson: string,
		private readonly blockIndex: number = 0,
	) {
		super(app);
		this.lastSavedJson = initialJson;
		this.file = app.workspace.getActiveFile();
		this.modalEl.addClass('obsidian-draw__modal');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obsidian-draw__modal-body');
		this.reactRoot = createRoot(contentEl);
		this.renderReact();
	}

	private renderReact = () => {
		if (!this.reactRoot) return;
		const isDark = document.body.classList.contains('theme-dark');
		const theme = isDark ? 'dark' : 'light';

		this.reactRoot.render(
			<ExcalidrawWrapper
				initialData={this.initialData as any}
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
			if (this.saveTimeout) {
				window.clearTimeout(this.saveTimeout);
			}
			this.performSave(elements, appState as unknown as AppState);
		}
		this.reactRoot?.unmount();
		this.reactRoot = null;
		this.contentEl.empty();
	}

	private handleSave = (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		_files: BinaryFiles,
	): void => {
		if (this.saveTimeout) {
			window.clearTimeout(this.saveTimeout);
		}
		this.saveTimeout = window.setTimeout(() => {
			this.performSave(elements, appState);
		}, 300);
	};

	private performSave = (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
	): void => {
		const savedAppState = { viewBackgroundColor: appState.viewBackgroundColor };
		const newJson = JSON.stringify({ elements, appState: savedAppState }, null, 2);
		if (newJson === this.lastSavedJson) return;

		const targetFile = this.file;
		if (!targetFile) return;

		this.lastSavedJson = newJson;

		this.plugin.app.vault.process(targetFile, (content: string) => {
			const openFence = '```excalidraw\n';

			// Find the blockIndex  
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

			if (fencePos === -1) return content; // block not found

			const contentStart = fencePos + openFence.length;
			const closeFenceIdx = content.indexOf('\n```', contentStart);
			if (closeFenceIdx === -1) return content;

			// Replace this 
			return (
				content.slice(0, contentStart) +
				newJson +
				content.slice(closeFenceIdx)
			);
		});
	};
}
