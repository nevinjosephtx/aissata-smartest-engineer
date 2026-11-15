// ================= PING NEVIN (with message) + LIVE MESSAGES FROM NEVIN =================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const { SUPABASE_URL, SUPABASE_KEY, NTFY_TOPIC } = window.APP_CONFIG;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const $ = (id) => document.getElementById(id);
// Every ping links to Nevin's app (Aissata HQ), opened on the Message tab.
const REPLY_URL = window.APP_CONFIG.APP_URL;

// ---------------- toast ----------------
let toastTimer;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------------- composer ----------------
const compose = $("compose"), text = $("pingText"), sendBtn = $("composeSend");
let lastPing = 0;

function openCompose() {
  compose.classList.remove("hidden");
  setTimeout(() => text.focus(), 50);
}
function closeCompose() { compose.classList.add("hidden"); }

$("pingBtn").addEventListener("click", openCompose);
$("composeCancel").addEventListener("click", closeCompose);
compose.addEventListener("click", (e) => { if (e.target === compose) closeCompose(); });
document.querySelectorAll(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    text.value = text.value ? `${text.value} ${c.textContent}` : c.textContent;
    text.focus();
  })
);

sendBtn.addEventListener("click", async () => {
  const wait = 15000 - (Date.now() - lastPing);
  if (wait > 0) return showToast(`Easy, genius 😄 try again in ${Math.ceil(wait / 1000)}s`);
  const note = text.value.trim();
  sendBtn.disabled = true;
  try {
    // Plain-text body (JSON inside) keeps this a "simple" request — no CORS preflight.
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic: NTFY_TOPIC,
        title: note ? "💌 Aissata says:" : "Aissata pinged you!",
        message: (note || "The smartest engineer is thinking about you 💕") + "\n\nReply: " + REPLY_URL,
        tags: ["heart"],
        priority: 4,
        click: REPLY_URL,
        actions: [{ action: "view", label: "Reply", url: REPLY_URL, clear: true }],
      }),
    });
    if (!res.ok) throw new Error(res.status);
    lastPing = Date.now();
    text.value = "";
    closeCompose();
    showToast("Sent to Nevin's phone 💌");
  } catch (e) {
    console.warn(e);
    showToast("Couldn't reach Nevin's phone — try again");
  } finally {
    sendBtn.disabled = false;
  }
});

// ---------------- incoming messages from Nevin ----------------
const layer = $("flash");
const queue = [];
let showing = false;

function seenSet() {
  try { return new Set(JSON.parse(localStorage.getItem("seenNotes") || "[]")); } catch { return new Set(); }
}
function markSeen(id) {
  const s = seenSet();
  s.add(id);
  try { localStorage.setItem("seenNotes", JSON.stringify([...s].slice(-200))); } catch {}
}

// Live only: a message shows if her site is open the moment Nevin sends it, then it's forgotten.
// Anything older than this (e.g. a delayed delivery) is ignored — old messages never replay.
const LIVE_WINDOW_MS = 60 * 1000;

function enqueue(msg) {
  if (!msg || seenSet().has(msg.id) || queue.some((m) => m.id === msg.id)) return;
  if (Date.now() - new Date(msg.created_at).getTime() > LIVE_WINDOW_MS) return;
  queue.push(msg);
  queue.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!showing) next();
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function next() {
  const msg = queue.shift();
  if (!msg) { showing = false; return; }
  showing = true;
  chime();
  try { navigator.vibrate && navigator.userActivation?.hasBeenActive && navigator.vibrate([60, 60, 120]); } catch {}
  try { await flash(msg.body); } catch (e) { console.warn(e); }
  markSeen(msg.id);
  await wait(500);
  next();
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !compose.classList.contains("hidden")) closeCompose();
});

// ---------------- flash animations (a different one every message) ----------------
// Run a Web Animation, but never wait longer than it should take (background tabs pause animations).
function run(el, keyframes, opts) {
  const a = el.animate(keyframes, { fill: "both", ...opts });
  const total = (opts.duration || 0) * (opts.iterations || 1) + (opts.delay || 0);
  return Promise.race([a.finished.catch(() => {}), wait(total + 400)]);
}
const rnd = (a, b) => a + Math.random() * (b - a);
const stagger = (chars, fn) => Promise.all(chars.map((c, i) => fn(c, i)));

const ANIMATIONS = [
  { name: "zoom punch",
    in: (w) => run(w, [{ transform: "scale(.2)", opacity: 0 }, { transform: "scale(1.12)", opacity: 1, offset: 0.7 }, { transform: "scale(1)", opacity: 1 }], { duration: 650, easing: "ease-out" }),
    out: (w) => run(w, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.7)", opacity: 0 }], { duration: 700, easing: "ease-in" }) },
  { name: "slide across",
    in: (w) => run(w, [{ transform: "translateX(-110vw) skewX(-14deg)" }, { transform: "translateX(4vw) skewX(6deg)", offset: 0.8 }, { transform: "none" }], { duration: 800, easing: "ease-out" }),
    out: (w) => run(w, [{ transform: "none" }, { transform: "translateX(110vw) skewX(14deg)" }], { duration: 700, easing: "ease-in" }) },
  { name: "rise and blur",
    in: (w) => run(w, [{ transform: "translateY(90px)", filter: "blur(16px)", opacity: 0 }, { transform: "none", filter: "blur(0)", opacity: 1 }], { duration: 900, easing: "ease-out" }),
    out: (w) => run(w, [{ transform: "none", filter: "blur(0)", opacity: 1 }, { transform: "translateY(-90px)", filter: "blur(16px)", opacity: 0 }], { duration: 900, easing: "ease-in" }) },
  { name: "drop bounce",
    in: (w) => run(w, [{ transform: "translateY(-100vh)" }, { transform: "translateY(24px)", offset: 0.65 }, { transform: "translateY(-10px)", offset: 0.85 }, { transform: "none" }], { duration: 1000, easing: "ease-out" }),
    out: (w) => run(w, [{ transform: "none", opacity: 1 }, { transform: "translateY(100vh) rotate(10deg)", opacity: 0.6 }], { duration: 750, easing: "ease-in" }) },
  { name: "spin in",
    in: (w) => run(w, [{ transform: "rotate(-540deg) scale(0)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 1000, easing: "cubic-bezier(.2,.8,.2,1)" }),
    out: (w) => run(w, [{ transform: "none", opacity: 1 }, { transform: "rotate(360deg) scale(0)", opacity: 0 }], { duration: 800, easing: "ease-in" }) },
  { name: "typewriter", split: true,
    in: async (w, chars) => {
      chars.forEach((c) => (c.style.opacity = 0));
      const step = Math.min(55, 2200 / Math.max(1, chars.length));
      for (const c of chars) { c.style.opacity = 1; await wait(step); }
    },
    out: (w) => run(w, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-30px)" }], { duration: 700, easing: "ease-in" }) },
  { name: "wave", split: true,
    in: (w, chars) => stagger(chars, (c, i) => run(c, [{ transform: "translateY(1.2em) rotate(-25deg)", opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 500, delay: i * 35, easing: "cubic-bezier(.2,1.4,.4,1)" })),
    out: (w, chars) => stagger(chars, (c, i) => run(c, [{ transform: "none", opacity: 1 }, { transform: "translateY(-1.4em) rotate(20deg)", opacity: 0 }], { duration: 450, delay: i * 25, easing: "ease-in" })) },
  { name: "explode", split: true,
    in: (w, chars) => stagger(chars, (c) => run(c, [{ transform: `translate(${rnd(-60, 60)}vw, ${rnd(-60, 60)}vh) rotate(${rnd(-360, 360)}deg)`, opacity: 0 }, { transform: "none", opacity: 1 }], { duration: 900, delay: rnd(0, 300), easing: "cubic-bezier(.2,.8,.2,1)" })),
    out: (w, chars) => stagger(chars, (c) => run(c, [{ transform: "none", opacity: 1 }, { transform: `translate(${rnd(-70, 70)}vw, ${rnd(-70, 70)}vh) rotate(${rnd(-540, 540)}deg)`, opacity: 0 }], { duration: 900, delay: rnd(0, 200), easing: "ease-in" })) },
  { name: "neon flicker",
    in: (w) => run(w, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.1, offset: 0.2 }, { opacity: 1, offset: 0.35 }, { opacity: 0.3, offset: 0.5 }, { opacity: 1, offset: 0.6 }, { opacity: 1 }], { duration: 1000 }),
    out: (w) => run(w, [{ opacity: 1 }, { opacity: 0.2, offset: 0.2 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 700 }) },
  { name: "heartbeat",
    in: (w) => run(w, [{ transform: "scale(0)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(.95)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 800, easing: "ease-out" }),
    hold: (w, ms) => run(w, [{ transform: "scale(1)" }, { transform: "scale(1.08)", offset: 0.15 }, { transform: "scale(1)", offset: 0.3 }, { transform: "scale(1.08)", offset: 0.45 }, { transform: "scale(1)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 1100, iterations: Math.max(1, Math.round(ms / 1100)) }),
    out: (w) => run(w, [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0)", opacity: 0 }], { duration: 600, easing: "ease-in" }) },
  { name: "curtain",
    in: (w) => run(w, [{ clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(-20% -5% -20% -5%)" }], { duration: 900, easing: "ease-out" }),
    out: (w) => run(w, [{ clipPath: "inset(-20% -5% -20% -5%)", opacity: 1 }, { clipPath: "inset(50% 0 50% 0)", opacity: 0.4 }], { duration: 700, easing: "ease-in" }) },
  { name: "marquee", marquee: true, noHold: true,
    in: async (w) => {
      const width = w.getBoundingClientRect().width, vw = innerWidth;
      const ms = Math.max(4500, ((vw + width) / 260) * 1000); // about 260px per second
      await run(w, [{ transform: `translateX(${(vw + width) / 2}px)` }, { transform: `translateX(${-(vw + width) / 2}px)` }], { duration: ms, easing: "linear" });
    },
    out: async () => {} },
];
let lastAnim = -1;

async function flash(body) {
  let k;
  do { k = (Math.random() * ANIMATIONS.length) | 0; } while (k === lastAnim && ANIMATIONS.length > 1);
  lastAnim = k;
  const A = ANIMATIONS[k];
  layer.dataset.anim = A.name;

  const wrap = document.createElement("div");
  wrap.className = "flash-msg" + (A.marquee ? " marquee" : "") + (body.length > 90 ? " long" : "");
  const text = document.createElement("div");
  text.className = "flash-text";
  const chars = [];
  if (A.split) {
    // keep words together so lines only break between words
    body.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) { text.appendChild(document.createTextNode(" ")); return; }
      const word = document.createElement("span");
      word.className = "word";
      for (const ch of Array.from(part)) {
        const s = document.createElement("span");
        s.className = "ch";
        s.textContent = ch;
        word.appendChild(s);
        chars.push(s);
      }
      text.appendChild(word);
    });
  } else {
    text.textContent = body;
  }
  const sig = document.createElement("div");
  sig.className = "flash-sig";
  sig.textContent = "Nevin";
  wrap.append(text, sig);
  layer.innerHTML = "";
  layer.appendChild(wrap);
  spawnHearts();

  const hold = Math.min(8000, Math.max(2600, 2600 + body.length * 55));
  await run(layer, [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  sig.style.opacity = 0;
  await A.in(wrap, chars);
  run(sig, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 500 });
  if (!A.noHold) await (A.hold ? A.hold(wrap, hold) : wait(hold));
  await A.out(wrap, chars);
  await run(layer, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });
  layer.innerHTML = "";
  delete layer.dataset.anim;
}

function spawnHearts() {
  for (let i = 0; i < 16; i++) {
    const h = document.createElement("span");
    h.className = "flash-heart";
    h.textContent = ["♥", "💕", "💗", "✨"][i % 4];
    h.style.left = Math.random() * 100 + "%";
    h.style.fontSize = 16 + Math.random() * 26 + "px";
    h.style.animationDelay = Math.random() * 2.5 + "s";
    h.style.animationDuration = 4 + Math.random() * 3 + "s";
    layer.appendChild(h);
  }
}

let audio;
function chime() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    [659, 880, 1047].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "sine"; o.frequency.value = f;
      const t = audio.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.65);
    });
  } catch {}
}

sb.channel("love-notes")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => enqueue(p.new))
  .subscribe();

// No catch-up on load: old messages are never shown again.
