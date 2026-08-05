import { Editor, MarkdownFileInfo, MarkdownView, Notice } from 'obsidian';
import { ExcalidrawModal } from '../obsidian/ExcalidrawModal';
import type ObsidianDrawPlugin from '../main';

const EMPTY_CANVAS = JSON.stringify(
	{
		elements: [],
		appState: { viewBackgroundColor: '#00000000' },
	},
	null,
	2,
);

 function findExcalidrawBlock(
	lines: string[],
	cursorLine: number,
): { openLine: number; closeLine: number } | null {
	let openLine = -1;
	for (let i = cursorLine; i >= 0; i--) {
		const l = lines[i];
		if (l !== undefined && l.trim().startsWith('```excalidraw')) {
			openLine = i;
			break;
		}
	}
	if (openLine === -1) return null;

	let closeLine = -1;
	for (let i = openLine + 1; i < lines.length; i++) {
		const l = lines[i];
		if (l !== undefined && l.trim() === '```') {
			closeLine = i;
			break;
		}
	}
	if (closeLine === -1) return null;

	return { openLine, closeLine };
}

export function registerCommands(plugin: ObsidianDrawPlugin) {
	//  Add canvas at cursor  
	plugin.addCommand({
		id: 'add-canvas',
		name: 'ObsidianDraw: Add canvas at cursor',
		editorCallback: (editor: Editor) => {
			const block = '```excalidraw\n' + EMPTY_CANVAS + '\n```';
			const cursor = editor.getCursor();
			const line = editor.getLine(cursor.line);

			if (line.trim().length > 0) {
				editor.replaceRange('\n' + block + '\n', { line: cursor.line, ch: line.length });
			} else {
				editor.replaceRange(block + '\n', { line: cursor.line, ch: 0 });
			}
		},
	});

	//  Open in editor  
	plugin.addCommand({
		id: 'open-canvas-editor',
		name: 'ObsidianDraw: Open canvas under cursor in editor',
		editorCallback: (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
			const lines = editor.getValue().split('\n');
			const block = findExcalidrawBlock(lines, editor.getCursor().line);

			if (!block) {
				new Notice('ObsidianDraw: Cursor is not inside an excalidraw block.');
				return;
			}

			const source = lines.slice(block.openLine + 1, block.closeLine).join('\n');
			let initialData: object | null = null;
			try {
				initialData = source.trim() ? JSON.parse(source) : null;
			} catch {
				new Notice('ObsidianDraw: Canvas JSON is invalid — opening blank canvas.');
			}

			new ExcalidrawModal(plugin.app, plugin, initialData, source.trim()).open();
		},
	});

	// ─── 3. Clear canvas under cursor ──────────────────────────────────────────
	plugin.addCommand({
		id: 'clear-canvas',
		name: 'ObsidianDraw: Clear canvas under cursor',
		editorCallback: (editor: Editor) => {
			const lines = editor.getValue().split('\n');
			const block = findExcalidrawBlock(lines, editor.getCursor().line);

			if (!block) {
				new Notice('ObsidianDraw: Cursor is not inside an excalidraw block.');
				return;
			}

			editor.replaceRange(
				EMPTY_CANVAS + '\n',
				{ line: block.openLine + 1, ch: 0 },
				{ line: block.closeLine, ch: 0 },
			);
			new Notice('ObsidianDraw: Canvas cleared.');
		},
	});

	// ─── 4. Delete canvas block under cursor ───────────────────────────────────
	plugin.addCommand({
		id: 'delete-canvas',
		name: 'ObsidianDraw: Delete canvas block under cursor',
		editorCallback: (editor: Editor) => {
			const lines = editor.getValue().split('\n');
			const block = findExcalidrawBlock(lines, editor.getCursor().line);

			if (!block) {
				new Notice('ObsidianDraw: Cursor is not inside an excalidraw block.');
				return;
			}

			editor.replaceRange(
				'',
				{ line: block.openLine, ch: 0 },
				{ line: block.closeLine + 1, ch: 0 },
			);
			new Notice('ObsidianDraw: Canvas deleted.');
		},
	});

	// ─── 5. New note with canvas ────────────────────────────────────────────────
	plugin.addCommand({
		id: 'new-note-with-canvas',
		name: 'ObsidianDraw: Create new note with canvas',
		callback: async () => {
			const date = new Date();
			const name = [
				'Drawing',
				date.getFullYear(),
				String(date.getMonth() + 1).padStart(2, '0'),
				String(date.getDate()).padStart(2, '0'),
				String(date.getHours()).padStart(2, '0') + String(date.getMinutes()).padStart(2, '0'),
			].join('-');

			const content = `# ${name}\n\n\`\`\`excalidraw\n${EMPTY_CANVAS}\n\`\`\`\n`;
			const file = await plugin.app.vault.create(`${name}.md`, content);
			await plugin.app.workspace.getLeaf(false).openFile(file);
			new Notice(`ObsidianDraw: Created "${name}.md"`);
		},
	});
}

