// ---------- State ----------
const state = {
  img: null,           // loaded HTMLImageElement
  tool: 'select',
  shapes: [],           // { type: 'blur'|'box'|'arrow'|'text', x,y,w,h, color, text }
  drawing: null,        // shape currently being drawn
  color: '#5B6CFF',
  bg: 'indigo',
  padding: 48,
  radius: 14,
  shadow: 55,
  dragStart: null,
};

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const dropZone = document.getElementById('dropZone');
const canvasWrap = document.getElementById('canvasWrap');
const fileInput = document.getElementById('fileInput');
const exportBtn = document.getElementById('exportBtn');
const copyBtn = document.getElementById('copyBtn');
const newBtn = document.getElementById('newBtn');
const toast = document.getElementById('toast');

const BG_GRADIENTS = {
  none: null,
  indigo: ['#5B6CFF', '#8C7BFF'],
  teal: ['#2EC4B6', '#5EE0D3'],
  sunset: ['#FF6B5E', '#FFB36B'],
  slate: ['#3A3F4B', '#6B7280'],
  mint: ['#A8E6CF', '#DCEDC8'],
};

// ---------- Toast helper ----------
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

// ---------- Image loading ----------
function loadImageFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      state.img = img;
      state.shapes = [];
      dropZone.classList.add('hidden');
      canvasWrap.classList.remove('hidden');
      exportBtn.disabled = false;
      copyBtn.disabled = false;
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => loadImageFromFile(e.target.files[0]));

['dragover', 'dragenter'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); })
);
dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  loadImageFromFile(file);
});

window.addEventListener('paste', (e) => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      loadImageFromFile(item.getAsFile());
      break;
    }
  }
});

newBtn.addEventListener('click', () => {
  state.img = null;
  state.shapes = [];
  dropZone.classList.remove('hidden');
  canvasWrap.classList.add('hidden');
  exportBtn.disabled = true;
  copyBtn.disabled = true;
  fileInput.value = '';
});

// ---------- Tool selection ----------
const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
toolButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    toolButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.tool = btn.dataset.tool;
    const hints = {
      select: 'Drag shapes to move them. Click a shape then press Delete to remove it.',
      blur: 'Tip: pick the blur tool, then drag over anything you want to hide.',
      box: 'Drag to draw a rectangle highlight.',
      arrow: 'Drag from the start point to where the arrow should point.',
      text: 'Click anywhere to drop a text label, then type.',
    };
    document.getElementById('panelHint').textContent = hints[state.tool] || '';
  });
});

document.getElementById('undoBtn').addEventListener('click', () => {
  state.shapes.pop();
  render();
});
document.getElementById('clearBtn').addEventListener('click', () => {
  state.shapes = [];
  render();
});

document.querySelectorAll('.color-swatch').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    state.color = sw.dataset.color;
  });
});

document.querySelectorAll('.swatch[data-bg]').forEach(sw => {
  sw.addEventListener('click', () => {
    document.querySelectorAll('.swatch[data-bg]').forEach(s => s.classList.remove('active'));
    sw.classList.add('active');
    state.bg = sw.dataset.bg;
    render();
  });
});

document.getElementById('paddingSlider').addEventListener('input', (e) => {
  state.padding = +e.target.value;
  render();
});
document.getElementById('radiusSlider').addEventListener('input', (e) => {
  state.radius = +e.target.value;
  render();
});
document.getElementById('shadowSlider').addEventListener('input', (e) => {
  state.shadow = +e.target.value;
  render();
});

// ---------- Canvas interaction ----------
function getImgRect() {
  // Image rect within the canvas, accounting for padding
  const pad = state.padding;
  return {
    x: pad,
    y: pad,
    w: canvas.width - pad * 2,
    h: canvas.height - pad * 2,
  };
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener('mousedown', (e) => {
  if (!state.img) return;
  const pos = canvasPos(e);

  if (state.tool === 'text') {
    const text = prompt('Enter label text:');
    if (text) {
      state.shapes.push({ type: 'text', x: pos.x, y: pos.y, text, color: state.color });
      render();
    }
    return;
  }

  if (state.tool === 'select') {
    return; // simple v1: select tool doesn't drag-move shapes, just a safe default cursor
  }

  state.dragStart = pos;
  state.drawing = { type: state.tool, x: pos.x, y: pos.y, w: 0, h: 0, color: state.color };
});

canvas.addEventListener('mousemove', (e) => {
  if (!state.drawing || !state.dragStart) return;
  const pos = canvasPos(e);
  state.drawing.w = pos.x - state.dragStart.x;
  state.drawing.h = pos.y - state.dragStart.y;
  render(true);
});

window.addEventListener('mouseup', () => {
  if (state.drawing) {
    if (Math.abs(state.drawing.w) > 4 && Math.abs(state.drawing.h) > 4) {
      state.shapes.push(state.drawing);
    }
    state.drawing = null;
    state.dragStart = null;
    render();
  }
});

// ---------- Rendering ----------
function render(opts) {
  if (!state.img) return;
  const forExport = opts === 'export';

  const img = state.img;
  const pad = state.padding;
  canvas.width = img.width + pad * 2;
  canvas.height = img.height + pad * 2;

  // Background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const grad = BG_GRADIENTS[state.bg];
  if (grad) {
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, grad[0]);
    g.addColorStop(1, grad[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#F7F8FA';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Shadow + rounded image
  const r = getImgRect();
  ctx.save();
  if (state.shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${(state.shadow / 100 * 0.45).toFixed(2)})`;
    ctx.shadowBlur = state.shadow * 0.6;
    ctx.shadowOffsetY = state.shadow * 0.15;
  }
  roundRectPath(ctx, r.x, r.y, r.w, r.h, state.radius);
  ctx.fillStyle = '#000';
  ctx.fill(); // shadow caster
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, r.x, r.y, r.w, r.h, state.radius);
  ctx.clip();
  ctx.drawImage(img, r.x, r.y, r.w, r.h);

  // Blur shapes get drawn by re-drawing a blurred crop of the image in place
  state.shapes.concat(state.drawing ? [state.drawing] : []).forEach(s => {
    if (s.type === 'blur') drawBlurShape(s, r, forExport);
  });
  ctx.restore();

  // Other annotations on top (not clipped so arrows can extend slightly, fine for v1)
  state.shapes.concat(state.drawing ? [state.drawing] : []).forEach(s => {
    if (s.type === 'box') drawBox(s);
    if (s.type === 'arrow') drawArrow(s);
    if (s.type === 'text') drawText(s);
  });
}

function roundRectPath(c, x, y, w, h, radius) {
  const rad = Math.min(radius, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

function drawBlurShape(s, imgRect, forExport) {
  const x = Math.min(s.x, s.x + s.w);
  const y = Math.min(s.y, s.y + s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  if (w < 2 || h < 2) return;

  // Step 1: heavy pixelation so the underlying content is destroyed, not just dimmed
  const tmp = document.createElement('canvas');
  const blockSize = 10; // pixels per "cell" — bigger = chunkier, more obviously redacted
  tmp.width = Math.max(1, Math.ceil(w / blockSize));
  tmp.height = Math.max(1, Math.ceil(h / blockSize));
  const tctx = tmp.getContext('2d');
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(state.img,
    x - imgRect.x, y - imgRect.y, w, h,
    0, 0, tmp.width, tmp.height
  );

  ctx.save();
  ctx.imageSmoothingEnabled = false; // keep the blocky/pixelated look, not smoothed
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);

  // Step 2: frosted glass wash on top so it visually reads as "deliberately hidden"
  // rather than "low quality image"
  ctx.fillStyle = 'rgba(247,248,250,0.35)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // dashed outline indicator — editing aid only, never baked into exported/copied output
  if (!forExport) {
    ctx.save();
    ctx.strokeStyle = 'rgba(91,108,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

function drawBox(s) {
  const x = Math.min(s.x, s.x + s.w);
  const y = Math.min(s.y, s.y + s.h);
  const w = Math.abs(s.w);
  const h = Math.abs(s.h);
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawArrow(s) {
  const x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
  const headLen = 16;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawText(s) {
  ctx.save();
  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillStyle = s.color;
  ctx.fillText(s.text, s.x, s.y);
  ctx.restore();
}

// ---------- Export ----------
exportBtn.addEventListener('click', () => {
  render('export');
  const link = document.createElement('a');
  link.download = 'cleanshot.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  render(); // restore editing view with outlines
  showToast('Downloaded ✓');
});

copyBtn.addEventListener('click', async () => {
  render('export');
  try {
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    showToast('Copied to clipboard ✓');
  } catch (err) {
    showToast('Copy failed — try Download instead');
  } finally {
    render(); // restore editing view with outlines
  }
});

// Keyboard: delete last shape
window.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && document.activeElement === document.body) {
    state.shapes.pop();
    render();
  }
});
