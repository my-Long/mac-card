'use strict';

const state = { theme: 'light', radius: 12, border: true };

let currentImg      = null;
let currentFileName = 'picborder';

const dropZone      = document.getElementById('drop-zone');
const fileInput     = document.getElementById('file-input');
const browseBtn     = document.getElementById('browse-btn');
const dropHint      = document.getElementById('drop-hint');
const previewCanvas = document.getElementById('preview-canvas');
const radiusSlider  = document.getElementById('radius-slider');
const radiusOut     = document.getElementById('radius-out');
const borderToggle  = document.getElementById('border-toggle');
const downloadBtn   = document.getElementById('download-btn');
const segBtns       = document.querySelectorAll('.seg');

// ── File loading ──────────────────────────────

function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const base = file.name.replace(/\.[^.]+$/, ''); // strip extension
  currentFileName = base || 'picborder';
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      currentImg = img;
      dropHint.style.display = 'none';
      previewCanvas.style.display = 'block';
      downloadBtn.disabled = false;
      render();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

browseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  loadImage(fileInput.files[0]);
  fileInput.value = '';
});

// ── Drag & drop ───────────────────────────────

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  loadImage(e.dataTransfer.files[0]);
});

// ── Paste ─────────────────────────────────────

document.addEventListener('paste', (e) => {
  const item = [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
  if (item) loadImage(item.getAsFile());
});

// ── Controls ──────────────────────────────────

segBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    segBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.theme = btn.dataset.theme;
    if (currentImg) render();
  });
});

radiusSlider.addEventListener('input', () => {
  state.radius = parseInt(radiusSlider.value, 10);
  radiusOut.value = state.radius;
  syncSliderFill(radiusSlider);
  if (currentImg) render();
});

function syncSliderFill(slider) {
  const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.setProperty('--pct', pct + '%');
}

syncSliderFill(radiusSlider);

borderToggle.addEventListener('change', () => {
  state.border = borderToggle.checked;
  if (currentImg) render();
});

// ── Download ──────────────────────────────────

downloadBtn.addEventListener('click', () => {
  // previewCanvas IS the output — true WYSIWYG, no separate render needed
  previewCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = currentFileName + '_macos.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png');
});

// ── Canvas rendering ──────────────────────────

const TITLEBAR_H = 40; // fixed, never scales

/**
 * imgW / imgH  — target pixel dimensions for the image content area
 * dpr          — pass window.devicePixelRatio for preview (crisp on Retina),
 *                pass 1 for download (native resolution)
 *
 * All CSS coordinates (titlebar 38px, dot positions) stay constant regardless
 * of imgW/imgH — only the image content changes size.
 */
function drawMacWindow(canvas, img, theme, radius, imgW, imgH, dpr, showBorder) {
  const isLight = theme === 'light';

  // Canvas physical size = CSS logical size × dpr
  canvas.width  = Math.round(imgW * dpr);
  canvas.height = Math.round((imgH + TITLEBAR_H) * dpr);

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr); // work in CSS px from here on

  const titlebarBg = isLight ? '#F6F6F6' : '#3c3c3c';
  const windowBg   = isLight ? '#ffffff'  : '#1e1e1e';
  const sepColor   = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)';
  const winH       = imgH + TITLEBAR_H;

  // Window background
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, imgW, winH, radius);
  ctx.fillStyle = windowBg;
  ctx.fill();
  ctx.restore();

  // Titlebar — always 38 CSS px tall
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, imgW, TITLEBAR_H, [radius, radius, 0, 0]);
  ctx.fillStyle = titlebarBg;
  ctx.fill();
  ctx.restore();

  // Separator
  ctx.save();
  ctx.strokeStyle = sepColor;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0,    TITLEBAR_H - 0.5);
  ctx.lineTo(imgW, TITLEBAR_H - 0.5);
  ctx.stroke();
  ctx.restore();

  // Traffic light dots — always at fixed CSS positions / size
  const dotY = Math.round(TITLEBAR_H / 2);
  [
    { x: 16, color: '#ff5f57' },
    { x: 36, color: '#ffbd2e' },
    { x: 56, color: '#28c840' },
  ].forEach(({ x, color }) => {
    ctx.beginPath();
    ctx.arc(x, dotY, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  });

  // Image — stretched to imgW × imgH in CSS px
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, TITLEBAR_H, imgW, imgH, [0, 0, radius, radius]);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, TITLEBAR_H, imgW, imgH);
  ctx.restore();

  // Outer border — drawn last so nothing paints over it
  if (showBorder) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, imgW - 1, winH - 1, Math.max(0, radius - 0.5));
    ctx.strokeStyle = isLight ? '#E3E3E3' : '#737572';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // undo scale(dpr, dpr)
}

function render() {
  if (!currentImg) return;

  const dpr = window.devicePixelRatio || 1;
  const pad = 48;

  // ── Preview ───────────────────────────────────
  // Scale only the IMAGE to fit the drop zone.
  // Titlebar stays at exactly 38 CSS px — same as the output.
  const availW = dropZone.clientWidth  - pad;
  const availH = dropZone.clientHeight - pad;
  const imgScale = Math.min(
    availW / currentImg.width,
    (availH - TITLEBAR_H) / currentImg.height,
    1 // never upscale
  );
  const pvW = Math.round(currentImg.width  * imgScale);
  const pvH = Math.round(currentImg.height * imgScale);

  drawMacWindow(previewCanvas, currentImg, state.theme, state.radius, pvW, pvH, dpr, state.border);
  previewCanvas.style.width  = pvW + 'px';
  previewCanvas.style.height = (pvH + TITLEBAR_H) + 'px';
  // Download uses previewCanvas directly — what you see is what you get.
}
