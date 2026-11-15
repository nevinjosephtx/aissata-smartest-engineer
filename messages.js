// ================= PING NEVIN (with message) + LIVE MESSAGES FROM NEVIN =================
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const { SUPABASE_URL, SUPABASE_KEY, NTFY_TOPIC } = window.APP_CONFIG;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const $ = (id) => document.getElementById(id);
// Every ping links to Nevin's app (Aissata HQ), opened on the Message tab.
const REPLY_URL = new URL("admin/#messages", location.href.split(/[?#]/)[0]).href;

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
        message: note || "The smartest engineer is thinking about you 💕",
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
const note = $("loveNote");
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

function enqueue(msg) {
  if (!msg || seenSet().has(msg.id) || queue.some((m) => m.id === msg.id)) return;
  queue.push(msg);
  queue.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  if (!showing) next();
}

function next() {
  const msg = queue.shift();
  if (!msg) { showing = false; return; }
  showing = true;
  $("noteBody").textContent = msg.body;
  $("noteTime").textContent = new Date(msg.created_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
  note.dataset.id = msg.id;
  note.classList.remove("hidden");
  spawnHearts();
  chime();
  try { navigator.vibrate && navigator.userActivation?.hasBeenActive && navigator.vibrate([60, 60, 120]); } catch {}
}

function dismiss() {
  markSeen(note.dataset.id);
  note.classList.add("hidden");
  next();
}
$("noteClose").addEventListener("click", dismiss);
$("noteReply").addEventListener("click", () => { dismiss(); if (!showing) openCompose(); });
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!note.classList.contains("hidden")) dismiss();
  else if (!compose.classList.contains("hidden")) closeCompose();
});

function spawnHearts() {
  const box = note.querySelector(".note-hearts");
  box.innerHTML = "";
  for (let i = 0; i < 26; i++) {
    const h = document.createElement("span");
    h.textContent = ["♥", "💕", "💗", "✨"][i % 4];
    h.style.left = Math.random() * 100 + "%";
    h.style.fontSize = 16 + Math.random() * 30 + "px";
    h.style.animationDelay = Math.random() * 4 + "s";
    h.style.animationDuration = 4 + Math.random() * 4 + "s";
    box.appendChild(h);
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

async function catchUp() {
  const { data, error } = await sb.from("messages").select("id,body,created_at").order("created_at", { ascending: true }).limit(20);
  if (error) return console.warn(error);
  data.forEach(enqueue);
}

sb.channel("love-notes")
  .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => enqueue(p.new))
  .subscribe();

catchUp();
// phones pause background tabs — check again when she comes back
document.addEventListener("visibilitychange", () => { if (!document.hidden) catchUp(); });
