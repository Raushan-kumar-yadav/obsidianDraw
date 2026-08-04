import {
	Decoration,
	DecorationSet,
	EditorView,
} from '@codemirror/view';
import { Range, StateField, Transaction, Text } from '@codemirror/state';
import { ExcalidrawLiveWidget } from './ExcalidrawLiveWidget';
import type ObsidianDrawPlugin from '../main';

const OPEN_FENCE_RE = /^(`{3,}|~{3,})excalidraw\s*$/;

 
export function buildLivePreviewPlugin(plugin: ObsidianDrawPlugin) {
	return StateField.define<DecorationSet>({
		create(state) {
			return buildDecorations(state.doc, plugin);
		},

		update(decorations: DecorationSet, tr: Transaction) {
			if (tr.docChanged) {
				return buildDecorations(tr.state.doc, plugin);
			}
			return decorations;
		},

		provide(field) {
			return EditorView.decorations.from(field);
		},
	});
}

function buildDecorations(doc: Text, plugin: ObsidianDrawPlugin): DecorationSet {
	const ranges: Range<Decoration>[] = [];
	let lineNum = 1;

	while (lineNum <= doc.lines) {
		const line = doc.line(lineNum);
		const fenceMatch = OPEN_FENCE_RE.exec(line.text);

		if (fenceMatch) {
			const fenceChar = (fenceMatch[1] as string)[0];
			const fenceLen = (fenceMatch[1] as string).length;
			const closeFenceRe = new RegExp(
				`^${fenceChar}{${fenceLen},}\\s*$`,
			);

			const contentParts: string[] = [];
			let closingLineNum = -1;

			for (let i = lineNum + 1; i <= doc.lines; i++) {
				const innerLine = doc.line(i);
				if (closeFenceRe.test(innerLine.text)) {
					closingLineNum = i;
					break;
				}
				contentParts.push(innerLine.text);
			}

			if (closingLineNum !== -1) {
				const closingLine = doc.line(closingLineNum);
				const source = contentParts.join('\n');

				ranges.push(
					Decoration.replace({
						widget: new ExcalidrawLiveWidget(source, plugin),
						block: true,
					}).range(line.from, closingLine.to),
				);

				lineNum = closingLineNum + 1;
				continue;
			}
		}

		lineNum++;
	}

	return Decoration.set(ranges, true);
}
