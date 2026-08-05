import { WidgetType, EditorView } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from '../obsidian/ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

interface ParsedSource {
	elements?: ExcalidrawElement[];
	appState?: Partial<AppState>;
	files?: Record<string, { mimeType: string; created?: number }>;
}

function extractFileIds(source: string): string[] {
	try {
		const parsed = JSON.parse(source) as ParsedSource;
		const ids: string[] = [];
		for (const el of parsed.elements ?? []) {
			const imgEl = el as ExcalidrawElement & { fileId?: string };
			if (imgEl.type === 'image' && imgEl.fileId) ids.push(imgEl.fileId);
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
	private appState: Partial<AppState> = {};
	private initialData: ParsedSource | null = null;
	private previewFiles: BinaryFiles = {};

	constructor(
		private readonly source: string,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly blockIndex: number = 0,
	) {
		super();
		this.parseSource(source);
		void this.loadFiles();
	}

	eq(other: ExcalidrawLiveWidget): boolean {
		return this.blockIndex === other.blockIndex && this.source === other.source;
	}

	toDOM(_view: EditorView): HTMLElement {
		const container = createDiv();
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
			this.renderPreview();
		}
	}

	private parseSource(source: string): void {
		if (!source.trim()) return;
		try {
			const parsed = JSON.parse(source) as ParsedSource;
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
				renderInCanvas={this.plugin.settings.renderThumbnailInCanvas}
			/>,
		);
	}

	private openModal = (): void => {
		new ExcalidrawModal(
			this.plugin.app,
			this.plugin,
			this.initialData as unknown as import('../obsidian/ExcalidrawModal').ParsedCanvasData | null,
			this.source.trim(),
			this.blockIndex,
		).open();
	};
}
