// A new font set on every visit (never the same one twice in a row).
// Each set has a bold "display" font (titles, the floating label), a "script" font
// (phrases, messages, captions) and a "body" font (buttons, small text).
(function () {
  const SETS = [
    { display: "Oswald", dq: "Oswald:wght@700", script: "Dancing Script", sq: "Dancing+Script:wght@700", body: "Inter", bq: "Inter:wght@400;600" },
    { display: "Bebas Neue", dq: "Bebas+Neue", script: "Great Vibes", sq: "Great+Vibes", body: "Poppins", bq: "Poppins:wght@400;600" },
    { display: "Anton", dq: "Anton", script: "Pacifico", sq: "Pacifico", body: "Nunito", bq: "Nunito:wght@400;700" },
    { display: "Playfair Display", dq: "Playfair+Display:wght@900", script: "Parisienne", sq: "Parisienne", body: "Lato", bq: "Lato:wght@400;700" },
    { display: "Righteous", dq: "Righteous", script: "Satisfy", sq: "Satisfy", body: "Quicksand", bq: "Quicksand:wght@500;700" },
    { display: "Archivo Black", dq: "Archivo+Black", script: "Sacramento", sq: "Sacramento", body: "Work Sans", bq: "Work+Sans:wght@400;600" },
    { display: "Abril Fatface", dq: "Abril+Fatface", script: "Allura", sq: "Allura", body: "Raleway", bq: "Raleway:wght@400;700" },
    { display: "Russo One", dq: "Russo+One", script: "Kaushan Script", sq: "Kaushan+Script", body: "Montserrat", bq: "Montserrat:wght@400;600" },
    { display: "Fredoka", dq: "Fredoka:wght@700", script: "Caveat", sq: "Caveat:wght@700", body: "Fredoka", bq: "Fredoka:wght@400;600" },
    { display: "Cinzel", dq: "Cinzel:wght@900", script: "Alex Brush", sq: "Alex+Brush", body: "Josefin Sans", bq: "Josefin+Sans:wght@400;600" },
    { display: "Bungee", dq: "Bungee", script: "Cookie", sq: "Cookie", body: "Rubik", bq: "Rubik:wght@400;600" },
    { display: "Chakra Petch", dq: "Chakra+Petch:wght@700", script: "Yellowtail", sq: "Yellowtail", body: "Space Grotesk", bq: "Space+Grotesk:wght@400;600" },
  ];

  let last = -1;
  try { last = parseInt(localStorage.getItem("fontSet") ?? "-1", 10); } catch {}
  let i;
  do { i = (Math.random() * SETS.length) | 0; } while (i === last && SETS.length > 1);
  try { localStorage.setItem("fontSet", String(i)); } catch {}
  const f = SETS[i];

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${f.dq}&family=${f.sq}&family=${f.bq}&display=swap`;
  document.head.appendChild(link);

  const root = document.documentElement.style;
  root.setProperty("--font-display", `"${f.display}", Impact, sans-serif`);
  root.setProperty("--font-script", `"${f.script}", cursive`);
  root.setProperty("--font-body", `"${f.body}", system-ui, sans-serif`);

  window.FONT_SET = f;
  // Canvas text (the floating label, the placeholder puzzle) waits on these.
  window.fontsReady = Promise.all([
    document.fonts.load(`700 40px "${f.display}"`),
    document.fonts.load(`700 40px "${f.script}"`),
  ]).catch(() => {});
})();
