import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const { SUPABASE_URL, SUPABASE_KEY, BUCKET, NTFY_TOPIC } = window.APP_CONFIG;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = (id) => document.getElementById(id);

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
  if (!["messages", "photos", "setup"].includes(name)) name = "messages";
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + name));
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  if (name === "photos") loadGrid();
  if (name === "messages") loadSent();
}
document.querySelectorAll("#tabs button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
addEventListener("hashchange", () => showTab(location.hash.slice(1)));

// ---------------- auth ----------------
$("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("authMsg").textContent = "Signing in…";
  const { error } = await sb.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  $("authMsg").textContent = error ? error.message : "";
});
$("signOut").addEventListener("click", () => sb.auth.signOut());

let ready = false;
sb.auth.onAuthStateChange((_event, session) => {
  const signedIn = !!session;
  $("authCard").classList.toggle("hidden", signedIn);
  $("app").classList.toggle("hidden", !signedIn);
  $("tabs").classList.toggle("hidden", !signedIn);
  $("signOut").classList.toggle("hidden", !signedIn);
  if (signedIn && !ready) {
    ready = true;
    // setTimeout: avoid calling Supabase inside the auth callback (can deadlock)
    setTimeout(async () => {
      const { data: isAdmin } = await sb.rpc("is_admin");
      if (!isAdmin) {
        $("app").innerHTML = '<div class="card"><h2>Not allowed</h2><p class="lead">This account isn\'t the owner.</p></div>';
        $("tabs").classList.add("hidden");
        return;
      }
      showTab(location.hash.slice(1));
    });
  }
  if (!signedIn) ready = false;
});

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
  loadSent();
});

async function loadSent() {
  const { data, error } = await sb.from("messages").select("id,body,created_at").order("created_at", { ascending: false }).limit(15);
  const list = $("sentList");
  list.innerHTML = "";
  if (error) { list.textContent = error.message; return; }
  if (!data.length) { list.innerHTML = '<li><span class="t">Nothing sent yet.</span></li>'; return; }
  for (const m of data) {
    const li = document.createElement("li");
    const left = document.createElement("div");
    const b = document.createElement("div"); b.className = "b"; b.textContent = m.body;
    const t = document.createElement("div"); t.className = "t"; t.textContent = new Date(m.created_at).toLocaleString();
    left.append(b, t);
    const del = document.createElement("button");
    del.textContent = "Unsend";
    del.addEventListener("click", async () => {
      del.disabled = true;
      await sb.from("messages").delete().eq("id", m.id);
      loadSent();
    });
    li.append(left, del);
    list.appendChild(li);
  }
}

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
    const url = new URL("./#messages", location.href).href;
    const res = await fetch("https://ntfy.sh/", {
      method: "POST",
      body: JSON.stringify({
        topic: NTFY_TOPIC, title: "Test ping", message: "Ping Nevin is working 💕", tags: ["white_check_mark"],
        click: url, actions: [{ action: "view", label: "Reply 💌", url, clear: true }],
      }),
    });
    $("pingMsg").textContent = res.ok ? "Sent! Check your phone." : "Failed: " + res.status;
  } catch (e) {
    $("pingMsg").textContent = "Failed: " + e.message;
  }
});
