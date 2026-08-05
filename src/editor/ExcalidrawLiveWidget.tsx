import { WidgetType, EditorView } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from '../obsidian/ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type ObsidianDrawPlugin from '../main';

export class ExcalidrawLiveWidget extends WidgetType {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private appState: any = {};
	private initialData: object | null = null;

	/**
	 * @param source         
	 * @param plugin           
	 * @param openingFenceLine 
	 * @param blockIndex     
	 */
	constructor(
		private readonly source: string,
		private readonly plugin: ObsidianDrawPlugin,
		private readonly blockIndex: number = 0,
	) {
		super();
		this.parseSource(source);
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

