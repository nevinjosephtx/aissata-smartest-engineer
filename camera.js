// ================= CAMERA + FLOATING LABEL + LOVE EFFECTS =================
const TITLE = "SMARTEST ENGINEER";
const BADGE = "NSBE VP";
const MP_VERSION = "0.10.14";

const video = document.getElementById("video");
const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("camStatus");

const fx = { hearts: true, petals: false, glow: false, frame: false, blush: false };
let landmarker = null;
let lastVideoTime = -1;
let started = false;

// Smoothed face state (canvas pixels, already mirrored).
const face = { found: false, everFound: false, x: 0, y: 0, top: 0, w: 0, h: 0, angle: 0, cheekL: null, cheekR: null };

window.addEventListener("enter-camera", start);

document.querySelectorAll(".fx").forEach((b) =>
  b.addEventListener("click", () => {
    fx[b.dataset.fx] = !fx[b.dataset.fx];
    b.classList.toggle("on", fx[b.dataset.fx]);
  })
);
document.getElementById("snap").addEventListener("click", snapshot);

async function start() {
  if (started) return;
  started = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    statusEl.textContent = "Camera blocked — allow camera access and reload ♥";
    console.error(err);
    return;
  }
  statusEl.textContent = "Loading face tracking…";
  requestAnimationFrame(loop);
  loadTracker();
}

async function loadTracker() {
  try {
    const { FaceLandmarker, FilesetResolver } = await import(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`
    );
    const files = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`
    );
    const opts = (delegate) => ({
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate,
      },
      runningMode: "VIDEO",
      numFaces: 1,
    });
    try {
      // GPU is faster, but can hang on some devices — give it 6s, then use CPU.
      landmarker = await Promise.race([
        FaceLandmarker.createFromOptions(files, opts("GPU")),
        new Promise((_, rej) => setTimeout(() => rej(new Error("gpu timeout")), 6000)),
      ]);
    } catch {
      landmarker = await FaceLandmarker.createFromOptions(files, opts("CPU"));
    }
    statusEl.textContent = "";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Face tracking unavailable — words will float at the top";
    setTimeout(() => (statusEl.textContent = ""), 4000);
  }
}

// ---------------- main loop ----------------
function loop(now) {
  requestAnimationFrame(loop);
  if (video.readyState < 2) return;
  const W = video.videoWidth, H = video.videoHeight;
  if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }

  track(now, W, H);

  drawVideo(W, H);
  if (fx.glow) drawGlowOverlay(W, H, now);
  if (fx.frame) drawHeartFrame(W, H, now);
  if (fx.petals) drawPetals(W, H);
  if (fx.blush) drawBlushHalo(now);
  if (fx.hearts) drawHearts(W, H);
  drawLabel(W, H, now); // always last so the words are never covered
}

function track(now, W, H) {
  if (!landmarker || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  let res;
  try { res = landmarker.detectForVideo(video, now); } catch { return; }
  const lm = res && res.faceLandmarks && res.faceLandmarks[0];
  if (!lm) { face.found = false; return; }

  const P = (i) => ({ x: (1 - lm[i].x) * W, y: lm[i].y * H }); // mirrored
  const top = P(10), chin = P(152), l = P(234), r = P(454);
  let e1 = P(33), e2 = P(263);
  if (e2.x < e1.x) [e1, e2] = [e2, e1];
  const target = {
    x: (l.x + r.x) / 2,
    y: (top.y + chin.y) / 2,
    top: top.y,
    topX: top.x,
    w: Math.hypot(r.x - l.x, r.y - l.y),
    h: Math.hypot(chin.x - top.x, chin.y - top.y),
    angle: Math.atan2(e2.y - e1.y, e2.x - e1.x),
  };
  const k = face.everFound ? 0.35 : 1;
  for (const key of ["x", "y", "top", "topX", "w", "h", "angle"]) {
    face[key] = (face[key] ?? target[key]) + (target[key] - (face[key] ?? target[key])) * k;
  }
  face.cheekL = P(50);
  face.cheekR = P(280);
  face.found = true;
  face.everFound = true;
}

// ---------------- video (+ dreamy filter) ----------------
function drawVideo(W, H) {
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  if (fx.glow) ctx.filter = "saturate(1.15) contrast(0.94) brightness(1.06)";
  ctx.drawImage(video, 0, 0, W, H);
  if (fx.glow) {
    // soft bloom
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.35;
    ctx.filter = "blur(14px)";
    ctx.drawImage(video, 0, 0, W, H);
  }
  ctx.restore();
}

const twinkles = [...Array(40)].map(() => ({ x: Math.random(), y: Math.random(), p: Math.random() * 6, s: 0.5 + Math.random() }));
function drawGlowOverlay(W, H, now) {
  ctx.save();
  // rosy wash
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,120,150,0.45)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  // maroon vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  v.addColorStop(0, "rgba(80,0,0,0)");
  v.addColorStop(1, "rgba(80,0,0,0.7)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  // twinkling sparkles
  const t = now / 1000;
  for (const s of twinkles) {
    const a = Math.max(0, Math.sin(t * 2 * s.s + s.p));
    sparkle(s.x * W, s.y * H, (W / 120) * s.s * (0.5 + a), `rgba(255,255,255,${a * 0.9})`);
  }
  ctx.restore();
}

function sparkle(x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

// ---------------- hearts ----------------
function heartPath(c, cx, cy, s) {
  const x = cx, y = cy - s / 2;
  c.beginPath();
  c.moveTo(x, y + s * 0.3);
  c.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
  c.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  c.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  c.closePath();
}

const HEART_COLORS = ["#ffffff", "#ff8fab", "#ff4d79", "#e0115f", "#9e1b32"];
const hearts = [];
function drawHearts(W, H) {
  const base = Math.min(W, H);
  if (hearts.length < 45 && Math.random() < 0.35) {
    // rise from around her shoulders if we see her, otherwise from the bottom
    const cx = face.found ? face.x + (Math.random() - 0.5) * face.w * 2.6 : Math.random() * W;
    hearts.push({
      x: cx, y: H + 20, vy: -(base * 0.003 + Math.random() * base * 0.004),
      s: base * (0.025 + Math.random() * 0.045), sway: Math.random() * 6, life: 1,
      color: HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0],
    });
  }
  ctx.save();
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.y += h.vy;
    h.sway += 0.04;
    const x = h.x + Math.sin(h.sway) * h.s * 0.8;
    const fade = Math.min(1, h.y / (H * 0.35));
    if (h.y < -h.s) { hearts.splice(i, 1); continue; }
    ctx.globalAlpha = Math.max(0, fade) * 0.9;
    ctx.shadowColor = "rgba(255,80,120,.8)";
    ctx.shadowBlur = h.s * 0.5;
    ctx.fillStyle = h.color;
    heartPath(ctx, x, h.y, h.s);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------- rose petals ----------------
const petals = [];
const PETAL_COLORS = [["#ff6b8b", "#b3002d"], ["#ffc2d1", "#ff6b8b"], ["#8a0f2a", "#500000"], ["#ffffff", "#ffc2d1"]];
function drawPetals(W, H) {
  const base = Math.min(W, H);
  if (petals.length < 60 && Math.random() < 0.4) {
    petals.push({
      x: Math.random() * W, y: -30, vy: base * (0.002 + Math.random() * 0.003), vx: (Math.random() - 0.3) * base * 0.002,
      r: base * (0.012 + Math.random() * 0.014), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.08,
      flip: Math.random() * 6, col: PETAL_COLORS[(Math.random() * PETAL_COLORS.length) | 0],
    });
  }
  ctx.save();
  for (let i = petals.length - 1; i >= 0; i--) {
    const p = petals[i];
    p.y += p.vy; p.x += p.vx + Math.sin(p.flip) * 0.6; p.rot += p.vr; p.flip += 0.05;
    if (p.y > H + 30) { petals.splice(i, 1); continue; }
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.35 + Math.abs(Math.sin(p.flip)) * 0.65); // tumbling
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, p.r * 1.4);
    g.addColorStop(0, p.col[0]); g.addColorStop(1, p.col[1]);
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(0, -p.r * 1.3);
    ctx.bezierCurveTo(p.r * 1.2, -p.r * 0.8, p.r * 0.9, p.r, 0, p.r * 1.2);
    ctx.bezierCurveTo(-p.r * 0.9, p.r, -p.r * 1.2, -p.r * 0.8, 0, -p.r * 1.3);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------- heart-shaped frame ----------------
const frameState = { x: 0, y: 0, s: 0, init: false };
function drawHeartFrame(W, H, now) {
  const tx = face.found ? face.x : W / 2;
  const ty = face.found ? face.y + face.h * 0.1 : H * 0.55;
  const ts = face.found ? face.h * 2.6 : Math.min(W, H) * 0.85;
  if (!frameState.init) Object.assign(frameState, { x: tx, y: ty, s: ts, init: true });
  frameState.x += (tx - frameState.x) * 0.2;
  frameState.y += (ty - frameState.y) * 0.2;
  frameState.s += (ts - frameState.s) * 0.2;
  const beat = 1 + Math.pow(Math.max(0, Math.sin(now / 1000 * Math.PI * 1.6)), 8) * 0.05; // heartbeat
  const s = frameState.s * beat;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  // heart path appended to same path; evenodd cuts it out
  const x = frameState.x, y = frameState.y - s / 2;
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.75, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.75, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fillStyle = "rgba(80,0,0,0.72)";
  ctx.fill("evenodd");
  heartPath(ctx, frameState.x, frameState.y, s);
  ctx.lineWidth = Math.max(4, s * 0.012);
  ctx.strokeStyle = "#fff";
  ctx.shadowColor = "rgba(255,120,160,1)";
  ctx.shadowBlur = s * 0.05;
  ctx.stroke();
  ctx.restore();
}

// ---------------- blush + heart halo ----------------
function drawBlushHalo(now) {
  if (!face.found) return;
  ctx.save();
  const r = face.w * 0.16;
  for (const c of [face.cheekL, face.cheekR]) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
    g.addColorStop(0, "rgba(255,90,130,0.55)");
    g.addColorStop(1, "rgba(255,90,130,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
  }
  // orbiting halo of hearts around the top of her head
  const t = now / 1000;
  const n = 9;
  const cx = face.topX, cy = face.top - face.h * 0.05;
  const rx = face.w * 0.62, ry = face.w * 0.16;
  ctx.translate(cx, cy);
  ctx.rotate(face.angle);
  const items = [];
  for (let i = 0; i < n; i++) {
    const a = t * 1.2 + (i / n) * Math.PI * 2;
    items.push({ x: Math.cos(a) * rx, y: Math.sin(a) * ry, depth: Math.sin(a), i });
  }
  items.sort((a, b) => a.depth - b.depth);
  for (const it of items) {
    const sz = face.w * (0.09 + it.depth * 0.025);
    ctx.globalAlpha = 0.55 + (it.depth + 1) * 0.22;
    ctx.fillStyle = it.i % 2 ? "#ffffff" : "#ff4d79";
    ctx.shadowColor = "rgba(255,80,120,.9)";
    ctx.shadowBlur = sz * 0.6;
    heartPath(ctx, it.x, it.y, sz);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------- the floating words (always visible) ----------------
const label = { x: 0, y: 0, fs: 0, angle: 0, init: false };
function drawLabel(W, H, now) {
  let tx, ty, tfs, tang;
  if (face.everFound) {
    tfs = Math.max(W * 0.03, Math.min(face.w * 0.17, W * 0.07));
    const lift = face.w * 0.28 + tfs * 1.6;
    tx = face.topX + Math.sin(face.angle) * lift;
    ty = face.top - Math.cos(face.angle) * lift;
    tang = face.angle * 0.6;
  } else {
    tfs = W * 0.045; tx = W / 2; ty = H * 0.16; tang = 0;
  }
  if (!label.init) Object.assign(label, { x: tx, y: ty, fs: tfs, angle: tang, init: true });
  label.x += (tx - label.x) * 0.25;
  label.y += (ty - label.y) * 0.25;
  label.fs += (tfs - label.fs) * 0.2;
  label.angle += (tang - label.angle) * 0.25;

  const fs = label.fs;
  const bob = Math.sin(now / 1000 * 2.2) * fs * 0.12;
  ctx.save();
  ctx.font = `700 ${fs}px Oswald, Impact, sans-serif`;
  const titleW = ctx.measureText(TITLE).width + fs * 1.6;
  // keep it fully on screen
  const x = Math.min(Math.max(label.x, titleW / 2 + 8), W - titleW / 2 - 8);
  const y = Math.min(Math.max(label.y + bob, fs * 1.1), H - fs * 1.4);
  ctx.translate(x, y);
  ctx.rotate(label.angle);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // title
  ctx.lineJoin = "round";
  ctx.lineWidth = fs * 0.22;
  ctx.strokeStyle = "#500000";
  ctx.shadowColor = "rgba(255,120,160,0.95)";
  ctx.shadowBlur = fs * 0.6;
  ctx.strokeText(TITLE, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(TITLE, 0, 0);

  // little hearts on each side
  const half = ctx.measureText(TITLE).width / 2;
  const pulse = 1 + Math.sin(now / 1000 * 5) * 0.1;
  for (const side of [-1, 1]) {
    ctx.fillStyle = "#ff4d79";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = fs * 0.06;
    heartPath(ctx, side * (half + fs * 0.55), 0, fs * 0.6 * pulse);
    ctx.fill(); ctx.stroke();
  }

  // NSBE VP badge
  const bfs = fs * 0.6;
  ctx.font = `700 ${bfs}px Oswald, Impact, sans-serif`;
  const bw = ctx.measureText(BADGE).width + bfs * 1.4;
  const bh = bfs * 1.45;
  const by = fs * 0.62 + bh / 2 + fs * 0.12;
  ctx.fillStyle = "#500000";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(2, bfs * 0.1);
  ctx.shadowColor = "rgba(0,0,0,.4)";
  ctx.shadowBlur = bfs * 0.4;
  roundRect(-bw / 2, by - bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillText(BADGE, 0, by + bfs * 0.04);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------- snapshot ----------------
function snapshot() {
  if (!canvas.width) return;
  const flash = document.createElement("div");
  Object.assign(flash.style, { position: "fixed", inset: 0, background: "#fff", opacity: 0.8, transition: "opacity .4s", zIndex: 99999 });
  document.body.appendChild(flash);
  requestAnimationFrame(() => (flash.style.opacity = 0));
  setTimeout(() => flash.remove(), 450);
  canvas.toBlob((blob) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aissata-smartest-engineer-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
