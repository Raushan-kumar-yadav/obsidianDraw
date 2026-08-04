import { useCallback, useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/dist/types/excalidraw/types';

export interface ExcalidrawWrapperProps {
	initialData: {
		elements?: readonly ExcalidrawElement[];
		appState?: Partial<AppState>;
		files?: BinaryFiles;
	} | null;
	onSave: (
		elements: readonly ExcalidrawElement[],
		appState: AppState,
		files: BinaryFiles,
	) => void;
 
	onExcalidrawAPI?: (api: ExcalidrawImperativeAPI) => void;
	 
	theme?: string;
}

export function ExcalidrawWrapper({
	initialData,
	onSave,
	onExcalidrawAPI,
	theme,
}: ExcalidrawWrapperProps) {
	const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleChange = useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles,
		) => {
			if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
			saveTimeoutRef.current = setTimeout(() => {
				onSave(elements, appState, files);
			}, 1000);
		},
		[onSave],
	);

	return (
		<div style={{ height: '100%', width: '100%', position: 'relative' }}>
			<Excalidraw
				initialData={initialData ?? undefined}
				onChange={handleChange}
				excalidrawAPI={onExcalidrawAPI}
				theme={theme as 'light' | 'dark'}
			/>
		</div>
	);
}
