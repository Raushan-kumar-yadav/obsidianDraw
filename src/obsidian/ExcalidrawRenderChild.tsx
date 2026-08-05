import { MarkdownPostProcessorContext, MarkdownRenderChild, TFile, TAbstractFile } from 'obsidian';
import { createRoot, Root } from 'react-dom/client';
import { ExcalidrawPreview } from '../components/ExcalidrawPreview';
import { ExcalidrawModal } from './ExcalidrawModal';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';
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

interface ParsedSource {
	elements?: ExcalidrawElement[];
	files?: Record<string, { mimeType: string }>;
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

export class ExcalidrawRenderChild extends MarkdownRenderChild {
	private reactRoot: Root | null = null;
	private elements: readonly ExcalidrawElement[] = [];
	private appState: Partial<AppState> = {};
	private initialData: object | null = null;
	private blockIndex = 0;
	private previewFiles: BinaryFiles = {};
	private previewHeight = 300;
	private previewZoom = 1;

	private get heightKey(): string {
		return `${this.ctx.sourcePath}:${this.blockIndex}`;
	}

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

		const savedSettingsHeight = this.plugin.settings.previewHeights?.[this.heightKey];
		this.previewHeight = savedSettingsHeight ?? this.plugin.settings.defaultCanvasHeight ?? 300;

		this.containerEl.empty();
		const mountEl = this.containerEl.createDiv();
		this.reactRoot = createRoot(mountEl);

		void this.loadFilesAndRender();

		this.registerEvent(
			this.plugin.app.vault.on('modify', (abstractFile: TAbstractFile) => {
				if (!(abstractFile instanceof TFile)) return;
				if (abstractFile.path !== this.ctx.sourcePath) return;

				void this.plugin.app.vault.read(abstractFile).then(async (content) => {
					const newSource = extractBlock(content, this.blockIndex);
					if (newSource === null) return;
					const changed = newSource.trim() !== this.source.trim();
					this.source = newSource;
					this.parseSource(newSource);

					if (changed) {
						await this.loadFilesAndRender();
					} else {
						this.renderPreview();
					}
				});
			}),
		);

		this.registerEvent(
			(this.plugin.app.workspace as unknown as { on: (event: string, cb: () => void) => import('obsidian').EventRef }).on(
				'obsidian-draw:preview-mode-changed',
				() => { this.renderPreview(); },
			),
		);
	}

	onunload(): void {
		this.reactRoot?.unmount();
		this.reactRoot = null;
	}

	private async loadFilesAndRender(): Promise<void> {
		const fileIds = extractFileIds(this.source);
		if (fileIds.length > 0) {
			this.previewFiles = await this.plugin.loadContentFiles(fileIds);
		} else {
			this.previewFiles = {};
		}
		this.renderPreview();
	}

	private parseSource(source: string): void {
		if (!source.trim()) return;
		try {
			const parsed = JSON.parse(source) as {
				elements?: ExcalidrawElement[];
				appState?: Partial<AppState>;
				previewHeight?: number;
				previewZoom?: number;
			};
			this.initialData = parsed;
			this.elements  = parsed.elements  ?? [];
			this.appState  = parsed.appState  ?? {};
			if (typeof parsed.previewHeight === 'number') this.previewHeight = parsed.previewHeight;
			if (typeof parsed.previewZoom   === 'number') this.previewZoom   = parsed.previewZoom;
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
				files={this.previewFiles}
				onEdit={this.openModal}
				renderInCanvas={this.plugin.settings.renderThumbnailInCanvas}
				initialHeight={this.previewHeight}
				onHeightChange={this.savePreviewHeight}
				initialZoom={this.previewZoom}
				onZoomChange={this.savePreviewZoom}
			/>,
		);
	}

	private savePreviewState = async (updates: { previewHeight?: number; previewZoom?: number }): Promise<void> => {
		const file = this.plugin.app.vault.getAbstractFileByPath(this.ctx.sourcePath);
		if (!(file instanceof TFile)) return;

		if (updates.previewHeight !== undefined) this.previewHeight = updates.previewHeight;
		if (updates.previewZoom   !== undefined) this.previewZoom   = updates.previewZoom;

		const content = await this.plugin.app.vault.read(file);
		const openFence = '```excalidraw\n';
		let searchPos = 0;
		let foundCount = 0;

		let newContent = content;
		while (searchPos < content.length) {
			const fencePos = content.indexOf(openFence, searchPos);
			if (fencePos === -1) break;

			const contentStart = fencePos + openFence.length;
			const closeFenceIdx = content.indexOf('\n```', contentStart);
			if (closeFenceIdx === -1) break;

			if (foundCount === this.blockIndex) {
				try {
					const parsed = JSON.parse(content.slice(contentStart, closeFenceIdx)) as Record<string, unknown>;
					if (updates.previewHeight !== undefined) parsed.previewHeight = updates.previewHeight;
					if (updates.previewZoom   !== undefined) parsed.previewZoom   = updates.previewZoom;
					newContent = (
						content.slice(0, contentStart) +
						JSON.stringify(parsed, null, 2) +
						content.slice(closeFenceIdx)
					);
				} catch {
					// leave content unchanged on parse error
				}
				break;
			}

			foundCount++;
			searchPos = closeFenceIdx + '\n```'.length;
		}

		if (newContent !== content) {
			await this.plugin.app.vault.modify(file, newContent);
		}
	};

	private savePreviewHeight = (height: number) => this.savePreviewState({ previewHeight: height });
	private savePreviewZoom   = (zoom: number)   => this.savePreviewState({ previewZoom: zoom });

	private openModal = (): void => {
		const info = this.ctx.getSectionInfo(this.containerEl);
		if (info) {
			this.blockIndex = computeBlockIndex(info.text, info.lineStart);
		}

		const scrollEl = this.findScrollContainer();
		const savedScrollTop = scrollEl?.scrollTop ?? 0;

		new ExcalidrawModal(
			this.plugin.app,
			this.plugin,
			this.initialData,
			this.source.trim(),
			this.blockIndex,
			() => {
				window.requestAnimationFrame(() => {
					window.requestAnimationFrame(() => {
						if (scrollEl) {
							scrollEl.scrollTop = savedScrollTop;
						}
					});
				});
			},
		).open();
	};

	private findScrollContainer(): HTMLElement | null {
		let el: HTMLElement | null = this.containerEl.parentElement;
		while (el) {
			const { overflow, overflowY } = window.getComputedStyle(el);
			if (
				overflow === 'auto' || overflow === 'scroll' ||
				overflowY === 'auto' || overflowY === 'scroll'
			) {
				return el;
			}
			el = el.parentElement;
		}
		return null;
	}
}