// Shared settings for the main site and the upload (sister) site.
// The publishable key is meant to be public; security comes from the database rules.
window.APP_CONFIG = {
  SUPABASE_URL: "https://dbkfpfydvjtkusnxwchb.supabase.co",
  SUPABASE_KEY: "sb_publishable_mgfj5QzAqYDeNIxwXwR-tg_5HI9e7mh",
  BUCKET: "photos",
  // Subscribe to this exact name in the ntfy app to get "Ping Nevin" notifications.
  NTFY_TOPIC: "aissata-ping-ed4ff1a00412",
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
