import { useCallback } from 'react';
import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
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
 
	onExcalidrawAPI?: (api: ExcalidrawImperativeAPI) => void | Promise<void>;
	 
	theme?: string;
	transparentBackground?: boolean;
	onToggleTransparentBackground?: (value: boolean) => void;
}

export function ExcalidrawWrapper({
	initialData,
	onSave,
	onExcalidrawAPI,
	theme,
	transparentBackground,
	onToggleTransparentBackground,
}: ExcalidrawWrapperProps) {
	// Force transparent background on load if enabled
	const data = { ...(initialData ?? {}) };
	if (transparentBackground) {
		data.appState = {
			...data.appState,
			viewBackgroundColor: '#00000000',
		};
	}

	const handleChange = useCallback(
		(
			elements: readonly ExcalidrawElement[],
			appState: AppState,
			files: BinaryFiles,
		) => {
			onSave(elements, appState, files);
		},
		[onSave],
	);

	return (
		<div style={{ height: '100%', width: '100%', position: 'relative' }}>
			<Excalidraw
				initialData={data}
				onChange={handleChange}
				excalidrawAPI={onExcalidrawAPI}
				theme={theme as 'light' | 'dark'}
				UIOptions={
					transparentBackground
						? { canvasActions: { changeViewBackgroundColor: false } }
						: undefined
				}
			>
				<MainMenu>
					<MainMenu.DefaultItems.SaveAsImage />
					<MainMenu.DefaultItems.Export />
					<MainMenu.DefaultItems.CommandPalette />
					<MainMenu.DefaultItems.SearchMenu />
					<MainMenu.DefaultItems.ClearCanvas />
					<MainMenu.Separator />
					<MainMenu.ItemCustom>
						<label
							style={{
								display: 'flex',
								alignItems: 'center',
								gap: '0.75rem',
								padding: '0.25rem 0.5rem',
								cursor: 'pointer',
								fontSize: '14px',
								color: 'var(--text-normal)'
							}}
						>
							<input
								type="checkbox"
								checked={transparentBackground}
								onChange={(e) => {
									onToggleTransparentBackground?.(e.target.checked);
								}}
							/>
							Transparent background
						</label>
					</MainMenu.ItemCustom>
					{!transparentBackground && <MainMenu.DefaultItems.ChangeCanvasBackground />}
					<MainMenu.DefaultItems.ToggleTheme />
					<MainMenu.DefaultItems.Help />
				</MainMenu>
			</Excalidraw>
		</div>
	);
}
