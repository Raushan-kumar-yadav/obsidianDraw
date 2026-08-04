import { App, PluginSettingTab, Setting, TFile } from 'obsidian';
import MyPlugin from '../main';

export interface MyPluginSettings {
	transparentBackground: boolean;
}

export const DEFAULT_SETTINGS: MyPluginSettings = {
	transparentBackground: true,
};

export class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass('obsidian-draw-settings-tab');

		// Render the mini list and Import button
		await this.renderLibraryList(containerEl);

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
	}

	private getLibraryFolder(): string {
		return `${this.plugin.manifest.dir}/libraries`;
	}

	private async renderLibraryList(containerEl: HTMLElement) {
		const folderPath = this.getLibraryFolder();
		const adapter = this.app.vault.adapter;
		
		let filesInFolder: string[] = [];
		if (await adapter.exists(folderPath)) {
			const listed = await adapter.list(folderPath);
			filesInFolder = listed.files.filter((f) => f.endsWith('.excalidrawlib'));
		}

		const listContainer = containerEl.createDiv({ cls: 'obsidian-draw-library-list-container' });
		listContainer.style.marginTop = '10px';
		listContainer.style.marginBottom = '20px';
		listContainer.style.padding = '10px';
		listContainer.style.backgroundColor = 'var(--background-secondary)';
		listContainer.style.borderRadius = '8px';
		listContainer.style.border = '1px solid var(--background-modifier-border)';

		const header = listContainer.createDiv({ cls: 'obsidian-draw-library-list-header' });
		header.style.display = 'flex';
		header.style.justifyContent = 'space-between';
		header.style.alignItems = 'center';
		header.style.marginBottom = '10px';

		const title = header.createEl('h4', { text: 'Installed Libraries' });
		title.style.margin = '0';

		const importLabel = header.createEl('label', { text: 'Import .excalidrawlib' });
		importLabel.style.cursor = 'pointer';
		importLabel.style.backgroundColor = 'var(--interactive-accent)';
		importLabel.style.color = 'var(--text-on-accent)';
		importLabel.style.padding = '4px 12px';
		importLabel.style.borderRadius = '4px';
		importLabel.style.fontSize = '13px';
		importLabel.style.fontWeight = '600';

		const importInput = importLabel.createEl('input');
		importInput.type = 'file';
		importInput.accept = '.excalidrawlib';
		importInput.multiple = true;
		importInput.style.display = 'none';

		importInput.onchange = async (e) => {
			const files = (e.target as HTMLInputElement).files;
			if (!files || files.length === 0) return;

			// Ensure the target folder exists
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
					const newName = `${nameWithoutExt} (${counter}).excalidrawlib`;
					deduplicatedPath = `${folderPath}/${newName}`;
					counter++;
				}

				try {
					await adapter.writeBinary(deduplicatedPath, buffer);
				} catch (err) {
					console.error(`[ObsidianDraw] Failed to create file ${deduplicatedPath}:`, err);
				}
			}

			this.display(); 
		};

		if (filesInFolder.length > 0) {
			const ul = listContainer.createEl('ul', { cls: 'obsidian-draw-library-list' });
			ul.style.listStyleType = 'none';
			ul.style.padding = '0';
			ul.style.margin = '0';

			filesInFolder.forEach((filePath) => {
				const fileName = filePath.split('/').pop() || filePath;
				const li = ul.createEl('li');
				li.style.display = 'flex';
				li.style.justifyContent = 'space-between';
				li.style.alignItems = 'center';
				li.style.padding = '6px 0';
				li.style.borderBottom = '1px solid var(--background-modifier-border)';

				li.createSpan({ text: fileName });
				const delBtn = li.createEl('button', { text: 'Delete' });
				delBtn.style.backgroundColor = 'var(--background-modifier-error)';
				delBtn.style.color = 'var(--text-on-accent)';
				delBtn.onclick = async () => {
					await adapter.remove(filePath);
					this.display(); // re-render list
				};
			});
		} else {
			const emptyState = listContainer.createDiv();
			emptyState.style.color = 'var(--text-muted)';
			emptyState.style.fontStyle = 'italic';
			emptyState.style.padding = '10px 0';
			emptyState.innerText = `No libraries found. Click import to add one.`;
		}
	}
}
