// ================= GALLERY + PING NEVIN =================
(function () {
  const gallery = document.getElementById("gallery");
  const stage = document.getElementById("gStage");
  const countEl = document.getElementById("gCount");
  const playBtn = document.getElementById("gPlay");
  const SLIDE_MS = 4500;

  // Each photo gets its own border style (photo #1 hearts, #2 pixel, #3 aero, ...).
  const BORDERS = [
    { cls: "f-hearts" },
    { cls: "f-pixel", cap: "LEVEL: GENIUS ♥" },
    { cls: "f-aero" },
    { cls: "f-polaroid", cap: "my favorite engineer ♥" },
    { cls: "f-film" },
    { cls: "f-neon" },
    { cls: "f-chrome" },
    { cls: "f-aggie", cap: "GIG 'EM ♥" },
    { cls: "f-tape" },
    { cls: "f-gold" },
  ];

  // A different animation between every photo.
  const EASE = "cubic-bezier(.2,.8,.2,1)";
  const TRANSITIONS = [
    { name: "fade", in: [{ opacity: 0 }, { opacity: 1 }], out: [{ opacity: 1 }, { opacity: 0 }] },
    { name: "slide", in: [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], out: [{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }] },
    { name: "zoom", in: [{ transform: "scale(.3)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], out: [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(1.5)", opacity: 0 }] },
    { name: "flip", in: [{ transform: "rotateY(-90deg)" }, { transform: "rotateY(0)" }], out: [{ transform: "rotateY(0)" }, { transform: "rotateY(90deg)" }], seq: true },
    { name: "spin", in: [{ transform: "rotate(-220deg) scale(.15)", opacity: 0 }, { transform: "rotate(0) scale(1)", opacity: 1 }], out: [{ transform: "rotate(0) scale(1)", opacity: 1 }, { transform: "rotate(220deg) scale(.15)", opacity: 0 }] },
    { name: "drop", in: [{ transform: "translateY(-120%)" }, { transform: "translateY(4%)", offset: 0.75 }, { transform: "translateY(0)" }], out: [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(120%)", opacity: 0 }] },
    { name: "blur", in: [{ filter: "blur(40px)", opacity: 0 }, { filter: "blur(0)", opacity: 1 }], out: [{ filter: "blur(0)", opacity: 1 }, { filter: "blur(40px)", opacity: 0 }] },
    { name: "circle", in: [{ clipPath: "circle(0% at 50% 50%)" }, { clipPath: "circle(80% at 50% 50%)" }], out: [{ opacity: 1 }, { opacity: 0.2 }] },
    { name: "heartbeat", in: [{ transform: "scale(0)" }, { transform: "scale(1.15)", offset: 0.6 }, { transform: "scale(.95)", offset: 0.8 }, { transform: "scale(1)" }], out: [{ transform: "scale(1)", opacity: 1 }, { transform: "scale(0)", opacity: 0 }] },
    { name: "swing", in: [{ transform: "rotateX(-100deg)", transformOrigin: "top" }, { transform: "rotateX(15deg)", transformOrigin: "top", offset: 0.7 }, { transform: "rotateX(0)", transformOrigin: "top" }], out: [{ transform: "rotateX(0)", transformOrigin: "bottom", opacity: 1 }, { transform: "rotateX(100deg)", transformOrigin: "bottom", opacity: 0 }] },
    { name: "curtain", in: [{ clipPath: "inset(0 50% 0 50%)" }, { clipPath: "inset(0 0% 0 0%)" }], out: [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(50% 0 50% 0)" }] },
  ];

  let photos = [];
  let index = 0;
  let current = null;
  let lastTransition = -1;
  let timer = null;
  let playing = true;
  let busy = false;

  document.getElementById("galleryBtn").addEventListener("click", open);
  document.getElementById("gClose").addEventListener("click", close);
  document.getElementById("gNext").addEventListener("click", () => go(1, true));
  document.getElementById("gPrev").addEventListener("click", () => go(-1, true));
  playBtn.addEventListener("click", () => {
    playing = !playing;
    playBtn.textContent = playing ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
    schedule();
  });
  document.addEventListener("keydown", (e) => {
    if (gallery.classList.contains("hidden")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") go(1, true);
    if (e.key === "ArrowLeft") go(-1, true);
  });
  let touchX = null;
  stage.addEventListener("pointerdown", (e) => (touchX = e.clientX));
  stage.addEventListener("pointerup", (e) => {
    if (touchX === null) return;
    const dx = e.clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1, true);
  });

  async function open() {
    gallery.classList.remove("hidden");
    gallery.setAttribute("aria-hidden", "false");
    stage.innerHTML = '<div class="g-empty">Loading photos…</div>';
    countEl.textContent = "";
    try { photos = await window.fetchPhotos(); } catch (e) { console.warn(e); photos = []; }
    stage.innerHTML = "";
    current = null;
    if (!photos.length) {
      stage.innerHTML = '<div class="g-empty">No photos yet 💕<br>Nevin is working on it.</div>';
      return;
    }
    index = 0;
    show(0, true);
  }

  function close() {
    clearTimeout(timer);
    gallery.classList.add("hidden");
    gallery.setAttribute("aria-hidden", "true");
    stage.innerHTML = "";
    current = null;
  }

  function go(step, manual) {
    if (!photos.length || busy) return;
    index = (index + step + photos.length) % photos.length;
    show(index, false);
    if (manual) schedule();
  }

  function schedule() {
    clearTimeout(timer);
    if (playing && photos.length > 1) timer = setTimeout(() => go(1, false), SLIDE_MS);
  }

  function buildSlide(i) {
    const b = BORDERS[i % BORDERS.length];
    const slide = document.createElement("div");
    slide.className = "slide";
    const frame = document.createElement("div");
    frame.className = "frame " + b.cls;
    const img = document.createElement("img");
    img.src = photos[i].url;
    img.alt = `Photo ${i + 1}`;
    img.draggable = false;
    frame.appendChild(img);
    if (b.cap) {
      const cap = document.createElement("span");
      cap.className = "cap";
      cap.textContent = b.cap;
      frame.appendChild(cap);
    }
    slide.appendChild(frame);
    return { slide, img };
  }

  async function show(i, first) {
    busy = true;
    countEl.textContent = `${i + 1} / ${photos.length}`;
    const { slide, img } = buildSlide(i);
    try { await img.decode(); } catch {}

    let t;
    do { t = (Math.random() * TRANSITIONS.length) | 0; } while (t === lastTransition && TRANSITIONS.length > 1);
    lastTransition = t;
    const tr = TRANSITIONS[t];
    const dur = 900;

    const old = current;
    current = slide;
    // Wait for an animation, but never longer than it should take (so nothing can get stuck).
    const done = (anim, ms) =>
      Promise.race([anim.finished.catch(() => {}), new Promise((r) => setTimeout(r, ms + 300))]);
    if (!(tr.seq && old && !first)) stage.appendChild(slide);
    if (first || !old) {
      await done(slide.animate(TRANSITIONS[0].in, { duration: 700, easing: EASE, fill: "both" }), 700);
    } else if (tr.seq) {
      await done(old.animate(tr.out, { duration: dur / 2, easing: "ease-in", fill: "both" }), dur / 2);
      old.remove();
      stage.appendChild(slide);
      await done(slide.animate(tr.in, { duration: dur / 2, easing: "ease-out", fill: "both" }), dur / 2);
    } else {
      const a = old.animate(tr.out, { duration: dur, easing: EASE, fill: "both" });
      const b = slide.animate(tr.in, { duration: dur, easing: EASE, fill: "both" });
      await Promise.all([done(a, dur), done(b, dur)]);
      old.remove();
    }
    // drop the finished animation so leftover transforms/clip-paths never linger
    slide.getAnimations().forEach((a) => a.cancel());
    // preload the next one
    if (photos.length > 1) new Image().src = photos[(i + 1) % photos.length].url;
    busy = false;
    schedule();
  }

  // (Ping Nevin + messages live in messages.js)
})();
