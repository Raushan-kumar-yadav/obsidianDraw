import { WidgetType, EditorView } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from '../obsidian/ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

function extractFileIds(source: string): string[] {
	try {
		const parsed = JSON.parse(source) as { elements?: any[]; files?: Record<string, any> };
		const ids: string[] = [];
		for (const el of parsed.elements ?? []) {
			if (el.type === 'image' && el.fileId) ids.push(el.fileId);
		}
		for (const id of Object.keys(parsed.files ?? {})) {
			if (!ids.includes(id)) ids.push(id);
		}
		return ids;
	} catch {
		return [];
	}
}

export class ExcalidrawLiveWidget extends WidgetType {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private appState: any = {};
	private initialData: object | null = null;
	private previewFiles: BinaryFiles = {};

	constructor(
		private readonly source: string,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly blockIndex: number = 0,
	) {
		super();
		this.parseSource(source);
		// Pre-load images asynchronously
		this.loadFiles();
	}

	eq(other: ExcalidrawLiveWidget): boolean {
		return this.blockIndex === other.blockIndex && this.source === other.source;
	}

	toDOM(_view: EditorView): HTMLElement {
		const container = document.createElement('div');
		this.reactRoot = createRoot(container);
		this.renderPreview();
		return container;
	}

	destroy(_dom: HTMLElement): void {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}

	private async loadFiles(): Promise<void> {
		const fileIds = extractFileIds(this.source);
		if (fileIds.length > 0) {
			this.previewFiles = await this.plugin.loadContentFiles(fileIds);
			// Re-render once files are loaded
			this.renderPreview();
		}
	}

	private parseSource(source: string): void {
		if (!source.trim()) return;
		try {
			const parsed = JSON.parse(source) as { elements?: ExcalidrawElement[], appState?: any };
			this.initialData = parsed;
			this.elements = parsed.elements ?? [];
			this.appState = parsed.appState ?? {};
		} catch (e) {
			console.error('[ObsidianDraw] LiveWidget: failed to parse JSON:', e);
		}
	}

	private renderPreview(): void {
		if (!this.reactRoot) return;
		this.reactRoot.render(
			<ExcalidrawPreview
				elements={this.elements}
				appState={this.appState}
				files={this.previewFiles}
				onEdit={this.openModal}
			/>,
		);
	}

	private openModal = (): void => {
		new ExcalidrawModal(
			this.plugin.app,
			this.plugin,
			this.initialData,
			this.source.trim(),
			this.blockIndex,
		).open();
	};
}
