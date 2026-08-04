import { WidgetType, EditorView } from '@codemirror/view';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from '../obsidian/ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type ObsidianDrawPlugin from '../main';

 
export class ExcalidrawLiveWidget extends WidgetType {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private initialData: object | null = null;

	constructor(
		private readonly source: string,
		private readonly plugin: ObsidianDrawPlugin,
	) {
		super();
		this.parseSource(source);
	}

 	eq(_other: ExcalidrawLiveWidget): boolean {
		return true;
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

	// private  

	private parseSource(source: string): void {
		if (!source.trim()) return;
		try {
			const parsed = JSON.parse(source) as { elements?: ExcalidrawElement[] };
			this.initialData = parsed;
			this.elements = parsed.elements ?? [];
		} catch (e) {
			console.error('[ObsidianDraw] LiveWidget: failed to parse JSON:', e);
		}
	}

	private renderPreview(): void {
		if (!this.reactRoot) return;
		this.reactRoot.render(
			<ExcalidrawPreview
				elements={this.elements}
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
		).open();
	};
}
