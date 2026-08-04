import { MarkdownPostProcessorContext, MarkdownRenderChild } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from './ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

 
export class ExcalidrawRenderChild extends MarkdownRenderChild {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private appState: Partial<AppState> = {};
	private initialData: object | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly source: string,
		private readonly ctx: MarkdownPostProcessorContext,
		private readonly plugin: ObsidianDrawPlugin,
	) {
		super(containerEl);
		this.parseSource(source);
	}

	onload(): void {
		this.containerEl.empty();
		const mountEl = this.containerEl.createDiv();
		this.reactRoot = createRoot(mountEl);
		this.renderPreview();
	}

	onunload(): void {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}

	//   private  

	private parseSource(source: string): void {
		if (!source.trim()) return;
		try {
			const parsed = JSON.parse(source) as { elements?: ExcalidrawElement[], appState?: Partial<AppState> };
			this.initialData = parsed;
			this.elements = parsed.elements ?? [];
			this.appState = parsed.appState ?? {};
		} catch (e) {
			console.error('[ObsidianDraw] RenderChild: failed to parse JSON:', e);
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
		).open();
	};
}