// ================= NEVIN'S LAST SONG (from YouTube Music) + BUILT-IN PLAYER =================
// The background job (.github/workflows/now-playing.yml) keeps the now_playing row up to date.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const $ = (id) => document.getElementById(id);

const card = $("song"), player = $("player"), frame = $("playerFrame");
let song = null;

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function render(row, fresh) {
  if (!row || !row.video_id) return;
  song = row;
  $("songArt").src = row.thumbnail || `https://i.ytimg.com/vi/${row.video_id}/hqdefault.jpg`;
  $("songTitle").textContent = row.title || "Untitled";
  $("songMeta").textContent = [row.artist, ago(row.changed_at)].filter(Boolean).join(" · ");
  card.classList.remove("hidden");
  if (fresh) {
    card.classList.remove("pulse");
    void card.offsetWidth; // restart the animation
    card.classList.add("pulse");
    window.showToast && window.showToast(`Nevin is listening to ${row.title}`);
  }
}

function openPlayer() {
  if (!song) return;
  $("playerTitle").textContent = song.title || "";
  $("playerArtist").textContent = [song.artist, song.album].filter(Boolean).join(" · ");
  $("playerYtm").href = `https://music.youtube.com/watch?v=${encodeURIComponent(song.video_id)}`;
  frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(song.video_id)}?autoplay=1&playsinline=1&rel=0`;
  player.classList.remove("hidden");
}
function closePlayer() {
  player.classList.add("hidden");
  frame.src = "about:blank"; // stops the music
}

card.addEventListener("click", openPlayer);
$("playerClose").addEventListener("click", closePlayer);
player.addEventListener("click", (e) => { if (e.target === player) closePlayer(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !player.classList.contains("hidden")) closePlayer(); });

async function load() {
  const { data, error } = await sb.from("now_playing").select("*").eq("id", 1).maybeSingle();
  if (error) return console.warn(error);
  render(data, false);
}

sb.channel("now-playing")
  .on("postgres_changes", { event: "*", schema: "public", table: "now_playing" }, (p) => {
    const changed = !song || p.new.video_id !== song.video_id;
    render(p.new, changed);
  })
  .subscribe();

load();
setInterval(() => song && render(song, false), 60000); // keep "x min ago" fresh
