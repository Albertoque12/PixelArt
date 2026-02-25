# Pixel Art Editor

A fully static, offline-capable pixel art editor built with vanilla HTML, CSS, and JavaScript.

## Features

- **Canvas/Grid**
  - Draw on a pixel grid rendered with `<canvas>` for performance.
  - Grid sizes: **16×16, 32×32, 64×64**.
  - Adjustable visual zoom (cell size) without changing the underlying artwork.

- **Drawing Tools**
  - Brush (click + drag).
  - Eraser (click + drag).
  - Bucket fill (exact-color flood fill).
  - Line tool (Bresenham-style plotting).
  - Rectangle outline + rectangle fill tools.

- **Color Management**
  - Color picker for active drawing color.
  - Built-in 16-color palette.
  - Add custom colors to palette.

- **History**
  - Undo / Redo with up to **30** history states.

- **Save / Export**
  - Export current artwork as PNG.
  - Save project as JSON (includes grid size, palette, active color, and pixel data).
  - Load project from JSON.

- **Keyboard Shortcuts**
  - `B` = Brush
  - `E` = Eraser
  - `G` = Bucket
  - `L` = Line
  - `Ctrl+Z` = Undo
  - `Ctrl+Y` = Redo

## Usage

1. Download or clone the project files.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox).
3. Start drawing immediately—no build steps, backend, or dependencies required.

## Project Structure

- `index.html` – UI layout and controls
- `styles.css` – responsive styling
- `app.js` – editor logic, rendering, tools, history, save/export
- `README.md` – usage and deployment guide

## Notes

- Designed to work offline by opening the HTML file directly.
- Uses no frameworks or external libraries.
