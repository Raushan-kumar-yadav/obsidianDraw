import { useCallback, useEffect, useRef, useState } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

const MIN_HEIGHT  = 80;
const MIN_SCALE   = 0.25;
const MAX_SCALE   = 4;
const SCALE_STEP  = 0.25;

interface ExcalidrawPreviewProps {
	elements: readonly ExcalidrawElement[];
	appState?: Partial<AppState>;
	files?: BinaryFiles;
	onEdit: () => void;
	 
 
	renderInCanvas?: boolean;
	initialHeight?: number;
	onHeightChange?: (height: number) => void;
 	initialZoom?: number;
 	onZoomChange?: (zoom: number) => void;
}

export function ExcalidrawPreview({
	elements,
	appState,
	files,
	onEdit,
	renderInCanvas = false,
	initialHeight = 300,
	onHeightChange,
	initialZoom = 1,
	onZoomChange,
}: ExcalidrawPreviewProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);

	//   Height state 
	const [height, setHeight] = useState(initialHeight);
	const currentHeight = useRef(height);
	currentHeight.current = height;
	useEffect(() => { setHeight(initialHeight); }, [initialHeight]);

	//   Zoom state 
	const [scale, setScale] = useState(initialZoom);
	useEffect(() => { setScale(initialZoom); }, [initialZoom]);

	const zoomIn = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setScale(s => {
			const next = Math.min(MAX_SCALE, parseFloat((s + SCALE_STEP).toFixed(2)));
			onZoomChange?.(next);
			return next;
		});
	}, [onZoomChange]);

	const zoomOut = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setScale(s => {
			const next = Math.max(MIN_SCALE, parseFloat((s - SCALE_STEP).toFixed(2)));
			onZoomChange?.(next);
			return next;
		});
	}, [onZoomChange]);

	//   Export  
	useEffect(() => {
		const active = (elements ?? []).filter((el) => !el.isDeleted);
		if (active.length === 0) { setPreviewUrl(null); return; }

		let cancelled = false;
		const isDark = document.body.classList.contains('theme-dark');

		exportToCanvas({
			elements: active,
			appState: {
				exportWithDarkMode: isDark,
				exportBackground: true,
				viewBackgroundColor: appState?.viewBackgroundColor,
			},
			files: files ?? null,
			maxWidthOrHeight: renderInCanvas ? 1200 : 600,
			exportPadding: 16,
		})
			.then((canvas: HTMLCanvasElement) => {
				if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
			})
			.catch((err: unknown) => console.error('[ObsidianDraw] Preview render error:', err));

		return () => { cancelled = true; };
 	}, [elements, appState, files, renderInCanvas]);

	//    Resize handle  
	const handleResizeStart = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const startY = e.clientY;
		const startH = currentHeight.current;

		const onMove = (ev: MouseEvent) => {
			setHeight(Math.max(MIN_HEIGHT, startH + (ev.clientY - startY)));
		};
		const onUp = () => {
			onHeightChange?.(currentHeight.current);
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
		};
		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
	}, [onHeightChange]);

	//   Shared click/keyboard props    
	const clickProps = {
		onClick:    (e: React.MouseEvent)   => { e.preventDefault(); e.stopPropagation(); onEdit(); },
		onKeyDown:  (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onEdit(); } },
		role:       'button' as const,
		tabIndex:   0,
		'aria-label': 'Click to open drawing editor',
	};

	const emptyState = (
		<div className="obsidian-draw__preview-empty">
			<span className="obsidian-draw__preview-empty-icon">✏️</span>
			<span className="obsidian-draw__preview-empty-label">Click to draw</span>
		</div>
	);

 	if (!renderInCanvas) {
		return (
			<div className="obsidian-draw__preview" {...clickProps}>
				{previewUrl ? (
					<>
						<img src={previewUrl} alt="Drawing preview" className="obsidian-draw__preview-img" />
						<div className="obsidian-draw__preview-hover-hint">✏️ Edit</div>
						<div className="obsidian-draw__preview-overlay" />
					</>
				) : emptyState}
			</div>
		);
	}

 	return (
		<div className="obsidian-draw__preview-outer" style={{ height: `${height}px` }}>
			{/* Scrollable area */}
			<div className="obsidian-draw__preview-scroll" {...clickProps}>
				{previewUrl ? (
					<img
						src={previewUrl}
						alt="Drawing preview"
						className="obsidian-draw__preview-img-canvas"
						style={{
							width:  scale >= 1 ? `${scale * 100}%` : `${scale * 100}%`,
							height: 'auto',
							display: 'block',
							margin: scale < 1 ? '0 auto' : '0',
						}}
					/>
				) : emptyState}
			</div>

 			{previewUrl && (
				<div className="obsidian-draw__preview-hover-hint">✏️ Edit</div>
			)}

 			<div className="obsidian-draw__preview-zoom-controls">
				<button
					className="obsidian-draw__preview-zoom-btn"
					onClick={zoomOut}
					disabled={scale <= MIN_SCALE}
					title="Zoom out"
					aria-label="Zoom out"
				>−</button>
				<span className="obsidian-draw__preview-zoom-label">
					{Math.round(scale * 100)}%
				</span>
				<button
					className="obsidian-draw__preview-zoom-btn"
					onClick={zoomIn}
					disabled={scale >= MAX_SCALE}
					title="Zoom in"
					aria-label="Zoom in"
				>+</button>
			</div>

 			<div
				className="obsidian-draw__preview-resize-handle"
				onMouseDown={handleResizeStart}
				title="Drag to resize"
			/>
		</div>
	);
}
