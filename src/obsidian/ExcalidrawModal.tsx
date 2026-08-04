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

	constructor(
		app: App,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly initialData: object | null,
		initialJson: string,
	) {
		super(app);
		this.lastSavedJson = initialJson;
		this.modalEl.addClass('obsidian-draw__modal');
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('obsidian-draw__modal-body');

 		const isDark = document.body.classList.contains('theme-dark');
		const theme = isDark ? 'dark' : 'light';

		this.reactRoot = createRoot(contentEl);
		this.reactRoot.render(
			<ExcalidrawWrapper
 				initialData={this.initialData as any}
				onSave={this.handleSave}
				onExcalidrawAPI={(api) => {
					this.excalidrawApi = api;
				}}
				theme={theme}
			/>,
		);
	}

	onClose(): void {
 		if (this.excalidrawApi) {
			const elements = this.excalidrawApi.getSceneElements();
			const appState = this.excalidrawApi.getAppState();
			const files = this.excalidrawApi.getFiles();
			this.handleSave(
				elements,
				appState as unknown as AppState,
				files as unknown as BinaryFiles,
			);
		}

		this.reactRoot?.unmount();
		this.reactRoot = null;
		this.contentEl.empty();
	}

	 
	private handleSave = (
		elements: readonly ExcalidrawElement[],
		_appState: AppState,
		_files: BinaryFiles,
	): void => {
		const newJson = JSON.stringify({ elements }, null, 2);
		if (newJson === this.lastSavedJson) return;

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!activeFile) return;

		const previousJson = this.lastSavedJson;
		this.lastSavedJson = newJson;  

		this.plugin.app.vault.process(activeFile, (content: string) => {
			const openFence = '```excalidraw\n';
			let searchPos = 0;

			while (searchPos < content.length) {
				const fencePos = content.indexOf(openFence, searchPos);
				if (fencePos === -1) break;

				const contentStart = fencePos + openFence.length;
				const closeFenceIdx = content.indexOf('\n```', contentStart);
				if (closeFenceIdx === -1) break;

				const blockContent = content.slice(contentStart, closeFenceIdx);
				const isMatch =
					blockContent.trim() === previousJson.trim() ||
					(blockContent.trim() === '' && previousJson.trim() === '');

				if (isMatch) {
					return (
						content.slice(0, contentStart) +
						newJson +
						content.slice(closeFenceIdx)
					);
				}

				searchPos = closeFenceIdx + '\n```'.length;
			}

			return content;  
		});
	};
}
