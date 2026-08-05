import { App, PluginSettingTab, Setting } from 'obsidian';
import ObsidianDrawPlugin from '../main';

export interface ObsidianDrawSettings {
	transparentBackground: boolean;
	previewHeights: Record<string, number>;
	renderThumbnailInCanvas: boolean;
	defaultCanvasHeight: number;
}

export const DEFAULT_SETTINGS: ObsidianDrawSettings = {
	transparentBackground: true,
	previewHeights: {},
	renderThumbnailInCanvas: false,
	defaultCanvasHeight: 300,
};

export class ObsidianDrawSettingTab extends PluginSettingTab {
	plugin: ObsidianDrawPlugin;

	constructor(app: App, plugin: ObsidianDrawPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/** Declarative settings API (Obsidian 1.13.0+). Enables settings search. */
	getSettingDefinitions() {
		return [
			{
				key: 'transparentBackground',
				name: 'Transparent background',
				desc: 'Force a transparent background and disable the canvas background color picker.',
				type: 'toggle' as const,
			},
			{
				key: 'renderThumbnailInCanvas',
				name: 'Render thumbnail in canvas',
				desc: 'When on, previews use a live interactive Excalidraw canvas. When off, a static image is used (default, lighter).',
				type: 'toggle' as const,
			},
			{
				key: 'defaultCanvasHeight',
				name: 'Default canvas height (px)',
				desc: 'Default preview height for new canvas blocks.',
				type: 'text' as const,
			},
		];
	}

	display(): void {
		this.render();
	}

	/** Internal render — called by display() and by library list refresh. */
	private render(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('obsidian-draw-settings-tab');

		void this.renderLibraryList(containerEl);

		new Setting(containerEl)
			.setName('Transparent background')
			.setDesc('Force a transparent background and disable the canvas background color picker.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.transparentBackground)
					.onChange(async (value) => {
						this.plugin.settings.transparentBackground = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Render thumbnail in canvas')
			.setDesc('When on, previews use a live interactive Excalidraw canvas. When off, a static image is used (default, lighter).')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.renderThumbnailInCanvas)
					.onChange(async (value) => {
						this.plugin.settings.renderThumbnailInCanvas = value;
						await this.plugin.saveSettings();
						(this.app.workspace as unknown as { trigger: (event: string) => void }).trigger('obsidian-draw:preview-mode-changed');
					}),
			);

		new Setting(containerEl)
			.setName('Default canvas height (px)')
			.setDesc('Default preview height for new canvas blocks. Existing blocks with a saved height are unaffected.')
			.addText((text) =>
				text
					.setPlaceholder('300')
					.setValue(String(this.plugin.settings.defaultCanvasHeight))
					.onChange(async (value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num >= 80) {
							this.plugin.settings.defaultCanvasHeight = num;
							await this.plugin.saveSettings();
						}
					}),
			);
	}

	private getLibraryFolder(): string {
		return `${this.plugin.manifest.dir}/libraries`;
	}

	private async renderLibraryList(containerEl: HTMLElement): Promise<void> {
		const folderPath = this.getLibraryFolder();
		const adapter = this.app.vault.adapter;

		let filesInFolder: string[] = [];
		if (await adapter.exists(folderPath)) {
			const listed = await adapter.list(folderPath);
			filesInFolder = listed.files.filter((f) => f.endsWith('.excalidrawlib'));
		}

		new Setting(containerEl).setName('Installed Libraries').setHeading();

		const importLabel = containerEl.createEl('label', {
			cls: 'obsidian-draw-library-import-label',
			text: 'Import .excalidrawlib',
		});

		const importInput = importLabel.createEl('input', { cls: 'obsidian-draw-library-import-input' });
		importInput.type = 'file';
		importInput.accept = '.excalidrawlib';
		importInput.multiple = true;

		importInput.onchange = async (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (!files || files.length === 0) return;

			if (!(await adapter.exists(folderPath))) {
				await adapter.mkdir(folderPath);
			}

			for (let i = 0; i < files.length; i++) {
				const file = files.item(i);
				if (!file) continue;
				const buffer = await file.arrayBuffer();

				const basePath = `${folderPath}/${file.name}`;
				let deduplicatedPath = basePath;
				let counter = 1;

				while (await adapter.exists(deduplicatedPath)) {
					const nameWithoutExt = file.name.replace(/\.excalidrawlib$/, '');
					deduplicatedPath = `${folderPath}/${nameWithoutExt} (${counter}).excalidrawlib`;
					counter++;
				}

				try {
					await adapter.writeBinary(deduplicatedPath, buffer);
				} catch (err) {
					console.error(`[ObsidianDraw] Failed to import library ${deduplicatedPath}:`, err);
				}
			}

			this.render();
		};

		if (filesInFolder.length > 0) {
			const ul = containerEl.createEl('ul', { cls: 'obsidian-draw-library-list' });

			filesInFolder.forEach((filePath) => {
				const fileName = filePath.split('/').pop() ?? filePath;
				const li = ul.createEl('li', { cls: 'obsidian-draw-library-list-item' });
				li.createSpan({ text: fileName });

				const delBtn = li.createEl('button', {
					text: 'Delete',
					cls: 'obsidian-draw-library-delete-btn',
				});
				delBtn.onclick = async () => {
					await adapter.remove(filePath);
					this.render();
				};
			});
		} else {
			containerEl.createDiv({
				cls: 'obsidian-draw-library-empty',
				text: 'No libraries found. Click Import to add one.',
			});
		}
	}
}
