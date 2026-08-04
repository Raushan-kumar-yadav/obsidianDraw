import { useEffect, useState } from 'react';
import { exportToCanvas } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/dist/types/excalidraw/element/types';

interface ExcalidrawPreviewProps {
 	elements: readonly ExcalidrawElement[];
 	onEdit: () => void;
}

 
export function ExcalidrawPreview({ elements, onEdit }: ExcalidrawPreviewProps) {
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		// Filter out deleted elements  
		const active = (elements ?? []).filter((el) => !el.isDeleted);
		if (active.length === 0) {
			setPreviewUrl(null);
			return;
		}

		setLoading(true);

		// current theme for the thumbnail
		const isDark = document.body.classList.contains('theme-dark');

		exportToCanvas({
			elements: active as ExcalidrawElement[],
			appState: {
				exportWithDarkMode: isDark,
				exportBackground: true,
			},
			files: null,
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
	// update on element update 
	}, [elements]);

	return (
		<div
			className="obsidian-draw__preview"
			onClick={onEdit}
			role="button"
			tabIndex={0}
			aria-label="Click to open drawing editor"
			onKeyDown={(e) => e.key === 'Enter' && onEdit()}
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
