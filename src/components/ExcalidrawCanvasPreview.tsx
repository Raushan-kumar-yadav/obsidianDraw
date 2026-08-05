import { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from '@excalidraw/excalidraw/dist/types/excalidraw/types';

const MIN_HEIGHT = 80;

interface ExcalidrawCanvasPreviewProps {
	elements: readonly ExcalidrawElement[];
	appState?: Partial<AppState>;
	files?: BinaryFiles;
	onEdit: () => void;
	initialHeight?: number;
	onHeightChange?: (height: number) => void;
}

export function ExcalidrawCanvasPreview({
	elements,
	appState,
	files,
	onEdit,
	initialHeight = 300,
	onHeightChange,
}: ExcalidrawCanvasPreviewProps) {
	const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const [height, setHeight] = useState(initialHeight);
	const currentHeight = useRef(height);
	currentHeight.current = height;

	useEffect(() => {
		setHeight(initialHeight);
	}, [initialHeight]);

	useEffect(() => {
		const api = apiRef.current;
		if (!api) return;
		api.updateScene({ elements });
		if (files && Object.keys(files).length > 0) {
			try { api.addFiles(Object.values(files)); } catch { /* ignore if files already added */ }
		}
		window.requestAnimationFrame(() => {
			apiRef.current?.scrollToContent(elements, { fitToContent: true, viewportZoomFactor: 0.9 });
		});
	}, [elements, files]);

	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const startY = e.clientY;
		const startH = currentHeight.current;

		const onMove = (ev: MouseEvent) => {
			const newH = Math.max(MIN_HEIGHT, startH + (ev.clientY - startY));
			setHeight(newH);
		};

		const onUp = () => {
			onHeightChange?.(currentHeight.current);
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}, [onHeightChange]);

	const isDark = document.body.classList.contains('theme-dark');

	return (
		<div className="obsidian-draw__preview-outer" style={{ height: `${height}px` }}>
			<div className="obsidian-draw__canvas-preview-inner">
				<Excalidraw
					initialData={{
						elements,
						appState: {
							viewBackgroundColor: appState?.viewBackgroundColor ?? (isDark ? '#1e1e2e' : '#ffffff'),
						},
						files: files ?? {},
						scrollToContent: true,
					}}
					viewModeEnabled={true}
					zenModeEnabled={true}
					theme={isDark ? 'dark' : 'light'}
					UIOptions={{
						canvasActions: {
							loadScene: false,
							saveToActiveFile: false,
							export: false,
							saveAsImage: false,
							clearCanvas: false,
							changeViewBackgroundColor: false,
						},
					}}
					excalidrawAPI={(api) => {
						apiRef.current = api;
						window.requestAnimationFrame(() => {
							window.requestAnimationFrame(() => {
								api.scrollToContent(elements, { fitToContent: true, viewportZoomFactor: 0.9 });
							});
						});
					}}
				/>

				<div
					className="obsidian-draw__canvas-preview-edit-btn"
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						onEdit();
					}}
					role="button"
					tabIndex={0}
					aria-label="Open drawing editor"
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							e.stopPropagation();
							onEdit();
						}
					}}
				>
					✏️ Edit
				</div>
			</div>

			<div
				className="obsidian-draw__preview-resize-handle"
				onMouseDown={handleResizeStart}
				title="Drag to resize"
			/>
		</div>
	);
}
