const pixelCanvas = document.getElementById('pixelCanvas');
const ctx = pixelCanvas.getContext('2d');

const gridSizeSelect = document.getElementById('gridSize');
const zoomRange = document.getElementById('zoomRange');
const zoomValue = document.getElementById('zoomValue');
const colorPicker = document.getElementById('colorPicker');
const addPaletteColorBtn = document.getElementById('addPaletteColor');
const paletteContainer = document.getElementById('palette');
const toolButtons = document.getElementById('toolButtons');
const activeToolLabel = document.getElementById('activeToolLabel');

const undoBtn = document.getElementById('undoBtn');
const redoBtn = document.getElementById('redoBtn');
const clearBtn = document.getElementById('clearBtn');
const exportPngBtn = document.getElementById('exportPngBtn');
const saveJsonBtn = document.getElementById('saveJsonBtn');
const loadJsonInput = document.getElementById('loadJsonInput');

const TRANSPARENT = null;
const HISTORY_LIMIT = 30;

const state = {
  gridSize: 32,
  cellSize: 14,
  activeTool: 'brush',
  activeColor: '#ff5722',
  isDrawing: false,
  lineStart: null,
  rectStart: null,
  pixels: [],
  palette: [
    '#000000', '#ffffff', '#ef4444', '#f59e0b', '#facc15', '#22c55e', '#10b981', '#06b6d4',
    '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#7c2d12', '#4b5563'
  ],
  undoStack: [],
  redoStack: []
};

function createPixelGrid(size) {
  return Array.from({ length: size }, () => Array(size).fill(TRANSPARENT));
}

function clonePixels(pixels) {
  return pixels.map((row) => [...row]);
}

function pushHistorySnapshot() {
  // Important: keep fixed-size undo stack and clear redo on fresh actions.
  state.undoStack.push(clonePixels(state.pixels));
  if (state.undoStack.length > HISTORY_LIMIT) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  refreshHistoryButtons();
}

function refreshHistoryButtons() {
  undoBtn.disabled = state.undoStack.length === 0;
  redoBtn.disabled = state.redoStack.length === 0;
}

function setCanvasDimensions() {
  const canvasSize = state.gridSize * state.cellSize;
  pixelCanvas.width = canvasSize;
  pixelCanvas.height = canvasSize;
  zoomValue.textContent = `${state.cellSize} px`;
}

function renderCanvas() {
  setCanvasDimensions();
  ctx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);

  for (let y = 0; y < state.gridSize; y += 1) {
    for (let x = 0; x < state.gridSize; x += 1) {
      const color = state.pixels[y][x];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * state.cellSize, y * state.cellSize, state.cellSize, state.cellSize);
    }
  }

  drawGridLines();
}

function drawGridLines() {
  ctx.strokeStyle = 'rgba(156, 163, 175, 0.35)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= state.gridSize; i += 1) {
    const pos = i * state.cellSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, pixelCanvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(pixelCanvas.width, pos);
    ctx.stroke();
  }
}

function getCellFromPointer(event) {
  const rect = pixelCanvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) / state.cellSize);
  const y = Math.floor((event.clientY - rect.top) / state.cellSize);

  if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) return null;
  return { x, y };
}

function setPixel(x, y, color) {
  if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) return;
  state.pixels[y][x] = color;
}

function applyBrush(cell) {
  setPixel(cell.x, cell.y, state.activeColor);
  renderCanvas();
}

function applyEraser(cell) {
  setPixel(cell.x, cell.y, TRANSPARENT);
  renderCanvas();
}

function floodFill(startX, startY, replacementColor) {
  // Flood fill uses exact color matching and iterative stack to avoid recursion limits.
  const targetColor = state.pixels[startY][startX];
  if (targetColor === replacementColor) return;

  const stack = [{ x: startX, y: startY }];

  while (stack.length) {
    const { x, y } = stack.pop();
    if (x < 0 || y < 0 || x >= state.gridSize || y >= state.gridSize) continue;
    if (state.pixels[y][x] !== targetColor) continue;

    state.pixels[y][x] = replacementColor;
    stack.push({ x: x + 1, y });
    stack.push({ x: x - 1, y });
    stack.push({ x, y: y + 1 });
    stack.push({ x, y: y - 1 });
  }
}

function plotLine(x0, y0, x1, y1, color) {
  // Bresenham-style line plotting for consistent straight lines on the pixel grid.
  let dx = Math.abs(x1 - x0);
  let sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0);
  let sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    setPixel(x0, y0, color);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function drawRect(start, end, fill) {
  const minX = Math.min(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxX = Math.max(start.x, end.x);
  const maxY = Math.max(start.y, end.y);

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const onEdge = x === minX || x === maxX || y === minY || y === maxY;
      if (fill || onEdge) {
        setPixel(x, y, state.activeColor);
      }
    }
  }
}

function setActiveTool(toolName) {
  state.activeTool = toolName;
  state.lineStart = null;
  state.rectStart = null;

  document.querySelectorAll('.tool-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.tool === toolName);
  });

  const label = {
    brush: 'Brush',
    eraser: 'Eraser',
    bucket: 'Bucket',
    line: 'Line',
    'rect-outline': 'Rectangle Outline',
    'rect-fill': 'Rectangle Fill'
  };
  activeToolLabel.textContent = label[toolName] || toolName;
}

function applyOneShotTool(cell) {
  if (state.activeTool === 'bucket') {
    pushHistorySnapshot();
    floodFill(cell.x, cell.y, state.activeColor);
    renderCanvas();
    return;
  }

  if (state.activeTool === 'line') {
    if (!state.lineStart) {
      state.lineStart = cell;
      return;
    }
    pushHistorySnapshot();
    plotLine(state.lineStart.x, state.lineStart.y, cell.x, cell.y, state.activeColor);
    state.lineStart = null;
    renderCanvas();
    return;
  }

  if (state.activeTool === 'rect-outline' || state.activeTool === 'rect-fill') {
    if (!state.rectStart) {
      state.rectStart = cell;
      return;
    }
    pushHistorySnapshot();
    drawRect(state.rectStart, cell, state.activeTool === 'rect-fill');
    state.rectStart = null;
    renderCanvas();
  }
}

function handlePointerDown(event) {
  const cell = getCellFromPointer(event);
  if (!cell) return;

  if (state.activeTool === 'brush' || state.activeTool === 'eraser') {
    pushHistorySnapshot();
    state.isDrawing = true;

    if (state.activeTool === 'brush') {
      applyBrush(cell);
    } else {
      applyEraser(cell);
    }

    return;
  }

  applyOneShotTool(cell);
}

function handlePointerMove(event) {
  if (!state.isDrawing) return;
  const cell = getCellFromPointer(event);
  if (!cell) return;

  if (state.activeTool === 'brush') {
    applyBrush(cell);
  } else if (state.activeTool === 'eraser') {
    applyEraser(cell);
  }
}

function stopDrawing() {
  state.isDrawing = false;
}

function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(clonePixels(state.pixels));
  state.pixels = state.undoStack.pop();
  refreshHistoryButtons();
  renderCanvas();
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(clonePixels(state.pixels));
  state.pixels = state.redoStack.pop();
  refreshHistoryButtons();
  renderCanvas();
}

function clearCanvas() {
  pushHistorySnapshot();
  state.pixels = createPixelGrid(state.gridSize);
  renderCanvas();
}

function exportPng() {
  // Export logic: draw pixels to a 1:1 offscreen canvas, then trigger download.
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = state.gridSize;
  exportCanvas.height = state.gridSize;
  const exportCtx = exportCanvas.getContext('2d');

  for (let y = 0; y < state.gridSize; y += 1) {
    for (let x = 0; x < state.gridSize; x += 1) {
      const color = state.pixels[y][x];
      if (!color) continue;
      exportCtx.fillStyle = color;
      exportCtx.fillRect(x, y, 1, 1);
    }
  }

  const link = document.createElement('a');
  link.href = exportCanvas.toDataURL('image/png');
  link.download = `pixel-art-${state.gridSize}x${state.gridSize}.png`;
  link.click();
}

function saveProjectJson() {
  const payload = {
    version: 1,
    gridSize: state.gridSize,
    activeColor: state.activeColor,
    palette: state.palette,
    pixels: state.pixels
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `pixel-art-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function loadProjectJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data.gridSize || !Array.isArray(data.pixels) || !Array.isArray(data.palette)) {
        throw new Error('Invalid project file.');
      }

      state.gridSize = data.gridSize;
      state.pixels = data.pixels;
      state.palette = data.palette;
      state.activeColor = data.activeColor || state.palette[0] || '#000000';
      state.undoStack = [];
      state.redoStack = [];

      gridSizeSelect.value = String(state.gridSize);
      colorPicker.value = state.activeColor;
      renderPalette();
      refreshHistoryButtons();
      renderCanvas();
    } catch (error) {
      alert(`Failed to load JSON: ${error.message}`);
    }
  };

  reader.readAsText(file);
}

function renderPalette() {
  paletteContainer.innerHTML = '';

  state.palette.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.classList.toggle('active', color.toLowerCase() === state.activeColor.toLowerCase());
    swatch.addEventListener('click', () => {
      state.activeColor = color;
      colorPicker.value = color;
      renderPalette();
    });
    paletteContainer.appendChild(swatch);
  });
}

function resizeGrid(newSize) {
  pushHistorySnapshot();
  const nextPixels = createPixelGrid(newSize);

  for (let y = 0; y < Math.min(newSize, state.gridSize); y += 1) {
    for (let x = 0; x < Math.min(newSize, state.gridSize); x += 1) {
      nextPixels[y][x] = state.pixels[y][x];
    }
  }

  state.gridSize = newSize;
  state.pixels = nextPixels;
  renderCanvas();
}

function handleKeyDown(event) {
  if (event.target.matches('input, select, textarea')) return;

  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') {
      event.preventDefault();
      undo();
    } else if (key === 'y') {
      event.preventDefault();
      redo();
    }
    return;
  }

  const toolByKey = {
    b: 'brush',
    e: 'eraser',
    g: 'bucket',
    l: 'line'
  };

  if (toolByKey[key]) {
    setActiveTool(toolByKey[key]);
  }
}

function initialize() {
  state.pixels = createPixelGrid(state.gridSize);

  renderPalette();
  refreshHistoryButtons();
  renderCanvas();
  setActiveTool('brush');

  gridSizeSelect.addEventListener('change', (event) => {
    resizeGrid(Number(event.target.value));
  });

  zoomRange.addEventListener('input', (event) => {
    state.cellSize = Number(event.target.value);
    renderCanvas();
  });

  colorPicker.addEventListener('input', (event) => {
    state.activeColor = event.target.value;
    renderPalette();
  });

  addPaletteColorBtn.addEventListener('click', () => {
    const color = state.activeColor.toLowerCase();
    if (!state.palette.includes(color)) {
      state.palette.push(color);
      renderPalette();
    }
  });

  toolButtons.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tool]');
    if (!button) return;
    setActiveTool(button.dataset.tool);
  });

  pixelCanvas.addEventListener('pointerdown', handlePointerDown);
  pixelCanvas.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', stopDrawing);
  pixelCanvas.addEventListener('pointerleave', stopDrawing);

  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', clearCanvas);

  exportPngBtn.addEventListener('click', exportPng);
  saveJsonBtn.addEventListener('click', saveProjectJson);
  loadJsonInput.addEventListener('change', (event) => {
    const [file] = event.target.files;
    if (file) loadProjectJson(file);
    event.target.value = '';
  });

  window.addEventListener('keydown', handleKeyDown);
}

initialize();
