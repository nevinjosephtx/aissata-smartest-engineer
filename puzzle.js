// ================= JIGSAW GATE =================
// Put your photo in this folder and name it photo.jpg (or change the path below).
const PUZZLE_IMAGE = "photo.jpg";
const GRID = 4; // 4 x 4 = 16 pieces. 3 = easy, 5 = hard.

(function () {
  const play = document.getElementById("play");
  const board = document.getElementById("board");
  const progress = document.getElementById("progress");
  const success = document.getElementById("success");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let pieces = [];
  let pieceSize = 0, margin = 0, boardX = 0, boardY = 0;
  let zTop = 10;
  let drag = null;

  // Testing shortcut: add ?skip to the URL to jump straight to the camera.
  if (new URLSearchParams(location.search).has("skip")) {
    window.addEventListener("load", () => unlock(true));
  }

  const fontsReady = Promise.all([
    document.fonts.load("700 64px 'Dancing Script'"),
    document.fonts.load("700 54px Oswald"),
    document.fonts.load("500 40px Oswald"),
  ]).catch(() => {});
  pickImage().then(
    (img) => build(img),
    () => fontsReady.then(() => build(makePlaceholder()))
  );

  // Pick a random uploaded photo — never the same one twice in a row.
  async function pickImage() {
    let photos = [];
    try { photos = await window.fetchPhotos(); } catch (e) { console.warn(e); }
    if (!photos.length) return loadImage(PUZZLE_IMAGE);
    let last = null;
    try { last = localStorage.getItem("lastPuzzle"); } catch {}
    let pool = photos.filter((p) => p.id !== last);
    if (!pool.length) pool = photos;
    // try a few in case one fails to load
    for (let i = 0; i < 3 && pool.length; i++) {
      const pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
      try {
        const img = await loadImage(pick.url);
        try { localStorage.setItem("lastPuzzle", pick.id); } catch {}
        return img;
      } catch {}
    }
    return loadImage(PUZZLE_IMAGE);
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // A pretty fallback image so the puzzle works before a photo is added.
  function makePlaceholder() {
    const c = document.createElement("canvas");
    c.width = c.height = 800;
    const g = c.getContext("2d");
    const grad = g.createLinearGradient(0, 0, 800, 800);
    grad.addColorStop(0, "#732f2f"); grad.addColorStop(0.5, "#500000"); grad.addColorStop(1, "#2a0000");
    g.fillStyle = grad; g.fillRect(0, 0, 800, 800);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(255,${150 + Math.random() * 100},${170 + Math.random() * 60},${0.15 + Math.random() * 0.5})`;
      heart(g, Math.random() * 800, Math.random() * 800, 8 + Math.random() * 34);
      g.fill();
    }
    g.fillStyle = "#fff";
    heart(g, 400, 330, 300); g.fill();
    g.fillStyle = "#500000";
    g.textAlign = "center";
    g.font = "700 64px 'Dancing Script', cursive";
    g.fillText("Aissata", 400, 345);
    g.fillStyle = "#fff";
    g.font = "700 54px Oswald, sans-serif";
    g.fillText("SMARTEST ENGINEER", 400, 640);
    g.font = "500 40px Oswald, sans-serif";
    g.fillText("NSBE VP  ♥  GIG 'EM", 400, 700);
    return c;
  }

  function heart(g, cx, cy, s) {
    const x = cx, y = cy - s / 2;
    g.beginPath();
    g.moveTo(x, y + s * 0.3);
    g.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
    g.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
    g.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
    g.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
    g.closePath();
  }

  function build(img) {
    const W = play.clientWidth, H = play.clientHeight;
    if (W < 50 || H < 50) { requestAnimationFrame(() => build(img)); return; } // wait for layout
    const boardSize = Math.floor(Math.min(W * 0.8, H * 0.55, 520));
    pieceSize = boardSize / GRID;
    margin = pieceSize * 0.25;
    boardX = Math.round((W - boardSize) / 2);
    boardY = Math.round((H - boardSize) / 2);
    Object.assign(board.style, {
      left: boardX + "px", top: boardY + "px",
      width: boardSize + "px", height: boardSize + "px",
    });

    // Center-crop the image to a square.
    const src = document.createElement("canvas");
    src.width = src.height = Math.round(boardSize * dpr);
    const sg = src.getContext("2d");
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const side = Math.min(iw, ih);
    sg.drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, src.width, src.height);
    board.style.backgroundImage = `url(${src.toDataURL("image/jpeg", 0.7)})`;

    // Random tab directions for every shared edge.
    const h = [...Array(GRID - 1)].map(() => [...Array(GRID)].map(() => (Math.random() < 0.5 ? 1 : -1)));
    const v = [...Array(GRID)].map(() => [...Array(GRID - 1)].map(() => (Math.random() < 0.5 ? 1 : -1)));

    const full = pieceSize + margin * 2;
    for (let r = 0; r < GRID; r++) {
      for (let c = 0; c < GRID; c++) {
        const edges = {
          top: r === 0 ? 0 : -h[r - 1][c],
          right: c === GRID - 1 ? 0 : v[r][c],
          bottom: r === GRID - 1 ? 0 : h[r][c],
          left: c === 0 ? 0 : -v[r][c - 1],
        };
        const cv = document.createElement("canvas");
        cv.className = "piece";
        cv.width = cv.height = Math.round(full * dpr);
        cv.style.width = cv.style.height = full + "px";
        const g = cv.getContext("2d", { willReadFrequently: true });
        g.scale(dpr, dpr);
        piecePath(g, margin, margin, pieceSize, edges);
        g.save();
        g.clip();
        g.drawImage(src, 0, 0, src.width, src.height, margin - c * pieceSize, margin - r * pieceSize, boardSize, boardSize);
        g.restore();
        g.lineWidth = 1.5;
        g.strokeStyle = "rgba(255,255,255,.55)";
        g.stroke();

        const p = {
          el: cv, ctx: g, r, c, locked: false,
          homeX: boardX + c * pieceSize - margin,
          homeY: boardY + r * pieceSize - margin,
          x: 0, y: 0,
        };
        scatter(p, W, H, full, boardSize);
        place(p);
        cv.style.zIndex = zTop++;
        play.appendChild(cv);
        pieces.push(p);
      }
    }
    updateProgress();
  }

  function scatter(p, W, H, full, boardSize) {
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * Math.max(1, W - full);
      const y = Math.random() * Math.max(1, H - full);
      const cx = x + full / 2, cy = y + full / 2;
      const inside = cx > boardX - 10 && cx < boardX + boardSize + 10 && cy > boardY - 10 && cy < boardY + boardSize + 10;
      if (!inside || i === 59) { p.x = x; p.y = y; return; }
    }
  }

  // Draws a jigsaw piece outline clockwise. Edge sign: +1 tab out, -1 slot in, 0 flat.
  function piecePath(g, x, y, s, e) {
    g.beginPath();
    g.moveTo(x, y);
    edge(g, x, y, x + s, y, e.top);
    edge(g, x + s, y, x + s, y + s, e.right);
    edge(g, x + s, y + s, x, y + s, e.bottom);
    edge(g, x, y + s, x, y, e.left);
    g.closePath();
  }
  function edge(g, x0, y0, x1, y1, sign) {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const dx = (x1 - x0) / L, dy = (y1 - y0) / L;
    const nx = dy, ny = -dx; // outward normal for clockwise path
    const P = (t, u) => [x0 + dx * L * t + nx * L * u * sign, y0 + dy * L * t + ny * L * u * sign];
    if (!sign) { g.lineTo(x1, y1); return; }
    g.lineTo(...P(0.36, 0));
    g.bezierCurveTo(...P(0.40, 0.06), ...P(0.28, 0.22), ...P(0.50, 0.22));
    g.bezierCurveTo(...P(0.72, 0.22), ...P(0.60, 0.06), ...P(0.64, 0));
    g.lineTo(x1, y1);
  }

  function place(p) {
    p.el.style.left = p.x + "px";
    p.el.style.top = p.y + "px";
  }

  // Alpha-aware hit test so you grab the piece you actually see.
  function pieceAt(clientX, clientY) {
    const rect = play.getBoundingClientRect();
    const px = clientX - rect.left, py = clientY - rect.top;
    const candidates = pieces
      .filter((p) => !p.locked)
      .sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    const full = pieceSize + margin * 2;
    for (const p of candidates) {
      const lx = px - p.x, ly = py - p.y;
      if (lx < 0 || ly < 0 || lx > full || ly > full) continue;
      try {
        const a = p.ctx.getImageData(Math.floor(lx * dpr), Math.floor(ly * dpr), 1, 1).data[3];
        if (a > 10) return { p, px, py };
      } catch { return { p, px, py }; }
    }
    return null;
  }

  play.addEventListener("pointerdown", (e) => {
    const hit = pieceAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    play.setPointerCapture(e.pointerId);
    drag = { p: hit.p, ox: hit.px - hit.p.x, oy: hit.py - hit.p.y, id: e.pointerId };
    hit.p.el.style.zIndex = zTop++;
    hit.p.el.classList.add("dragging");
  });

  play.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const rect = play.getBoundingClientRect();
    drag.p.x = e.clientX - rect.left - drag.ox;
    drag.p.y = e.clientY - rect.top - drag.oy;
    place(drag.p);
  });

  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = drag.p;
    p.el.classList.remove("dragging");
    if (Math.hypot(p.x - p.homeX, p.y - p.homeY) < pieceSize * 0.28) {
      p.x = p.homeX; p.y = p.homeY; p.locked = true;
      p.el.classList.add("locked");
      p.el.style.zIndex = 1;
      place(p);
      try { navigator.vibrate && navigator.userActivation?.hasBeenActive && navigator.vibrate(15); } catch {}
      updateProgress();
      if (pieces.every((q) => q.locked)) setTimeout(() => unlock(false), 400);
    }
    drag = null;
  };
  play.addEventListener("pointerup", endDrag);
  play.addEventListener("pointercancel", endDrag);

  function updateProgress() {
    progress.textContent = `${pieces.filter((p) => p.locked).length} / ${GRID * GRID}`;
  }

  function unlock(instant) {
    success.classList.remove("hidden");
    if (!instant) burst();
  }

  function burst() {
    for (let i = 0; i < 28; i++) {
      const s = document.createElement("div");
      s.textContent = ["♥", "💕", "✨", "💗"][i % 4];
      Object.assign(s.style, {
        position: "absolute", left: "50%", top: "50%", fontSize: 18 + Math.random() * 22 + "px",
        color: "#ff8fab", pointerEvents: "none", zIndex: 10000,
        transition: "transform 1.4s cubic-bezier(.1,.8,.3,1), opacity 1.4s",
      });
      success.appendChild(s);
      const a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 260;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        s.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) rotate(${Math.random() * 90 - 45}deg)`;
        s.style.opacity = 0;
      }));
      setTimeout(() => s.remove(), 1500);
    }
  }

  document.getElementById("enterBtn").addEventListener("click", () => {
    document.getElementById("gate").classList.remove("active");
    document.getElementById("cam").classList.add("active");
    window.dispatchEvent(new Event("enter-camera"));
  });
})();
