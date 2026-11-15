// Shared settings for the main site and the upload (sister) site.
// The publishable key is meant to be public; security comes from the database rules.
window.APP_CONFIG = {
  SUPABASE_URL: "https://dbkfpfydvjtkusnxwchb.supabase.co",
  SUPABASE_KEY: "sb_publishable_mgfj5QzAqYDeNIxwXwR-tg_5HI9e7mh",
  BUCKET: "photos",
  // Subscribe to this exact name in the ntfy app to get "Ping Nevin" notifications.
  NTFY_TOPIC: "aissata-ping-ed4ff1a00412",
  // Public links. Every ping opens APP_URL, no matter where her site was opened from.
  SITE_URL: "https://nevinjosephtx.github.io/aissata-smartest-engineer/",
  APP_URL: "https://nevinjosephtx.github.io/aissata-smartest-engineer/admin/#messages",
};

window.fetchPhotos = async function () {
  const { SUPABASE_URL, SUPABASE_KEY, BUCKET } = window.APP_CONFIG;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/photos?select=id,path,created_at&order=created_at.asc`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error("photo list failed: " + res.status);
  const rows = await res.json();
  return rows.map((r) => ({ ...r, url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${r.path}` }));
};

// Starter phrases (used if the database can't be reached). Edit the live list in Aissata HQ > Phrases.
window.DEFAULT_PHRASES = [
  "The smartest engineer in the building",
  "Smartest girl I know",
  "Certified genius",
  "Big brain, bigger heart",
  "Top of the class, top of my world",
  "The smartest Aggie on campus",
  "Too smart for her own good",
  "Brains and beauty",
  "Future CEO",
  "NSBE VP and my MVP",
  "Problem solver extraordinaire",
  "Dean's list energy",
  "Smarter than the textbook",
  "Engineering's finest",
  "Her brain deserves its own fan club",
  "Out-thinking everyone since day one",
  "The real Einstein",
  "Galaxy brain",
  "Genius at work",
  "Calculating how cute she is... error: number too large",
  "My favorite genius",
  "Ms. Smartest Engineer",
  "Aissata, the brilliant",
  "My baby",
  "Nevin's baby",
  "Baby girl",
  "My favorite baby",
  "My sweet baby",
  "Baby, you're the one",
  "The cutest girl alive",
  "Cutest engineer in the world",
  "Too cute to function",
  "Cuteness overload",
  "Officially the cutest",
  "The cutest smile on campus",
  "Cute AND smart? Unfair",
  "Adorable on purpose",
  "Prettiest girl in every room",
  "Stunning, as usual",
  "A walking masterpiece",
  "Beautiful inside and out",
  "My favorite person",
  "My whole heart",
  "The love of my life",
  "My sunshine",
  "My favorite notification",
  "My best friend",
  "My favorite hello",
  "The best part of my day",
  "Forever my girl",
  "Mine, always",
  "My forever",
  "My happy place",
  "The one I'll always choose",
  "Smart, sweet, and all mine",
  "Queen of engineering",
  "Absolute boss",
  "Leader of the pack",
  "Main character energy",
  "Unstoppable",
  "Built different",
  "She runs the show",
  "Making history",
  "Born to lead",
  "The blueprint",
  "Aissata the Great",
  "Gig 'em, genius",
  "Maroon and beautiful",
  "Aggie excellence",
  "NSBE royalty",
  "The pride of NSBE",
  "Engineering the future",
  "Simply amazing",
  "Perfect in every way",
  "One in a billion",
  "The real MVP",
  "Elite",
  "Iconic",
  "Legendary",
  "Proud of you always"
];

// Loads the editable phrase list once and shares it (puzzle screen, gallery captions).
window.fetchPhrases = (function () {
  let cached;
  return function () {
    if (cached) return cached;
    const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
    cached = fetch(`${SUPABASE_URL}/rest/v1/phrases?select=text&order=created_at.asc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows) => {
        const list = rows.map((r) => r.text.trim()).filter(Boolean);
        return list.length ? list : window.DEFAULT_PHRASES;
      })
      .catch(() => window.DEFAULT_PHRASES);
    return cached;
  };
})();

window.shuffled = function (arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
