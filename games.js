// ================= UNLOCK GAMES (one is picked at random each visit; see puzzle.js) =================
// Each game gets a ctx: { play, dpr, setHint, setProgress, photo, ready, size, done }.
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const rnd = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; };
  const svg = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const stage = (ctx) => { const s = el("div", "game", ctx.play); return s; };
  const haptic = () => { try { navigator.vibrate && navigator.userActivation?.hasBeenActive && navigator.vibrate(12); } catch {} };

  // Center-crop any image/canvas into a square canvas of `px` pixels.
  function squareCanvas(img, px) {
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(px);
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, side = Math.min(iw, ih);
    c.getContext("2d").drawImage(img, (iw - side) / 2, (ih - side) / 2, side, side, 0, 0, c.width, c.height);
    return c;
  }

  // ---------------------------------------------------------------- SPIN TILES (2x2)
  async function spin(ctx) {
    ctx.setHint("Tap each square to turn the photo right side up.");
    const img = await ctx.photo();
    await ctx.ready();
    const { W, H } = ctx.size();
    const S = Math.floor(Math.min(W * 0.9, H * 0.9, 440));
    const url = squareCanvas(img, S * ctx.dpr).toDataURL("image/jpeg", 0.85);
    const grid = el("div", "spin-grid", stage(ctx));
    grid.style.width = grid.style.height = S + "px";
    const angles = [];
    for (let i = 0; i < 4; i++) {
      const r = (i / 2) | 0, c = i % 2;
      const t = el("button", "spin-tile", grid);
      t.type = "button";
      t.setAttribute("aria-label", `Turn square ${i + 1}`);
      Object.assign(t.style, { backgroundImage: `url(${url})`, backgroundSize: `${S}px ${S}px`, backgroundPosition: `${-c * S / 2}px ${-r * S / 2}px` });
      angles[i] = rnd(1, 3) * 90; // every square starts turned
      t.style.transform = `rotate(${angles[i]}deg)`;
      t.addEventListener("click", () => {
        if (grid.classList.contains("solved")) return;
        angles[i] += 90;
        t.style.transform = `rotate(${angles[i]}deg)`;
        haptic();
        check();
      });
    }
    function check() {
      const upright = angles.filter((a) => a % 360 === 0).length;
      ctx.setProgress(`${upright} / 4 upright`);
      if (upright === 4) { grid.classList.add("solved"); ctx.done(); }
    }
    check();
  }

  // ---------------------------------------------------------------- COLOR REVEAL (rub until 95%)
  async function reveal(ctx) {
    ctx.setHint("Rub the photo to bring its color back.");
    ctx.setProgress("0%");
    const img = await ctx.photo();
    await ctx.ready();
    const { W, H } = ctx.size();
    const S = Math.floor(Math.min(W * 0.92, H * 0.92, 460));
    const px = Math.round(S * ctx.dpr);
    const box = el("div", "reveal-box", stage(ctx));
    box.style.width = box.style.height = S + "px";

    const color = squareCanvas(img, px);
    color.className = "reveal-layer";
    box.appendChild(color);

    const gray = document.createElement("canvas");
    gray.width = gray.height = px;
    gray.className = "reveal-layer reveal-top";
    const g = gray.getContext("2d", { willReadFrequently: true });
    g.drawImage(color, 0, 0);
    const data = g.getImageData(0, 0, px, px);
    for (let i = 0; i < data.data.length; i += 4) {
      const d = data.data, y = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      d[i] = d[i + 1] = d[i + 2] = y * 0.9;
    }
    g.putImageData(data, 0, 0);
    box.appendChild(gray);

    g.globalCompositeOperation = "destination-out";
    g.lineCap = g.lineJoin = "round";
    g.lineWidth = px * 0.16;
    let last = null, done = false, pending = false;
    const at = (e) => { const r = gray.getBoundingClientRect(); return [(e.clientX - r.left) * px / r.width, (e.clientY - r.top) * px / r.height]; };
    gray.addEventListener("pointerdown", (e) => { try { gray.setPointerCapture(e.pointerId); } catch {} last = at(e); rub(last, last); });
    gray.addEventListener("pointermove", (e) => { if (!last) return; const p = at(e); rub(last, p); last = p; });
    const stop = () => (last = null);
    gray.addEventListener("pointerup", stop);
    gray.addEventListener("pointercancel", stop);

    function rub(a, b) {
      if (done) return;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] + 0.01, b[1]); g.stroke();
      if (!pending) { pending = true; setTimeout(measure, 150); }
    }
    function measure() {
      pending = false;
      const d = g.getImageData(0, 0, px, px).data;
      let clear = 0, total = 0;
      for (let i = 3; i < d.length; i += 4 * 6) { total++; if (d[i] < 30) clear++; }
      const pct = Math.floor((clear / total) * 100);
      ctx.setProgress(`${Math.min(pct, 100)}%`);
      if (pct >= 95 && !done) {
        done = true;
        gray.style.transition = "opacity .6s"; gray.style.opacity = 0;
        ctx.setProgress("100%");
        ctx.done();
      }
    }
  }

  // ---------------------------------------------------------------- TRACE THE HEART
  async function trace(ctx) {
    ctx.setHint("Trace the dotted heart with your finger.");
    ctx.setProgress("0%");
    await ctx.ready();
    const { W, H } = ctx.size();
    const S = Math.floor(Math.min(W * 0.92, H * 0.8, 440));
    const px = Math.round(S * ctx.dpr);
    const wrap = stage(ctx);
    const cv = el("canvas", "trace-canvas", wrap);
    cv.width = cv.height = px; cv.style.width = cv.style.height = S + "px";
    const again = el("button", "game-btn ghost", wrap);
    again.type = "button"; again.textContent = "Start over";
    const g = cv.getContext("2d");

    // Classic heart curve, scaled to the canvas.
    const N = 180, pts = [];
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      pts.push([px / 2 + x * px / 38, px * 0.47 - y * px / 38]);
    }
    const tol = px * 0.065;
    let curveLen = 0;
    pts.forEach((q, i) => { const n = pts[(i + 1) % N]; curveLen += Math.hypot(n[0] - q[0], n[1] - q[1]); });
    let covered, onLen, offLen, strokes, last = null, done = false;
    reset();
    again.addEventListener("click", reset);

    function reset() {
      covered = new Array(N).fill(false); onLen = 0; offLen = 0; strokes = []; done = false;
      ctx.setProgress("0%");
      draw();
    }
    function draw() {
      g.clearRect(0, 0, px, px);
      g.lineCap = g.lineJoin = "round";
      // dotted guide
      g.setLineDash([px * 0.012, px * 0.03]);
      g.lineWidth = px * 0.012;
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.stroke();
      g.setLineDash([]);
      // the parts she's traced
      g.fillStyle = "#ff8fab";
      pts.forEach((p, i) => { if (covered[i]) { g.beginPath(); g.arc(p[0], p[1], px * 0.012, 0, 7); g.fill(); } });
      // her strokes
      g.strokeStyle = "#ff4d79"; g.lineWidth = px * 0.03; g.shadowColor = "rgba(255,77,121,.8)"; g.shadowBlur = px * 0.02;
      strokes.forEach((s) => { g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.stroke(); });
      g.shadowBlur = 0;
    }
    const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * px / r.width, (e.clientY - r.top) * px / r.height]; };
    cv.addEventListener("pointerdown", (e) => { if (done) return; try { cv.setPointerCapture(e.pointerId); } catch {} last = at(e); strokes.push([last]); });
    cv.addEventListener("pointermove", (e) => {
      if (!last || done) return;
      const p = at(e), len = Math.hypot(p[0] - last[0], p[1] - last[1]);
      if (len < 1) return;
      let near = Infinity;
      pts.forEach((q, i) => { const d = Math.hypot(q[0] - p[0], q[1] - p[1]); near = Math.min(near, d); if (d < tol) covered[i] = true; });
      if (near < tol * 1.6) onLen += len; else offLen += len;
      strokes[strokes.length - 1].push(p);
      last = p;
      draw();
      const pct = Math.floor((covered.filter(Boolean).length / N) * 100);
      ctx.setProgress(`${pct}%`);
      if (pct >= 90) finish();
    });
    const stop = () => (last = null);
    cv.addEventListener("pointerup", stop);
    cv.addEventListener("pointercancel", stop);

    function finish() {
      last = null;
      // scribbling all over the box (way more ink than one heart, or mostly off the line) doesn't count
      if (offLen > (onLen + offLen) * 0.35 || onLen + offLen > curveLen * 2.5) {
        ctx.setHint("Stay on the dotted line, genius. Try again.");
        setTimeout(() => { ctx.setHint("Trace the dotted heart with your finger."); reset(); }, 1400);
        done = true;
        return;
      }
      done = true;
      g.fillStyle = "rgba(255,77,121,.85)";
      g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
      ctx.setProgress("100%");
      ctx.done();
    }
  }

  // ---------------------------------------------------------------- QUICK MATH (3 questions, 5 seconds each, all right)
  async function math(ctx) {
    ctx.setHint("3 questions. 5 seconds each. Get all 3 right.");
    await ctx.ready();
    const wrap = stage(ctx);
    const card = el("div", "math-card", wrap);
    intro();

    function intro() {
      ctx.setProgress(null);
      card.innerHTML = "";
      el("div", "math-big", card).textContent = "Ready, genius?";
      el("p", "math-note", card).textContent = "Miss one and you start over.";
      const go = el("button", "game-btn", card);
      go.type = "button"; go.textContent = "Start";
      go.addEventListener("click", () => ask(0));
    }

    function makeQuestion() {
      const type = ["mul", "add", "sub", "div", "sq"][rnd(0, 4)];
      let q, a;
      if (type === "mul") { const x = rnd(3, 12), y = rnd(3, 12); q = `${x} × ${y}`; a = x * y; }
      if (type === "add") { const x = rnd(12, 89), y = rnd(12, 89); q = `${x} + ${y}`; a = x + y; }
      if (type === "sub") { const x = rnd(40, 99), y = rnd(11, x - 5); q = `${x} − ${y}`; a = x - y; }
      if (type === "div") { const y = rnd(2, 12), z = rnd(2, 12); q = `${y * z} ÷ ${y}`; a = z; }
      if (type === "sq") { const x = rnd(2, 15); q = `${x}²`; a = x * x; }
      const opts = new Set([a]);
      const near = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5];
      shuffle(near);
      for (const d of near) { if (opts.size >= 4) break; if (a + d > 0) opts.add(a + d); }
      return { q, a, opts: shuffle([...opts]) };
    }

    function ask(i) {
      if (i === 3) {
        card.innerHTML = "";
        el("div", "math-big", card).textContent = "3 for 3. Obviously.";
        ctx.setProgress("3 / 3");
        ctx.done();
        return;
      }
      ctx.setProgress(`${i + 1} / 3`);
      const { q, a, opts } = makeQuestion();
      card.innerHTML = "";
      el("div", "math-label", card).textContent = `Question ${i + 1} of 3`;
      el("div", "math-q", card).textContent = `${q} = ?`;
      const bar = el("div", "math-timer", card);
      const fill = el("i", null, bar);
      const answers = el("div", "math-answers", card);
      let over = false;
      const start = performance.now();
      // the real deadline runs on a clock (can't be paused by switching apps); the bar is just visual
      const deadline = setTimeout(() => fail(`Time's up! It was ${a}.`), 5000);
      const tick = (now) => {
        if (over) return;
        const left = Math.max(0, 1 - (now - start) / 5000);
        fill.style.transform = `scaleX(${left})`;
        fill.classList.toggle("low", left < 0.3);
        if (left > 0) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      opts.forEach((n) => {
        const b = el("button", "math-opt", answers);
        b.type = "button"; b.textContent = n;
        b.addEventListener("click", () => {
          if (over) return;
          over = true;
          clearTimeout(deadline);
          if (n === a) { b.classList.add("right"); haptic(); setTimeout(() => ask(i + 1), 450); }
          else { b.classList.add("wrong"); setTimeout(() => fail(`Not quite! It was ${a}.`, true), 350); }
        });
      });
      function fail(msg, already) {
        if (over && !already) return;
        over = true;
        card.innerHTML = "";
        el("div", "math-big", card).textContent = msg;
        el("p", "math-note", card).textContent = "All 3 have to be right. New questions:";
        const again = el("button", "game-btn", card);
        again.type = "button"; again.textContent = "Try again";
        again.addEventListener("click", () => ask(0));
        ctx.setProgress(null);
      }
    }
  }

  // ---------------------------------------------------------------- CIRCUIT (rotate wires to light the heart)
  async function circuit(ctx) {
    ctx.setHint("Tap the wires to turn them. Get power from the battery to the heart.");
    await ctx.ready();
    const { W, H } = ctx.size();
    const ROWS = 4, COLS = 4;
    const N = 1, E = 2, S = 4, Wd = 8;
    const DIRS = [[N, -1, 0], [E, 0, 1], [S, 1, 0], [Wd, 0, -1]];
    const opp = { [N]: S, [S]: N, [E]: Wd, [Wd]: E };
    const rot = (m) => ((m << 1) | (m >> 3)) & 15; // turn a piece 90° clockwise

    // Random winding path from the left edge to the right edge.
    let path;
    for (let tries = 0; tries < 200 && !path; tries++) {
      const r0 = rnd(0, ROWS - 1), seen = new Set([r0 + "," + 0]), p = [[r0, 0]];
      const walk = () => {
        const [r, c] = p[p.length - 1];
        if (c === COLS - 1 && p.length >= COLS + 2) return true;
        for (const [, dr, dc] of shuffle(DIRS.slice())) {
          const nr = r + dr, nc = c + dc, k = nr + "," + nc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen.has(k)) continue;
          seen.add(k); p.push([nr, nc]);
          if (p.length <= 11 && walk()) return true;
          p.pop(); seen.delete(k);
        }
        return false;
      };
      if (walk()) path = p;
    }
    const dirBetween = (a, b) => DIRS.find(([, dr, dc]) => a[0] + dr === b[0] && a[1] + dc === b[1])[0];
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const base = Math.random() < 0.5 ? (N | S) : (N | E); // decoy straight or corner
      cells.push({ r, c, mask: base });
    }
    const cell = (r, c) => cells[r * COLS + c];
    path.forEach((p, i) => {
      const inn = i === 0 ? Wd : dirBetween(p, path[i - 1]);
      const out = i === path.length - 1 ? E : dirBetween(p, path[i + 1]);
      cell(p[0], p[1]).mask = inn | out;
    });
    const startRow = path[0][0], endRow = path[path.length - 1][0];
    // scramble every piece; pieces on the real path always start pointed the wrong way
    const onPath = new Set(path.map(([r, c]) => r * COLS + c));
    cells.forEach((cl, i) => {
      const goal = cl.mask;
      do {
        cl.mask = goal;
        for (let k = rnd(onPath.has(i) ? 1 : 0, 3); k > 0; k--) cl.mask = rot(cl.mask);
      } while (onPath.has(i) && cl.mask === goal);
      cl.angle = 0;
    });
    if (solved()) { const cl = cell(startRow, 0); cl.mask = rot(cl.mask); }

    // Draw
    const cs = 100, pad = 70;
    const box = el("div", "circuit-box", stage(ctx));
    const vbW = COLS * cs + pad * 2, vbH = ROWS * cs;
    const scale = Math.min((W * 0.96) / vbW, (H * 0.92) / vbH, 1.1);
    box.style.width = vbW * scale + "px";
    const root = svg("svg", { viewBox: `0 0 ${vbW} ${vbH}`, width: "100%", role: "img", "aria-label": "Circuit puzzle" }, box);
    const yOf = (r) => r * cs + cs / 2;
    const leadIn = svg("line", { x1: 34, y1: yOf(startRow), x2: pad, y2: yOf(startRow), class: "wire on" }, root);
    const leadOut = svg("line", { x1: pad + COLS * cs, y1: yOf(endRow), x2: vbW - 36, y2: yOf(endRow), class: "wire" }, root);
    // battery
    const bat = svg("g", { class: "battery" }, root);
    svg("rect", { x: 6, y: yOf(startRow) - 24, width: 28, height: 48, rx: 6 }, bat);
    svg("rect", { x: 14, y: yOf(startRow) - 30, width: 12, height: 6, rx: 2 }, bat);
    const plus = svg("text", { x: 20, y: yOf(startRow) + 7, "text-anchor": "middle" }, bat); plus.textContent = "+";
    // heart bulb
    const hx = vbW - 30, hy = yOf(endRow);
    const bulb = svg("path", { class: "bulb", d: `M ${hx} ${hy + 18} C ${hx - 30} ${hy - 4}, ${hx - 18} ${hy - 26}, ${hx} ${hy - 10} C ${hx + 18} ${hy - 26}, ${hx + 30} ${hy - 4}, ${hx} ${hy + 18} Z` }, root);

    const groups = cells.map((cl, i) => {
      const gx = pad + cl.c * cs, gy = cl.r * cs;
      const tile = svg("g", { class: "tile", transform: `translate(${gx} ${gy})`, role: "button", "aria-label": `Wire ${i + 1}` }, root);
      svg("rect", { x: 3, y: 3, width: cs - 6, height: cs - 6, rx: 12, class: "tile-bg" }, tile);
      const spinG = svg("g", { class: "tile-spin" }, tile);
      svg("rect", { x: 0, y: 0, width: cs, height: cs, fill: "transparent" }, spinG); // keeps the spin centered
      cl.spin = spinG;
      cl.lines = [];
      for (const [bit, dr, dc] of DIRS) {
        const ln = svg("line", { x1: cs / 2, y1: cs / 2, x2: cs / 2 + dc * cs / 2, y2: cs / 2 + dr * cs / 2, class: "wire" }, spinG);
        cl.lines.push([bit, ln]);
      }
      svg("circle", { cx: cs / 2, cy: cs / 2, r: 9, class: "joint" }, spinG);
      // draw the *unrotated* base shape; rotation is shown with a CSS transform
      cl.base = cl.mask; cl.angle = 0;
      cl.lines.forEach(([bit, ln]) => ln.style.display = (cl.base & bit) ? "" : "none");
      tile.addEventListener("click", () => {
        if (box.classList.contains("solved")) return;
        cl.mask = rot(cl.mask); cl.angle += 90;
        spinG.style.transform = `rotate(${cl.angle}deg)`;
        haptic();
        paint();
      });
      return tile;
    });
    paint();

    function powered() {
      const on = new Set(), q = [];
      const s = cell(startRow, 0);
      if (s.mask & Wd) { on.add(s); q.push(s); }
      while (q.length) {
        const cur = q.shift();
        for (const [bit, dr, dc] of DIRS) {
          if (!(cur.mask & bit)) continue;
          const nr = cur.r + dr, nc = cur.c + dc;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
          const nb = cell(nr, nc);
          if (!on.has(nb) && (nb.mask & opp[bit])) { on.add(nb); q.push(nb); }
        }
      }
      return on;
    }
    function solved(on = powered()) { const e = cell(endRow, COLS - 1); return on.has(e) && (e.mask & E); }
    function paint() {
      const on = powered();
      cells.forEach((cl) => cl.spin.classList.toggle("on", on.has(cl)));
      const win = solved(on);
      leadOut.classList.toggle("on", !!win);
      bulb.classList.toggle("lit", !!win);
      if (win) { box.classList.add("solved"); ctx.done(); }
    }
  }

  // ---------------------------------------------------------------- LOGIC GATES (flip switches until output = 1)
  async function logic(ctx) {
    ctx.setHint("Flip the switches until the heart gets a 1.");
    await ctx.ready();
    const OPS = {
      AND: (a, b) => a & b, OR: (a, b) => a | b, XOR: (a, b) => a ^ b,
      NAND: (a, b) => 1 - (a & b), NOR: (a, b) => 1 - (a | b), XNOR: (a, b) => 1 - (a ^ b),
    };
    const names = Object.keys(OPS);
    let g1, g2, g3, inputs;
    const out = (x) => { const a = OPS[g1](x[0], x[1]), b = OPS[g2](x[2], x[3]); return { a, b, o: OPS[g3](a, b) }; };
    for (;;) { // a puzzle that starts at 0 and has only a few winning switch combos
      [g1, g2, g3] = [0, 0, 0].map(() => names[rnd(0, names.length - 1)]);
      let wins = 0;
      for (let m = 0; m < 16; m++) wins += out([m >> 3 & 1, m >> 2 & 1, m >> 1 & 1, m & 1]).o;
      inputs = [0, 0, 0, 0].map(() => rnd(0, 1));
      if (wins >= 1 && wins <= 5 && out(inputs).o === 0) break;
    }

    const { W, H } = ctx.size();
    const box = el("div", "logic-box", stage(ctx));
    const vbW = 560, vbH = 330;
    box.style.width = Math.min(W * 0.98, (H * 0.95) * vbW / vbH, 620) + "px";
    const root = svg("svg", { viewBox: `0 0 ${vbW} ${vbH}`, width: "100%", role: "img", "aria-label": "Logic gate puzzle" }, box);
    const ys = [45, 120, 210, 285];
    const g1y = (ys[0] + ys[1]) / 2, g2y = (ys[2] + ys[3]) / 2, g3y = (g1y + g2y) / 2;
    const gx = 230, g3x = 390;

    const wire = (pts) => svg("polyline", { points: pts.map((p) => p.join(",")).join(" "), class: "lwire" }, root);
    const wIn = [
      wire([[90, ys[0]], [160, ys[0]], [160, g1y - 14], [gx, g1y - 14]]),
      wire([[90, ys[1]], [160, ys[1]], [160, g1y + 14], [gx, g1y + 14]]),
      wire([[90, ys[2]], [160, ys[2]], [160, g2y - 14], [gx, g2y - 14]]),
      wire([[90, ys[3]], [160, ys[3]], [160, g2y + 14], [gx, g2y + 14]]),
    ];
    const wA = wire([[gx + 80, g1y], [340, g1y], [340, g3y - 14], [g3x, g3y - 14]]);
    const wB = wire([[gx + 80, g2y], [340, g2y], [340, g3y + 14], [g3x, g3y + 14]]);
    const wO = wire([[g3x + 80, g3y], [500, g3y]]);

    const gate = (x, y, name) => {
      const g = svg("g", { class: "gate" }, root);
      svg("rect", { x, y: y - 32, width: 80, height: 64, rx: 14 }, g);
      const t = svg("text", { x: x + 40, y: y + 7, "text-anchor": "middle" }, g); t.textContent = name;
      return g;
    };
    gate(gx, g1y, g1); gate(gx, g2y, g2); gate(g3x, g3y, g3);

    const hx = 525, hy = g3y;
    const heart = svg("path", { class: "bulb", d: `M ${hx} ${hy + 22} C ${hx - 36} ${hy - 4}, ${hx - 22} ${hy - 32}, ${hx} ${hy - 12} C ${hx + 22} ${hy - 32}, ${hx + 36} ${hy - 4}, ${hx} ${hy + 22} Z` }, root);
    const outText = svg("text", { x: hx, y: hy + 48, "text-anchor": "middle", class: "out-label" }, root);

    const switches = ys.map((y, i) => {
      const g = svg("g", { class: "switch", role: "button", "aria-label": `Switch ${"ABCD"[i]}` }, root);
      svg("rect", { x: 10, y: y - 22, width: 80, height: 44, rx: 22 }, g);
      const knob = svg("circle", { cx: 32, cy: y, r: 16, class: "knob" }, g);
      const lbl = svg("text", { x: 66, y: y + 7, "text-anchor": "middle" }, g);
      g.addEventListener("click", () => {
        if (box.classList.contains("solved")) return;
        inputs[i] ^= 1; haptic(); paint();
      });
      return { g, knob, lbl, name: "ABCD"[i] };
    });
    paint();

    function paint() {
      const { a, b, o } = out(inputs);
      switches.forEach((s, i) => {
        s.g.classList.toggle("on", !!inputs[i]);
        s.knob.setAttribute("cx", inputs[i] ? 68 : 32);
        s.lbl.setAttribute("x", inputs[i] ? 34 : 66);
        s.lbl.textContent = `${s.name} ${inputs[i]}`;
        wIn[i].classList.toggle("on", !!inputs[i]);
      });
      wA.classList.toggle("on", !!a); wB.classList.toggle("on", !!b); wO.classList.toggle("on", !!o);
      heart.classList.toggle("lit", !!o);
      outText.textContent = `= ${o}`;
      ctx.setProgress(`Output: ${o}`);
      if (o) { box.classList.add("solved"); ctx.done(); }
    }
  }

  window.GATE_GAMES = { spin, reveal, trace, math, circuit, logic };
})();
