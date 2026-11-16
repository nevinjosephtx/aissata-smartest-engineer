import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const { SUPABASE_URL, SUPABASE_KEY, BUCKET, NTFY_TOPIC } = window.APP_CONFIG;
const $ = (id) => document.getElementById(id);

// No login: the owner chose a fully open app.
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

$("topic").textContent = NTFY_TOPIC;
$("herLink").textContent = new URL("../", location.href).href;
$("appLink").textContent = new URL("./", location.href).href;

// ---------------- app install (PWA) ----------------
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvt = e;
  $("installCard").classList.remove("hidden");
});
$("installBtn").addEventListener("click", async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $("installCard").classList.add("hidden");
});
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) $("iosInstall").classList.remove("hidden");

// ---------------- tabs ----------------
function showTab(name) {
  if (!["messages", "photos", "snaps", "phrases", "setup"].includes(name)) name = "messages";
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + name));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  if (name === "photos") loadGrid();
  if (name === "messages") loadThread();
  if (name === "snaps") loadSnaps();
  if (name === "setup") loadMusic();
  if (name === "phrases") loadPhrases();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
addEventListener("hashchange", () => showTab(location.hash.slice(1)));

// Open straight to the app.
showTab(location.hash.slice(1));

// ---------------- messages ----------------
document.querySelectorAll(".chip").forEach((c) =>
  c.addEventListener("click", () => {
    const b = $("body");
    b.value = b.value ? `${b.value} ${c.textContent}` : c.textContent;
    b.dispatchEvent(new Event("input"));
    b.focus();
  })
);
$("body").addEventListener("input", () => ($("count").textContent = `${$("body").value.length} / 500`));

$("send").addEventListener("click", async () => {
  const body = $("body").value.trim();
  if (!body) return ($("sendMsg").textContent = "Write something first 🙂");
  $("send").disabled = true;
  $("sendMsg").textContent = "Sending…";
  const { error } = await sb.from("messages").insert({ body });
  $("send").disabled = false;
  if (error) return ($("sendMsg").textContent = error.message);
  $("body").value = "";
  $("count").textContent = "0 / 500";
  $("sendMsg").textContent = "Sent! 💌";
  loadThread();
});

// Conversation with Aissata: her pings on the left, your messages on the right.
async function loadThread() {
  const { data, error } = await sb.from("messages").select("id,body,sender,created_at,read_at")
    .order("created_at", { ascending: false }).limit(200);
  const box = $("thread");
  if (error) { box.textContent = error.message; return; }
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = data.length ? "" : '<div class="empty">No messages yet.</div>';
  const rows = data.reverse();
  // read receipt only under your latest message
  const lastMine = [...rows].reverse().find((m) => m.sender === "nevin");
  let lastDay = null;
  for (const m of rows) {
    const when = new Date(m.created_at);
    if (when.toDateString() !== lastDay) {
      lastDay = when.toDateString();
      const sep = document.createElement("div");
      sep.className = "t-day";
      sep.textContent = dayLabel(when);
      box.appendChild(sep);
    }
    const row = document.createElement("div");
    row.className = "t-row " + (m.sender === "nevin" ? "me" : "her");
    const b = document.createElement("div");
    b.className = "t-bubble";
    b.textContent = m.body;
    const meta = document.createElement("div");
    meta.className = "t-meta";
    const time = document.createElement("span");
    time.textContent = when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    meta.appendChild(time);
    if (m.sender === "nevin") {
      if (m === lastMine) {
        const r = document.createElement("span");
        r.textContent = m.read_at ? `Seen ${new Date(m.read_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Delivered";
        meta.appendChild(r);
      }
      const del = document.createElement("button");
      del.textContent = "Unsend";
      del.addEventListener("click", async () => {
        del.disabled = true;
        await sb.from("messages").delete().eq("id", m.id);
        loadThread();
      });
      meta.appendChild(del);
    }
    row.append(b, meta);
    box.appendChild(row);
  }
  if (atBottom || !box.dataset.loaded) box.scrollTop = box.scrollHeight;
  box.dataset.loaded = "1";
}

function dayLabel(d) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const that = new Date(d); that.setHours(0, 0, 0, 0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return that.toLocaleDateString([], { weekday: "long" });
  return that.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// ---------------- snapshots she took ----------------
async function loadSnaps() {
  const { data, error } = await sb.from("snapshots").select("id,path,created_at").order("created_at", { ascending: false });
  const grid = $("snapGrid");
  if (error) { grid.textContent = error.message; return; }
  $("snapCount").textContent = `(${data.length})`;
  grid.innerHTML = data.length ? "" : '<p class="lead">No snapshots yet. They show up here when she taps Snapshot.</p>';
  data.forEach((row, i) => {
    const url = sb.storage.from(BUCKET).getPublicUrl(row.path).data.publicUrl;
    const t = document.createElement("div");
    t.className = "snap-tile";
    const a = document.createElement("a");
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    const img = document.createElement("img");
    img.loading = "lazy"; img.alt = `Snapshot from ${new Date(row.created_at).toLocaleString()}`; img.src = url;
    a.appendChild(img);
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm("Delete this snapshot?")) return;
      del.disabled = true;
      await sb.storage.from(BUCKET).remove([row.path]);
      await sb.from("snapshots").delete().eq("id", row.id);
      loadSnaps();
    });
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = new Date(row.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    t.append(a, del, n);
    grid.appendChild(t);
  });
}

// ---------------- live updates ----------------
const tabOpen = (name) => !$("tab-" + name).classList.contains("hidden");
sb.channel("hq-live")
  .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => { if (tabOpen("messages")) loadThread(); })
  .on("postgres_changes", { event: "*", schema: "public", table: "snapshots" }, () => { if (tabOpen("snaps")) loadSnaps(); })
  .subscribe();

// ---------------- photos ----------------
const drop = $("drop"), file = $("file");
drop.addEventListener("click", () => file.click());
drop.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && file.click());
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); upload([...e.dataTransfer.files]); });
file.addEventListener("change", () => { upload([...file.files]); file.value = ""; });

async function upload(files) {
  files = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
  if (!files.length) return;
  const bar = $("bar");
  bar.style.display = "block";
  let done = 0, failed = 0;
  for (const f of files) {
    $("upMsg").textContent = `Uploading ${done + 1} of ${files.length}…`;
    try {
      const blob = await shrink(f);
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (up.error) throw up.error;
      const ins = await sb.from("photos").insert({ path });
      if (ins.error) throw ins.error;
    } catch (err) {
      console.error(f.name, err);
      failed++;
    }
    done++;
    bar.firstElementChild.style.width = (done / files.length) * 100 + "%";
  }
  $("upMsg").textContent = failed ? `Done — ${failed} photo(s) couldn't be read. Try JPG/PNG for those.` : `Added ${files.length} photo(s) 💕`;
  setTimeout(() => { bar.style.display = "none"; bar.firstElementChild.style.width = 0; }, 800);
  loadGrid();
}

// Resize to max 1800px and convert to JPEG (also fixes rotation).
async function shrink(f) {
  const bmp = await createImageBitmap(f, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close && bmp.close();
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.86));
}

async function loadGrid() {
  const { data, error } = await sb.from("photos").select("id,path,created_at").order("created_at");
  const grid = $("grid");
  if (error) { grid.textContent = error.message; return; }
  $("photoCount").textContent = `(${data.length})`;
  grid.innerHTML = data.length ? "" : '<p class="lead">No photos yet — add some above.</p>';
  data.forEach((row, i) => {
    const t = document.createElement("div");
    t.className = "tile";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "";
    img.src = sb.storage.from(BUCKET).getPublicUrl(row.path).data.publicUrl;
    const del = document.createElement("button");
    del.textContent = "✕";
    del.setAttribute("aria-label", "Remove photo");
    del.addEventListener("click", async () => {
      if (!confirm("Remove this photo from her puzzle and gallery?")) return;
      del.disabled = true;
      await sb.storage.from(BUCKET).remove([row.path]);
      const { error } = await sb.from("photos").delete().eq("id", row.id);
      if (error) { alert(error.message); del.disabled = false; return; }
      loadGrid();
    });
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = `#${i + 1}`;
    t.append(img, del, n);
    grid.appendChild(t);
  });
}

// ---------------- test ping ----------------
$("testPing").addEventListener("click", async () => {
  $("pingMsg").textContent = "Sending…";
  try {
    const url = window.APP_CONFIG.APP_URL;
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic: NTFY_TOPIC, title: "Test ping", message: "Ping Nevin is working 💕\n\nReply: " + url, tags: ["white_check_mark"],
        click: url, actions: [{ action: "view", label: "Reply", url, clear: true }],
      }),
    });
    $("pingMsg").textContent = res.ok ? "Sent! Check your phone." : "Failed: " + res.status;
  } catch (e) {
    $("pingMsg").textContent = "Failed: " + e.message;
  }
});

// ---------------- phrases ----------------
$("phraseForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("newPhrase").value.trim();
  if (!text) return;
  $("phraseMsg").textContent = "Adding...";
  const { error } = await sb.from("phrases").insert({ text });
  if (error) return ($("phraseMsg").textContent = error.message);
  $("newPhrase").value = "";
  $("phraseMsg").textContent = "Added.";
  loadPhrases();
});

async function loadPhrases() {
  const { data, error } = await sb.from("phrases").select("id,text,created_at").order("created_at", { ascending: false });
  const list = $("phraseList");
  if (error) { list.textContent = error.message; return; }
  $("phraseCount").textContent = `(${data.length})`;
  list.innerHTML = data.length ? "" : '<li><span class="lead">No phrases yet. The site will use the starter list.</span></li>';
  for (const row of data) {
    const li = document.createElement("li");
    const input = document.createElement("input");
    input.value = row.text;
    input.maxLength = 120;
    input.setAttribute("aria-label", "Phrase");
    const state = document.createElement("span");
    state.className = "state";
    let saved = row.text;
    const save = async () => {
      const text = input.value.trim();
      if (!text) { input.value = saved; return; }
      if (text === saved) return;
      state.textContent = "...";
      const { error } = await sb.from("phrases").update({ text }).eq("id", row.id);
      if (error) { state.textContent = "Error"; return; }
      saved = text;
      state.textContent = "Saved";
      setTimeout(() => (state.textContent = ""), 1500);
    };
    input.addEventListener("blur", save);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); if (e.key === "Escape") { input.value = saved; input.blur(); } });
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", async () => {
      del.disabled = true;
      const { error } = await sb.from("phrases").delete().eq("id", row.id);
      if (error) { del.disabled = false; state.textContent = "Error"; return; }
      li.remove();
      $("phraseCount").textContent = `(${list.children.length})`;
    });
    li.append(input, state, del);
    list.appendChild(li);
  }
}

// ---------------- your music (synced by the "Update last song" job) ----------------
async function loadMusic() {
  const box = $("musicStatus");
  const { data, error } = await sb.from("now_playing").select("*").eq("id", 1).maybeSingle();
  if (error) { box.textContent = error.message; return; }
  if (!data) {
    box.innerHTML = '<span class="lead">Not synced yet. Follow the steps below once, and her site will show your latest song.</span>';
    return;
  }
  const since = (iso) => {
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 2 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} hr ago` : `${Math.round(m / 1440)} days ago`;
  };
  box.innerHTML = "";
  const img = document.createElement("img");
  img.alt = "";
  img.src = data.thumbnail || `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`;
  const text = document.createElement("div");
  const t = document.createElement("div"); t.className = "t"; t.textContent = data.title || "Untitled";
  const m1 = document.createElement("div"); m1.className = "m"; m1.textContent = data.artist || "";
  const m2 = document.createElement("div"); m2.className = "m";
  const stale = Date.now() - new Date(data.checked_at).getTime() > 2 * 3600 * 1000;
  m2.textContent = `On her site · last checked ${since(data.checked_at)}${stale ? " (sync may be broken: redo setup)" : ""}`;
  text.append(t, m1, m2);
  box.append(img, text);
}

