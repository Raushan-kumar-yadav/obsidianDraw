import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile, TAbstractFile } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from './ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
import type ObsidianDrawPlugin from '../main';

 function computeBlockIndex(fileContent: string, lineStart: number): number {
	const lines = fileContent.split('\n');
	let count = 0;
	for (let i = 0; i < lineStart; i++) {
		const l = lines[i];
		if (l !== undefined && l.trim().startsWith('```excalidraw')) {
			count++;
		}
	}
	return count;
}

 function extractBlock(content: string, blockIndex: number): string | null {
	const openFence = '```excalidraw\n';
	let searchPos = 0;
	let foundCount = 0;

	while (searchPos < content.length) {
		const fencePos = content.indexOf(openFence, searchPos);
		if (fencePos === -1) break;

		const contentStart = fencePos + openFence.length;
		const closeFenceIdx = content.indexOf('\n```', contentStart);
		if (closeFenceIdx === -1) break;

		if (foundCount === blockIndex) {
			return content.slice(contentStart, closeFenceIdx);
		}

		foundCount++;
		searchPos = closeFenceIdx + '\n```'.length;
	}

	return null;
}

export class ExcalidrawRenderChild extends MarkdownRenderChild {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private appState: Partial<AppState> = {};
	private initialData: object | null = null;
 	private blockIndex = 0;

	constructor(
		containerEl: HTMLElement,
		private source: string,
		private readonly ctx: MarkdownPostProcessorContext,
		private readonly plugin: ObsidianDrawPlugin,
	) {
		super(containerEl);
		this.parseSource(source);
	}

	onload(): void {
 		const info = this.ctx.getSectionInfo(this.containerEl);
		if (info) {
			this.blockIndex = computeBlockIndex(info.text, info.lineStart);
		}

		this.containerEl.empty();
		const mountEl = this.containerEl.createDiv();
		this.reactRoot = createRoot(mountEl);
		this.renderPreview();

		 
		this.registerEvent(
			this.plugin.app.vault.on('modify', (abstractFile: TAbstractFile) => {
				if (!(abstractFile instanceof TFile)) return;
				if (abstractFile.path !== this.ctx.sourcePath) return;

				this.plugin.app.vault.read(abstractFile).then((content) => {
					const newSource = extractBlock(content, this.blockIndex);
					if (newSource === null) return;
					if (newSource.trim() === this.source.trim()) return; // no change
					this.source = newSource;
					this.parseSource(newSource);
					this.renderPreview();
				});
			}),
		);
	}

	onunload(): void {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}

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
 		const info = this.ctx.getSectionInfo(this.containerEl);
		if (info) {
			this.blockIndex = computeBlockIndex(info.text, info.lineStart);
		}

		new ExcalidrawModal(
			this.plugin.app,
			this.plugin,
			this.initialData,
			this.source.trim(),
			this.blockIndex,
		).open();
	};
}