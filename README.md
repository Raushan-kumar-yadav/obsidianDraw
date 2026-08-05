<div align="center">

# 🎨 CanvasDraw

**Seamless, lightweight, and powerful Excalidraw integration for Obsidian.**

Embed interactive drawings, system architecture diagrams, mind maps, and sketches directly inside your markdown notes with zero friction.

[![Obsidian](https://img.shields.io/badge/Obsidian-Plugin-purple.svg?style=for-the-badge&logo=obsidian)](https://obsidian.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Excalidraw](https://img.shields.io/badge/Excalidraw-Powered-6965DB?style=for-the-badge&logo=excalidraw&logoColor=white)](https://excalidraw.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

![ObsidianDraw Inline Canvas Preview](./assets/inline-preview.png)

</div>

---

## ✨ Features at a Glance

- 📝 **Native Markdown Code Blocks** — Diagrams are stored directly within ```` ```excalidraw ```` code blocks in your note files.
- ⚡ **Instant Click-to-Edit Modal** — Click any drawing thumbnail to open the full-screen Excalidraw editor modal.
- 🖼️ **Image & Asset Support** — Paste or drag screenshots and images into your drawing; binary assets are automatically stored locally in your vault's `content/` folder without cluttering markdown.
- 📚 **Excalidraw Libraries & Custom Imports** — Comes bundled with architectural, AWS, system design, data viz, and stick-figure libraries, with full support to import `.excalidrawlib` files.
- 🔍 **Interactive Canvas & Zoom Controls** — Hover to reveal smooth `+` / `−` zoom buttons and a bottom-right resize handle.
- 💾 **Per-Block Layout Persistence** — Canvas height and zoom level are saved directly inside each block's JSON metadata, preserving your exact viewport per drawing.
- 🌗 **Automatic Theme Sync** — Seamlessly adapts to Obsidian's Light and Dark themes.
- 🪟 **Transparent Background Mode** — Optional setting to render diagrams transparently for seamless note blending.
- ⌨️ **Command Palette Integration** — Fast commands to insert, edit, clear, and delete drawing blocks.

---

## 📸 Feature Tour

### 1. Full-Featured Drawing Editor & Library Manager
Open any canvas into a full-featured Excalidraw workspace. Use shapes, arrows, custom colors, roughness settings, handwriting fonts, or drag-and-drop elements from the **Personal Library**.

![Excalidraw Modal Editor](./assets/modal-editor.png)

---

### 2. Native Inline Previews with Hover Controls
In Reading View and Live Preview, your drawings render as crisp inline elements. Hovering over a canvas reveals the interactive chrome:
- **Zoom Controls (`+` / `−`)**: Zoom in for detailed inspection or zoom out for high-level overviews.
- **Corner Resize Handle**: Drag to adjust preview height to fit your note layout.
- **Click to Edit**: Click on the drawing to launch the full editor modal.

![Inline Drawing in Note](./assets/inline-preview.png)

---

### 3. Command Palette Quick Actions
Access all drawing actions instantly via `Ctrl+P` / `Cmd+P`:

![ObsidianDraw Command Palette](./assets/command-palette.png)

| Command | Description |
| :--- | :--- |
| **ObsidianDraw: Add canvas at cursor** | Inserts a new Excalidraw block at the current cursor position. |
| **ObsidianDraw: Open canvas under cursor in editor** | Opens the Excalidraw drawing under the cursor into the full-screen editor modal. |
| **ObsidianDraw: Create new note with canvas** | Creates a new markdown note pre-populated with a canvas block. |
| **ObsidianDraw: Clear canvas under cursor** | Resets the drawing under cursor to a blank canvas. |
| **ObsidianDraw: Delete canvas block under cursor** | Removes the entire Excalidraw block under cursor from the note. |

---

### 4. Customization & Library Settings
Configure your drawing preferences in **Settings → Community plugins → ObsidianDraw**:

![Plugin Settings](./assets/plugin-settings.png)

- **Installed Libraries**: View active `.excalidrawlib` packages, import new library files, or delete unwanted ones.
- **Transparent Background**: Toggle transparent background mode for transparent canvas rendering.
- **Render Thumbnail in Canvas**: Switch between static image previews and interactive zoomable/scrollable canvas containers.
- **Default Canvas Height**: Set default initial height (in pixels) for newly created drawing blocks.

---

## 🚀 Getting Started

### Creating a Drawing

1. Open any note in Obsidian.
2. Run the command **`ObsidianDraw: Add canvas at cursor`** from the command palette (`Ctrl+P` / `Cmd+P`), or insert a code block manually:
   ````markdown
   ```excalidraw
   {
     "elements": []
   }
   ```
   ````
3. Click the canvas thumbnail to open the Excalidraw editor and start sketching!
4. Close the modal or click outside when finished — your changes will automatically save back to the note.

---

## 📦 Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. In your Obsidian vault, navigate to `.obsidian/plugins/` and create a folder named `obsidianDraw`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into `.obsidian/plugins/obsidianDraw/`.
4. Open **Settings → Community plugins** in Obsidian and enable **ObsidianDraw**.

---

## 🛠️ Development

```bash
# Clone the repository
git clone https://github.com/Raushan-kumar-yadav/obsidianDraw.git

# Install dependencies
npm install

# Start development build in watch mode
npm run dev

# Build production bundle
npm run build
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).