import { useEffect, useState } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/dist/types/excalidraw/types';

interface ExcalidrawPreviewProps {
	elements: readonly ExcalidrawElement[];
	appState?: Partial<AppState>;
 	files?: BinaryFiles;
	onEdit: () => void;
}

export function ExcalidrawPreview({ elements, appState, files, onEdit }: ExcalidrawPreviewProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const active = (elements ?? []).filter((el) => !el.isDeleted);
		if (active.length === 0) {
			setPreviewUrl(null);
			return;
		}

		setLoading(true);
		const isDark = document.body.classList.contains('theme-dark');

		exportToCanvas({
			elements: active as ExcalidrawElement[],
			appState: {
				exportWithDarkMode: isDark,
				exportBackground: true,
				viewBackgroundColor: appState?.viewBackgroundColor,
			},
 			files: files ?? null,
			maxWidthOrHeight: 600,
			exportPadding: 16,
		})
			.then((canvas: HTMLCanvasElement) => {
				setPreviewUrl(canvas.toDataURL('image/png'));
			})
			.catch((err: unknown) => {
				console.error('[ObsidianDraw] Preview render error:', err);
				setPreviewUrl(null);
			})
			.finally(() => setLoading(false));
 	}, [elements, appState, files]);

	return (
		<div
			className="obsidian-draw__preview"
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onEdit();
			}}
			role="button"
			tabIndex={0}
			aria-label="Click to open drawing editor"
			onKeyDown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					e.stopPropagation();
					onEdit();
				}
			}}
		>
			{loading && (
				<div className="obsidian-draw__preview-loading">Rendering…</div>
			)}

			{!loading && previewUrl && (
				<>
					<img
						src={previewUrl}
						alt="Drawing preview"
						className="obsidian-draw__preview-img"
					/>
					<div className="obsidian-draw__preview-hover-hint">✏️ Edit</div>
					<div style={{ position: 'absolute', inset: 0, zIndex: 3 }} />
				</>
			)}

			{!loading && !previewUrl && (
				<div className="obsidian-draw__preview-empty">
					<span className="obsidian-draw__preview-empty-icon">✏️</span>
					<span className="obsidian-draw__preview-empty-label">
						Click to draw
					</span>
				</div>
			)}
		</div>
	);
}
